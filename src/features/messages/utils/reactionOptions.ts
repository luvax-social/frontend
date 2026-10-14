/**
 * The six quick reactions, in picker order. They are emoji the sender chose to send, which is user
 * content rather than product copy, and each is already in the server's accepted form (the heart
 * carries its emoji variation selector).
 */
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;

export const REACTION_TRIGGER_ATTRIBUTE = 'data-reaction-trigger';
