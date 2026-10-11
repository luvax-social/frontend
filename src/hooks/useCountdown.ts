import { useEffect, useState } from 'react';

export function useCountdown(initialSeconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return {
    secondsLeft,
    isComplete: secondsLeft === 0,
    reset: () => setSecondsLeft(initialSeconds),
    start: (seconds = initialSeconds) => setSecondsLeft(seconds),
  };
}
