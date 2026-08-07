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
      className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
    >
      Export CSV
    </button>
  );
}
