import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { extractPageContent, getDisplayName, getUserSummary } from '@/utils/helpers';
import { LxAvatar, LxBtn, LxIcon } from '../components/primitives';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';
import {
  useApproveFollowRequest,
  usePendingFollowRequests,
  useRejectFollowRequest,
} from '../hooks/useSocial';
import { routeTo } from '@/config/constants';
import { toast } from '../components/Toast';

const requesterId = (request, follower) =>
  request?.id || request?.requesterId || request?.followerId || follower?.id || null;

/**
 * The sub-view the pinned entry opens: every pending follow request, each with its own
 * Confirm and Delete. Keyed on the resolved requester id (fixing D20, which used to key
 * by array index).
 * @param {{onBack: () => void}} props
 */
export function FollowRequestsView({ onBack }) {
  const navigate = useNavigate();
  const { data: requestsResponse, isLoading } = usePendingFollowRequests();
  const approve = useApproveFollowRequest();
  const reject = useRejectFollowRequest();
  const requests = extractPageContent(requestsResponse);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: `1px solid ${v.border}`,
          position: 'sticky',
          top: 0,
          background: v.base,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="back to notifications"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <LxIcon name="back" size={20} color={v.ink} />
        </button>
        <span style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 600, color: v.ink }}>
          follow requests
        </span>
      </div>

      {isLoading ? (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            fontFamily: v.fontMono,
            fontSize: 12,
            color: v.ink3,
          }}
        >
          loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink3,
          }}
        >
          No pending requests.
        </div>
      ) : (
        requests.map((request) => {
          const user = getUserSummary(request, 'follower');
          const id = requesterId(request, user);
          return (
            <div
              key={id ?? user.username}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${v.borderSubtle}`,
              }}
            >
              <LxAvatar size={40} src={user.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
                <LxVerifiedName
                  name={getDisplayName(user)}
                  verified={user.isVerified}
                  category={user.verifiedCategory}
                  size={12}
                  onClick={() => user.id && navigate(routeTo.userProfile(user.id))}
                  textStyle={{
                    fontFamily: v.fontBody,
                    fontSize: 14,
                    fontWeight: 600,
                    color: v.ink,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexShrink: 0 }}>
                <LxBtn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!id) {
                      toast("couldn't find that follow request. refresh and try again.");
                      return;
                    }
                    approve.mutate(id, {
                      onError: (error) =>
                        toast(error?.message || "couldn't confirm that request. try again."),
                    });
                  }}
                >
                  confirm
                </LxBtn>
                <LxBtn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!id) {
                      toast("couldn't find that follow request. refresh and try again.");
                      return;
                    }
                    reject.mutate(id, {
                      onError: (error) =>
                        toast(error?.message || "couldn't delete that request. try again."),
                    });
                  }}
                >
                  delete
                </LxBtn>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
