import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/PanelPage';
import { FilterBar } from '../components/FilterBar';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { SplitView } from '../components/SplitView';
import { LocalTime } from '../components/LocalTime';
import { StatusBadge } from '../components/StatusBadge';
import { getSplitSelection, withSelection } from '../lib/splitSelection';
import { useSupportQueue } from '../hooks/useSupportQueue';
import { SupportTicketDetailScreen } from './SupportTicketDetailScreen';
import { TICKET_STATUSES, TICKET_STATUS_LABELS, isAppealTicket } from '../lib/supportTicketSchema';

/**
 * The staff support queue.
 *
 * Filter state lives in the URL, so a filtered view can be linked and survives
 * a reload, matching the report queue and the audit log.
 *
 * First paint is `open`, which is what a reviewer looking for work wants.
 * Claiming a ticket moves it to `in_progress`, so the ticket the reviewer just
 * committed to would drop straight out of the list they were reading. The
 * screen follows it instead: the filter moves with the claim, the row stays
 * selected, and the change is visible in the filter chips rather than hidden.
 */
const DEFAULT_STATUS = 'OPEN';

// The subject is the only column a moderator scans to decide what a ticket is
// about, and it was the one being squeezed: roughly 90px, wrapping a seeded
// subject onto four lines, while the timestamp wrapped onto three inside a card
// that ended well short of the space the column had.
//
// Only the subject declares a width. Under the table's auto layout that claims
// the slack while every other column still sizes to its own content, so the
// badges stay whole and the timestamp stays on one line. Declaring a width on
// all five and switching to a fixed layout does the opposite: it clips whatever
// exceeds its share, which truncated the status badge mid-word.
const columns = [
  {
    key: 'subject',
    header: 'subject',
    width: '50%',
    render: (row) => row.subject,
  },
  {
    key: 'category',
    header: 'category',
    // The appeal marker sits with the category rather than in a column of its
    // own, because it qualifies what the ticket is about and an extra column
    // would take width from the subject, which is the one a reviewer scans.
    //
    // Driven by `admin_action_id`, never by `source`: an appeal opened from a
    // signed-in session arrives as `AUTHENTICATED`, exactly like an ordinary
    // ticket, so source would show nothing. Never by category either, which the
    // authenticated form lets the submitter choose.
    render: (row) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {(row.category ?? '').toLowerCase().replace(/_/g, ' ')}
        {isAppealTicket(row) ? <StatusBadge status="escalated" size="sm" /> : null}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'status',
    nowrap: true,
    render: (row) => <StatusBadge status={(row.status ?? '').toLowerCase()} />,
  },
  {
    key: 'assignedTo',
    header: 'claimed',
    nowrap: true,
    // A badge, not the bare word "no", so it matches the status beside it.
    render: (row) => <StatusBadge status={row.assignedTo ? 'claimed' : 'unclaimed'} />,
  },
  {
    key: 'createdAt',
    header: 'opened',
    nowrap: true,
    render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
  },
];

export function SupportTicketQueueScreen() {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status');
  const status = statusParam === null ? DEFAULT_STATUS : statusParam;

  const {
    rows,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useSupportQueue({ status });

  const { selectedId, hasSelection } = getSplitSelection(searchParams, rows);
  const openRecord = (id) => setSearchParams(withSelection(searchParams, id));
  const closeRecord = () => setSearchParams(withSelection(searchParams, null));

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value ?? '');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });
  const isDirty = status !== DEFAULT_STATUS;

  /**
   * Moves the queue to the status a claim just produced, keeping the ticket
   * open in the detail pane.
   *
   * Without this the reviewer claims a ticket in order to decide it and the
   * list they are looking at goes empty, with nothing saying where the ticket
   * went. Following it is the smaller surprise, and the filter chips show what
   * changed.
   */
  const followClaimedTicket = () => {
    if (status === 'IN_PROGRESS' || !selectedId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('status', 'IN_PROGRESS');
    next.set('selected', selectedId);
    setSearchParams(next, { replace: true });
  };

  const groups = useMemo(
    () => [
      {
        key: 'status',
        label: 'status',
        value: status,
        options: TICKET_STATUSES.map((value) => ({
          value,
          label: TICKET_STATUS_LABELS[value],
        })),
      },
    ],
    [status]
  );

  const list = (
    <div>
      <PageHeader title="support" />

      <div className="lx-admin-panel-card">
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
          emptyTitle="nothing waiting"
          emptyHint="no support tickets match this view."
          footer={
            <LoadMore
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          }
        />
      </div>
    </div>
  );

  return (
    <SplitView
      list={list}
      hasSelection={hasSelection}
      onClose={closeRecord}
      backLabel="back to the queue"
      emptyIcon="flag"
      emptyTitle="no ticket open"
      emptyHint="pick a ticket from the queue to read it and decide what happens next."
      detail={
        selectedId ? (
          <SupportTicketDetailScreen
            key={selectedId}
            ticketId={selectedId}
            onClaimed={followClaimedTicket}
          />
        ) : null
      }
    />
  );
}

export default SupportTicketQueueScreen;
