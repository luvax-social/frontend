import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { useDeleteNotification, useMarkRead, useMarkUnread } from '../hooks/useNotifications';
import { toast } from '../components/Toast';

/**
 * "mark as read" / "mark as unread" / "delete" for one row. Every mutation is optimistic
 * with its rollback owned by the hook (useNotifications.js); this component only reports
 * a rejection to the user.
 * @param {{item: object, anchorRef: object, open: boolean, onClose: () => void}} props
 */
export function NotificationMenu({ item, anchorRef, open, onClose }) {
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const deleteNotification = useDeleteNotification();

  const onFail = (message) => (error) => toast(error?.message || message);

  return (
    <LxDropdownMenu
      anchorRef={anchorRef}
      open={open}
      onClose={onClose}
      items={[
        !item.isRead && {
          id: 'read',
          icon: 'check',
          label: 'mark as read',
          onClick: () =>
            markRead.mutate(item.id, { onError: onFail("couldn't mark that as read.") }),
        },
        item.isRead && {
          id: 'unread',
          icon: 'mail',
          label: 'mark as unread',
          onClick: () =>
            markUnread.mutate(item.id, { onError: onFail("couldn't mark that as unread.") }),
        },
        {
          id: 'delete',
          icon: 'trash',
          label: 'delete',
          tone: 'danger',
          onClick: () =>
            deleteNotification.mutate(item.id, { onError: onFail("couldn't delete that.") }),
        },
      ]}
    />
  );
}
