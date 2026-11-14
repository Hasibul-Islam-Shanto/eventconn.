import { apiClient, type PaginatedResponse, type SuccessResponse } from '@/lib/api-client';
import type { Booking, IssuedTicket } from '@/types/domain';

export type TicketHold = {
  id: string;
  userId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  expiresAt: string;
  status: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};
export type RawBooking = Omit<
  Booking,
  'ticketId' | 'ticketName' | 'quantity' | 'unitPrice' | 'name' | 'email' | 'phone'
> & {
  currency: string;
  items: {
    id: string;
    ticketTypeId: string;
    ticketName: string;
    quantity: number;
    unitPrice: number;
  }[];
  tickets?: IssuedTicket[];
};
export function mapBooking(raw: RawBooking): Booking {
  const item = raw.items[0];
  return {
    ...raw,
    ticketId: item?.ticketTypeId ?? '',
    ticketName: item?.ticketName ?? 'Ticket',
    quantity: item?.quantity ?? 0,
    unitPrice: item?.unitPrice ?? 0,
    name: `Customer ${raw.userId.slice(0, 8)}`,
    email: '',
    phone: '',
    tickets: raw.tickets ?? [],
  };
}
export const createTicketHold = (body: {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
}) => apiClient.post<SuccessResponse<TicketHold>>('/bookings/holds', { body });
export async function createBooking(holdId: string, key: string) {
  const response = await apiClient.post<SuccessResponse<RawBooking>>('/bookings', {
    body: { holdId },
    headers: { 'Idempotency-Key': key },
  });
  return mapBooking(response.data);
}
export async function getBookings(page: number, limit: number, signal?: AbortSignal) {
  const response = await apiClient.get<PaginatedResponse<RawBooking>>('/bookings', {
    query: { page, limit },
    signal,
  });
  return { ...response, data: response.data.map(mapBooking) };
}
export async function getBooking(id: string, signal?: AbortSignal) {
  const response = await apiClient.get<SuccessResponse<RawBooking>>(`/bookings/${id}`, { signal });
  return mapBooking(response.data);
}
export async function cancelBooking(id: string) {
  const response = await apiClient.patch<SuccessResponse<RawBooking>>(`/bookings/${id}/cancel`, {
    body: {},
  });
  return mapBooking(response.data);
}
export type Payment = {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};
export const createPayment = (bookingId: string, outcome: 'SUCCEEDED' | 'FAILED', key: string) =>
  apiClient.post<SuccessResponse<Payment>>('/payments', {
    body: { bookingId, outcome },
    headers: { 'Idempotency-Key': key },
  });
