import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
export default function NotFound() {
  return (
    <div className="container page-space">
      <div className="empty-state not-found">
        <Compass size={48} />
        <p className="eyebrow">A LITTLE OFF THE BEATEN PATH</p>
        <h1>This isn’t where the party is.</h1>
        <p>We couldn’t find this page, but your next great experience is still out there.</p>
        <Link href="/events" className="button">
          Find your way to something good <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
