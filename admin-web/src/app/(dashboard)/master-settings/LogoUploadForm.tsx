"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoUploadForm({ companyId, currentLogoUrl }: { companyId: string; currentLogoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const response = await fetch(`/api/proxy/company/companies/${companyId}/upload_logo`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setSubmitting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {currentLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentLogoUrl}
          alt="Company logo"
          className="h-10 w-10 rounded border border-slate-200 dark:border-slate-700 object-contain bg-white"
        />
      ) : (
        <span className="text-xs text-slate-400">No logo uploaded</span>
      )}
      <label className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 cursor-pointer">
        {submitting ? "Uploading…" : "Upload logo"}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={submitting} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
