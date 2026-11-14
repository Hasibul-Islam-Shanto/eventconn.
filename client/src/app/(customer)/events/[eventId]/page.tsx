import { EventDetails } from '@/features/events/event-details';
export const metadata = { title: 'Event details' };
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  return <EventDetails id={(await params).eventId} />;
}
