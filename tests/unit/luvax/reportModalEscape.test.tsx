import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react';

import { ReportModal } from '@/features/luvax/components/ReportModal';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { REPORT_TYPES } from '@/services/report.service';

const target = {
  entityType: REPORT_TYPES.COMMENT,
  entityId: 'c1',
  author: 'someone',
  text: 'a comment',
  avatarUrl: null,
};

function Overlay({
  onOverlayClose,
  onModalClose,
}: {
  onOverlayClose: () => void;
  onModalClose: () => void;
}) {
  useEscapeKey(true, onOverlayClose);
  return <ReportModal target={target} onClose={onModalClose} />;
}

describe('report modal and the overlay it opens over', () => {
  it('closes only the modal when Escape is pressed', () => {
    const onOverlayClose = vi.fn();
    const onModalClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Overlay onOverlayClose={onOverlayClose} onModalClose={onModalClose} />
      </QueryClientProvider>
    );

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(onOverlayClose).not.toHaveBeenCalled();
  });
});
