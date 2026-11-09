import { apiFetch } from "./api";
import { apiRangeQuery, readPage, readRange, type DateRange } from "./dateRange";
import { getDateContext } from "./dateContext";

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type RawParams = Record<string, string | string[] | undefined>;

/** Everything a dated list page needs from its searchParams: the
 * validated range, the page number, the tenant date context, and a flat
 * copy of the query for links/pickers to preserve. */
export async function readListParams(searchParams: Promise<RawParams>) {
  const params = await searchParams;
  const context = await getDateContext();
  const { range, error } = readRange(params, context.max_span_days);
  const page = readPage(params);
  const query: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) query[k] = Array.isArray(v) ? v[0] : v;
  return { range, error, page, context, query };
}

/** GET a paginated list with the date range + page applied. A page past
 * the end (DRF 404 — e.g. the range shrank under a stale ?page=) falls
 * back to page 1 instead of erroring the whole screen. */
export async function fetchDatedList<T>(
  basePath: string,
  range: DateRange,
  page: number,
): Promise<{ data: Paginated<T>; page: number }> {
  const sep = basePath.includes("?") ? "&" : "?";
  const build = (p: number) => `${basePath}${sep}page=${p}${apiRangeQuery(range)}`;
  let response = await apiFetch(build(page));
  let effectivePage = page;
  if (response.status === 404 && page > 1) {
    response = await apiFetch(build(1));
    effectivePage = 1;
  }
  if (!response.ok) {
    throw new Error(`GET ${build(effectivePage)} failed: ${response.status} ${await response.text()}`);
  }
  return { data: (await response.json()) as Paginated<T>, page: effectivePage };
}
