'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ChevronDown, Menu, Moon, Sun, Monitor, Ticket, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/store/use-app-store';
import { useCurrentUser } from '@/features/auth/queries';
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="EventConn home">
      <span className="brand-icon">
        <Ticket size={23} />
      </span>
      eventconn<span className="brand-dot">.</span>
    </Link>
  );
}
export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <button
      className="icon-button theme-toggle"
      title={`Theme: ${theme}. Click to switch.`}
      aria-label={`Theme: ${theme}. Switch theme`}
      onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
    >
      {theme === 'light' ? (
        <Sun size={19} />
      ) : theme === 'dark' ? (
        <Moon size={19} />
      ) : (
        <Monitor size={19} />
      )}
    </button>
  );
}
export function Navigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  if (path.startsWith('/organizer')) return null;
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Brand />
        <nav aria-label="Main navigation" className={open ? 'main-nav open' : 'main-nav'}>
          {[
            ['/', 'Home'],
            ['/events', 'Explore Events'],
            ['/bookings', 'My Bookings'],
          ].map(([href, label]) => (
            <Link
              key={href}
              onClick={() => setOpen(false)}
              href={href}
              className={path === href ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <Link
            className="organizer-link"
            href={user?.role === 'ORGANIZER' ? '/organizer' : '/register'}
          >
            For organizers <ArrowUpRight size={15} />
          </Link>
          <span className="nav-divider" />
          <ThemeToggle />
          {user ? (
            <Link
              href={user.role === 'ORGANIZER' ? '/organizer/profile' : '/profile'}
              className="profile-link"
            >
              <span className="avatar">
                {user.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <ChevronDown size={14} />
            </Link>
          ) : (
            <Link className="button small" href="/login">
              Sign in
            </Link>
          )}
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  const path = usePathname();
  if (path.startsWith('/organizer')) return null;
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Brand />
          <p>Good things happen when we show up.</p>
        </div>
        <div className="footer-links">
          <Link href="/events">Explore events</Link>
          <Link href="/organizer">
            Become an organizer <ArrowUpRight size={14} />
          </Link>
          <span>© 2026 EventConn</span>
        </div>
      </div>
    </footer>
  );
}
