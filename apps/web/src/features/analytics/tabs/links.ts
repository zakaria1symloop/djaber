// Links from the analytics tables to the filtered lists: the period of the tab travels as `from` / `to` (the dates
// answered by the API, Africa/Algiers), so the list shows exactly the rows behind the figure.
import type { AnalyticsRange } from '@djaber/shared';

export const listRange = (r: Pick<AnalyticsRange, 'from' | 'to'>) => `from=${r.from}&to=${r.to}`;
