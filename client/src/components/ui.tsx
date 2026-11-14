'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { SearchX, X } from 'lucide-react';
export function EmptyState({
  title = 'Nothing here yet',
  description = 'Your next great experience is waiting.',
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <SearchX size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const tones: Record<string, string> = {
    CONFIRMED: 'success',
    PENDING: 'warning',
    CANCELLED: 'danger',
    COMPLETED: 'neutral',
    DRAFT: 'neutral',
    PUBLISHED: 'info',
    'ON SALE': 'info',
    'SOLD OUT': 'neutral',
    DISABLED: 'neutral',
    'Demo payment complete': 'success',
    'Demo payment pending': 'warning',
    'Demo payment refunded': 'neutral',
  };
  const tone = typeof children === 'string' ? (tones[children] ?? 'neutral') : 'neutral';
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
