import type {
  PrismaClient,
  Prisma,
  Event,
  TicketType,
} from "../../../generated/client/index.js";
import { z } from "zod";
import { assert } from "../../../../../packages/config/src/http.js";
import type {
  TicketSnapshot,
  Publisher,
} from "../../../../../packages/shared-types/src/index.js";
import { eventMessage } from "../../../../../packages/shared-types/src/index.js";
import {
  eventInput,
  eventPatch,
  eventQuery,
  ticketInput,
} from "./event.validation.js";
const include = { venue: true, category: true, ticketTypes: true } as const;
export class EventService {
  constructor(
    private db: PrismaClient,
    private syncInventory: (
      ticket: TicketSnapshot,
      requestId: string,
    ) => Promise<void>,
    private publish: Publisher,
  ) {}
  async own(id: string, userId: string) {
    const event = await this.db.event.findUnique({ where: { id }, include });
    assert(event, 404, "EVENT_NOT_FOUND", "Event not found");
    assert(
      event.organizerId === userId,
      403,
      "FORBIDDEN",
      "Event belongs to another organizer",
    );
    return event;
  }
  validateDates(start: Date, end: Date) {
    assert(start < end, 400, "INVALID_DATES", "Event end must be after start");
  }
  snapshot(event: Event, ticket: TicketType): TicketSnapshot {
    return {
      id: ticket.id,
      eventId: event.id,
      organizerId: event.organizerId,
      name: ticket.name,
      price: ticket.price,
      capacity: ticket.capacity,
      isActive: ticket.isActive,
      eventStatus: event.status,
      salesStartAt: ticket.salesStartAt.toISOString(),
      salesEndAt: ticket.salesEndAt.toISOString(),
    };
  }
  async create(userId: string, input: z.infer<typeof eventInput>) {
    this.validateDates(input.startDateTime, input.endDateTime);
    assert(
      input.startDateTime > new Date(),
      400,
      "INVALID_DATES",
      "Event must start in the future",
    );
    const { coverImageUrl, ...required } = input;
    return this.db.event.create({
      data: {
        ...required,
        ...(coverImageUrl ? { coverImageUrl } : {}),
        organizerId: userId,
      },
      include,
    });
  }
  async patch(
    id: string,
    userId: string,
    input: z.infer<typeof eventPatch>,
    correlationId: string,
  ) {
    const event = await this.own(id, userId);
    const next = input.status ?? event.status;
    const transitions: Record<string, string[]> = {
      DRAFT: ["DRAFT", "PUBLISHED", "CANCELLED"],
      PUBLISHED: ["PUBLISHED", "COMPLETED", "CANCELLED"],
      COMPLETED: ["COMPLETED"],
      CANCELLED: ["CANCELLED"],
    };
    assert(
      transitions[event.status]?.includes(next),
      409,
      "INVALID_TRANSITION",
      "Invalid event status transition",
    );
    const { status: _status, ...edits } = input;
    assert(
      event.status === "DRAFT" || Object.keys(edits).length === 0,
      409,
      "EVENT_LOCKED",
      "Published event definitions are immutable",
    );
    this.validateDates(
      input.startDateTime ?? event.startDateTime,
      input.endDateTime ?? event.endDateTime,
    );
    if (next === "PUBLISHED") {
      assert(
        event.ticketTypes.some((t) => t.isActive),
        409,
        "NO_TICKETS",
        "Add an active ticket type before publication",
      );
      assert(
        event.startDateTime > new Date(),
        409,
        "EVENT_STARTED",
        "Cannot publish an event that has started",
      );
    }
    if (next === "COMPLETED")
      assert(
        event.endDateTime <= new Date(),
        409,
        "EVENT_NOT_ENDED",
        "Event has not ended",
      );
    // Sync before publication; booking always rechecks the live catalog, so a partial sync cannot enable a draft event.
    for (const ticket of event.ticketTypes)
      assert(
        ticket.salesEndAt <= (input.startDateTime ?? event.startDateTime),
        400,
        "INVALID_SALES_PERIOD",
        "Ticket sales must end by the event start",
      );
    const prospective = { ...event, status: next };
    if (next !== event.status || next === "PUBLISHED")
      for (const ticket of event.ticketTypes)
        await this.syncInventory(
          this.snapshot(prospective, ticket),
          correlationId,
        );
    const data = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    ) as Prisma.EventUpdateInput;
    const updated = await this.db.event.update({
      where: { id, updatedAt: event.updatedAt },
      data,
      include,
    });
    if (next === "PUBLISHED" && event.status !== "PUBLISHED")
      await this.publish(
        eventMessage("event.published", { eventId: id }, correlationId),
      );
    return updated;
  }
  async remove(id: string, userId: string) {
    const event = await this.own(id, userId);
    assert(
      event.status === "DRAFT",
      409,
      "EVENT_LOCKED",
      "Only draft events can be deleted",
    );
    const deleted = await this.db.event.deleteMany({
      where: { id, status: "DRAFT", updatedAt: event.updatedAt },
    });
    assert(
      deleted.count === 1,
      409,
      "EVENT_CHANGED",
      "Event changed; reload and retry",
    );
  }
  async ticket(
    id: string,
    userId: string,
    input: z.infer<typeof ticketInput>,
    ticketId?: string,
  ) {
    const event = await this.own(id, userId);
    assert(
      event.status === "DRAFT",
      409,
      "EVENT_LOCKED",
      "Ticket definitions are immutable after publication",
    );
    assert(
      input.salesStartAt < input.salesEndAt &&
        input.salesEndAt <= event.startDateTime,
      400,
      "INVALID_SALES_PERIOD",
      "Sales must end after they start and by the event start",
    );
    return this.db.$transaction(async (tx) => {
      const locked = await tx.event.updateMany({
        where: { id, status: "DRAFT", updatedAt: event.updatedAt },
        data: { updatedAt: new Date() },
      });
      assert(
        locked.count === 1,
        409,
        "EVENT_CHANGED",
        "Event changed; reload and retry",
      );
      if (ticketId) {
        assert(
          event.ticketTypes.some((t) => t.id === ticketId),
          404,
          "TICKET_NOT_FOUND",
          "Ticket type not found",
        );
        return tx.ticketType.update({ where: { id: ticketId }, data: input });
      }
      return tx.ticketType.create({ data: { ...input, eventId: id } });
    });
  }
  async deleteTicket(id: string, userId: string, ticketId: string) {
    const event = await this.own(id, userId);
    assert(
      event.status === "DRAFT",
      409,
      "EVENT_LOCKED",
      "Ticket definitions are immutable after publication",
    );
    assert(
      event.ticketTypes.some((t) => t.id === ticketId),
      404,
      "TICKET_NOT_FOUND",
      "Ticket type not found",
    );
    await this.db.$transaction(async (tx) => {
      const locked = await tx.event.updateMany({
        where: { id, status: "DRAFT", updatedAt: event.updatedAt },
        data: { updatedAt: new Date() },
      });
      assert(
        locked.count === 1,
        409,
        "EVENT_CHANGED",
        "Event changed; reload and retry",
      );
      await tx.ticketType.delete({ where: { id: ticketId } });
    });
  }
  async list(query: z.infer<typeof eventQuery>, organizerId?: string) {
    const where: Prisma.EventWhereInput = {
      ...(organizerId
        ? { organizerId, ...(query.status ? { status: query.status } : {}) }
        : { status: "PUBLISHED" }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.city
        ? { venue: { city: { equals: query.city, mode: "insensitive" } } }
        : {}),
      ...(query.date
        ? {
            startDateTime: {
              gte: new Date(query.date),
              lt: new Date(new Date(query.date).getTime() + 86400000),
            },
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.event.findMany({
        where,
        include,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ startDateTime: "asc" }, { id: "asc" }],
      }),
      this.db.event.count({ where }),
    ]);
    return { data, total };
  }
  async detail(id: string) {
    const event = await this.db.event.findFirst({
      where: { id, status: "PUBLISHED" },
      include,
    });
    assert(event, 404, "EVENT_NOT_FOUND", "Event not found");
    return event;
  }
  async trustedTicket(id: string) {
    const ticket = await this.db.ticketType.findUnique({
      where: { id },
      include: { event: true },
    });
    assert(ticket, 404, "TICKET_NOT_FOUND", "Ticket type not found");
    return this.snapshot(ticket.event, ticket);
  }
}
