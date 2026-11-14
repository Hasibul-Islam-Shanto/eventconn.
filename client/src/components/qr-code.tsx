/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeImage({ value, size = 180, className = '' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-slate-400">Generating QR…</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Ticket Admission QR Code"
      width={size}
      height={size}
      className={`rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white p-2 inline-block ${className}`}
    />
  );
}
