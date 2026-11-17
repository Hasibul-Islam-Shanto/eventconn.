'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, CreditCard, LockKeyhole, Minus, Plus, Ticket } from 'lucide-react';
import type { Event } from '@/types/domain';
import { dateLabel, money } from '@/lib/format';
import { useDemo } from '@/components/demo-provider';
import { Modal } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { uuid } from '@/lib/id';
import { useCurrentUser } from '@/features/auth/queries';
import { useBooking, useCreateBooking, useCreatePayment, useCreateTicketHold } from './queries';
import type { TicketHold } from './api';
import { isTicketOnSale } from './booking-utils';

const attendeeSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  payment: z.enum(['demo-card', 'demo-wallet']),
});
type AttendeeValues = z.infer<typeof attendeeSchema>;

export function TicketSelection({ event }: { event: Event }) {
  const tickets = event.ticketTypes.filter((ticket) => ticket.enabled);
  const [ticketId, setTicketId] = useState(
    tickets.find((ticket) => isTicketOnSale(ticket))?.id || '',
  );
  const [quantity, setQuantity] = useState(1);
  const [hold, setHold] = useState<TicketHold | null>(null);
  const [error, setError] = useState('');
  const createHold = useCreateTicketHold();
  const user = useCurrentUser();
  const router = useRouter();
  const ticket = tickets.find((item) => item.id === ticketId);
  async function reserve() {
    if (!user.data) {
      router.push(`/login?next=/events/${event.id}`);
      return;
    }
    if (user.data.role !== 'CUSTOMER') {
      setError('Customer accounts can reserve tickets.');
      return;
    }
    setError('');
    try {
      setHold(
        (await createHold.mutateAsync({ eventId: event.id, ticketTypeId: ticketId, quantity }))
          .data,
      );
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'We couldn’t hold these tickets.');
    }
  }
  return (
    <aside className="ticket-panel">
      <p className="eyebrow">MAKE IT A PLAN</p>
      <h2>Your next great memory.</h2>
      <p className="muted">Choose your ticket. We’ll save your spot.</p>
      <div className="ticket-options">
        {tickets.map((item) => (
          <label
            key={item.id}
            className={`ticket-option ${item.id === ticketId ? 'selected' : ''} ${!isTicketOnSale(item) ? 'unavailable' : ''}`}
          >
            <input
              type="radio"
              name="ticket"
              checked={item.id === ticketId}
              disabled={!isTicketOnSale(item)}
              onChange={() => {
                setTicketId(item.id);
                setQuantity(1);
              }}
            />
            <span>
              <strong>{item.name}</strong>
              <small>{!isTicketOnSale(item) ? 'Sales closed' : 'Available to reserve'}</small>
            </span>
            <strong>{item.price === 0 ? 'Free' : money(item.price)}</strong>
          </label>
        ))}
      </div>
      <div className="quantity-line">
        <span>Number of tickets</span>
        <div className="stepper">
          <button
            aria-label="Remove one ticket"
            disabled={quantity <= 1}
            onClick={() => setQuantity(quantity - 1)}
          >
            <Minus size={15} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            aria-label="Add one ticket"
            disabled={!ticket || quantity >= 20}
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <div className="total-line">
        <span>
          Estimated total <small>Backend confirms the total</small>
        </span>
        <strong>{money((ticket?.price || 0) * quantity)}</strong>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        className="button full"
        disabled={!ticket || !isTicketOnSale(ticket) || createHold.isPending}
        onClick={reserve}
      >
        {createHold.isPending ? 'Holding your tickets…' : 'Reserve my spot'}{' '}
        <ArrowRight size={18} />
      </button>
      <p className="secure-note">
        <LockKeyhole size={13} /> Secure booking. Good times ahead.
      </p>
      {hold && ticket && (
        <Checkout event={event} ticketId={ticket.id} hold={hold} onClose={() => setHold(null)} />
      )}
    </aside>
  );
}

function HoldCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(next);
      if (!next) onExpire();
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);
  const seconds = Math.ceil(remaining / 1000);
  return (
    <strong aria-live="polite">
      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
    </strong>
  );
}

