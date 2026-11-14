export type Role = 'CUSTOMER' | 'ORGANIZER';
export type EventCategory = string;
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export interface Customer {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
export type Organizer = Customer;
export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  timezone: string;
}
export interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  enabled: boolean;
  salesStart: string;
  salesEnd: string;
  description: string;
}
export interface Event {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImage: string;
  categoryId: string;
  venueId: string;
  organizerId: string;
  category: EventCategory;
  date: string;
  startTime: string;
  endTime: string;
  venue: Venue;
  city: string;
  organizer: string;
  ticketTypes: TicketType[];
  startingPrice: number;
  availability: number;
  featured: boolean;
  status: EventStatus;
}
export interface IssuedTicket {
  id: string;
  bookingId: string;
  eventId: string;
  organizerId: string;
  ticketTypeId: string;
  ticketName: string;
  ticketNumber: number;
  ticketCode: string;
  qrSignature: string;
  status: 'VALID' | 'CHECKED_IN' | 'CANCELLED';
  checkedInAt: string | null;
  checkedInBy: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  eventId: string;
  ticketId: string;
  ticketName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: BookingStatus;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  userId: string;
  organizerId: string;
  subtotal: number;
  fees: number;
  paymentStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  expiresAt: string;
  tickets?: IssuedTicket[];
}
