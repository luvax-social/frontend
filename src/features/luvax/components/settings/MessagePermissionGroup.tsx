import { useState } from 'react';

import type { MessagePermission, UserSettingsResponse } from '@/types/domain';

import { useUpdateMySettings } from '../../hooks/useSettings';
import { SettingsRadioGroup, type RadioOption } from './SettingsRadioGroup';

const OPTIONS: readonly RadioOption<MessagePermission>[] = [
  {
    value: 'everyone',
    label: 'everyone',
    description: "People you don't follow can send one message. It arrives in your requests.",
  },
  {
    value: 'following',
    label: 'people you follow',
    description: 'Only people you follow can start a conversation with you.',
  },
  {
    value: 'nobody',
    label: 'no one',
    description: 'No one new can message you. People you follow each other with still can.',
  },
];

/**
 * Who may start a direct conversation with this account, saved on each choice.
 *
 * Writes `messagePermission` through the shared settings mutation, which shows
 * the choice at once and rolls the cached record back to the snapshot taken
 * before the request if the server refuses it. The failure is stated beside the
 * group so the restored selection is not mistaken for a choice that never took.
 */
export function MessagePermissionGroup({
  settings,
  isLoading,
}: {
  settings?: UserSettingsResponse;
  isLoading: boolean;
}) {
  const updateSettings = useUpdateMySettings();
  const [failure, setFailure] = useState('');

  return (
    <div className="lx-radio-block">
      <h4 className="lx-radio-block-title">who can message you</h4>
      <SettingsRadioGroup
        label="who can message you"
        options={OPTIONS}
        value={settings?.messagePermission}
        disabled={!settings || isLoading}
        onChange={(messagePermission) => {
          setFailure('');
          updateSettings.mutate(
            { messagePermission },
            { onError: () => setFailure("We couldn't save that just now. Try again in a moment.") }
          );
        }}
      />
      {failure ? <div className="lx-settings-error">{failure}</div> : null}
    </div>
  );
}
