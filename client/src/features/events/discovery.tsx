'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  MapPin,
  Music2,
  Cpu,
  Palette,
  Utensils,
  BriefcaseBusiness,
  Flower2,
  Trophy,
  Users,
  SlidersHorizontal,
  Ticket,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { photo } from '@/mocks/data';
import { useEvents, useCategories } from './queries';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAppStore } from '@/store/use-app-store';
import { EventCard } from './event-card';
import { EmptyState, Modal, PageHeading } from '@/components/ui';
const categoryIcons = [Music2, Cpu, Palette, Utensils, BriefcaseBusiness, Flower2, Trophy, Users];
export function HomeDiscovery() {
  const eventQuery = useEvents({ page: 1, limit: 6 });
  const categoryQuery = useCategories();
  const events = eventQuery.data?.data ?? [];
  const categories = categoryQuery.data?.data ?? [];
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-line" />
            LESS SCROLLING. MORE LIVING.
          </p>
          <h1>
            Make room for
            <br />a little <span>more life.</span>
          </h1>
          <p className="hero-description">
            The live music. The big ideas. The unexpected connections.
            <br className="desktop-break" /> Find events worth showing up for.
          </p>
          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(
                `/events?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`,
              );
            }}
          >
            <div className="search-text">
              <Search size={19} />
              <input
                aria-label="Search events"
                placeholder="What are you into?"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="search-location">
              <MapPin size={17} />
              <input
                aria-label="Choose location"
                placeholder="Any city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <button className="button" type="submit">
              Explore <ArrowUpRight size={17} />
            </button>
          </form>
          <div className="hero-proof">
            <div className="avatar-stack">
              {[
                'photo-1534528741775-53994a69daeb',
                'photo-1500648767791-00dcc994a43e',
                'photo-1506794778202-cad84cf45f1d',
              ].map((id, index) => (
                <Image
                  key={id}
                  src={photo(id)}
                  width={32}
                  height={32}
                  alt={`EventConn community member ${index + 1}`}
                />
              ))}
            </div>
            <p>
              Join <strong>12,000+</strong> people making plans that matter.
            </p>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            className="hero-photo"
            priority
            src="/hero-tech.webp"
            alt="Tech conference keynote with dynamic LED displays, atmospheric lighting, and attendees"
            fill
            sizes="(max-width: 800px) 100vw, 45vw"
          />
          <div className="hero-photo-shade" />
          <span className="hero-image-label">
            <span /> MOMENTS &gt; THINGS
          </span>
          <div className="hero-image-caption">
            <span>OUT THERE IS YOUR NEXT GREAT MEMORY.</span>
            <p>Be part of something.</p>
          </div>
          <Link href={events[0] ? `/events/${events[0].id}` : '/events'} className="floating-event">
            <div className="date-tile">
              <span>OCT</span>
              <strong>17</strong>
            </div>
            <div>
              <small>YOUR NEXT SATURDAY NIGHT</small>
              <strong>{events[0]?.title || 'Find your next experience'}</strong>
              <span>
                <MapPin size={12} /> {events[0]?.venue.name || 'Explore EventConn'}
              </span>
            </div>
            <span className="circle-arrow">
              <ArrowUpRight size={20} />
            </span>
          </Link>
        </div>
      </section>
      <section className="category-section">
        <div className="container">
          <div className="section-title compact">
            <h2>Find your kind of thing.</h2>
            <span>A little something for everyone.</span>
          </div>
          <div className="category-grid">
            {categoryQuery.isPending && <p className="muted">Loading categories…</p>}
            {categories.map((category, index) => {
              const Icon = categoryIcons[index % categoryIcons.length] ?? Ticket;
              return (
                <Link
                  href={`/events?category=${encodeURIComponent(category.slug)}`}
                  key={category.id}
                  className="category-item"
                >
                  <span>
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <strong>{category.name}</strong>
                  <ChevronRight size={13} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-title">
          <div>
            <p className="eyebrow">THE GOOD STUFF, HANDPICKED</p>
            <h2>Worth putting on your calendar.</h2>
            <p>Standout experiences. A few new favorites waiting to happen.</p>
          </div>
          <Link className="text-link" href="/events">
            Explore all events <ArrowRight size={17} />
          </Link>
        </div>
        <div className="event-grid">
          {eventQuery.isPending && <p className="muted">Loading experiences…</p>}
          {eventQuery.isError && (
            <EmptyState title="Experiences are unavailable">
              <button className="button secondary" onClick={() => eventQuery.refetch()}>
                Try again
              </button>
            </EmptyState>
          )}
          {events.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
      <section className="container">
        <div className="editorial-banner">
          <div>
            <p className="eyebrow">GOOD COMPANY. GREAT EXPERIENCES.</p>
            <h2>
              Your people are out there.
              <br />
              Go find them.
            </h2>
            <p>Turn “we should do something” into a plan.</p>
            <Link className="button" href="/events">
              Find your next experience <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="banner-image">
            <Image
              src={photo('photo-1511632765486-a01980e01a18')}
              alt="Friends sharing a relaxed outdoor gathering"
              fill
              sizes="(max-width: 640px) 100vw, 45vw"
            />
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-title">
          <div>
            <p className="eyebrow">SOMETHING TO LOOK FORWARD TO</p>
            <h2>Coming up around you.</h2>
          </div>
          <Link className="text-link" href="/events?sort=date">
            See what’s next <ArrowRight size={17} />
          </Link>
        </div>
        <div className="event-grid">
          {events.slice(3, 6).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
      <div className="container benefits">
        {[
          [Ticket, 'Less hassle. More happening.', 'Find it, book it, and you’re in.'],
          [
            ShieldCheck,
            'Great hosts. Real experiences.',
            'Thoughtfully curated, locally connected.',
          ],
          [Sparkles, 'Your plans, in your pocket.', 'All your tickets. One happy place.'],
        ].map(([Icon, title, description]) => {
          const BenefitIcon = Icon as typeof Ticket;
          return (
            <div key={String(title)}>
              <BenefitIcon size={23} />
              <div>
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
export function ExploreEvents() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [city, setCity] = useState(params.get('city') || '');
  const [date, setDate] = useState(params.get('date') || '');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState(params.get('sort') || 'recommended');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [mobileFilters, setMobileFilters] = useState(false);
  const saved = useAppStore((state) => state.saved);
  const debouncedQuery = useDebouncedValue(query);
  const { data: categoryResponse } = useCategories();
  const eventQuery = useEvents({ search: debouncedQuery, category, city, date, page, limit: 12 });
  const events = eventQuery.data?.data ?? [];
  const pagination = eventQuery.data?.pagination;
  const filtered = (
    savedOnly ? events.filter((event) => saved.includes(event.id)) : [...events]
  ).sort((first, second) =>
    sort === 'low'
      ? first.startingPrice - second.startingPrice
      : sort === 'high'
        ? second.startingPrice - first.startingPrice
        : first.date.localeCompare(second.date),
  );
  const updateUrl = (nextPage = 1) => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (category) next.set('category', category);
    if (city) next.set('city', city);
    if (date) next.set('date', date);
    if (sort !== 'recommended') next.set('sort', sort);
    if (nextPage > 1) next.set('page', String(nextPage));
    router.replace(`/events${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const reset = () => {
    setQuery('');
    setCategory('');
    setCity('');
    setDate('');
    setSavedOnly(false);
    setPage(1);
    router.replace('/events', { scroll: false });
  };
  const filters = (
    <>
      <label>
        Category
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          onBlur={() => updateUrl(1)}
        >
          <option value="">All categories</option>
          {categoryResponse?.data.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Location
        <input
          value={city}
          placeholder="Any city"
          onChange={(event) => {
            setCity(event.target.value);
            setPage(1);
          }}
          onBlur={() => updateUrl(1)}
        />
      </label>
      <label>
        From date
        <input
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setPage(1);
          }}
          onBlur={() => updateUrl(1)}
        />
      </label>
      <button className="text-button" onClick={reset}>
        Clear filters
      </button>
    </>
  );
  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="GET OUT. GET INSPIRED."
        title="Find your next great experience."
        description="For your interests, your people, and your next free evening."
      />
      <div className="explore-search">
        <Search size={20} />
        <input
          aria-label="Search events"
          placeholder="Search events, interests, or venues…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => updateUrl(1)}
        />
        <button className="button secondary filter-mobile" onClick={() => setMobileFilters(true)}>
          <SlidersHorizontal size={17} /> Filters
        </button>
      </div>
      <div className="filter-bar">{filters}</div>
      {mobileFilters && (
        <Modal title="Find your event" onClose={() => setMobileFilters(false)}>
          <div className="form-stack">
            {filters}
            <button className="button" onClick={() => setMobileFilters(false)}>
              Show {filtered.length} events
            </button>
          </div>
        </Modal>
      )}
      <div className="results-bar">
        <span>
          <strong>{pagination?.total ?? 0}</strong> experiences to look forward to
        </span>
        <div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(event) => setSavedOnly(event.target.checked)}
            />{' '}
            Saved
          </label>
          <select
            aria-label="Sort events"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            onBlur={() => updateUrl(page)}
          >
            <option value="recommended">Recommended</option>
            <option value="date">Soonest first</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
          </select>
        </div>
      </div>
      {eventQuery.isPending ? (
        <p className="muted">Finding experiences…</p>
      ) : eventQuery.isError ? (
        <EmptyState
          title="Events are unavailable"
          description="Check the API Gateway and try again."
        >
          <button className="button secondary" onClick={() => eventQuery.refetch()}>
            Try again
          </button>
        </EmptyState>
      ) : filtered.length ? (
        <div className="event-grid">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events found"
          description="Try another search or give your filters a little more room."
        >
          <button className="button secondary" onClick={reset}>
            Reset filters
          </button>
        </EmptyState>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="load-more">
          <button
            className="button secondary"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              updateUrl(next);
            }}
          >
            Previous
          </button>
          <span>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            className="button secondary"
            disabled={page >= pagination.totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              updateUrl(next);
            }}
          >
            Next <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
