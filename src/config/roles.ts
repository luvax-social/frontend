import { ROUTES } from '@/config/constants';
import type { Role } from '@/types/auth';

/**
 * The three account roles the backend defines, as the lowercase values that
 * arrive on the login and refresh `user.role`. The access-token claim carries
 * the same values uppercase; every consumer in the app works in lowercase, so
 * casing is normalised once, here, at the point of capture.
 */
export const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;

/**
 * Collapses a role from any source to one of the lowercase ROLES values, or
 * null when it is absent or unrecognised. This is the single normalisation
 * point referenced by the store and the guards, so nothing downstream has to
 * reason about casing.
 */
export const normalizeRole = (role: unknown): Role | null => {
  if (typeof role !== 'string') {
    return null;
  }
  const lowered = role.trim().toLowerCase();
  return lowered === ROLES.USER || lowered === ROLES.MODERATOR || lowered === ROLES.ADMIN
    ? lowered
    : null;
};

/** A moderator or an administrator: the two roles that may reach the panel. */
export const isPanelRole = (role: unknown) => {
  const normalized = normalizeRole(role);
  return normalized === ROLES.MODERATOR || normalized === ROLES.ADMIN;
};

/** An administrator only. Governs the administrator-only route tree and polls. */
export const isAdminRole = (role: unknown) => normalizeRole(role) === ROLES.ADMIN;

/**
 * Where an authenticated account lands after sign-in and where an authenticated
 * visitor to a guest route is sent. A moderator or administrator lands in the
 * panel; an ordinary user lands in the user-facing application. The panel entry
 * redirects onward to the report queue.
 */
export const landingPathForRole = (role: unknown) =>
  isPanelRole(role) ? ROUTES.ADMIN : ROUTES.APP;
