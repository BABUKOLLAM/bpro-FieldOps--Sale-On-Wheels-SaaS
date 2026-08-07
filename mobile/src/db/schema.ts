import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Local SQLite schema. Two kinds of tables, per the offline-sync design
 * in docs/architecture.md:
 *  - server-authoritative / read-only on device: customers, items,
 *    price_list_items, gst_registrations, van_stock, beats, beat_customers
 *  - device-originated / create-only: invoices, invoice_lines, trips,
 *    trip_checkpoints — these carry a client-generated `server_id` (the
 *    same UUID that becomes the primary key on the backend) plus a local
 *    `sync_status` so the UI can show pending/synced/failed per record.
 *
 * This is a pragmatic custom sync protocol (matching apps.mobile_sync's
 * pull/push endpoints) rather than WatermelonDB's built-in synchronize()
 * change-tracking — see src/sync/synchronize.ts.
 */
export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'code', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'gstin', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'credit_limit', type: 'number' },
        { name: 'credit_days', type: 'number' },
        { name: 'outstanding_balance', type: 'number' },
        { name: 'is_blocked', type: 'boolean' },
        { name: 'credit_status', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'items',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'sku', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'barcode', type: 'string' },
        { name: 'base_uom', type: 'string' },
        { name: 'hsn_code', type: 'string' },
        { name: 'gst_rate', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'price_list_items',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'item_server_id', type: 'string', isIndexed: true },
        { name: 'rate', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'gst_registrations',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'state', type: 'string' },
        { name: 'gstin', type: 'string' },
        { name: 'is_default', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'van_stock',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'godown_server_id', type: 'string', isIndexed: true },
        { name: 'item_server_id', type: 'string', isIndexed: true },
        { name: 'item_sku', type: 'string' },
        { name: 'item_name', type: 'string' },
        { name: 'qty_on_hand', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'beats',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'beat_customers',
      columns: [
        { name: 'beat_server_id', type: 'string', isIndexed: true },
        { name: 'customer_server_id', type: 'string', isIndexed: true },
        { name: 'visit_sequence', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'invoices',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'customer_server_id', type: 'string', isIndexed: true },
        { name: 'godown_server_id', type: 'string' },
        { name: 'gst_registration_server_id', type: 'string' },
        { name: 'place_of_supply_state', type: 'string' },
        { name: 'invoice_date', type: 'string' },
        { name: 'grand_total', type: 'number' },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'sync_error', type: 'string' },
        { name: 'device_created_at', type: 'number' },
        // Signature capture (FR-12): the file is written to local storage
        // at capture time, then uploaded separately via a multipart PATCH
        // once the invoice's JSON push has succeeded (see sync/synchronize.ts).
        { name: 'signature_local_uri', type: 'string' },
        { name: 'signature_uploaded', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'invoice_lines',
      columns: [
        { name: 'invoice_local_id', type: 'string', isIndexed: true },
        { name: 'item_server_id', type: 'string' },
        { name: 'qty', type: 'number' },
        { name: 'rate', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'trips',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'vehicle_server_id', type: 'string' },
        { name: 'beat_server_id', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'start_time', type: 'number' },
        { name: 'end_time', type: 'number' },
        { name: 'start_odometer', type: 'number' },
        { name: 'end_odometer', type: 'number' },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'sync_error', type: 'string' },
        // GPS point capture (FR-05/FM-02) — best-effort, never blocks
        // starting/ending a trip if location isn't available.
        { name: 'start_latitude', type: 'number' },
        { name: 'start_longitude', type: 'number' },
        { name: 'end_latitude', type: 'number' },
        { name: 'end_longitude', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'trip_checkpoints',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'trip_local_id', type: 'string', isIndexed: true },
        { name: 'trip_server_id', type: 'string' },
        { name: 'customer_server_id', type: 'string' },
        { name: 'check_in_time', type: 'number' },
        { name: 'check_out_time', type: 'number' },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'sync_error', type: 'string' },
        { name: 'check_in_latitude', type: 'number' },
        { name: 'check_in_longitude', type: 'number' },
        { name: 'check_out_latitude', type: 'number' },
        { name: 'check_out_longitude', type: 'number' },
      ],
    }),
    tableSchema({
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
    tableSchema({
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
    tableSchema({
      name: 'attendance',
      columns: [
        // check-in is created offline like invoices/trips; check-out is a
        // direct online action against the record's id once it exists
        // server-side (see src/screens/attendance/AttendanceScreen.tsx) —
        // so only check-in fields need a sync_status.
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
});
