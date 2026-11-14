'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, Plus, Pencil, ArrowUpRight } from 'lucide-react';
import { useOrganizerEvents, useUpdateEvent } from './queries';
import { useDemo } from '@/components/demo-provider';
import { Badge, EmptyState, PageHeading } from '@/components/ui';
import { dateLabel, money } from '@/lib/format';
export function EventManagement() {
  const { notify } = useDemo();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const eventsQuery = useOrganizerEvents({
    search: query,
    status: status ? (status as 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED') : undefined,
    page,
    limit: 5,
  });
  const publish = useUpdateEvent();
  const filtered = eventsQuery.data?.data ?? [];
  const pages = eventsQuery.data?.pagination.totalPages ?? 1;
  return (
    <>
      <PageHeading
        eyebrow="YOUR IDEAS, OUT IN THE WORLD"
        title="Make it an occasion."
        description="Create, fine-tune, and manage your experiences."
      >
        <Link className="button" href="/organizer/events/new">
          <Plus size={17} /> Create event
        </Link>
      </PageHeading>
      <section className="panel">
        <div className="management-filters">
          <div className="input-icon">
            <Search size={17} />
            <input
              aria-label="Search your events"
              placeholder="Search your events…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filter event status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date & location</th>
                <th>From</th>
                <th>Availability</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 5, page * 5).map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.title}</strong>
                    <small>{event.category}</small>
                  </td>
                  <td>
                    {dateLabel(event.date, event.venue.timezone)}
                    <small>{event.city}</small>
                  </td>
                  <td>{money(event.startingPrice)}</td>
                  <td>
                    {event.ticketTypes
                      .filter((ticket) => ticket.enabled)
                      .reduce((sum, ticket) => sum + ticket.quantity, 0)}{' '}
                    tickets
                  </td>
                  <td>
                    <Badge>{event.status}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="icon-button"
                        href={`/organizer/events/${event.id}/edit`}
                        aria-label={`Edit ${event.title}`}
                      >
                        <Pencil size={16} />
                      </Link>
                      {event.status === 'DRAFT' && (
                        <button
                          className="button small"
                          disabled={publish.isPending}
                          onClick={async () => {
                            await publish.mutateAsync({
                              id: event.id,
                              input: { status: 'PUBLISHED' },
                            });
                            notify('Event published.');
                          }}
                        >
                          Publish
                        </button>
                      )}
                      <Link
                        className="icon-button"
                        href={`/events/${event.id}`}
                        aria-label={`View ${event.title}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {eventsQuery.isPending && <p className="muted">Loading your events…</p>}
        {eventsQuery.isError && (
          <p role="alert" className="field-error">
            Your events could not be loaded.
          </p>
        )}
        {!eventsQuery.isPending && !filtered.length && (
          <EmptyState
            title="No events match your filters"
            description="Try a different search, or make room for a new experience."
          />
        )}
        <div className="pagination">
          <span>{eventsQuery.data?.pagination.total ?? 0} events</span>
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
