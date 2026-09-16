import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { authApi } from '@/api/authApi';
import { clearAuthAndRedirect } from '@/api/axiosClient';
import { LxAvatar } from '@/components/ui/lx-avatar';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxToggle } from '@/components/ui/lx-toggle';
import { ROUTES } from '@/config/constants';
import { v } from '@/config/tokens';
import { useThemeChoice } from '@/hooks/useThemeChoice';
import { useAuthStore } from '@/store/useAuthStore';
import { extractPageContent } from '@/utils/helpers';
import {
  bioField,
  displayNameField,
  usernameField,
  websiteUrlField,
} from '@/utils/validationFields';
import { useQueryClient } from '@tanstack/react-query';

import { useMediaUpload } from '../hooks/useMediaUpload';
import { appealPath } from '@/utils/appealEntry';
import { useMyWarnings, useReportReasonNames } from '../hooks/useAccountStanding';
import {
  useApproveFollowRequest,
  useBlockedUsers,
  usePendingFollowRequests,
  useRejectFollowRequest,
  useUnblock,
} from '../hooks/useSocial';
import { useMySettings, useUpdateMySettings } from '../hooks/useSettings';
import { useMyProfile, useUpdateMyProfile } from '../hooks/useUsers';
import { LxBtn } from './primitives';
import { SavedPostsScreen } from './SavedPostsScreen';

// ─── Shared pieces ──────────────────────────────────────────────────────────

/**
 * Loading, empty and failure share one framed block, so a category never
 * renders as an unexplained blank region and the layout does not jump when a
 * request resolves into one of them.
 */
function StateBlock({ icon = 'settings', title, hint }) {
  return (
    <div className="lx-settings-state">
      <LxIcon name={icon} size={22} color={v.ink2} />
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

/**
 * Renders whichever of loading, failure or empty applies, or the children when
 * the list has content. `error` wins over `isLoading` so a retry that fails
 * does not fall back to a spinner.
 */
function ListState({ isLoading, error, isEmpty, emptyTitle, emptyHint, emptyIcon, children }) {
  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load this"
        hint="the server did not answer. it is usually a passing thing - reload the page and it should come back."
      />
    );
  }
  if (isLoading) return <StateBlock icon="clock" title="loading" />;
  if (isEmpty) return <StateBlock icon={emptyIcon} title={emptyTitle} hint={emptyHint} />;
  return children;
}

function SettingsRow({ label, sub, control }) {
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
 * A value the server returns but offers no endpoint to change. It renders as
 * text, not as a disabled control: a greyed-out input would imply the value
 * could be edited under some other condition, and none exists.
 */
function ReadonlyRow({ label, sub, value }) {
  return (
    <SettingsRow
      label={label}
      sub={sub}
      control={<div className="lx-settings-readonly">{value}</div>}
    />
  );
}

export function AppearanceCategory() {
  const { dark, setTheme } = useThemeChoice();

  return (
    <div className="lx-settings-card">
      <SettingsRow
        label="dark mode"
        sub={dark ? 'using the dark theme' : 'using the light theme'}
        control={
          <LxToggle
            on={dark}
            onChange={(next) => setTheme(next)}
            label={dark ? 'switch to light mode' : 'switch to dark mode'}
          />
        }
      />
    </div>
  );
}

function PersonRow({ person, actions }) {
  return (
    <div className="lx-settings-person">
      <LxAvatar size={36} src={person?.avatarUrl} />
      <div className="lx-settings-person-text">
        <div className="lx-settings-person-name">{person?.displayName || person?.username}</div>
        <div className="lx-settings-person-handle">@{person?.username}</div>
      </div>
      <div className="lx-settings-person-actions">{actions}</div>
    </div>
  );
}

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * A toggle bound to one boolean on the settings record.
 *
 * The record accepts a partial update and leaves every omitted field alone, so
 * one changed field is the whole body. A failed write rolls back through the
 * mutation hook and says so here rather than leaving the switch showing a value
 * the server never accepted.
 */
function SettingToggle({ settings, field, label, sub, isLoading }) {
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
                {
                  onError: () =>
                    setFailure("we couldn't save that just now. try again in a moment."),
                }
              );
            }}
          />
        }
      />
      {failure ? <div className="lx-settings-error">{failure}</div> : null}
    </div>
  );
}

