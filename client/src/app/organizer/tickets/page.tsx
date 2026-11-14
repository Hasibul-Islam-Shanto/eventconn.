import { Suspense } from 'react';
import { TicketManagement } from '@/features/organizer/ticket-management';
export const metadata = { title: 'Manage Tickets' };
export default function Page() {
  return (
    <Suspense fallback={<p>Loading ticket types…</p>}>
      <TicketManagement />
    </Suspense>
  );
}
