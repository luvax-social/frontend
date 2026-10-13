import type { ReactNode } from 'react';
import { useState } from 'react';

import { LxIcon } from '@/components/ui/lx-icon';
import { LxToggle } from '@/components/ui/lx-toggle';
import { v } from '@/config/tokens';
import type { UserSettingsResponse } from '@/types/domain';

import { useUpdateMySettings } from '../../hooks/useSettings';

type BooleanSetting = {
  [K in keyof UserSettingsResponse]: NonNullable<UserSettingsResponse[K]> extends boolean
    ? K
    : never;
}[keyof UserSettingsResponse] &
  string;

/**
 * Loading, empty and failure share one framed block, so a category never
 * renders as an unexplained blank region and the layout does not jump when a
 * request resolves into one of them.
 */
export function StateBlock({
  icon = 'settings',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="lx-settings-state">
      <LxIcon name={icon} size={22} color={v.ink2} />
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

export function SettingsRow({
  label,
  sub,
  control,
}: {
  label: string;
  sub?: string;
  control?: ReactNode;
}) {
  return (
    <div className="lx-settings-row">
      <div className="lx-settings-row-text">
        <div className="lx-settings-row-label">{label}</div>
        {sub ? <div className="lx-settings-row-sub">{sub}</div> : null}
      </div>
      {control}
    </div>
  );
}

/**
 * A toggle bound to one boolean on the settings record.
 *
 * The record accepts a partial update and leaves every omitted field alone, so
 * one changed field is the whole body. A failed write rolls back through the
 * mutation hook and says so here rather than leaving the switch showing a value
 * the server never accepted.
 */
export function SettingToggle({
  settings,
  field,
  label,
  sub,
  isLoading,
  failureMessage = "we couldn't save that just now. try again in a moment.",
}: {
  settings?: UserSettingsResponse;
  field: BooleanSetting;
  label: string;
  sub?: string;
  isLoading: boolean;
  failureMessage?: string;
}) {
  const updateSettings = useUpdateMySettings();
  const [failure, setFailure] = useState('');

  return (
    <div>
      <SettingsRow
        label={label}
        sub={sub}
        control={
          <LxToggle
            label={label}
            on={settings ? Boolean(settings[field]) : false}
            disabled={!settings || isLoading}
            busy={updateSettings.isPending}
            onChange={(value) => {
              setFailure('');
              updateSettings.mutate(
                { [field]: value },
                { onError: () => setFailure(failureMessage) }
              );
            }}
          />
        }
      />
      {failure ? <div className="lx-settings-error">{failure}</div> : null}
    </div>
  );
}