function Checkout({
  event,
  ticketId,
  hold,
  onClose,
}: {
  event: Event;
  ticketId: string;
  hold: TicketHold;
  onClose: () => void;
}) {
  const ticket = event.ticketTypes.find((item) => item.id === ticketId)!;
  const current = useCurrentUser();
  const createBooking = useCreateBooking();
  const createPayment = useCreatePayment();
  const [bookingKey] = useState(() => uuid());
  const [paymentKey] = useState(() => uuid());
  const [step, setStep] = useState(0);
  const [bookingId, setBookingId] = useState('');
  const [expired, setExpired] = useState(false);
  const [formError, setFormError] = useState('');
  const booking = useBooking(bookingId, true);
  const { notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AttendeeValues>({
    resolver: zodResolver(attendeeSchema),
    defaultValues: {
      name: current.data?.name || '',
      email: current.data?.email || '',
      phone: '',
      payment: 'demo-card',
    },
  });
  const terminal =
    booking.data?.status === 'CONFIRMED' ||
    booking.data?.status === 'CANCELLED' ||
    booking.data?.status === 'COMPLETED';
  async function submit() {
    if (expired) return;
    setFormError('');
    try {
      const created = await createBooking.mutateAsync({
        holdId: hold.id,
        idempotencyKey: bookingKey,
      });
      setBookingId(created.id);
      await createPayment.mutateAsync({
        bookingId: created.id,
        outcome: 'SUCCEEDED',
        idempotencyKey: paymentKey,
      });
      notify('Payment completed. Confirming your booking…');
    } catch (reason) {
      setFormError(
        reason instanceof ApiError ? reason.message : 'We couldn’t complete this booking.',
      );
    }
  }
  const completed = bookingId && terminal;
  return (
    <Modal
      title={
        completed
          ? booking.data?.status === 'CONFIRMED'
            ? 'You’re going!'
            : 'Booking update'
          : step === 0
            ? 'Your evening starts here.'
            : 'Just a few details.'
      }
      onClose={onClose}
    >
      {completed ? (
        <div className="confirmation">
          <span className="success-circle">
            <Check size={32} />
          </span>
          <h2>
            {booking.data?.status === 'CONFIRMED'
              ? 'Something to look forward to.'
              : 'This booking was not confirmed.'}
          </h2>
          <p>The backend reports this booking as {booking.data?.status.toLowerCase()}.</p>
          <div className="confirmation-ticket">
            <Ticket size={26} />
            <h3>{event.title}</h3>
            <p>
              {dateLabel(event.date, event.venue.timezone)} · {event.venue.name}
            </p>
            <hr />
            <p>
              {hold.quantity} × {ticket.name}
            </p>
            <strong>{money(booking.data?.total ?? 0)}</strong>
            <small>BOOKING REFERENCE</small>
            <code>{bookingId}</code>
          </div>
          <Link className="button full" href={`/bookings/${bookingId}`} onClick={onClose}>
            View my booking <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <>
          <div className="checkout-steps">
            <span className={step === 0 ? 'active' : ''}>1. Review</span>
            <span className={step === 1 ? 'active' : ''}>2. Attendee & payment</span>
            <span>3. Confirmation</span>
          </div>
          <div className="checkout-summary">
            <h3>{event.title}</h3>
            <p>
              {dateLabel(event.date, event.venue.timezone)} · {event.venue.name}
            </p>
            <div>
              <span>
                {hold.quantity} × {ticket.name}
              </span>
              <strong>{money(ticket.price * hold.quantity)}</strong>
            </div>
            <div className="total-line">
              <strong>Hold expires in</strong>
              <HoldCountdown expiresAt={hold.expiresAt} onExpire={() => setExpired(true)} />
            </div>
          </div>
          {bookingId ? (
            <div className="empty-state">
              <h3>Payment successful. Confirming your booking…</h3>
              <p>We’ll update this view when Booking Service confirms it.</p>
            </div>
          ) : step === 0 ? (
            <button className="button full" disabled={expired} onClick={() => setStep(1)}>
              Continue to attendee information <ArrowRight size={17} />
            </button>
          ) : (
            <form onSubmit={handleSubmit(submit)} className="form-stack">
              <label>
                Full name
                <input {...register('name')} autoComplete="name" readOnly />
                {errors.name && <small className="field-error">{errors.name.message}</small>}
              </label>
              <label>
                Email address
                <input {...register('email')} type="email" readOnly />
                {errors.email && <small className="field-error">{errors.email.message}</small>}
              </label>
              <label>
                Phone <span className="muted">(presentation only)</span>
                <input {...register('phone')} type="tel" />
              </label>
              <fieldset>
                <legend>Mock payment method</legend>
                <label className="payment-option">
                  <input type="radio" value="demo-card" {...register('payment')} />
                  <CreditCard size={20} /> Demo card ···· 4242
                </label>
                <label className="payment-option">
                  <input type="radio" value="demo-wallet" {...register('payment')} /> Demo wallet
                </label>
              </fieldset>
              <p className="demo-note">
                No card data is sent. The backend calculates the final BDT total.
              </p>
              {expired && (
                <p role="alert" className="field-error">
                  This ticket hold has expired.
                </p>
              )}
              {formError && (
                <p role="alert" className="field-error">
                  {formError}
                </p>
              )}
              <button
                className="button full"
                disabled={expired || createBooking.isPending || createPayment.isPending}
              >
                {createBooking.isPending || createPayment.isPending
                  ? 'Completing your booking…'
                  : 'Complete mock payment'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
