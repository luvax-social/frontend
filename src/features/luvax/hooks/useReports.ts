import type { CreateReportRequest, ReportType } from '@/types/domain';
import { getErrorCode } from '@/utils/captchaErrors';
import { getErrorMessage } from '@/utils/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as reportService from '../../../services/report.service';
import { userKeys } from './useUsers';

/**
 * Backend error codes this application handles by name.
 *
 * The axios error normalizer rewrites `error.message`, so branching on message text is
 * unreliable. The `code` field on the response body is left untouched and is what these
 * compare against.
 */
export const REPORT_ERROR_CODES = {
  DUPLICATE: 'REPORT_DUPLICATE',
  SELF_NOT_ALLOWED: 'REPORT_SELF_NOT_ALLOWED',
  TARGET_NOT_FOUND: 'REPORT_TARGET_NOT_FOUND',
};

/** Returns the backend's error code for a failed request, or null when there is none. */
export const getReportErrorCode = (error: unknown) => getErrorCode(error);

/**
 * Turns a failed submission into copy the reader can act on.
 *
 * The duplicate case is deliberately worded as an ordinary outcome rather than a failure.
 * It says the target was already reported without qualifying it by reason, because the
 * server's uniqueness key is (reporter, report type, entity) and excludes the reason:
 * a second report of the same thing is refused whatever reason is chosen. Wording it as
 * "already reported for that reason" would tell the reader a different reason would work,
 * which it would not.
 */
export const describeReportError = (error: unknown) => {
  switch (getReportErrorCode(error)) {
    case REPORT_ERROR_CODES.DUPLICATE:
      return {
        tone: 'neutral',
        title: 'you already reported this',
        message:
          'This is already with our review team, so there is nothing more to send. A report covers the whole item, so it cannot be sent again under a different reason.',
      };
    case REPORT_ERROR_CODES.SELF_NOT_ALLOWED:
      return {
        tone: 'error',
        title: "you can't report your own content",
        message: 'This belongs to you, so there is nothing to report.',
      };
    case REPORT_ERROR_CODES.TARGET_NOT_FOUND:
      return {
        tone: 'error',
        title: 'this is no longer here',
        message: 'It was removed or deleted before the report could be sent.',
      };
    default:
      return {
        tone: 'error',
        title: "that report couldn't be sent",
        message: getErrorMessage(error, '') || 'Please try again.',
      };
  }
};

/**
 * Submits a report.
 *
 * The reported item carries the viewer's own report state, so the item is refetched
 * afterwards and its report control settles into the reported state. This runs on a
 * duplicate rejection too: that answer means the flag is already true on the server and
 * the cached copy is the stale one, which is what makes the up-front state and the
 * duplicate error agree rather than contradict each other.
 *
 * A regular user still cannot list their own reports; GET /reports remains restricted to
 * moderators and administrators.
 */
export const useSubmitReport = () => {
  const queryClient = useQueryClient();

  const refreshReportedItem = (reportType: ReportType) => {
    if (reportType === reportService.REPORT_TYPES.USER) {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      return;
    }

    if (reportType === reportService.REPORT_TYPES.COMMENT) {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['commentReplies'] });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['post'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['explore'] });
    queryClient.invalidateQueries({ queryKey: ['userPosts'] });
  };

  return useMutation({
    mutationFn: (input: CreateReportRequest) => reportService.submitReport(input),
    onSuccess: (_response, variables) => refreshReportedItem(variables?.reportType),
    onError: (error, variables) => {
      if (getReportErrorCode(error) === REPORT_ERROR_CODES.DUPLICATE) {
        refreshReportedItem(variables?.reportType);
      }
    },
  });
};
