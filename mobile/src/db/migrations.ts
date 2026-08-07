import {
  addColumns,
  createTable,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * v1 -> v2 (Phase 2 slice 1): signature capture columns on invoices, plus
 * the new expenses table. Real migration (not a dev-only schema bump) so
 * an already-installed app upgrades in place without losing local data —
 * see docs/architecture.md for why that matters here specifically: an
 * agent's not-yet-synced offline invoices must survive an app update.
 */
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'invoices',
          columns: [
            { name: 'signature_local_uri', type: 'string' },
            { name: 'signature_uploaded', type: 'boolean' },
          ],
        }),
        createTable({
          name: 'expenses',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'trip_server_id', type: 'string' },
            { name: 'category', type: 'string' },
            { name: 'amount', type: 'number' },
            { name: 'description', type: 'string' },
            { name: 'expense_date', type: 'string' },
            { name: 'receipt_local_uri', type: 'string' },
            { name: 'receipt_uploaded', type: 'boolean' },
            { name: 'status', type: 'string' },
            { name: 'device_created_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
      ],
    },
  ],
});
