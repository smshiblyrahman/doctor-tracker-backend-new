/**
 * Pagination for this service is the shared `$facet` helper; re-exported here so
 * controllers import it from a service-local path like the rest of the utils.
 */
export { paginate, parseSort, buildPaginationMeta } from '@doctor-tracker/common';
