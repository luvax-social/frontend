/**
 * The backend rejects any undeclared query parameter on `/api/v1/admin/**` with
 * 400 and any undeclared request-body field anywhere with 400. The two common
 * React shortcuts, spreading a filter object into `params` and handing a form's
 * whole state to a request body, both fail here.
 *
 * These helpers are the single mechanism the panel uses to obey that contract:
 * a query serialiser that keeps only an endpoint's declared parameter keys, and
 * a body builder that is written out field by field at every call site.
 */

/**
 * Reduces a filter object to only the keys an endpoint declares, dropping any
 * value that is undefined, null, or an empty or whitespace-only string. The
 * result is safe to hand to Axios `params`.
 *
 * Every list call passes its own declared-key list so a stray filter key can
 * never reach the wire, which is enforced even on the report endpoints that do
 * not police it, so the same defensive habit holds everywhere.
 *
 * @param {Object} filters the caller's filter state, possibly with extra keys
 * @param {string[]} declaredKeys the exact parameter names the endpoint accepts
 * @returns {Object} a params object containing only declared, meaningful values
 */
export const pickParams = (filters = {}, declaredKeys = []) => {
  const out = {};
  for (const key of declaredKeys) {
    const value = filters?.[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    out[key] = value;
  }
  return out;
};

/**
 * Builds a request body from an explicit field map, dropping only keys whose
 * value is undefined. A null is preserved because some fields are meaningfully
 * null; an empty string is preserved because the caller chose to send it.
 *
 * This exists so a body is assembled from a written-out mapping rather than by
 * spreading form state; every call site lists its fields by hand, and this only
 * removes the undefined ones.
 *
 * @param {Object} fields an object whose keys are exactly the declared body fields
 * @returns {Object} the same object without its undefined-valued keys
 */
export const buildBody = (fields = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    out[key] = value;
  }
  return out;
};
