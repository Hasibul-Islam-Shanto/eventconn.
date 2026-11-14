'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Ticket, Check } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Badge, EmptyState, Modal, PageHeading } from '@/components/ui';
import { dateLabel, money } from '@/lib/format';
import type { TicketType } from '@/types/domain';
import {
  useCreateTicketType,
  useDeleteTicketType,
  useOrganizerEvents,
  useUpdateTicketType,
} from './queries';

const schema = z
  .object({
    name: z.string().min(2),
    description: z.string().max(1000),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
    salesStart: z.string().min(1),
    salesEnd: z.string().min(1),
    enabled: z.boolean(),
  })
  .refine((values) => values.salesEnd > values.salesStart, {
    path: ['salesEnd'],
    message: 'Sales must end after they start.',
  });
type Values = z.infer<typeof schema>;
export function TicketManagement() {
  const eventsQuery = useOrganizerEvents({ page: 1, limit: 100 });
  const events = eventsQuery.data?.data ?? [];
  const params = useSearchParams();
  const [eventId, setEventId] = useState(params.get('event') || '');
  const [editing, setEditing] = useState<TicketType | null | undefined>();
  const [deleting, setDeleting] = useState<TicketType | null>(null);
  const create = useCreateTicketType();
  const update = useUpdateTicketType();
  const remove = useDeleteTicketType();
  const { notify } = useDemo();
  const selectedEventId = eventId || events[0]?.id || '';
  const event = events.find((item) => item.id === selectedEventId);
  return (
    <>
      <PageHeading
        eyebrow="A PLACE FOR EVERYONE"
        title="The right ticket for every guest."
        description="Set prices and capacity before publishing."
      >
        <button
          className="button"
          disabled={!event || event.status !== 'DRAFT'}
          onClick={() => setEditing(null)}
        >
          <Plus size={17} /> Add ticket type
        </button>
      </PageHeading>
      <label className="event-select">
        Select an event
        <select value={selectedEventId} onChange={(change) => setEventId(change.target.value)}>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {eventsQuery.isPending && <p>Loading events…</p>}
      <div className="ticket-management-grid">
        {event?.ticketTypes.map((ticket) => (
          <article className="panel ticket-management-card" key={ticket.id}>
            <div className="section-title compact">
              <span className="ticket-icon">
                <Ticket size={24} />
              </span>
              <Badge>{!ticket.enabled ? 'DISABLED' : 'ON SALE'}</Badge>
            </div>
            <h2>{ticket.name}</h2>
            <strong className="ticket-price">
              {money(ticket.price)}
              <small> / ticket</small>
            </strong>
            <p>Capacity: {ticket.quantity}</p>
            <div className="ticket-dates">
              <small>SALES WINDOW</small>
              <p>
                {dateLabel(ticket.salesStart)} – {dateLabel(ticket.salesEnd)}
              </p>
            </div>
            <div className="ticket-card-actions">
              <button
                className="button secondary small"
                disabled={event.status !== 'DRAFT'}
                onClick={() => setEditing(ticket)}
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                className="icon-button danger"
                disabled={event.status !== 'DRAFT'}
                aria-label={`Delete ${ticket.name}`}
                onClick={() => setDeleting(ticket)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!event?.ticketTypes.length && !eventsQuery.isPending && (
        <EmptyState
          title="Give your guests a way in."
          description="Create your first ticket type to start taking bookings."
        >
          <button className="button" onClick={() => setEditing(null)} disabled={!event}>
            Add ticket type
          </button>
        </EmptyState>
      )}
      {editing !== undefined && event && (
        <Modal
          title={editing ? 'Fine-tune this ticket.' : 'Make room for your guests.'}
          onClose={() => setEditing(undefined)}
        >
          <TicketForm
            ticket={editing}
            eventEnd={event.startTime}
            pending={create.isPending || update.isPending}
            onSave={async (values) => {
              const input = {
                name: values.name,
                description: values.description,
                price: Math.round(values.price * 100),
                capacity: values.quantity,
                salesStartAt: new Date(values.salesStart).toISOString(),
                salesEndAt: new Date(values.salesEnd).toISOString(),
                isActive: values.enabled,
              };
              if (editing)
                await update.mutateAsync({
                  eventId: selectedEventId,
                  ticketId: editing.id,
                  input,
                });
              else await create.mutateAsync({ eventId: selectedEventId, input });
              setEditing(undefined);
              notify(editing ? 'Ticket type updated.' : 'Ticket type created.');
            }}
          />
        </Modal>
      )}
      {deleting && event && (
        <Modal title="Remove this ticket type?" onClose={() => setDeleting(null)}>
          <p>{deleting.name} will no longer be available.</p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              Keep ticket
            </button>
            <button
              className="button destructive"
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync({ eventId: selectedEventId, ticketId: deleting.id });
                setDeleting(null);
                notify('Ticket type removed.');
              }}
            >
              Remove ticket
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function TicketForm({
  ticket,
  eventEnd,
  pending,
  onSave,
}: {
  ticket: TicketType | null;
  eventEnd: string;
  pending: boolean;
  onSave: (values: Values) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: ticket
      ? {
          ...ticket,
          price: ticket.price / 100,
          salesStart: new Date(ticket.salesStart).toISOString().slice(0, 16),
          salesEnd: new Date(ticket.salesEnd).toISOString().slice(0, 16),
        }
      : {
          name: '',
          description: '',
          price: 25,
          quantity: 100,
          salesStart: new Date().toISOString().slice(0, 16),
          salesEnd: new Date(eventEnd).toISOString().slice(0, 16),
          enabled: true,
        },
  });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSave(values);
        } catch (error) {
          setError('root', {
            message: error instanceof Error ? error.message : 'Ticket could not be saved.',
          });
        }
      })}
    >
      <label>
        Ticket name
        <input {...register('name')} />
        {errors.name && <small className="field-error">{errors.name.message}</small>}
      </label>
      <label>
        Description
        <textarea {...register('description')} />
      </label>
      <label>
        Price (BDT)
        <input type="number" step="0.01" min="0" {...register('price', { valueAsNumber: true })} />
      </label>
      <label>
        Capacity
        <input type="number" min="1" {...register('quantity', { valueAsNumber: true })} />
      </label>
      <label>
        Sales start
        <input type="datetime-local" {...register('salesStart')} />
      </label>
      <label>
        Sales end
        <input type="datetime-local" {...register('salesEnd')} />
        {errors.salesEnd && <small className="field-error">{errors.salesEnd.message}</small>}
      </label>
      <label className="checkbox-label">
        <input type="checkbox" {...register('enabled')} /> Active
      </label>
      {errors.root && <p className="field-error">{errors.root.message}</p>}
      <button className="button full" disabled={pending}>
        Save ticket type <Check size={17} />
      </button>
    </form>
  );
}
