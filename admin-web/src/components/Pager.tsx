import Link from "next/link";

/** Prev/Next links for a DRF page-number list, preserving the page's
 * other query params (e.g. the from/to date range). Server component. */
export default function Pager({
  pathname,
  query,
  page,
  count,
  pageSize = 50,
}: {
  pathname: string;
  query: Record<string, string | undefined>;
  page: number;
  count: number;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const linkClass =
    "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      {page > 1 && <Link className={linkClass} href={href(page - 1)}>Previous</Link>}
      <span>
        Page {page} of {pages} · {count} records
      </span>
      {page < pages && <Link className={linkClass} href={href(page + 1)}>Next</Link>}
    </nav>
  );
}
