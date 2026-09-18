import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { FilterBar } from '../components/FilterBar';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { SplitView } from '../components/SplitView';
import { buildReportColumns } from '../components/reportColumns';
import { getSplitSelection, withSelection } from '../lib/splitSelection';
import { ReportDetailScreen } from './ReportDetailScreen';
import { useReportQueue } from '../hooks/useReportQueue';
import { useVocabularies } from '../hooks/useVocabularies';
import {
  MODERATOR_REPORT_STATUSES,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
} from '../lib/reportSchema';

/**
 * The report queue. Both roles reach the screen, but the backend returns a
 * moderator only the pending and reviewing reports, so the moderator's status
 * filter offers only those two values; the administrator's offers the full
 * five-value set. See MODERATOR_REPORT_STATUSES in lib/reportSchema.js.
 *
 * First paint is the pending queue at a limit of twenty. Filter state lives in
 * the URL rather than in component state, so a filtered view can be linked and
 * survives a reload. Changing a filter resets pagination, because the query key
 * includes the filter values.
 */
const DEFAULT_STATUS = 'pending';

export function ReportQueueScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { reasonLabel } = useVocabularies();
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const availableStatuses = isAdmin ? REPORT_STATUSES : MODERATOR_REPORT_STATUSES;

  // A null status param means the screen has not been filtered yet, so it
  // defaults to pending; an explicit empty string is the "all" selection.
  const statusParam = searchParams.get('status');
  const status = statusParam === null ? DEFAULT_STATUS : statusParam;
  const reportType = searchParams.get('reportType') ?? '';

  const {
    rows,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useReportQueue({ status, reportType });

  const columns = useMemo(() => buildReportColumns(reasonLabel), [reasonLabel]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      // An explicit empty value is meaningful for status ("all") but not for
      // reportType, so status keeps the empty key and reportType drops it.
      if (key === 'status') {
        next.set(key, '');
      } else {
        next.delete(key);
      }
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });
  const isDirty = status !== DEFAULT_STATUS || reportType !== '';

  // The open record is a history entry of its own, so back walks from one
  // record to the record before it and finally to the bare list.
  const { selectedId, hasSelection } = getSplitSelection(searchParams, rows);
  const openRecord = (id) => setSearchParams(withSelection(searchParams, id));
  const closeRecord = () => setSearchParams(withSelection(searchParams, null));

  const groups = [
    {
      key: 'status',
      label: 'status',
      value: status,
      options: availableStatuses.map((value) => ({ value, label: REPORT_STATUS_LABELS[value] })),
    },
    {
      key: 'reportType',
      label: 'type',
      value: reportType,
      options: REPORT_TYPES.map((value) => ({ value, label: REPORT_TYPE_LABELS[value] })),
    },
  ];

  const list = (
    <div>
      <PageHeader title="reports" />

      <PanelCard padded={false}>
        <FilterBar groups={groups} onChange={setFilter} onClear={clearFilters} isDirty={isDirty} />
        <RecordTable
          columns={columns}
          rows={rows}
          keyField="id"
          onRowClick={(row) => openRecord(row.id)}
          selectedKey={selectedId}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message}
          onRetry={refetch}
          emptyIcon="check"
          emptyTitle="the queue is clear"
          emptyHint="no reports match this view. nothing is waiting for review."
          footer={
            <LoadMore
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          }
        />
      </PanelCard>
    </div>
  );

  return (
    <SplitView
      list={list}
      hasSelection={hasSelection}
      onClose={closeRecord}
      backLabel="back to the queue"
      emptyIcon="flag"
      emptyTitle="no report open"
      emptyHint="pick a report from the queue to see what was reported, who reported it, and what can be done about it."
      detail={
        selectedId ? <ReportDetailScreen key={selectedId} reportId={selectedId} embedded /> : null
      }
    />
  );
}
