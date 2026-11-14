import { EventForm } from '@/features/organizer/event-form';
export const metadata = { title: 'Edit Event' };
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <EventForm id={(await params).eventId} />;
}
