export const money = (minorUnits: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);

export const dateLabel = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));

export const timeLabel = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));

function zonedParts(iso: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export const toDateInput = (iso: string, timeZone = 'UTC') => {
  const parts = zonedParts(iso, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const toTimeInput = (iso: string, timeZone = 'UTC') => {
  const parts = zonedParts(iso, timeZone);
  return `${parts.hour}:${parts.minute}`;
};

/** Convert a wall-clock date and time in an IANA zone to an absolute ISO timestamp. */
export function zonedDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = target;

  // Recalculate the zone offset because it can differ across daylight-saving boundaries.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const rendered = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const adjustment = target - rendered;
    candidate += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(candidate).toISOString();
}
