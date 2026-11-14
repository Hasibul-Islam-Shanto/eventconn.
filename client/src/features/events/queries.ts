'use client';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getEvent, getEvents, type EventFilters } from './api';

export const eventKeys = {
  all: ['events'] as const,
  lists: () => ['events', 'list'] as const,
  list: (filters: EventFilters) => ['events', 'list', filters] as const,
  details: () => ['events', 'detail'] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
};
export const categoryKeys = { all: ['categories'] as const };
export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ signal }) => getEvents(filters, signal),
    staleTime: 90_000,
    placeholderData: (previous) => previous,
  });
}
export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }) => getEvent(id, signal),
    staleTime: 90_000,
    enabled: Boolean(id),
  });
}
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 10 * 60_000,
  });
}
