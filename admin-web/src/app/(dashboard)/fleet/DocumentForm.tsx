"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type Vehicle = { id: string; reg_no: string };
type User = { id: string; username: string; first_name: string; is_field_agent: boolean };

const DOC_TYPES = [
  { value: "rc", label: "Registration Certificate" },
  { value: "insurance", label: "Insurance" },
  { value: "permit", label: "Permit" },
  { value: "puc", label: "PUC Certificate" },
  { value: "driving_license", label: "Driving License" },
];

export default function DocumentForm({ vehicles, agents }: { vehicles: Vehicle[]; agents: User[] }) {
  const router = useRouter();
  const [holderType, setHolderType] = useState<"vehicle" | "agent">("vehicle");
  const [holderId, setHolderId] = useState("");
  const [documentType, setDocumentType] = useState("rc");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/fleet/documents", {
        method: "POST",
        body: JSON.stringify({
          vehicle: holderType === "vehicle" ? holderId : null,
          agent: holderType === "agent" ? holderId : null,
          document_type: documentType,
          document_number: documentNumber,
          expiry_date: expiryDate,
        }),
      });
      if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
      setHolderId("");
      setDocumentNumber("");
      setExpiryDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Holder</label>
        <select
          value={holderType}
          onChange={(e) => {
            setHolderType(e.target.value as "vehicle" | "agent");
            setHolderId("");
          }}
          className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="vehicle">Vehicle</option>
          <option value="agent">Driver</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {holderType === "vehicle" ? "Vehicle" : "Driver"}
        </label>
        <select
          required
          value={holderId}
          onChange={(e) => setHolderId(e.target.value)}
          className="mt-1 w-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">Select</option>
          {holderType === "vehicle"
            ? vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.reg_no}
                </option>
              ))
            : agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name || a.username}
                </option>
              ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Document</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="mt-1 w-48 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Document number</label>
        <input
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          className="mt-1 w-36 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Expiry date</label>
        <input
          required
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="mt-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <Button
        type="submit"
        disabled={submitting}>
        {submitting ? "Adding…" : "Add Document"}
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
