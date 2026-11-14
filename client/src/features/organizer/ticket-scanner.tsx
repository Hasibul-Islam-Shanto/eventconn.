'use client';
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Users,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Badge, PageHeading } from '@/components/ui';
import { useOrganizerEvents, useCheckInStats, useCheckInTicket } from './queries';

function playFeedbackTone(type: 'success' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Web Audio blocked or unsupported
  }
}

type ScanStatus =
  | { type: 'idle' }
  | { type: 'success'; message: string; ticketCode: string; attendee?: string }
  | { type: 'already_used'; message: string; ticketCode: string }
  | { type: 'error'; message: string };

export function TicketScanner() {
  const eventsQuery = useOrganizerEvents({ page: 1, limit: 100 });
  const events = eventsQuery.data?.data ?? [];
  const [chosenEventId, setChosenEventId] = useState<string>('');
  const selectedEventId = chosenEventId || (events.length > 0 ? events[0].id : '');

  const statsQuery = useCheckInStats(selectedEventId);
  const checkInMutation = useCheckInTicket();

  const [scanStatus, setScanStatus] = useState<ScanStatus>({ type: 'idle' });
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);

  const handleProcessCode = async (rawCode: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 2200);

    let ticketCode = rawCode.trim();
    let qrSignature = '';
    let eventId = selectedEventId;

    try {
      if (rawCode.startsWith('{') && rawCode.endsWith('}')) {
        const parsed = JSON.parse(rawCode);
        if (parsed.code) ticketCode = parsed.code;
        if (parsed.sig) qrSignature = parsed.sig;
        if (parsed.eventId) eventId = parsed.eventId;
      } else if (rawCode.includes(':')) {
        const parts = rawCode.split(':');
        if (parts.length >= 3) {
          ticketCode = parts[1];
          qrSignature = parts[2];
          eventId = parts[3] || selectedEventId;
        }
      }
    } catch {
      // Not JSON, assume manual raw ticketCode
    }

    if (!selectedEventId) {
      setScanStatus({ type: 'error', message: 'Please select an event first.' });
      playFeedbackTone('error');
      return;
    }

    if (eventId && eventId !== selectedEventId) {
      setScanStatus({
        type: 'error',
        message: 'This ticket was issued for a different event!',
      });
      playFeedbackTone('error');
      return;
    }

    try {
      const result = await checkInMutation.mutateAsync({
        ticketCode,
        qrSignature: qrSignature || 'manual-entry',
        eventId: selectedEventId,
      });

      playFeedbackTone('success');
      setScanStatus({
        type: 'success',
        message: `Admitted: Pass #${result.ticketNumber} · ${result.ticketName}`,
        ticketCode: result.ticketCode,
      });
    } catch (err: unknown) {
      playFeedbackTone('error');
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'ALREADY_CHECKED_IN') {
        setScanStatus({
          type: 'already_used',
          message: apiErr.message || 'Ticket was already checked in earlier!',
          ticketCode,
        });
      } else {
        setScanStatus({
          type: 'error',
          message: apiErr?.message || 'Check-in failed. Please verify the ticket code.',
        });
      }
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          void handleProcessCode(decodedText);
        },
        () => {
          // Frame without barcode, ignore
        },
      );
      setIsScanning(true);
    } catch {
      setCameraError('Unable to access camera. Please allow camera permissions or use manual entry.');
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      setIsScanning(false);
    } catch {
      // Ignore cleanup error
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        void html5QrCodeRef.current.stop();
      }
    };
  }, []);

  const stats = statsQuery.data;
  const progressPercent = stats?.total && stats.total > 0
    ? Math.min(100, Math.round((stats.checkedIn / stats.total) * 100))
    : 0;

  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="GATE ADMISSION CONTROL"
        title="Check-in Scanner"
        description="Scan attendee QR passes or enter ticket codes to validate entrance."
      >
        <Badge>LIVE SCANNER</Badge>
      </PageHeading>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Event Selection & Camera Scanner */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              Select Active Event
            </label>
            <select
              className="input"
              value={selectedEventId}
              onChange={(e) => {
                setChosenEventId(e.target.value);
                setScanStatus({ type: 'idle' });
              }}
              style={{ width: '100%', padding: '0.6rem 0.8rem' }}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.city})
                </option>
              ))}
            </select>
          </div>

          {/* Scanner Viewport */}
          <div
            style={{
              borderRadius: '0.75rem',
              overflow: 'hidden',
              background: '#090d16',
              border: '1px solid #1e293b',
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div id="qr-reader" style={{ width: '100%' }} />

            {!isScanning && (
              <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Camera size={44} className="text-slate-400" />
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  Camera is idle. Click below to start scanning.
                </p>
                <button className="button" onClick={startCamera}>
                  <Camera size={18} /> Launch Camera
                </button>
              </div>
            )}

            {isScanning && (
              <div style={{ position: 'absolute', bottom: '0.75rem', zIndex: 10 }}>
                <button className="button secondary" onClick={stopCamera} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                  Pause Camera
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>
              {cameraError}
            </p>
          )}

          {/* Real-time Status Card */}
          {scanStatus.type !== 'idle' && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                border:
                  scanStatus.type === 'success'
                    ? '1px solid #22c55e'
                    : scanStatus.type === 'already_used'
                      ? '1px solid #f59e0b'
                      : '1px solid #ef4444',
                background:
                  scanStatus.type === 'success'
                    ? 'rgba(34, 197, 94, 0.08)'
                    : scanStatus.type === 'already_used'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(239, 68, 68, 0.08)',
              }}
            >
              {scanStatus.type === 'success' ? (
                <CheckCircle2 size={24} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />
              ) : scanStatus.type === 'already_used' ? (
                <AlertCircle size={24} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <XCircle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '1rem',
                    color:
                      scanStatus.type === 'success'
                        ? '#22c55e'
                        : scanStatus.type === 'already_used'
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                >
                  {scanStatus.type === 'success'
                    ? 'VALID PASS - ADMITTED'
                    : scanStatus.type === 'already_used'
                      ? 'ALREADY CHECKED IN'
                      : 'CHECK-IN REJECTED'}
                </strong>
                <span style={{ fontSize: '0.9rem' }}>{scanStatus.message}</span>
                {'ticketCode' in scanStatus && (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.8 }}>
                    Code: {scanStatus.ticketCode}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Code Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                void handleProcessCode(manualCode.trim());
              }
            }}
            style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
          >
            <input
              type="text"
              className="input"
              placeholder="Or enter ticket code (e.g. EC-1A2B-C3-1)…"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="button secondary"
              disabled={checkInMutation.isPending || !manualCode.trim()}
            >
              Verify Code
            </button>
          </form>
        </section>

        {/* Right Column: Live Check-in Stats & Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Progress & Stat Cards */}
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Users size={18} /> Gate Attendance
              </h3>
              <button
                className="icon-button"
                onClick={() => void statsQuery.refetch()}
                title="Refresh counts"
              >
                <RefreshCw size={15} className={statsQuery.isFetching ? 'animate-spin' : ''} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center', margin: '1rem 0' }}>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <small className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>TOTAL ISSUED</small>
                <strong style={{ fontSize: '1.4rem' }}>{stats?.total ?? 0}</strong>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <small style={{ display: 'block', fontSize: '0.75rem', color: '#22c55e' }}>CHECKED IN</small>
                <strong style={{ fontSize: '1.4rem', color: '#22c55e' }}>{stats?.checkedIn ?? 0}</strong>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <small className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>REMAINING</small>
                <strong style={{ fontSize: '1.4rem' }}>{stats?.remaining ?? 0}</strong>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#22c55e',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.4rem' }} className="muted">
              <span>{progressPercent}% admitted</span>
              <span>{stats?.remaining ?? 0} awaiting arrival</span>
            </div>
          </section>

          {/* Recent Scans Feed */}
          <section className="panel" style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={18} className="text-sky-500" /> Recent Admissions
            </h3>

            {stats?.recent && stats.recent.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {stats.recent.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(0,0,0,0.03)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <strong>Pass #{entry.ticketNumber} · {entry.ticketName}</strong>
                      <div className="muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {entry.ticketCode}
                      </div>
                    </div>
                    <Badge>
                      {new Date(entry.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No admissions recorded yet for this event.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
