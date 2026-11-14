'use client';
import { RotateCcw } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page-space">
      <div className="empty-state">
        <h1>A small change of plans.</h1>
        <p>Something went wrong loading this page. Let’s give it another try.</p>
        <button className="button" onClick={reset}>
          <RotateCcw size={17} /> Try again
        </button>
      </div>
    </div>
  );
}
