"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type Category = { id: string; name: string };
type UOM = { id: string; code: string; name: string };

export default function ItemForm({ categories, uoms }: { categories: Category[]; uoms: UOM[] }) {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [gstRate, setGstRate] = useState("18.00");
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const [baseUom, setBaseUom] = useState(uoms[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/catalog/items", {
        method: "POST",
        body: JSON.stringify({ sku, name, gst_rate: gstRate, category: category || null, base_uom: baseUom }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      setSku("");
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">SKU</label>
        <input required value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">GST %</label>
        <input type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="mt-1 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100" />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-40 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">UOM</label>
        <select required value={baseUom} onChange={(e) => setBaseUom(e.target.value)} className="mt-1 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100">
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>{u.code}</option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add Item"}
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
