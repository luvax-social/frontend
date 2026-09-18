import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { SplitView } from '../components/SplitView';
import { buildReportColumns } from '../components/reportColumns';
import { getSplitSelection, withSelection } from '../lib/splitSelection';
import { ReportDetailScreen } from './ReportDetailScreen';
import { useReportQueue } from '../hooks/useReportQueue';
import { useVocabularies } from '../hooks/useVocabularies';

/**
 * The escalated queue: reports a moderator handed up, which only an
 * administrator can close. It is the report list filtered to the escalated
 * status; there is no separate endpoint. The route is administrator-only and
 * unreachable for a moderator, and the navigation badge count comes from the
 * shell rather than from this screen.
 *
 * Opening a row fills the right region rather than navigating to the report's
 * own page, which is what the report queue and the account list already do.
 * Deciding an escalation is a queue to work through, and leaving the screen for
 * each one threw away the list, its scroll position and every page it had
 * loaded, to return to the top of a refetched queue.
 */
export function EscalatedQueueScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { reasonLabel } = useVocabularies();
  const {
    rows,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useReportQueue({ status: 'escalated' });

  const columns = useMemo(() => buildReportColumns(reasonLabel), [reasonLabel]);

  const { selectedId, hasSelection } = getSplitSelection(searchParams, rows);
  const openRecord = (id) => setSearchParams(withSelection(searchParams, id));
  const closeRecord = () => setSearchParams(withSelection(searchParams, null));

  const list = (
    <div>
      <PageHeader title="escalated" />

      <PanelCard padded={false}>
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
          emptyTitle="no escalated reports"
          emptyHint="nothing has been escalated for an administrator decision."
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
      emptyIcon="alert"
      emptyTitle="no report open"
      emptyHint="pick an escalation from the queue to see what was reported and close it."
      detail={
        selectedId ? <ReportDetailScreen key={selectedId} reportId={selectedId} embedded /> : null
      }
    />
  );
}

export default EscalatedQueueScreen;
