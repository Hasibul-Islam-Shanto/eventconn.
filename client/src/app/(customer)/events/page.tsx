import { Suspense } from 'react';
import { ExploreEvents } from '@/features/events/discovery';
export const metadata = { title: 'Explore Events' };
export default function EventsPage() {
  return (
    <Suspense fallback={<p className="container page-space">Finding your next experience…</p>}>
      <ExploreEvents />
    </Suspense>
  );
}
