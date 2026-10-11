// Wire contracts mirror support and verification backend DTO records.
import type { UserSummaryResponse } from './domain';

// modules/support/dto/response/SupportTicketResponse.java
export interface SupportTicketResponse {
  id: string;
  category: SupportCategory;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  source: SupportSource;
  staffResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export type SupportCategory =
  | 'APPEAL_BAN'
  | 'APPEAL_SUSPENSION'
  | 'APPEAL_WARNING_STRIKE'
  | 'APPEAL_CONTENT_REMOVAL'
  | 'ACCOUNT_ACCESS'
  | 'ACCOUNT_DATA'
  | 'BUG_REPORT'
  | 'SAFETY_CONCERN'
  | 'OTHER'
  | 'VERIFICATION_REQUEST';

export type SupportTicketStatus =
  | 'PENDING_CONFIRMATION'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'ANSWERED'
  | 'REJECTED';

export type SupportSource = 'AUTHENTICATED' | 'SIGNED_LINK' | 'PUBLIC_FORM';

// modules/support/dto/response/SupportTicketStaffResponse.java
export interface SupportTicketStaffResponse {
  id: string;
  userId: string | null;
  contactEmail: string;
  category: SupportCategory;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  source: SupportSource;
  adminActionId: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  staffResponse: string | null;
  internalNote: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  escalatedBy: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  createdAt: string;
}

// modules/support/dto/response/AppealSubmittedResponse.java
export interface AppealSubmittedResponse {
  ticket: SupportTicketResponse;
  statusToken: string;
}

// modules/support/dto/response/AppealLinkResponse.java
export interface AppealLinkResponse {
  category: SupportCategory;
}

// modules/support/dto/response/VerificationCategoryResponse.java
export interface VerificationCategoryResponse {
  categoryKey: string;
  displayName: string;
  covers: string;
  iconKey: string;
}

// modules/support/dto/response/VerificationStateResponse.java
export interface VerificationStateResponse {
  verified: boolean;
  categoryKey: string | null;
  iconKey: string | null;
  verifiedSince: string | null;
  pendingRequestId: string | null;
  requestStatus: string | null;
  requestCategoryKey: string | null;
  requestedAt: string | null;
  decisionReason: string | null;
  canRequest: boolean;
}

// modules/support/dto/response/VerificationQueueItemResponse.java
export interface VerificationQueueItemResponse {
  ticketId: string;
  requester: UserSummaryResponse;
  status: string;
  assignedTo: string | null;
  categoryKey: string;
  claimedName: string;
  evidenceFieldCount: number;
  evidenceWebsite: string | null;
  evidenceOtherProfile: string | null;
  evidenceEmailDomain: string | null;
  evidencePublishedWork: string | null;
  evidencePress: string | null;
  evidenceOfficialListing: string | null;
  evidenceNote: string | null;
  createdAt: string;
  previousGrants: VerificationGrantResponse[];
}

// modules/support/dto/response/VerificationGrantResponse.java
export interface VerificationGrantResponse {
  id: string;
  categoryKey: string;
  grantedAt: string;
  revokedAt: string | null;
  revocationActor: string | null;
  revocationReason: string | null;
}

// modules/support/dto/request/CreateSupportTicketRequest.java
export interface CreateSupportTicketRequest {
  category: SupportCategory;
  subject: string;
  body: string;
}

// modules/support/dto/request/SignedAppealRequest.java
export interface SignedAppealRequest {
  token: string;
  subject: string;
  body: string;
}

// modules/support/dto/request/InProductAppealRequest.java
export interface InProductAppealRequest {
  adminActionId: string;
  subject: string;
  body: string;
}

// modules/support/dto/request/ResendAppealLinkRequest.java
export interface ResendAppealLinkRequest {
  contactEmail: string;
  turnstileToken: string;
}

// modules/support/dto/request/PublicSupportTicketRequest.java
export interface PublicSupportTicketRequest {
  contactEmail: string;
  category: SupportCategory;
  subject: string;
  body: string;
  turnstileToken: string;
}

// modules/support/dto/request/CreateVerificationRequest.java
export interface CreateVerificationRequest {
  categoryKey: string;
  claimedName: string;
  evidenceWebsite?: string | null;
  evidenceOtherProfile?: string | null;
  evidenceEmailDomain?: string | null;
  evidencePublishedWork?: string | null;
  evidencePress?: string | null;
  evidenceOfficialListing?: string | null;
  evidenceNote?: string | null;
}

// modules/support/dto/request/RespondSupportTicketRequest.java
export interface RespondSupportTicketRequest {
  staffResponse: string;
  internalNote?: string;
}

// modules/support/dto/request/EscalateSupportTicketRequest.java
export interface EscalateSupportTicketRequest {
  reason: string;
}

// modules/support/dto/request/VerificationDecisionRequest.java
export interface VerificationDecisionRequest {
  reason: string;
  internalNote?: string | null;
}