// ─── Profile ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  username: usernameField,
  displayName: displayNameField,
  bio: bioField,
  websiteUrl: websiteUrlField,
});

/**
 * The profile fields, edited where they are displayed.
 *
 * The values come from `GET /users/me` rather than from the session user in the
 * store: the store carries a lean sign-in payload with no bio, link or privacy
 * flag, so a form seeded from it shows an empty bio to somebody who has one.
 *
 * A save sends only the fields this form owns, all of which are declared on
 * `UpdateProfileRequest`. An unknown field is fatal to the whole request on
 * this endpoint, so nothing else may be added to the body.
 */
export function ProfileCategory() {
  const { data: profileResponse, isLoading, error } = useMyProfile();
  const profile = profileResponse?.data ?? profileResponse;
  const updateProfile = useUpdateMyProfile();
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const { uploadMedia } = useMediaUpload();

  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);

  // Seeds the form once the profile arrives. A later refetch must not overwrite
  // what the person is part-way through typing, so this only fills an empty
  // form rather than tracking the query.
  useEffect(() => {
    if (!profile || form) return;
    const timer = window.setTimeout(() => {
      setForm({
        username: profile.username ?? '',
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        websiteUrl: profile.websiteUrl ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        bannerUrl: profile.bannerUrl ?? '',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile, form]);

  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your profile"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }
  if (isLoading || !form) return <StateBlock icon="clock" title="loading" />;

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    if (fieldErrors[key]) setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const pickImage = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setFormError(
        `please choose an image for your ${field === 'bannerUrl' ? 'banner' : 'picture'}.`
      );
      return;
    }
    setFormError('');
    setUploadingField(field);
    try {
      const result = await uploadMedia(file);
      const cdnUrl = result?.data?.cdnUrl ?? result?.cdnUrl;
      if (cdnUrl) update(field, cdnUrl);
      else setFormError("we couldn't read the uploaded image. try again.");
    } catch (uploadError) {
      setFormError(uploadError?.uploadMessage || "we couldn't upload that image. try again.");
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = () => {
    setFormError('');
    setSaved(false);
    const result = profileSchema.safeParse({
      username: form.username,
      displayName: form.displayName,
      bio: form.bio,
      websiteUrl: form.websiteUrl,
    });
    if (!result.success) {
      const next = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (!next[field]) next[field] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    updateProfile.mutate(
      {
        username: form.username,
        displayName: form.displayName,
        bio: form.bio,
        websiteUrl: form.websiteUrl,
        avatarUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
      },
      {
        onSuccess: (data) => {
          const updated = data?.data ?? data;
          setUser({ ...user, ...updated });
          setSaved(true);
        },
        // The entered values are left exactly as typed. A field-scoped refusal
        // is shown against its field; anything else is shown once above the
        // actions. Nothing is reverted.
        // The refusals this endpoint can return, in the product's own words. A
        // server sentence is never rendered: they are written in a different
        // voice, and the two that matter here are both field-scoped anyway, so
        // they belong against the field rather than in a banner above the form.
        onError: (saveError) => {
          if (saveError?.fieldErrors) {
            setFieldErrors(saveError.fieldErrors);
            return;
          }
          if (saveError?.response?.data?.code === 'USER_USERNAME_ALREADY_EXISTS') {
            setFieldErrors({ username: 'that username is taken. try a different one.' });
            return;
          }
          setFormError("we couldn't save your profile just now. try again in a moment.");
        },
      }
    );
  };

  const fieldProps = (key) => ({
    value: form[key],
    onChange: (event) => update(key, event.target.value),
    'aria-invalid': fieldErrors[key] ? 'true' : undefined,
  });

  return (
    <div>
      {formError ? <div className="lx-settings-banner">{formError}</div> : null}

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">picture and banner</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}>
          <LxAvatar size={64} src={form.avatarUrl} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <LxBtn
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={uploadingField === 'avatarUrl'}
            >
              {uploadingField === 'avatarUrl' ? 'uploading' : 'change picture'}
            </LxBtn>
            <LxBtn
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => bannerInput.current?.click()}
              disabled={uploadingField === 'bannerUrl'}
            >
              {uploadingField === 'bannerUrl' ? 'uploading' : 'change banner'}
            </LxBtn>
          </div>
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          hidden
          aria-label="upload a new picture"
          onChange={(event) => pickImage(event, 'avatarUrl')}
        />
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          hidden
          aria-label="upload a new banner"
          onChange={(event) => pickImage(event, 'bannerUrl')}
        />
      </div>

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">about you</h3>

        <div className="lx-settings-field">
          <label className="lx-settings-label" htmlFor="lx-display-name">
            display name
          </label>
          <input
            id="lx-display-name"
            className="lx-settings-input"
            {...fieldProps('displayName')}
          />
          {fieldErrors.displayName ? (
            <div className="lx-settings-error">{fieldErrors.displayName}</div>
          ) : null}
        </div>

        <div className="lx-settings-field">
          <label className="lx-settings-label" htmlFor="lx-username">
            username
          </label>
          <input id="lx-username" className="lx-settings-input" {...fieldProps('username')} />
          {fieldErrors.username ? (
            <div className="lx-settings-error">{fieldErrors.username}</div>
          ) : null}
        </div>

        <div className="lx-settings-field">
          <label className="lx-settings-label" htmlFor="lx-bio">
            bio
          </label>
          <textarea id="lx-bio" className="lx-settings-textarea" {...fieldProps('bio')} />
          {fieldErrors.bio ? <div className="lx-settings-error">{fieldErrors.bio}</div> : null}
        </div>

        <div className="lx-settings-field">
          <label className="lx-settings-label" htmlFor="lx-website">
            link
          </label>
          <input
            id="lx-website"
            className="lx-settings-input"
            placeholder="example.com"
            {...fieldProps('websiteUrl')}
          />
          {fieldErrors.websiteUrl ? (
            <div className="lx-settings-error">{fieldErrors.websiteUrl}</div>
          ) : null}
        </div>
      </div>

      <div className="lx-settings-actions">
        <LxBtn
          variant="primary"
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? 'saving' : 'save changes'}
        </LxBtn>
        {saved ? <span className="lx-settings-saved">saved</span> : null}
      </div>
    </div>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

/**
 * The five notification preferences the settings record actually carries.
 * There is no story-view preference: `notify_*` covers likes, comments,
 * follows, mentions and messages and nothing else, so no sixth row is drawn.
 */
export function NotificationsCategory() {
  const { data: response, isLoading, error } = useMySettings();
  const settings = response?.data ?? response;

  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your notification settings"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }

  return (
    <div>
      <SettingToggle
        settings={settings}
        isLoading={isLoading}
        field="notifyLikes"
        label="likes"
        sub="when someone likes your post or comment"
      />
      <SettingToggle
        settings={settings}
        isLoading={isLoading}
        field="notifyComments"
        label="comments and replies"
        sub="when someone comments on your post or replies to you"
      />
      <SettingToggle
        settings={settings}
        isLoading={isLoading}
        field="notifyFollows"
        label="new followers"
        sub="when someone follows you or asks to"
      />
      <SettingToggle
        settings={settings}
        isLoading={isLoading}
        field="notifyMentions"
        label="mentions"
        sub="when someone mentions you"
      />
      <SettingToggle
        settings={settings}
        isLoading={isLoading}
        field="notifyMessages"
        label="messages"
        sub="when someone sends you a message"
      />
    </div>
  );
}

// ─── Privacy ────────────────────────────────────────────────────────────────

/**
 * Audience controls. `isPrivate` lives on the profile record and the other
 * three live on the settings record, so this category writes to two endpoints.
 * Both accept a partial body and leave omitted fields alone.
 */
export function PrivacyCategory() {
  const { data: profileResponse, isLoading: profileLoading, error: profileError } = useMyProfile();
  const profile = profileResponse?.data ?? profileResponse;
  const updateProfile = useUpdateMyProfile();
  const {
    data: settingsResponse,
    isLoading: settingsLoading,
    error: settingsError,
  } = useMySettings();
  const settings = settingsResponse?.data ?? settingsResponse;
  const [privateFailure, setPrivateFailure] = useState('');

  const error = profileError || settingsError;
  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your privacy settings"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }

  return (
    <div>
      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">your account</h3>
        <SettingsRow
          label="private account"
          sub="only followers you approve can see your posts"
          control={
            <LxToggle
              label="private account"
              on={Boolean(profile?.isPrivate)}
              disabled={!profile || profileLoading}
              busy={updateProfile.isPending}
              onChange={(value) => {
                setPrivateFailure('');
                updateProfile.mutate(
                  { isPrivate: value },
                  {
                    onError: () =>
                      setPrivateFailure("we couldn't save that just now. try again in a moment."),
                  }
                );
              }}
            />
          }
        />
        {privateFailure ? <div className="lx-settings-error">{privateFailure}</div> : null}
      </div>

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">what others can see and do</h3>
        <SettingToggle
          settings={settings}
          isLoading={settingsLoading}
          field="showActivityStatus"
          label="show activity status"
          sub="let people see when you were last active"
        />
        <SettingToggle
          settings={settings}
          isLoading={settingsLoading}
          field="allowStoryReplies"
          label="allow story replies"
          sub="people can message you in response to a story"
        />
        <SettingToggle
          settings={settings}
          isLoading={settingsLoading}
          field="allowMessageRequests"
          label="allow message requests"
          sub="people you do not follow can message you"
        />
        <SettingToggle
          settings={settings}
          isLoading={settingsLoading}
          field="suggestible"
          label="suggest my account to others"
          sub="turn this off and you will not appear in anyone's suggested accounts"
        />
      </div>
    </div>
  );
}

// ─── Follow requests ────────────────────────────────────────────────────────

/**
 * Incoming follow requests. Only a private account accumulates them; a public
 * account's list is legitimately empty and says so rather than implying the
 * screen failed.
 */
export function RequestsCategory() {
  const { data: response, isLoading, error } = usePendingFollowRequests();
  const requests = extractPageContent(response);
  const approve = useApproveFollowRequest();
  const reject = useRejectFollowRequest();
  const { data: profileResponse } = useMyProfile();
  const profile = profileResponse?.data ?? profileResponse;
  const [failure, setFailure] = useState('');

  const act = (mutation, requesterId) => {
    setFailure('');
    mutation.mutate(requesterId, {
      onError: () => setFailure("we couldn't do that just now. try again in a moment."),
    });
  };

  return (
    <div>
      {failure ? <div className="lx-settings-banner">{failure}</div> : null}
      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={requests.length === 0}
        emptyIcon="profile"
        emptyTitle="no one is waiting"
        emptyHint={
          profile && !profile.isPrivate
            ? 'your account is public, so people follow you without asking first.'
            : 'nobody has asked to follow you right now.'
        }
      >
        <div>
          {requests.map((request) => (
            <PersonRow
              key={request.id}
              person={request.follower}
              actions={
                <>
                  <LxBtn
                    variant="primary"
                    size="sm"
                    type="button"
                    disabled={approve.isPending}
                    onClick={() => act(approve, request.follower?.id ?? request.id)}
                  >
                    approve
                  </LxBtn>
                  <LxBtn
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={reject.isPending}
                    onClick={() => act(reject, request.follower?.id ?? request.id)}
                  >
                    decline
                  </LxBtn>
                </>
              }
            />
          ))}
        </div>
      </ListState>
    </div>
  );
}

// ─── Blocked accounts ───────────────────────────────────────────────────────

/**
 * Blocked accounts, with unblock in place.
 *
 * Unblocking is not put behind a confirmation: it restores access rather than
 * destroying anything, and the application's confirmation vocabulary is
 * reserved for the direction that does destroy something. What unblocking does
 * not do - restore the follow edges the block removed - is stated on the
 * screen, because that is the consequence a person is most likely to assume
 * wrongly.
 */
export function BlockedCategory() {
  const { data: response, isLoading, error } = useBlockedUsers();
  const blocked = extractPageContent(response);
  const unblock = useUnblock();
  const [failure, setFailure] = useState('');
  const [pendingId, setPendingId] = useState(null);

  return (
    <div>
      {failure ? <div className="lx-settings-banner">{failure}</div> : null}
      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={blocked.length === 0}
        emptyIcon="ban"
        emptyTitle="you have not blocked anyone"
        emptyHint="accounts you block stop seeing you, and you stop seeing them."
      >
        <div>
          <p className="lx-settings-note" style={{ marginBottom: 12 }}>
            unblocking lets an account see you again. it does not restore the follows the block
            removed — either of you would have to follow the other again.
          </p>
          {blocked.map((entry) => (
            <PersonRow
              key={entry.user?.id}
              person={entry.user}
              actions={
                <LxBtn
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={unblock.isPending && pendingId === entry.user?.id}
                  onClick={() => {
                    setFailure('');
                    setPendingId(entry.user?.id);
                    unblock.mutate(entry.user?.id, {
                      onError: () =>
                        setFailure("we couldn't unblock them just now. try again in a moment."),
                    });
                  }}
                >
                  {unblock.isPending && pendingId === entry.user?.id ? 'unblocking' : 'unblock'}
                </LxBtn>
              }
            />
          ))}
        </div>
      </ListState>
    </div>
  );
}

// ─── Saved posts ────────────────────────────────────────────────────────────

/**
 * The viewer's saved posts. Not a preference, and it is filed here only because
 * this screen is the one place the list is reachable from; removing the entry
 * would take a working capability away.
 */
export function SavedCategory() {
  return <SavedPostsScreen />;
}

// ─── Account ────────────────────────────────────────────────────────────────

/**
 * What is true about the account, and how a person gets into it.
 *
 * Everything above the actions is read-only because no endpoint writes it. The
 * email address in particular is rejected outright by the profile endpoint, so
 * it is shown as information rather than as a field that looks editable.
 *
 * A suspension is deliberately absent. A suspended account is refused at
 * sign-in and answered 401 on every authenticated endpoint, so it can never
 * load this screen; there is no state in which this category could render one.
 * The refusal is surfaced where it actually happens, on the sign-in screen.
 */
export function AccountCategory() {
  const { data: profileResponse, isLoading, error } = useMyProfile();
  const profile = profileResponse?.data ?? profileResponse;
  const sessionUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToSupport = () => navigate(ROUTES.SETTINGS_SUPPORT);
  const goToAppeal = (adminActionId) => navigate(appealPath(adminActionId));

  const {
    data: warningsResponse,
    isLoading: warningsLoading,
    error: warningsError,
  } = useMyWarnings();
  const warnings = extractPageContent(warningsResponse);
  const { data: reasonNames } = useReportReasonNames();

  const [resetState, setResetState] = useState('idle');
  const [resetError, setResetError] = useState('');

  const sendReset = async () => {
    setResetError('');
    setResetState('sending');
    try {
      await authApi.forgotPassword({ email: profile?.email ?? sessionUser?.email });
      setResetState('sent');
    } catch {
      setResetState('idle');
      setResetError("we couldn't send that email just now. try again in a moment.");
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch {
      // The session is being discarded either way; a failed logout call must
      // not strand the person on a screen they meant to leave.
    }
    queryClient.clear();
    clearAuthAndRedirect();
  };

  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your account"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }
  if (isLoading) return <StateBlock icon="clock" title="loading" />;

  return (
    <div>
      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">your details</h3>
        <ReadonlyRow
          label="email"
          sub="the address you sign in with. it cannot be changed here."
          value={profile?.email ?? '—'}
        />
        <ReadonlyRow
          label="verified"
          sub="whether luvax has confirmed who you are"
          value={profile?.isVerified ? 'yes' : 'not verified'}
        />
        <ReadonlyRow
          label="account"
          sub="who can see your posts"
          value={profile?.isPrivate ? 'private' : 'public'}
        />
        <ReadonlyRow label="joined" value={formatDate(profile?.createdAt)} />
        {/*
          A badge is asked for through support, where every other request to a
          human already goes. This section used to carry the request form
          itself, which made it the only support-shaped surface anywhere in the
          product and the only one the maintainer could find - while the help
          centre, which had the same form and every other kind of request
          besides, had no entry point at all. The form is gone from here; this
          is the pointer left in its place, because somebody looking for it will
          look here first.
        */}
        {profile?.isVerified ? null : (
          <div style={{ marginTop: 14 }}>
            <p className="lx-settings-note">
              asking for a verified badge is a support request, like appealing a decision or
              reporting a problem.
            </p>
            {/* Its own control rather than a link inside the sentence: an
                inline link cannot carry a 44px target without breaking the
                line box it sits in. */}
            <button type="button" className="lx-settings-textlink" onClick={goToSupport}>
              open support
            </button>
          </div>
        )}
      </div>

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">your standing</h3>
        <ListState
          isLoading={warningsLoading}
          error={warningsError}
          isEmpty={warnings.length === 0}
          emptyIcon="check"
          emptyTitle="your account is in good standing"
          emptyHint="no moderator has issued a warning against this account."
        >
          <div>
            {warnings.map((warning) => (
              <div key={warning.id} className="lx-settings-warning">
                <div className="lx-settings-warning-reason">
                  {(
                    reasonNames?.[warning.reasonKey] ??
                    warning.reasonKey ??
                    'warning'
                  ).toLowerCase()}
                </div>
                {warning.note ? (
                  <div className="lx-settings-warning-note">{warning.note}</div>
                ) : null}
                <div className="lx-settings-warning-when">{formatDate(warning.createdAt)}</div>
                {/* The in-product route to contest this. Before it existed, the
                    only way to appeal a warning was a link inside the email
                    that announced it, so a lost email meant a lost appeal. */}
                {warning.adminActionId ? (
                  <button
                    type="button"
                    className="lx-settings-textlink"
                    onClick={() => goToAppeal(warning.adminActionId)}
                  >
                    appeal this warning
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </ListState>
      </div>

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">password</h3>
        {resetState === 'sent' ? (
          <p className="lx-settings-note">
            we sent a link to {profile?.email}. open it to choose a new password. it expires in
            fifteen minutes.
          </p>
        ) : (
          <>
            <p className="lx-settings-note" style={{ marginBottom: 12 }}>
              changing your password is done by email. we send a link to {profile?.email} and you
              choose the new one there.
            </p>
            {resetError ? <div className="lx-settings-error">{resetError}</div> : null}
            <LxBtn
              variant="secondary"
              size="sm"
              type="button"
              onClick={sendReset}
              disabled={resetState === 'sending'}
            >
              {resetState === 'sending' ? 'sending' : 'send me a reset link'}
            </LxBtn>
          </>
        )}
      </div>

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">signing out</h3>
        <LxBtn variant="ghost" size="sm" type="button" onClick={signOut}>
          sign out
        </LxBtn>
      </div>
    </div>
  );
}
