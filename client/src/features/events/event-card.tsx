'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Heart, MapPin } from 'lucide-react';
import type { Event } from '@/types/domain';
import { dateLabel, money, timeLabel } from '@/lib/format';
import { useAppStore } from '@/store/use-app-store';
export function EventCard({ event }: { event: Event }) {
  const saved = useAppStore((state) => state.saved.includes(event.id));
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  return (
    <article className="event-card">
      <div className="event-image">
        <Link href={`/events/${event.id}`} tabIndex={-1} aria-hidden="true">
          <Image
            src={event.coverImage}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        </Link>
        <span className="image-category">{event.category}</span>
        <button
          className={`save-button ${saved ? 'saved' : ''}`}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${event.title}`}
          aria-pressed={saved}
          onClick={() => toggleSaved(event.id)}
        >
          <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="event-card-content">
        <div className="event-date">
          <CalendarDays size={13} />
          {dateLabel(event.date, event.venue.timezone)}
          <span>·</span>
          {timeLabel(event.startTime, event.venue.timezone)}
        </div>
        <Link href={`/events/${event.id}`}>
          <h3>{event.title}</h3>
        </Link>
        <p className="event-venue">
          <MapPin size={14} />
          {event.venue.name}, {event.city}
        </p>
        <div className="event-card-bottom">
          <span>
            {event.startingPrice === 0 ? (
              <strong>Free</strong>
            ) : (
              <>
                From <strong>{money(event.startingPrice)}</strong>
                <small> / person</small>
              </>
            )}
          </span>
          <Link href={`/events/${event.id}`} aria-label={`View ${event.title}`}>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
