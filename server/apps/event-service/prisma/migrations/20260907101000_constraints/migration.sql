ALTER TABLE "Event" ADD CONSTRAINT "event_dates" CHECK ("endDateTime" > "startDateTime");
ALTER TABLE "TicketType" ADD CONSTRAINT "ticket_definition" CHECK ("price" >= 0 AND "capacity" > 0 AND "salesEndAt" > "salesStartAt");
