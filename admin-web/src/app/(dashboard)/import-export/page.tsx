import { apiGet } from "@/lib/api";
import EntityImportExportCard, { type EntityInfo, type ImportJob } from "./EntityImportExportCard";

export default async function ImportExportPage() {
  const entities = await apiGet<EntityInfo[]>("/api/dataio/entities/");
  const jobsPage = await apiGet<{ results: ImportJob[] }>("/api/dataio/jobs/");
  const recentJobs = jobsPage.results;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Import / Export</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Bulk-load or download master data as a spreadsheet — products, price lists, staff, routes, customers,
          vehicles, and godowns. Download a template, fill it in, and upload it back; existing records are matched
          and updated automatically.
        </p>
      </div>

      {entities.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          You don&apos;t have permission to manage any master data entities.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entities.map((entity) => (
            <EntityImportExportCard
              key={entity.slug}
              entity={entity}
              recentJobs={recentJobs.filter((job) => job.entity_slug === entity.slug).slice(0, 3)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
