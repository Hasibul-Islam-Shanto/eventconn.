import { OrganizerShell } from '@/features/organizer/organizer-shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OrganizerShell>{children}</OrganizerShell>;
}
