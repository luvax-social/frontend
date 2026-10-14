import type { ConfirmConfig } from '@/components/common/ConfirmModal';

/** Confirmation shown before a request is deleted; deleting is silent to the sender. */
export const deleteRequestConfirm = (name: string, onConfirm: () => void): ConfirmConfig => ({
  title: 'delete this request?',
  message: `It will be removed from your requests. ${name} won't be told.`,
  confirmLabel: 'delete',
  onConfirm,
});
