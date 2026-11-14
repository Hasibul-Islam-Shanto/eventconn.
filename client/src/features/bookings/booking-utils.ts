import type { Booking, Event, TicketType } from '@/types/domain';

export function isTicketOnSale(ticket: TicketType, now = new Date()): boolean {
  return ticket.enabled && new Date(ticket.salesStart) <= now && new Date(ticket.salesEnd) > now;
}

export function canCancelBooking(booking: Booking, event: Event, now = new Date()): boolean {
  return booking.status === 'PENDING' && new Date(event.startTime) > now;
}
