'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Ticket, Download, QrCode } from 'lucide-react';
import { dateLabel, money } from '@/lib/format';
import { Badge, EmptyState, Modal, PageHeading } from '@/components/ui';
import { QRCodeImage } from '@/components/qr-code';
import { useCurrentUser } from '@/features/auth/queries';
import { useEvents, useEvent } from '@/features/events/queries';
import { useBooking, useCancelBooking, useMyBookings } from './queries';
import { useDemo } from '@/components/demo-provider';

export function BookingsPage() {
  const [tab, setTab] = useState('Upcoming');
  const [page, setPage] = useState(1);
  const bookingsQuery = useMyBookings(page, 20);
  const eventsQuery = useEvents({ page: 1, limit: 100 });
  const events = eventsQuery.data?.data ?? [];
  const filtered = (bookingsQuery.data?.data ?? []).filter((booking) =>
    tab === 'Cancelled'
      ? booking.status === 'CANCELLED'
      : tab === 'Past'
        ? booking.status === 'COMPLETED'
        : booking.status === 'CONFIRMED' || booking.status === 'PENDING',
  );
  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="YOUR GOOD TIMES, ALL TOGETHER"
        title="Plans worth looking forward to."
        description="Your tickets, your memories, your next adventure."
      >
        <Link href="/events" className="button secondary">
          Find an experience <ArrowUpRight size={17} />
        </Link>
      </PageHeading>
      <div className="tabs">
        {['Upcoming', 'Past', 'Cancelled'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {bookingsQuery.isPending ? (
        <p className="muted">Loading your bookings…</p>
      ) : bookingsQuery.isError ? (
        <EmptyState title="Bookings are unavailable" description="Please try again.">
          <button className="button" onClick={() => bookingsQuery.refetch()}>
            Try again
          </button>
        </EmptyState>
      ) : (
        <div className="booking-list">
          {filtered.map((booking) => {
            const event = events.find((item) => item.id === booking.eventId);
            return (
              <article className="booking-card" key={booking.id}>
                <div className="booking-card-copy">
                  <Badge>{booking.status}</Badge>
                  <h2>{event?.title || `Event ${booking.eventId.slice(0, 8)}`}</h2>
                  <p>
                    <CalendarDays size={15} />
                    Booked {dateLabel(booking.createdAt)}
                  </p>
                  <small>
                    {booking.quantity} {booking.quantity === 1 ? 'ticket' : 'tickets'} ·{' '}
                    {booking.ticketName} · {booking.id}
                  </small>
                </div>
                <Link className="button secondary" href={`/bookings/${booking.id}`}>
                  View booking <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      )}
      {!bookingsQuery.isPending && !filtered.length && (
        <EmptyState
          title={
            tab === 'Upcoming'
              ? 'Your calendar has room for something good.'
              : `No ${tab.toLowerCase()} bookings`
          }
          description="Your bookings will appear here when their status changes."
        >
          <Link className="button" href="/events">
            Explore events <ArrowRight size={16} />
          </Link>
        </EmptyState>
      )}
      {bookingsQuery.data && bookingsQuery.data.pagination.totalPages > 1 && (
        <div className="pagination">
          <span>{bookingsQuery.data.pagination.total} bookings</span>
          <div>
            <button
              className="button secondary small"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {bookingsQuery.data.pagination.totalPages}
            </span>
            <button
              className="button secondary small"
              disabled={page >= bookingsQuery.data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingDetails({ id }: { id: string }) {
  const bookingQuery = useBooking(id, true);
  const eventQuery = useEvent(bookingQuery.data?.eventId ?? '');
  const current = useCurrentUser();
  const cancelMutation = useCancelBooking();
  const { notify } = useDemo();
  const [cancel, setCancel] = useState(false);
  const booking = bookingQuery.data;
  const event = eventQuery.data;
  if (bookingQuery.isPending) return <p className="container page-space">Loading booking…</p>;
  if (!booking)
    return (
      <div className="container page-space">
        <EmptyState title="Booking not found">
          <Link href="/bookings" className="button">
            Back to bookings
          </Link>
        </EmptyState>
      </div>
    );
  function download() {
    const content = `EVENTCONN BOOKING\n${booking!.id}\n${event?.title || booking!.eventId}\n${booking!.quantity} x ${booking!.ticketName}\nTotal: ${money(booking!.total)}\nStatus: ${booking!.status}\nThis is a mock credential.`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${booking!.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="container page-space">
      <Link href="/bookings" className="text-link">
        <ArrowLeft size={16} /> My bookings
      </Link>
      <PageHeading
        eyebrow="YOUR EXPERIENCE, READY WHEN YOU ARE"
        title={
          booking.status === 'PENDING'
            ? 'Your booking is being confirmed.'
            : 'Your booking details.'
        }
        description={`Booking reference: ${booking.id}`}
      >
        <Badge>{booking.status}</Badge>
      </PageHeading>
      <div className="detail-grid">
        <section className="panel">
          <h2>{event?.title || `Event ${booking.eventId}`}</h2>
          {event && (
            <>
              <p>{dateLabel(event.date, event.venue.timezone)}</p>
              <p className="muted">
                {event.venue.name} · {event.venue.address}, {event.city}
              </p>
              <Link href={`/events/${event.id}`} className="text-link">
                View event details <ArrowRight size={16} />
              </Link>
            </>
          )}
          <hr />
          <h3>Account</h3>
          <p>
            {current.data?.name}
            <br />
            {current.data?.email}
          </p>
        </section>
        <aside className="panel booking-receipt">
          <Ticket size={30} />
          <h2>Your ticket</h2>
          <p>
            {booking.quantity} × {booking.ticketName}
          </p>
          <div className="receipt-line">
            <span>Unit price</span>
            <strong>{money(booking.unitPrice)}</strong>
          </div>
          <div className="receipt-line">
            <span>Service fee</span>
            <strong>{money(booking.fees)}</strong>
          </div>
          <div className="total-line">
            <span>Total</span>
            <strong>{money(booking.total)}</strong>
          </div>
          <Badge>
            {booking.paymentStatus === 'SUCCEEDED'
              ? 'Payment complete'
              : booking.paymentStatus === 'PENDING'
                ? 'Payment pending'
                : 'Payment closed'}
          </Badge>
          {booking.status === 'PENDING' && (
            <p className="demo-note">Waiting for Booking Service confirmation…</p>
          )}
          <button className="button full secondary" onClick={download}>
            <Download size={17} /> Download booking
          </button>
          {booking.status === 'PENDING' && (
            <button className="text-button danger" onClick={() => setCancel(true)}>
              Cancel booking
            </button>
          )}
        </aside>
      </div>

      {booking.status === 'CONFIRMED' && (
        <section className="panel" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem' }}>
                <QrCode size={22} className="text-sky-500" /> Digital Admission Passes ({booking.tickets?.length || booking.quantity})
              </h2>
              <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                Present each QR code at the venue gate for check-in. Codes are cryptographically signed.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {booking.tickets && booking.tickets.length > 0 ? (
              booking.tickets.map((t) => {
                const qrPayload = JSON.stringify({
                  code: t.ticketCode,
                  sig: t.qrSignature,
                  eventId: t.eventId,
                });
                const isUsed = t.status === 'CHECKED_IN';
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      border: isUsed ? '1px dashed #94a3b8' : '1px solid rgba(56, 189, 248, 0.4)',
                      background: isUsed ? 'rgba(148, 163, 184, 0.05)' : 'rgba(56, 189, 248, 0.03)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        Pass #{t.ticketNumber} · {t.ticketName}
                      </span>
                      <Badge>{isUsed ? 'CHECKED IN' : 'VALID'}</Badge>
                    </div>

                    <div style={{ margin: '0.25rem 0', opacity: isUsed ? 0.35 : 1 }}>
                      <QRCodeImage value={qrPayload} size={160} />
                    </div>

                    <div
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(0,0,0,0.06)',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {t.ticketCode}
                    </div>

                    {isUsed && t.checkedInAt && (
                      <small className="muted" style={{ fontSize: '0.75rem' }}>
                        Admitted at {new Date(t.checkedInAt).toLocaleTimeString()}
                      </small>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 600 }}>{booking.ticketName} (Pass)</span>
                <QRCodeImage
                  value={JSON.stringify({ code: booking.id, eventId: booking.eventId })}
                  size={160}
                />
                <div style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                  {booking.id.slice(0, 16)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {cancel && (
        <Modal title="Cancel this plan?" onClose={() => setCancel(false)}>
          <p>Your pending booking will be cancelled and its inventory released.</p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setCancel(false)}>
              Keep my booking
            </button>
            <button
              className="button destructive"
              disabled={cancelMutation.isPending}
              onClick={async () => {
                await cancelMutation.mutateAsync(id);
                setCancel(false);
                notify('Booking cancelled.');
              }}
            >
              Yes, cancel booking
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
