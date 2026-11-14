import { BookingDetails } from '@/features/bookings/booking-pages';
export const metadata = { title: 'Booking details' };
export default async function Page({ params }: { params: Promise<{ bookingId: string }> }) {
  return <BookingDetails id={(await params).bookingId} />;
}
