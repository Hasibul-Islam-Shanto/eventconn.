'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useOrganizerBooking, useOrganizerBookings, useOrganizerEvents } from './queries';
import { Badge, EmptyState, PageHeading } from '@/components/ui';
import { dateLabel, money } from '@/lib/format';
export function BookingManagement() {
  const [page, setPage] = useState(1);
  const bookingsQuery = useOrganizerBookings(page, 20);
  const eventsQuery = useOrganizerEvents({ page: 1, limit: 100 });
  const events = eventsQuery.data?.data ?? [];
  const bookings = bookingsQuery.data?.data ?? [];
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const filtered = bookings.filter(
    (booking) =>
      (!query ||
        `${booking.id} ${booking.name} ${booking.email}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!eventId || booking.eventId === eventId) &&
      (!status || booking.status === status),
  );
  const pages = bookingsQuery.data?.pagination.totalPages ?? 1;
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND THE PLANS"
        title="Every booking is a new connection."
        description="Keep track of your guests, tickets, and reservations."
      />
      <section className="panel">
        <div className="management-filters">
          <div className="input-icon">
            <Search size={17} />
            <input
              aria-label="Search bookings"
              placeholder="Search reference, guest, or email…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filter bookings by event"
            value={eventId}
            onChange={(event) => {
              setEventId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter booking status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Booking / date</th>
                <th>Customer</th>
                <th>Event / ticket</th>
                <th>Qty.</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 5, page * 5).map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Link href={`/organizer/bookings/${booking.id}`}>{booking.id}</Link>
                    <small>{dateLabel(booking.createdAt.slice(0, 10))}</small>
                  </td>
                  <td>
                    {booking.name}
                    <small>{booking.userId}</small>
                  </td>
                  <td>
                    {events.find((event) => event.id === booking.eventId)?.title}
                    <small>{booking.ticketName}</small>
                  </td>
                  <td>{booking.quantity}</td>
                  <td>{money(booking.total)}</td>
                  <td>
                    <Badge>{booking.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bookingsQuery.isPending && <p className="muted">Loading bookings…</p>}
        {bookingsQuery.isError && <p className="field-error">Bookings could not be loaded.</p>}
        {!bookingsQuery.isPending && !filtered.length && (
          <EmptyState
            title="No bookings match these filters"
            description="Try another guest name, event, or status."
          >
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setEventId('');
                setStatus('');
                setPage(1);
              }}
            >
              Reset filters
            </button>
          </EmptyState>
        )}
        <div className="pagination">
          <span>{bookingsQuery.data?.pagination.total ?? 0} bookings</span>
          <div>
            <button
              className="button secondary small"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              className="button secondary small"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function OrganizerBookingDetails({ id }: { id: string }) {
  const booking = useOrganizerBooking(id);
  const events = useOrganizerEvents({ page: 1, limit: 100 });
  if (booking.isPending) return <p>Loading booking…</p>;
  if (!booking.data)
    return (
      <EmptyState title="Booking not found">
        <Link href="/organizer/bookings" className="button">
          Back to bookings
        </Link>
      </EmptyState>
    );
  const event = events.data?.data.find((item) => item.id === booking.data?.eventId);
  return (
    <>
      <Link href="/organizer/bookings" className="text-link">
        ← All bookings
      </Link>
      <PageHeading
        eyebrow="BOOKING DETAILS"
        title={event?.title || `Event ${booking.data.eventId.slice(0, 8)}`}
        description={`Reference ${booking.data.id}`}
      >
        <Badge>{booking.data.status}</Badge>
      </PageHeading>
      <section className="panel booking-receipt">
        <p>Customer ID</p>
        <code>{booking.data.userId}</code>
        <p>
          {booking.data.quantity} × {booking.data.ticketName}
        </p>
        <div className="receipt-line">
          <span>Total</span>
          <strong>{money(booking.data.total)}</strong>
        </div>
        <div className="receipt-line">
          <span>Payment</span>
          <strong>{booking.data.paymentStatus}</strong>
        </div>
        <p className="muted">Created {dateLabel(booking.data.createdAt)}</p>
      </section>
    </>
  );
}
