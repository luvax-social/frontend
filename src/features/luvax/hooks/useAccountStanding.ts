import { useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';
import * as configService from '@/services/config.service';
import * as userService from '@/services/user.service';

export const standingKeys = {
  warnings: () => ['users', 'me', 'warnings'],
  vocabularies: () => ['config', 'vocabularies'],
};

/**
 * The warnings issued against the viewer's own account.
 *
 * This is the only part of an account's moderation standing the backend lets
 * the account itself read. A suspension is not readable here or anywhere else:
 * a suspended account is refused at sign-in and every authenticated endpoint
 * answers 401, so it can never load this screen to be told about it. See
 * `docs/user-settings-and-auth-errors/settings-contract-verification.md`.
 */
export const useMyWarnings = () => {
  return useQuery({
    queryKey: standingKeys.warnings(),
    // Wrapped rather than passed by reference: TanStack calls queryFn with a
    // context object, which would otherwise be received as the cursor.
    queryFn: ({ signal }) => userService.getMyWarnings(undefined, undefined, signal),
  });
};

/**
 * The server's report-reason vocabulary, used only to turn a warning's
 * `reasonKey` into the name the server gives that reason. Rarely changes, so it
 * is held for the long stale window.
 */
export const useReportReasonNames = () => {
  return useQuery({
    queryKey: standingKeys.vocabularies(),
    queryFn: ({ signal }) => configService.getVocabularies(signal),
    staleTime: STALE_TIME.LONG,
    select: (envelope) => {
      const reasons = envelope?.data?.reportReasons ?? [];
      return reasons.reduce<Record<string, string>>((names, reason) => {
        if (reason?.key) names[reason.key] = reason.displayName ?? reason.key;
        return names;
      }, {});
    },
  });
};
