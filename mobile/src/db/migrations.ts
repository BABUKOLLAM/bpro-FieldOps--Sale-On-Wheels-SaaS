import {
  addColumns,
  createTable,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * v1 -> v2 (Phase 2 slice 1): signature capture columns on invoices, plus
 * the new expenses table.
 *
 * v2 -> v3 (Phase 2 slice 2): GPS point-capture columns on trips/
 * trip_checkpoints, plus the new location_pings breadcrumb table.
 *
 * v3 -> v4 (BRD completion — FR-16): the new attendance table.
 *
 * v4 -> v5 (FR-03 collections): the new receipts table.
 *
 * v5 -> v6 (FR-04 returns + pre-orders): sales_orders/-_lines and
 * credit_notes/-_lines tables.
 *
 * Real migrations (not a dev-only schema bump) so an already-installed
 * app upgrades in place without losing local data — see
 * docs/architecture.md for why that matters here specifically: an
 * agent's not-yet-synced offline invoices/trips must survive an app
 * update.
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
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'trips',
          columns: [
            { name: 'start_latitude', type: 'number' },
            { name: 'start_longitude', type: 'number' },
            { name: 'end_latitude', type: 'number' },
            { name: 'end_longitude', type: 'number' },
          ],
        }),
        addColumns({
          table: 'trip_checkpoints',
          columns: [
            { name: 'check_in_latitude', type: 'number' },
            { name: 'check_in_longitude', type: 'number' },
            { name: 'check_out_latitude', type: 'number' },
            { name: 'check_out_longitude', type: 'number' },
          ],
        }),
        createTable({
          name: 'location_pings',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'trip_local_id', type: 'string', isIndexed: true },
            { name: 'trip_server_id', type: 'string' },
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' },
            { name: 'recorded_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'attendance',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'check_in_at', type: 'number' },
            { name: 'check_in_latitude', type: 'number' },
            { name: 'check_in_longitude', type: 'number' },
            { name: 'check_out_at', type: 'number' },
            { name: 'check_out_latitude', type: 'number' },
            { name: 'check_out_longitude', type: 'number' },
            { name: 'device_created_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'receipts',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'customer_server_id', type: 'string', isIndexed: true },
            { name: 'trip_server_id', type: 'string' },
            { name: 'mode', type: 'string' },
            { name: 'amount', type: 'number' },
            { name: 'reference_no', type: 'string' },
            { name: 'received_at', type: 'number' },
            { name: 'device_created_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'sales_orders',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'customer_server_id', type: 'string', isIndexed: true },
            { name: 'trip_server_id', type: 'string' },
            { name: 'order_date', type: 'string' },
            { name: 'notes', type: 'string' },
            { name: 'device_created_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
        createTable({
          name: 'sales_order_lines',
          columns: [
            { name: 'order_local_id', type: 'string', isIndexed: true },
            { name: 'item_server_id', type: 'string' },
            { name: 'qty', type: 'number' },
            { name: 'rate', type: 'number' },
          ],
        }),
        createTable({
          name: 'credit_notes',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'original_invoice_server_id', type: 'string', isIndexed: true },
            { name: 'customer_server_id', type: 'string' },
            { name: 'trip_server_id', type: 'string' },
            { name: 'reason_code', type: 'string' },
            { name: 'note_date', type: 'string' },
            { name: 'device_created_at', type: 'number' },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'sync_error', type: 'string' },
          ],
        }),
        createTable({
          name: 'credit_note_lines',
          columns: [
            { name: 'credit_note_local_id', type: 'string', isIndexed: true },
            { name: 'item_server_id', type: 'string' },
            { name: 'qty', type: 'number' },
            { name: 'rate', type: 'number' },
            { name: 'condition', type: 'string' },
          ],
        }),
      ],
    },
  ],
});
