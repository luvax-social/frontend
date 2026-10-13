import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { TWEAK_DEFAULTS } from './constants/data';

/**
 * Display preferences shared by the authenticated shell and its screens.
 *
 * These were props threaded down from the screen switch. Screens are route
 * elements now and no parent renders them directly, so the values travel
 * through context instead. This carries appearance settings only: navigation
 * state lives in the URL.
 */
export type Tweaks = typeof TWEAK_DEFAULTS;
export type Viewport = 'desktop' | 'tablet' | 'mobile';
export interface TweaksContextValue {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  viewport: Viewport;
}
const LuvaxTweaksContext = createContext<TweaksContextValue>({
  tweaks: TWEAK_DEFAULTS,
  setTweak: () => {},
  viewport: 'desktop',
});

export function LuvaxTweaksProvider({
  value,
  children,
}: {
  value: TweaksContextValue;
  children?: ReactNode;
}) {
  return <LuvaxTweaksContext.Provider value={value}>{children}</LuvaxTweaksContext.Provider>;
}

export function useLuvaxTweaks() {
  return useContext(LuvaxTweaksContext);
}
