import type { AdminActionResponse, AdminPostRestoreResponse } from '@/types/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';

/**
 * The four content types a reviewer can take down and put back, each mapped to
 * its endpoint pair. Stories and messages joined posts and comments when the
 * backend added their four endpoints; before that a reported story or message
 * was rendered read-only.
 *
 * A map rather than a chain of ternaries: with four types a ternary chain has a
 * silent default, and the default would have been "treat it as a comment".
 */
const REMOVE_BY_TYPE = {
  post: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.removePost(id, reason, reportId),
  comment: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.removeComment(id, reason, reportId),
  story: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.removeStory(id, reason, reportId),
  message: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.removeMessage(id, reason, reportId),
};

const RESTORE_BY_TYPE = {
  post: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.restorePost(id, reason, reportId),
  comment: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.restoreComment(id, reason, reportId),
  story: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.restoreStory(id, reason, reportId),
  message: (id: string, reason: string, reportId: string | null | undefined) =>
    adminApi.restoreMessage(id, reason, reportId),
};

/**
 * The mutations a reviewer performs from the report detail screen.
 *
 * Every mutation invalidates the queries whose result it changed, so the report
 * and its target refetch after an action rather than showing stale state. A
 * conflict (another reviewer acted first, or a double submit) is surfaced by the
 * screen as a calm message; the refetch that follows comes from these
 * invalidations.
 *
 * Mutations do not auto-retry, so a 429 or a conflict never turns into a burst.
 */
export function useReportActions(reportId: string | null | undefined) {
  const queryClient = useQueryClient();

  const invalidateReport = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'report', reportId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'report-target', reportId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
  };

  const invalidateEscalation = () => {
    invalidateReport();
    queryClient.invalidateQueries({ queryKey: ['admin', 'escalated-count'] });
  };

  const markReviewing = useMutation({
    mutationFn: () => adminApi.markReviewing(reportId!),
    onSuccess: invalidateReport,
  });

  const escalate = useMutation({
    mutationFn: (reason: string) => adminApi.escalateReport(reportId!, reason),
    onSuccess: invalidateEscalation,
  });

  const resolve = useMutation({
    mutationFn: (reason: string) => adminApi.resolveReport(reportId!, reason),
    onSuccess: invalidateEscalation,
  });

  const dismiss = useMutation({
    mutationFn: (reason: string) => adminApi.dismissReport(reportId!, reason),
    onSuccess: invalidateEscalation,
  });

  const removeContent = useMutation({
    mutationFn: ({
      targetType,
      entityId,
      reason,
    }: {
      targetType: 'post' | 'comment' | 'story' | 'message';
      entityId: string;
      reason: string;
    }) => REMOVE_BY_TYPE[targetType](entityId, reason, reportId),
    onSuccess: invalidateReport,
  });

  const restoreContent = useMutation<
    AdminActionResponse | AdminPostRestoreResponse,
    Error,
    { targetType: 'post' | 'comment' | 'story' | 'message'; entityId: string; reason: string }
  >({
    mutationFn: ({
      targetType,
      entityId,
      reason,
    }: {
      targetType: 'post' | 'comment' | 'story' | 'message';
      entityId: string;
      reason: string;
    }) => RESTORE_BY_TYPE[targetType](entityId, reason, reportId),
    onSuccess: invalidateReport,
  });

  return { markReviewing, escalate, resolve, dismiss, removeContent, restoreContent };
}
