import { AuthForm } from '@/features/auth/auth-form';
import { Suspense } from 'react';
export const metadata = { title: 'Sign in' };
export default function Page() {
  return (
    <Suspense fallback={<p className="container page-space">Loading sign in…</p>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
