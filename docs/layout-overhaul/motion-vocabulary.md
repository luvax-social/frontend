# Motion Vocabulary

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

One set of durations and easings for the whole app, defined once in `src/index.css`, plus how reduced motion is handled and how the scrim was treated.

## Durations

| Token | Value | Used for |
|-------|-------|----------|
| `--duration-fast` | 150ms | taps and hovers |
| `--duration-normal` | 200ms | overlays, modals, menus, toasts, the carousel crossfade, content fade-in |
| `--duration-slow` | 300ms | the bottom sheet, which travels further |

## Easings

| Token | Value | Used for |
|-------|-------|----------|
| `--ease-out` | cubic-bezier(0.16, 1, 0.3, 1) | entries, which decelerate into place |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | exits, which accelerate away |

## Which surface uses which

| Surface | Motion |
|---------|--------|
| Modal (`LxModal`) | scrim fades in; panel rises and scales in, centred, over `--duration-normal` |
| Post detail overlay | scrim fades in; panel rises and scales in over `--duration-normal`; closes on Escape, scrim click, or the close control |
| Bottom sheet (`LxBottomSheet`) | slides up over `--duration-slow`; scrim fades over `--duration-normal` |
| Dropdown menu | existing rise and scale, on `--duration-normal` |
| Carousel | items crossfade over `--duration-normal` when moving between them |
| Toast | rises and fades in, holds for 1700ms, then falls and fades out over `--duration-normal` |
| Like | the existing heart bump on tap, unchanged |
| Content loading | the feed list and loaded panes fade in rather than snapping in |
| Screen change | the shell's main region is keyed by screen and fades in on each change rather than cutting |
| Report completion | the panel rises and fades, the confirmation mark pops, transcribed from the design |

## Restraint

Nothing loops, nothing pulses, and nothing draws attention while the user is reading.
Every duration is short enough that a fast user never waits on one.
The vocabulary is one set of tokens defined once, so every surface shares the same feel rather than each screen inventing its own.

## Reduced motion

Everything that moves is disabled cleanly when the user asks for reduced motion.
A single `@media (prefers-reduced-motion: reduce)` rule collapses every animation and transition to a near-zero duration and turns off smooth scrolling.
This was verified, not assumed: under the emulated preference the overlay panel's animation duration measured 0.000001 seconds against 0.2 seconds with the preference off.

## The scrim

Opening a post should focus attention on that post.
The scrim behind the post detail overlay was too weak, at 18 percent ink with a 1 pixel blur, so the feed behind competed for attention.
It is now 62 percent of a near-black ink with a 3 pixel blur.
That is strong enough that the open post clearly holds attention, while the surrounding feed is still faintly visible at the edges rather than gone entirely.
Looked at across all three widths, the treatment reads the same and does not feel heavy.
