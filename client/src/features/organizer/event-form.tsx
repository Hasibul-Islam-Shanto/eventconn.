'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { useCategories } from '@/features/events/queries';
import { ApiError } from '@/lib/api-client';
import { toDateInput, toTimeInput, zonedDateTimeToIso } from '@/lib/format';
import { EmptyState, PageHeading } from '@/components/ui';
import { useCreateEvent, useCreateVenue, useOrganizerEvent, useUpdateEvent } from './queries';

const schema = z
  .object({
    title: z.string().min(5),
    categoryId: z.uuid(),
    shortDescription: z.string().min(15).max(500),
    description: z.string().min(30),
    date: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    venue: z.string().min(2),
    city: z.string().min(2),
    address: z.string().min(3),
    timezone: z.string().min(1),
    coverImage: z.union([z.url(), z.literal('')]),
    status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']),
  })
  .refine((values) => values.endTime > values.startTime, {
    path: ['endTime'],
    message: 'End time must be later than start time.',
  });
type Values = z.infer<typeof schema>;
const defaults: Values = {
  title: '',
  categoryId: '',
  shortDescription: '',
  description: '',
  date: '',
  startTime: '18:00',
  endTime: '22:00',
  venue: '',
  city: 'Dhaka',
  address: '',
  timezone: 'Asia/Dhaka',
  coverImage: '',
  status: 'DRAFT',
};
export function EventForm({ id }: { id?: string }) {
  const eventQuery = useOrganizerEvent(id || '');
  const categories = useCategories();
  const createVenue = useCreateVenue();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { notify } = useDemo();
  const router = useRouter();
  const existing = eventQuery.data;
  const values = existing
    ? {
        title: existing.title,
        categoryId: existing.categoryId,
        shortDescription: existing.shortDescription,
        description: existing.description,
        date: toDateInput(existing.startTime, existing.venue.timezone),
        startTime: toTimeInput(existing.startTime, existing.venue.timezone),
        endTime: toTimeInput(existing.endTime, existing.venue.timezone),
        venue: existing.venue.name,
        city: existing.city,
        address: existing.venue.address,
        timezone: existing.venue.timezone,
        coverImage: existing.coverImage === '/og.png' ? '' : existing.coverImage,
        status: existing.status,
      }
    : defaults;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), values });
  if (id && eventQuery.isPending) return <p>Loading event…</p>;
  if (id && !existing)
    return (
      <EmptyState title="Event not found">
        <Link href="/organizer/events" className="button">
          Back to events
        </Link>
      </EmptyState>
    );
  function field(name: keyof Values, label: string, type = 'text') {
    return (
      <label key={name}>
        {label}
        {name === 'description' || name === 'shortDescription' ? (
          <textarea
            rows={name === 'description' ? 5 : 2}
            {...register(name)}
            aria-invalid={!!errors[name]}
          />
        ) : (
          <input type={type} {...register(name)} aria-invalid={!!errors[name]} />
        )}
        {errors[name] && <small className="field-error">{errors[name]?.message}</small>}
      </label>
    );
  }
  async function submit(input: Values) {
    try {
      const startDateTime = zonedDateTimeToIso(input.date, input.startTime, input.timezone);
      const endDateTime = zonedDateTimeToIso(input.date, input.endTime, input.timezone);
      let venueId = existing?.venueId;
      if (
        !existing ||
        input.venue !== existing.venue.name ||
        input.city !== existing.city ||
        input.address !== existing.venue.address ||
        input.timezone !== existing.venue.timezone
      )
        venueId = (
          await createVenue.mutateAsync({
            name: input.venue,
            city: input.city,
            address: input.address,
            timezone: input.timezone,
          })
        ).data.id;
      const eventInput = {
        title: input.title,
        slug: `${input.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${(id || crypto.randomUUID()).slice(0, 8)}`,
        shortDescription: input.shortDescription,
        description: input.description,
        ...(input.coverImage ? { coverImageUrl: input.coverImage } : {}),
        categoryId: input.categoryId,
        venueId: venueId!,
        startDateTime,
        endDateTime,
      };
      if (id)
        await updateEvent.mutateAsync({
          id,
          input:
            existing?.status === 'DRAFT'
              ? { ...eventInput, status: input.status }
              : { status: input.status },
        });
      else {
        const created = await createEvent.mutateAsync(eventInput);
        notify('Event created. Add ticket types before publishing.');
        router.push(`/organizer/tickets?event=${created.id}`);
        return;
      }
      notify('Event updated successfully.');
      router.push('/organizer/events');
    } catch (reason) {
      setError('root', {
        message: reason instanceof ApiError ? reason.message : 'Event could not be saved.',
      });
    }
  }
  return (
    <>
      <Link className="text-link" href="/organizer/events">
        <ArrowLeft size={16} /> Back to your events
      </Link>
      <PageHeading
        eyebrow="GREAT EXPERIENCES START WITH AN IDEA"
        title={id ? 'Make the details count.' : 'Bring your next idea to life.'}
        description="Set the scene. Tell your story. Give people something to look forward to."
      />
      <form className="event-edit-form" onSubmit={handleSubmit(submit)}>
        <section className="panel form-stack">
          <div>
            <p className="eyebrow">01 / THE EXPERIENCE</p>
            <h2>Give it a little personality.</h2>
          </div>
          {field('title', 'Event title')}
          <label>
            Category
            <select {...register('categoryId')}>
              <option value="">Choose a category</option>
              {categories.data?.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <small className="field-error">Choose a category.</small>}
          </label>
          {field('shortDescription', 'The short version')}
          {field('description', 'About this experience')}
        </section>
        <section className="panel form-stack">
          <div>
            <p className="eyebrow">02 / THE WHEN & WHERE</p>
            <h2>Put it on the calendar.</h2>
          </div>
          <div className="form-columns">
            {field('date', 'Event date', 'date')}
            {field('startTime', 'Start time', 'time')}
            {field('endTime', 'End time', 'time')}
          </div>
          <div className="form-columns">
            {field('venue', 'Venue name')}
            {field('city', 'City')}
          </div>
          {field('address', 'Street address')}
          {field('timezone', 'IANA timezone')}
        </section>
        <section className="panel form-stack">
          <div>
            <p className="eyebrow">03 / THE FIRST IMPRESSION</p>
            <h2>Set the scene.</h2>
          </div>
          {field('coverImage', 'Cover image URL', 'url')}
          {id && (
            <label>
              Event status
              <select {...register('status')}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
          )}
          {errors.root && (
            <p role="alert" className="field-error">
              {errors.root.message}
            </p>
          )}
        </section>
        <div className="form-footer">
          <Link href="/organizer/events" className="button secondary">
            Cancel
          </Link>
          <button
            className="button"
            disabled={
              isSubmitting ||
              createEvent.isPending ||
              updateEvent.isPending ||
              createVenue.isPending
            }
          >
            {isSubmitting ? 'Saving your experience…' : id ? 'Save changes' : 'Create event'}{' '}
            <Check size={17} />
          </button>
        </div>
      </form>
    </>
  );
}
