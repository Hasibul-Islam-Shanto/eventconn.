import { apiClient, type PaginatedResponse, type SuccessResponse } from '@/lib/api-client';
import { mapBooking, type RawBooking } from '@/features/bookings/api';
import { mapEvent, type EventFilters, type RawEvent, type RawTicket } from '@/features/events/api';
export type EventInput = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImageUrl?: string;
  categoryId: string;
  venueId: string;
  startDateTime: string;
  endDateTime: string;
};
export type VenueInput = { name: string; address: string; city: string; timezone: string };
export type TicketInput = {
  name: string;
  description?: string;
  price: number;
  capacity: number;
  salesStartAt: string;
  salesEndAt: string;
  isActive: boolean;
};
export async function getOrganizerEvents(filters: EventFilters, signal?: AbortSignal) {
  const response = await apiClient.get<PaginatedResponse<RawEvent>>('/organizer/events', {
    query: filters,
    signal,
  });
  return { ...response, data: response.data.map(mapEvent) };
}
export async function getOrganizerEvent(id: string, signal?: AbortSignal) {
  const response = await apiClient.get<SuccessResponse<RawEvent>>(`/organizer/events/${id}`, {
    signal,
  });
  return mapEvent(response.data);
}
export const createVenue = (body: VenueInput) =>
  apiClient.post<SuccessResponse<RawEvent['venue']>>('/organizer/venues', { body });
export async function createEvent(body: EventInput) {
  const response = await apiClient.post<SuccessResponse<RawEvent>>('/organizer/events', { body });
  return mapEvent(response.data);
}
export async function updateEvent(
  id: string,
  body: Partial<EventInput> & { status?: RawEvent['status'] },
) {
  const response = await apiClient.patch<SuccessResponse<RawEvent>>(`/organizer/events/${id}`, {
    body,
  });
  return mapEvent(response.data);
}
export async function createTicketType(eventId: string, body: TicketInput) {
  return (
    await apiClient.post<SuccessResponse<RawTicket>>(`/organizer/events/${eventId}/ticket-types`, {
      body,
    })
  ).data;
}
export async function updateTicketType(
  eventId: string,
  ticketId: string,
  body: Partial<TicketInput>,
) {
  return (
    await apiClient.patch<SuccessResponse<RawTicket>>(
      `/organizer/events/${eventId}/ticket-types/${ticketId}`,
      { body },
    )
  ).data;
}
export const deleteTicketType = (eventId: string, ticketId: string) =>
  apiClient.delete<SuccessResponse<null>>(`/organizer/events/${eventId}/ticket-types/${ticketId}`);
export async function getOrganizerBookings(page: number, limit: number, signal?: AbortSignal) {
  const response = await apiClient.get<PaginatedResponse<RawBooking>>('/organizer/bookings', {
    query: { page, limit },
    signal,
  });
  return { ...response, data: response.data.map(mapBooking) };
}
export async function getOrganizerBooking(id: string, signal?: AbortSignal) {
  const response = await apiClient.get<SuccessResponse<RawBooking>>(`/organizer/bookings/${id}`, {
    signal,
  });
  return mapBooking(response.data);
}

export type CheckInInput = {
  ticketCode: string;
  qrSignature: string;
  eventId: string;
};

export type CheckInResult = {
  ticketCode: string;
  ticketName: string;
  ticketNumber: number;
  status: string;
  checkedInAt: string;
  bookingId: string;
};

export type CheckInStats = {
  total: number;
  checkedIn: number;
  remaining: number;
  recent: Array<{
    id: string;
    ticketCode: string;
    ticketName: string;
    ticketNumber: number;
    checkedInAt: string;
  }>;
};

export async function checkInTicket(body: CheckInInput) {
  return (await apiClient.post<SuccessResponse<CheckInResult>>('/organizer/check-in', { body })).data;
}

export async function getCheckInStats(eventId: string, signal?: AbortSignal) {
  return (
    await apiClient.get<SuccessResponse<CheckInStats>>(`/organizer/events/${eventId}/check-ins`, {
      signal,
    })
  ).data;
}
