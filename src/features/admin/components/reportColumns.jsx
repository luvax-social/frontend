import { v } from '@/config/tokens';

import { REPORT_TYPE_LABELS } from '../lib/reportSchema';
import { StatusBadge } from './StatusBadge';
import { LocalTime } from './LocalTime';
import { ReporterName } from './ReporterName';

/**
 * The column set for a report list, shared by the report queue and the
 * escalated queue so both render identically. The reason is rendered as its
 * vocabulary display name, never the raw key; the reporter is resolved to a
 * username; the timestamp is shown in the viewer's local zone.
 *
 * @param {(key:string)=>string} reasonLabel from the vocabulary hook
 */
export const buildReportColumns = (reasonLabel) => [
  {
    key: 'type',
    header: 'type',
    nowrap: true,
    render: (row) => (
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: v.ink2,
        }}
      >
        {REPORT_TYPE_LABELS[row.reportType] ?? row.reportType}
      </span>
    ),
  },
  {
    key: 'reason',
    header: 'reason',
    render: (row) => (
      <span style={{ color: v.ink, fontWeight: 500 }}>{reasonLabel(row.reportReason)}</span>
    ),
  },
  {
    key: 'reporter',
    header: 'reporter',
    nowrap: true,
    render: (row) => <ReporterName userId={row.reporterId} />,
  },
  {
    key: 'status',
    header: 'status',
    nowrap: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'created',
    header: 'reported',
    nowrap: true,
    // showZone omitted, as every other panel table does: the zone is the viewer's own and
    // identical on every row, so repeating it per row is noise that costs the column its width.
    // The full instant, in UTC, stays on hover.
    render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
  },
];
