import { describe, expect, it } from 'vitest';

import { bubbleCornerRadius } from '@/features/messages/utils/bubbleShape';

describe('bubbleCornerRadius', () => {
  it('rounds all four corners for a standalone message', () => {
    const radius = bubbleCornerRadius({ isMine: true, isFirstInRun: true, isLastInRun: true });
    expect(radius).toBe('15px 15px 15px 15px');
  });

  describe("the viewer's own (right-aligned) messages", () => {
    it('keeps the left side always rounded and flattens the outer-bottom corner for the first message in a run', () => {
      const radius = bubbleCornerRadius({ isMine: true, isFirstInRun: true, isLastInRun: false });
      // top-left, top-right, bottom-right, bottom-left
      expect(radius).toBe('15px 15px 4px 15px');
    });

    it('flattens both right corners for a middle message in a run', () => {
      const radius = bubbleCornerRadius({ isMine: true, isFirstInRun: false, isLastInRun: false });
      expect(radius).toBe('15px 4px 4px 15px');
    });

    it('keeps the left side always rounded and flattens the outer-top corner for the last message in a run', () => {
      const radius = bubbleCornerRadius({ isMine: true, isFirstInRun: false, isLastInRun: true });
      expect(radius).toBe('15px 4px 15px 15px');
    });
  });

  describe("the other person's (left-aligned) messages", () => {
    it('mirrors the treatment: right side always rounded, left corners vary', () => {
      const first = bubbleCornerRadius({ isMine: false, isFirstInRun: true, isLastInRun: false });
      expect(first).toBe('15px 15px 15px 4px');

      const middle = bubbleCornerRadius({ isMine: false, isFirstInRun: false, isLastInRun: false });
      expect(middle).toBe('4px 15px 15px 4px');

      const last = bubbleCornerRadius({ isMine: false, isFirstInRun: false, isLastInRun: true });
      expect(last).toBe('4px 15px 15px 15px');
    });
  });
});
