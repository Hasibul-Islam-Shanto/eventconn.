import { OrganizerBookingDetails } from '@/features/organizer/booking-management';
export const metadata = { title: 'Organizer booking details' };
export default async function Page({ params }: { params: Promise<{ bookingId: string }> }) {
  return <OrganizerBookingDetails id={(await params).bookingId} />;
}
