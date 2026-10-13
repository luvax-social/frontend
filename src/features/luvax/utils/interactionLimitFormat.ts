/**
 * Formats the end of an interaction limit for display, for example "Sat, Oct 17, 9:40 pm".
 *
 * The server sends an absolute instant. It is written in the timezone of the device that renders
 * it, never in UTC, because the person reading it asked "until when" in their own day. The day
 * period is lowercased, since the interface chrome is lowercase. `locale` defaults to the
 * browser's; tests pass one explicitly so the output does not depend on the host.
 *
 * Returns an empty string for a missing or unreadable value.
 */
export function formatLimitEnd(value: string | null | undefined, locale?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .formatToParts(date)
    .map((part) => (part.type === 'dayPeriod' ? part.value.toLowerCase() : part.value))
    .join('');
}
