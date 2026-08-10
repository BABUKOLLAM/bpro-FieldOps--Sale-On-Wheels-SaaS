"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type EntityInfo = { slug: string; label: string; columns: string[] };
export type RowError = { row: number; message: string };
export type ImportJob = {
  id: string;
  entity_slug: string;
  file_name: string;
  uploaded_by_name: string;
  created_count: number;
  updated_count: number;
  error_count: number;
  errors: RowError[];
  created_at: string;
};

const LINK_CLASS = "font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500";

export default function EntityImportExportCard({
  entity,
  recentJobs,
}: {
  entity: EntityInfo;
  recentJobs: ImportJob[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/proxy/dataio/entities/${entity.slug}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Import failed.");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{entity.label}</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Columns: {entity.columns.join(", ")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        <span className="text-slate-400 dark:text-slate-500">Template:</span>
        <a className={LINK_CLASS} href={`/api/proxy/dataio/entities/${entity.slug}/template?filetype=xlsx`}>
          xlsx
        </a>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <a className={LINK_CLASS} href={`/api/proxy/dataio/entities/${entity.slug}/template?filetype=csv`}>
          csv
        </a>
        <span className="ml-3 text-slate-400 dark:text-slate-500">Export:</span>
        <a className={LINK_CLASS} href={`/api/proxy/dataio/entities/${entity.slug}/export?filetype=xlsx`}>
          xlsx
        </a>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <a className={LINK_CLASS} href={`/api/proxy/dataio/entities/${entity.slug}/export?filetype=csv`}>
          csv
        </a>
      </div>

      <label className="mt-3 inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {uploading ? "Importing…" : "Upload to import"}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="mt-3 rounded-md bg-slate-50 dark:bg-slate-800 p-2 text-xs">
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {result.created_count} created, {result.updated_count} updated
            {result.error_count > 0 && `, ${result.error_count} error${result.error_count === 1 ? "" : "s"}`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-red-600 dark:text-red-400">
              {result.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recentJobs.length > 0 && (
        <details className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer select-none">Recent imports</summary>
          <ul className="mt-1 space-y-1">
            {recentJobs.map((job) => (
              <li key={job.id}>
                {new Date(job.created_at).toLocaleString()} — {job.file_name || "upload"} by{" "}
                {job.uploaded_by_name || "—"}: {job.created_count} created, {job.updated_count} updated,{" "}
                {job.error_count} errors
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
