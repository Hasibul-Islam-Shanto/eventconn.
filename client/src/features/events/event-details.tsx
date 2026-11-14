'use client';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin, Clock3, ArrowLeft, Share2, Heart, Check } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { dateLabel, timeLabel } from '@/lib/format';
import { TicketSelection } from '@/features/bookings/checkout';
import { EmptyState, Badge } from '@/components/ui';
import { EventCard } from './event-card';
import { useAppStore } from '@/store/use-app-store';
import { useEvent, useEvents } from './queries';
import { ApiError } from '@/lib/api-client';
export function EventDetails({ id }: { id: string }) {
  const { notify } = useDemo();
  const eventQuery = useEvent(id);
  const relatedQuery = useEvents({ page: 1, limit: 4 });
  const event = eventQuery.data;
  const events = relatedQuery.data?.data ?? [];
  const saved = useAppStore((state) => state.saved.includes(id));
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  if (eventQuery.isPending) return <p className="container page-space">Loading event…</p>;
  if (
    eventQuery.isError &&
    (!(eventQuery.error instanceof ApiError) || eventQuery.error.status !== 404)
  )
    return (
      <div className="container page-space">
        <EmptyState
          title="This event couldn’t be loaded"
          description="Please try again in a moment."
        >
          <button className="button secondary" onClick={() => eventQuery.refetch()}>
            Try again
          </button>
        </EmptyState>
      </div>
    );
  if (!event)
    return (
      <div className="container page-space">
        <EmptyState
          title="This event couldn’t be found"
          description="There are plenty of other experiences waiting for you."
        >
          <Link className="button" href="/events">
            Explore events
          </Link>
        </EmptyState>
      </div>
    );
  return (
    <div className="container page-space">
      <div className="detail-navigation">
        <Link className="text-link" href="/events">
          <ArrowLeft size={16} /> Back to experiences
        </Link>
        <div>
          <button className="button secondary small" onClick={() => toggleSaved(id)}>
            <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Saved' : 'Save event'}
          </button>
          <button
            className="icon-button"
            aria-label="Copy event link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                notify('Event link copied. Share a good time.');
              } catch {
                notify('Copy the address from your browser to share this event.');
              }
            }}
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
      <div className="detail-cover">
        <Image
          src={event.coverImage}
          alt={event.title}
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
        />
        <Badge>{event.category}</Badge>
      </div>
      <div className="detail-grid">
        <div>
          <div className="detail-title">
            <p className="eyebrow">
              {event.category.toUpperCase()} · {event.city.toUpperCase()}
            </p>
            <h1>{event.title}</h1>
            <p>{event.shortDescription}</p>
          </div>
          <div className="event-facts">
            <div>
              <CalendarDays />
              <span>
                <strong>{dateLabel(event.date, event.venue.timezone)}</strong>
                <small>
                  {timeLabel(event.startTime, event.venue.timezone)} –{' '}
                  {timeLabel(event.endTime, event.venue.timezone)}
                </small>
              </span>
            </div>
            <div>
              <MapPin />
              <span>
                <strong>{event.venue.name}</strong>
                <small>
                  {event.venue.address}, {event.city}
                </small>
              </span>
            </div>
          </div>
          <section className="about-event">
            <h2>A little about the experience.</h2>
            {event.description.split('\n\n').map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
          <div className="host-card">
            <span className="host-avatar">g.</span>
            <div>
              <small>BROUGHT TO YOU BY</small>
              <h3>
                {event.organizer} <Check size={16} />
              </h3>
              <p>Thoughtfully curated experiences. Meaningful connections.</p>
            </div>
          </div>
          <div className="detail-note">
            <Clock3 size={18} />
            <p>
              Plans changed? Cancel a confirmed booking before the event from your booking details.
            </p>
          </div>
        </div>
        <TicketSelection event={event} />
      </div>
      <section className="section">
        <div className="section-title">
          <h2>Keep the good plans going.</h2>
          <Link href="/events" className="text-link">
            More experiences →
          </Link>
        </div>
        <div className="event-grid">
          {events
            .filter((item) => item.id !== id && item.status === 'PUBLISHED')
            .slice(0, 3)
            .map((item) => (
              <EventCard event={item} key={item.id} />
            ))}
        </div>
      </section>
    </div>
  );
}
