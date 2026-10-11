/**
 * Per-corner border radius for a message bubble (or album tile) that is part of a run of
 * consecutive same-sender messages.
 *
 * The side facing the conversation - away from the screen edge - always stays fully rounded: the
 * left side for the viewer's own (right-aligned) messages, the right side for the other
 * person's (left-aligned) ones. The outer side, nearest the screen edge, is what varies: rounded
 * at the run's own start and end (the "tail" that marks where a burst of messages begins and
 * ends), flattened everywhere it touches a neighboring bubble in between - the same run a
 * consecutive burst already collapses its avatar and separator for.
 */

const ROUNDED = 15;
const FLAT = 4;

export function bubbleCornerRadius({
  isMine,
  isFirstInRun,
  isLastInRun,
}: {
  isMine: boolean;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}) {
  const solo = isFirstInRun && isLastInRun;
  const outerTop = solo || isFirstInRun ? ROUNDED : FLAT;
  const outerBottom = solo || isLastInRun ? ROUNDED : FLAT;

  const [topLeft, topRight, bottomRight, bottomLeft] = isMine
    ? [ROUNDED, outerTop, outerBottom, ROUNDED]
    : [outerTop, ROUNDED, ROUNDED, outerBottom];

  return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
}
