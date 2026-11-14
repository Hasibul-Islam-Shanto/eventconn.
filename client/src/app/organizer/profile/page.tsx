import { ProfileForm } from '@/features/auth/profile-form';
export const metadata = { title: 'Organizer Profile' };
export default function Page() {
  return <ProfileForm organizer />;
}
