'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  UserRound,
  ArrowUpRight,
  Menu,
  X,
  Plus,
  ChevronRight,
  QrCode,
} from 'lucide-react';
import { Brand, ThemeToggle } from '@/components/navigation';
import { useCurrentUser } from '@/features/auth/queries';
const links = [
  { href: '/organizer', label: 'Overview', icon: LayoutDashboard },
  { href: '/organizer/events', label: 'Events', icon: CalendarDays },
  { href: '/organizer/scan', label: 'Check-in Scanner', icon: QrCode },
  { href: '/organizer/bookings', label: 'Bookings', icon: Users },
  { href: '/organizer/tickets', label: 'Tickets', icon: Ticket },
  { href: '/organizer/profile', label: 'Profile', icon: UserRound },
];
export function OrganizerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  return (
    <div className="organizer-shell">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`organizer-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <span className="workspace-label">ORGANIZER WORKSPACE</span>
        <nav aria-label="Organizer navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              className={
                path === href || (href !== '/organizer' && path.startsWith(href)) ? 'active' : ''
              }
              onClick={() => setOpen(false)}
              key={href}
              href={href}
            >
              <Icon size={19} />
              {label}
              {path === href && <ChevronRight size={15} />}
            </Link>
          ))}
        </nav>
        <Link href="/organizer/events/new" className="button">
          <Plus size={17} /> Create an event
        </Link>
        <div className="sidebar-bottom">
          <p>
            Bring people together.
            <br />
            <strong>Make something happen.</strong>
          </p>
          <Link href="/">
            Customer experience <ArrowUpRight size={16} />
          </Link>
          <small>Connected workspace</small>
        </div>
      </aside>
      <div className="organizer-main">
        <header className="organizer-topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open organizer navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span>{links.find((item) => item.href === path)?.label || 'Event studio'}</span>
          <div>
            <span className="workspace-status">
              <span /> Connected workspace
            </span>
            <ThemeToggle />
            <Link href="/organizer/profile" className="avatar">
              {(user?.name || 'Organizer')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </Link>
          </div>
        </header>
        <div className="organizer-content">{children}</div>
      </div>
    </div>
  );
}
