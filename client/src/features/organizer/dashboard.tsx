'use client';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Ticket, DollarSign, Clock3, Plus } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/queries';
import { useOrganizerBookings, useOrganizerEvents } from './queries';
import { dateLabel, money } from '@/lib/format';
import { Badge, PageHeading } from '@/components/ui';
export function Dashboard() {
  const { data: user } = useCurrentUser();
  const eventsQuery = useOrganizerEvents({ page: 1, limit: 100 });
  const bookingsQuery = useOrganizerBookings(1, 100);
  const events = eventsQuery.data?.data ?? [];
  const bookings = bookingsQuery.data?.data ?? [];
  const paid = bookings.filter(
    (booking) => booking.status === 'CONFIRMED' || booking.status === 'COMPLETED',
  );
  const upcoming = events.filter(
    (event) => event.status === 'PUBLISHED' && new Date(event.date) > new Date(),
  );
  const stats = [
    {
      label: 'Total events',
      value: events.length,
      icon: CalendarDays,
      note: 'Ideas brought to life',
    },
    {
      label: 'Upcoming events',
      value: upcoming.length,
      icon: Clock3,
      note: 'Good things on the horizon',
    },
    {
      label: 'Tickets sold',
      value: paid.reduce((sum, booking) => sum + booking.quantity, 0),
      icon: Ticket,
      note: 'People coming together',
    },
    {
      label: 'Total revenue',
      value: money(paid.reduce((sum, booking) => sum + booking.total, 0)),
      icon: DollarSign,
      note: 'From confirmed bookings',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="LET’S MAKE SOMETHING HAPPEN"
        title={`Welcome back, ${(user?.name || 'Organizer').split(' ')[0]}.`}
        description="Here’s what’s happening in your little corner of EventConn."
      >
        <Link className="button" href="/organizer/events/new">
          <Plus size={17} /> Create event
        </Link>
      </PageHeading>
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <section className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title compact">
            <h2>Upcoming experiences</h2>
            <Link className="text-link" href="/organizer/events">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
          {upcoming.slice(0, 4).map((event) => (
            <div className="upcoming-row" key={event.id}>
              <div className="date-tile">
                <span>
                  {new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                  })}
                </span>
                <strong>{new Date(event.date).getDate()}</strong>
              </div>
              <div>
                <Link href={`/organizer/events/${event.id}/edit`}>
                  <h3>{event.title}</h3>
                </Link>
                <p>
                  {event.venue.name} · {event.city}
                </p>
              </div>
              <Badge>{event.status}</Badge>
            </div>
          ))}
          {!upcoming.length && (
            <p className="muted">Your next event starts with an idea. Create one above.</p>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">SMALL MOMENTS. REAL IMPACT.</p>
          <h2>Event performance</h2>
          <p className="muted">Confirmed tickets by experience.</p>
          <div className="performance-list">
            {events.slice(0, 4).map((event) => {
              const sold = paid
                .filter((booking) => booking.eventId === event.id)
                .reduce((sum, booking) => sum + booking.quantity, 0);
              return (
                <div key={event.id}>
                  <div>
                    <span>{event.title}</span>
                    <strong>{sold}</strong>
                  </div>
                  <progress
                    max={Math.max(
                      10,
                      ...events.map((item) =>
                        paid
                          .filter((booking) => booking.eventId === item.id)
                          .reduce((sum, booking) => sum + booking.quantity, 0),
                      ),
                    )}
                    value={sold}
                    aria-label={`${sold} tickets sold for ${event.title}`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-title compact">
          <h2>Recent bookings</h2>
          <Link href="/organizer/bookings" className="text-link">
            All bookings <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Experience</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 5).map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Link href={`/organizer/bookings/${booking.id}`}>{booking.id}</Link>
                  </td>
                  <td>{booking.name}</td>
                  <td>{events.find((event) => event.id === booking.eventId)?.title}</td>
                  <td>{dateLabel(booking.createdAt)}</td>
                  <td>{money(booking.total)}</td>
                  <td>
                    <Badge>{booking.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
