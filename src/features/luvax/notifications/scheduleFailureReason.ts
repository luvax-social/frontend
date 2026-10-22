/**
 * The sentence for the reason a scheduled post went back to drafts.
 *
 * The backend records one of a small set of codes with the failure notice; this turns the code into
 * what the author can act on. An unknown code reads generically instead of showing the raw code.
 *
 * @param reason the code from the notice, such as `banned_hashtag`
 */
export function scheduleFailureReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'banned_hashtag':
      return 'a hashtag in it is no longer available. Remove the hashtag to schedule it again.';
    case 'place_unavailable':
      return 'its place is no longer available. Remove or change the place to schedule it again.';
    case 'media_unavailable':
      return 'a photo or video in it is no longer available. Replace it to schedule it again.';
    case 'owner_unavailable':
      return 'your account could not publish it at that time.';
    default:
      return 'it could not be published at the scheduled time.';
  }
}
