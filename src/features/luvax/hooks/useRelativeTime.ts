import { useEffect, useMemo, useState } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

const resolveSeedDisplayDate = (dateStr: string | null | undefined, seedKey?: string | null) => {
  if (!dateStr || !seedKey?.startsWith('seed_')) {
    return dateStr;
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }

  const ageDays = Math.floor((Date.now() - parsed.getTime()) / DAY_MS);
  if (ageDays < 180) {
    return dateStr;
  }

  const code = [...seedKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const freshDays = 2 + (code % 5);
  return new Date(Date.now() - freshDays * DAY_MS).toISOString();
};

export const formatRelativeTime = (
  dateStr: string | null | undefined,
  options: { seedKey?: string | null } = {}
) => {
  const effectiveDate = resolveSeedDisplayDate(dateStr, options.seedKey);
  if (!effectiveDate) return 'now';

  const parsed = new Date(effectiveDate);
  if (Number.isNaN(parsed.getTime())) {
    return effectiveDate;
  }

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const useRelativeTime = (
  dateStr: string | null | undefined,
  options: { seedKey?: string | null } = {}
) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return useMemo(() => formatRelativeTime(dateStr, options), [dateStr, options, tick]);
};
