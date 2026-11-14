import test from 'node:test';
import assert from 'node:assert/strict';
import { isTicketOnSale, canCancelBooking } from '../src/features/bookings/booking-utils.ts';
import { mapEvent } from '../src/features/events/api.ts';
import { mapBooking } from '../src/features/bookings/api.ts';
import { toDateInput, toTimeInput, zonedDateTimeToIso } from '../src/lib/format.ts';

const ticket = {
  id: 'general',
  name: 'General',
  description: '',
  price: 4500,
  quantity: 2,
  enabled: true,
  salesStart: '2026-09-01T00:00:00.000Z',
  salesEnd: '2026-10-17T18:00:00.000Z',
};
test('sale windows and cancellation use backend timestamps and states', () => {
  assert.equal(isTicketOnSale(ticket, new Date('2026-09-01T00:00:00.000Z')), true);
  assert.equal(isTicketOnSale(ticket, new Date('2026-10-17T18:00:00.000Z')), false);
  assert.equal(
    canCancelBooking(
      { status: 'PENDING' },
      { startTime: '2026-10-17T18:00:00.000Z' },
      new Date('2026-10-17T17:59:00.000Z'),
    ),
    true,
  );
  assert.equal(
    canCancelBooking(
      { status: 'CONFIRMED' },
      { startTime: '2026-10-17T18:00:00.000Z' },
      new Date('2026-10-17T17:59:00.000Z'),
    ),
    false,
  );
});
test('event responses map to the established presentation model', () => {
  const mapped = mapEvent({
    id: '9fb897e0-3d73-40d2-82c0-1807118f62ad',
    organizerId: 'a03c6534-548c-41ec-9629-d5581e33cd06',
    title: 'Concert',
    slug: 'concert',
    shortDescription: 'Music',
    description: 'Music event',
    coverImageUrl: null,
    categoryId: 'ca8379f6-86cb-4887-a81c-a905253b004d',
    venueId: 'ca16576b-37d4-410f-ab03-841d13f5d835',
    startDateTime: '2026-10-17T18:00:00.000Z',
    endDateTime: '2026-10-17T20:00:00.000Z',
    status: 'PUBLISHED',
    createdAt: '',
    updatedAt: '',
    category: { id: 'ca8379f6-86cb-4887-a81c-a905253b004d', name: 'Music', slug: 'music' },
    venue: {
      id: 'ca16576b-37d4-410f-ab03-841d13f5d835',
      name: 'Hall',
      address: 'Road 1',
      city: 'Dhaka',
      timezone: 'Asia/Dhaka',
    },
    ticketTypes: [
      {
        id: 'a52e3f39-26ad-47f7-aaf7-c39eb7f41cfd',
        eventId: '9fb897e0-3d73-40d2-82c0-1807118f62ad',
        name: 'General',
        description: '',
        price: 4500,
        capacity: 100,
        salesStartAt: '2026-09-01T00:00:00.000Z',
        salesEndAt: '2026-10-17T17:00:00.000Z',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    ],
  });
  assert.equal(mapped.coverImage, '/og.png');
  assert.equal(mapped.startingPrice, 4500);
  assert.equal(mapped.ticketTypes[0].quantity, 100);
});
test('booking responses retain authoritative totals and item snapshots', () => {
  const booking = mapBooking({
    id: '957226f8-f71c-47ca-b712-7b92e223d13a',
    userId: 'a03c6534-548c-41ec-9629-d5581e33cd06',
    organizerId: 'efae5fc8-64cd-4aab-83cf-27b2345fce51',
    eventId: '9fb897e0-3d73-40d2-82c0-1807118f62ad',
    status: 'PENDING',
    subtotal: 9000,
    fees: 0,
    total: 9000,
    paymentStatus: 'PENDING',
    expiresAt: '2026-09-07T10:10:00.000Z',
    createdAt: '2026-09-07T10:00:00.000Z',
    currency: 'BDT',
    items: [
      {
        id: 'item',
        ticketTypeId: 'a52e3f39-26ad-47f7-aaf7-c39eb7f41cfd',
        ticketName: 'General',
        quantity: 2,
        unitPrice: 4500,
      },
    ],
  });
  assert.equal(booking.total, 9000);
  assert.equal(booking.ticketName, 'General');
  assert.equal(booking.quantity, 2);
});

test('organizer event times round-trip through the venue timezone', () => {
  const iso = zonedDateTimeToIso('2026-10-17', '18:30', 'Asia/Dhaka');
  assert.equal(iso, '2026-10-17T12:30:00.000Z');
  assert.equal(toDateInput(iso, 'Asia/Dhaka'), '2026-10-17');
  assert.equal(toTimeInput(iso, 'Asia/Dhaka'), '18:30');
});
