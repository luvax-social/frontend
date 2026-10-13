import type { ReportType } from './domain';

export interface ReportTarget {
  entityType: ReportType;
  entityId: string;
  author?: string | null;
  text?: string | null;
  avatarUrl?: string | null;
}
