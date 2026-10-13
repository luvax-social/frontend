/**
 * Moved to `src/utils/requestContract.js`.
 *
 * The declared-key contract is not an administrative concern: the backend
 * rejects an undeclared query parameter or body field on the support endpoints
 * exactly as it does on the admin ones, and the support slice must obey the
 * same rule without importing across feature boundaries.
 *
 * Re-exported here so existing admin call sites keep working unchanged.
 */
export { buildBody, pickParams } from '@/utils/requestContract';
