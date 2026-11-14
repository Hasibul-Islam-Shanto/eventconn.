'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventKeys } from '@/features/events/queries';
import type { EventFilters } from '@/features/events/api';
import {
  createEvent,
  createTicketType,
  createVenue,
  deleteTicketType,
  getOrganizerBooking,
  getOrganizerBookings,
  getOrganizerEvent,
  getOrganizerEvents,
  updateEvent,
  updateTicketType,
  checkInTicket,
  getCheckInStats,
  type CheckInInput,
  type EventInput,
  type TicketInput,
  type VenueInput,
} from './api';
export const organizerEventKeys = {
  all: ['organizer-events'] as const,
  lists: () => ['organizer-events', 'list'] as const,
  list: (filters: EventFilters) => ['organizer-events', 'list', filters] as const,
  detail: (id: string) => ['organizer-events', 'detail', id] as const,
};
export const organizerBookingKeys = {
  all: ['organizer-bookings'] as const,
  list: (page: number, limit: number) => ['organizer-bookings', 'list', { page, limit }] as const,
  detail: (id: string) => ['organizer-bookings', 'detail', id] as const,
};
export function useOrganizerEvents(filters: EventFilters) {
  return useQuery({
    queryKey: organizerEventKeys.list(filters),
    queryFn: ({ signal }) => getOrganizerEvents(filters, signal),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}
export function useOrganizerEvent(id: string) {
  return useQuery({
    queryKey: organizerEventKeys.detail(id),
    queryFn: ({ signal }) => getOrganizerEvent(id, signal),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
export function useCreateVenue() {
  return useMutation({ mutationFn: (input: VenueInput) => createVenue(input) });
}
export function useCreateEvent() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: () => void query.invalidateQueries({ queryKey: organizerEventKeys.lists() }),
  });
}
export function useUpdateEvent() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<EventInput> & { status?: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' };
    }) => updateEvent(id, input),
    onSuccess: (event) => {
      query.setQueryData(organizerEventKeys.detail(event.id), event);
      void query.invalidateQueries({ queryKey: organizerEventKeys.lists() });
      void query.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
function invalidateTicket(query: ReturnType<typeof useQueryClient>, eventId: string) {
  void query.invalidateQueries({ queryKey: organizerEventKeys.detail(eventId) });
  void query.invalidateQueries({ queryKey: organizerEventKeys.lists() });
}
export function useCreateTicketType() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: TicketInput }) =>
      createTicketType(eventId, input),
    onSuccess: (_, variables) => invalidateTicket(query, variables.eventId),
  });
}
export function useUpdateTicketType() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      ticketId,
      input,
    }: {
      eventId: string;
      ticketId: string;
      input: Partial<TicketInput>;
    }) => updateTicketType(eventId, ticketId, input),
    onSuccess: (_, variables) => invalidateTicket(query, variables.eventId),
  });
}
export function useDeleteTicketType() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, ticketId }: { eventId: string; ticketId: string }) =>
      deleteTicketType(eventId, ticketId),
    onSuccess: (_, variables) => invalidateTicket(query, variables.eventId),
  });
}
export function useOrganizerBookings(page = 1, limit = 20) {
  return useQuery({
    queryKey: organizerBookingKeys.list(page, limit),
    queryFn: ({ signal }) => getOrganizerBookings(page, limit, signal),
    staleTime: 20_000,
    placeholderData: (previous) => previous,
  });
}
export function useOrganizerBooking(id: string) {
  return useQuery({
    queryKey: organizerBookingKeys.detail(id),
    queryFn: ({ signal }) => getOrganizerBooking(id, signal),
    enabled: Boolean(id),
    staleTime: 20_000,
  });
}

export const checkInKeys = {
  stats: (eventId: string) => ['organizer-checkin-stats', eventId] as const,
};

export function useCheckInStats(eventId: string) {
  return useQuery({
    queryKey: checkInKeys.stats(eventId),
    queryFn: ({ signal }) => getCheckInStats(eventId, signal),
    enabled: Boolean(eventId),
    refetchInterval: 5000,
  });
}

export function useCheckInTicket() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckInInput) => checkInTicket(body),
    onSuccess: (_, variables) => {
      void query.invalidateQueries({ queryKey: checkInKeys.stats(variables.eventId) });
      void query.invalidateQueries({ queryKey: organizerBookingKeys.all });
    },
  });
}
