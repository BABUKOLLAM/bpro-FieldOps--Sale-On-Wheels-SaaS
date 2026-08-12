"use client";

/** Client-side CSV export from data already on the page — a practical
 * substitute for FM-13's "exportable to Excel/PDF and emailable," which
 * would need real server-side document generation + email delivery
 * infrastructure this slice doesn't build. Opens as a plain download; any
 * spreadsheet app opens a CSV natively. */
export default function ExportCsvButton({
  data,
  filename,
}: {
  data: Record<string, unknown>[];
  filename: string;
}) {
  function handleExport() {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const escape = (value: unknown) => {
      const str = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = [headers.join(","), ...data.map((row) => headers.map((h) => escape(row[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
    >
      Export CSV
    </button>
  );
}
