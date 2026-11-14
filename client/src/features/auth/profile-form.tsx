'use client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAppStore } from '@/store/use-app-store';
import { PageHeading } from '@/components/ui';
import { useCurrentUser, useLogout } from './queries';
export function ProfileForm({ organizer = false }: { organizer?: boolean }) {
  const { theme, setTheme } = useAppStore();
  const current = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();
  const user = current.data;
  if (!user) return null;
  return (
    <div className={organizer ? '' : 'container page-space'}>
      <PageHeading
        eyebrow="A LITTLE ABOUT YOU"
        title={organizer ? 'Your organizer profile.' : 'Make yourself at home.'}
        description="Your account details come from EventConn."
      />
      <div className="profile-grid">
        <section className="panel">
          <div className="profile-intro">
            <span className="avatar large">
              {user.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h2>{user.name}</h2>
              <p className="muted">
                {user.role === 'ORGANIZER' ? 'Organizer' : 'Event enthusiast'} · Joined{' '}
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="form-stack">
            <label>
              Full name
              <input value={user.name} readOnly />
            </label>
            <label>
              Email address
              <input value={user.email} readOnly />
            </label>
            <p className="muted small-copy">
              Profile editing is not exposed by the current backend API.
            </p>
          </div>
        </section>
        <aside className="form-stack">
          <section className="panel">
            <h3>Make it feel like you.</h3>
            <p className="muted">Choose your preferred appearance.</p>
            <div className="theme-options">
              {(['light', 'dark', 'system'] as const).map((item) => (
                <button
                  key={item}
                  className={theme === item ? 'selected' : ''}
                  onClick={() => setTheme(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
          <button
            className="text-button danger"
            disabled={logout.isPending}
            onClick={async () => {
              await logout.mutateAsync();
              router.replace('/login');
            }}
          >
            <LogOut size={16} /> {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </aside>
      </div>
    </div>
  );
}
