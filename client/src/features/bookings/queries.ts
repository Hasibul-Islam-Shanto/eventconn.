'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBooking,
  createBooking,
  createPayment,
  createTicketHold,
  getBooking,
  getBookings,
} from './api';

export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => ['bookings', 'list'] as const,
  list: (page: number, limit: number) => ['bookings', 'list', { page, limit }] as const,
  details: () => ['bookings', 'detail'] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
};
export const paymentKeys = { all: ['payments'] as const };
export function useCreateTicketHold() {
  return useMutation({ mutationFn: createTicketHold });
}
export function useCreateBooking() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ holdId, idempotencyKey }: { holdId: string; idempotencyKey: string }) =>
      createBooking(holdId, idempotencyKey),
    onSuccess: (booking) => {
      query.setQueryData(bookingKeys.detail(booking.id), booking);
      void query.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
export function useMyBookings(page = 1, limit = 20) {
  return useQuery({
    queryKey: bookingKeys.list(page, limit),
    queryFn: ({ signal }) => getBookings(page, limit, signal),
    staleTime: 20_000,
    placeholderData: (previous) => previous,
  });
}
export function useBooking(id: string, poll = false) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: ({ signal }) => getBooking(id, signal),
    enabled: Boolean(id),
    staleTime: 5_000,
    refetchInterval: (query) => (poll && query.state.data?.status === 'PENDING' ? 2_000 : false),
  });
}
export function useCancelBooking() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: cancelBooking,
    onSuccess: (booking) => {
      query.setQueryData(bookingKeys.detail(booking.id), booking);
      void query.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
export function useCreatePayment() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      outcome,
      idempotencyKey,
    }: {
      bookingId: string;
      outcome: 'SUCCEEDED' | 'FAILED';
      idempotencyKey: string;
    }) => createPayment(bookingId, outcome, idempotencyKey),
    onSuccess: (_payment, variables) => {
      void query.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
    },
  });
}
