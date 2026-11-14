import { apiClient, type PaginatedResponse, type SuccessResponse } from '@/lib/api-client';
import type { Event } from '@/types/domain';

export type EventFilters = {
  search?: string;
  category?: string;
  city?: string;
  date?: string;
  status?: Event['status'];
  page?: number;
  limit?: number;
};
export type Category = { id: string; name: string; slug: string };
export type RawTicket = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  salesStartAt: string;
  salesEndAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type RawEvent = {
  id: string;
  organizerId: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string | null;
  categoryId: string;
  venueId: string;
  startDateTime: string;
  endDateTime: string;
  status: Event['status'];
  createdAt: string;
  updatedAt: string;
  category: Category;
  venue: { id: string; name: string; address: string; city: string; timezone: string };
  ticketTypes: RawTicket[];
};

export function mapEvent(raw: RawEvent): Event {
  const active = raw.ticketTypes.filter((ticket) => ticket.isActive);
  return {
    id: raw.id,
    organizerId: raw.organizerId,
    title: raw.title,
    slug: raw.slug,
    shortDescription: raw.shortDescription,
    description: raw.description,
    coverImage: raw.coverImageUrl || '/og.png',
    categoryId: raw.categoryId,
    category: raw.category.name,
    venueId: raw.venueId,
    date: raw.startDateTime,
    startTime: raw.startDateTime,
    endTime: raw.endDateTime,
    venue: raw.venue,
    city: raw.venue.city,
    organizer: `Organizer ${raw.organizerId.slice(0, 8)}`,
    ticketTypes: raw.ticketTypes.map((ticket) => ({
      id: ticket.id,
      name: ticket.name,
      description: ticket.description,
      price: ticket.price,
      quantity: ticket.capacity,
      enabled: ticket.isActive,
      salesStart: ticket.salesStartAt,
      salesEnd: ticket.salesEndAt,
    })),
    startingPrice: active.length ? Math.min(...active.map((ticket) => ticket.price)) : 0,
    availability: active.reduce((sum, ticket) => sum + ticket.capacity, 0),
    featured: false,
    status: raw.status,
  };
}

export async function getEvents(filters: EventFilters, signal?: AbortSignal) {
  const response = await apiClient.get<PaginatedResponse<RawEvent>>('/events', {
    query: filters,
    signal,
  });
  return { ...response, data: response.data.map(mapEvent) };
}
export async function getEvent(id: string, signal?: AbortSignal) {
  const response = await apiClient.get<SuccessResponse<RawEvent>>(`/events/${id}`, { signal });
  return mapEvent(response.data);
}
export const getCategories = (signal?: AbortSignal) =>
  apiClient.get<SuccessResponse<Category[]>>('/categories', { signal });
