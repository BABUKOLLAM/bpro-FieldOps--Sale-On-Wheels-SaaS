import { Q } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import { database } from '../db';
import { apiFetch, apiUploadFile } from '../api/client';
import Invoice, {
  SYNC_FAILED,
  SYNC_PENDING,
  SYNC_SYNCED,
} from '../db/models/Invoice';
import InvoiceLine from '../db/models/InvoiceLine';
import Trip from '../db/models/Trip';
import TripCheckpoint from '../db/models/TripCheckpoint';
import Expense from '../db/models/Expense';
import LocationPing from '../db/models/LocationPing';
import Attendance from '../db/models/Attendance';
import Receipt from '../db/models/Receipt';
import SalesOrder from '../db/models/SalesOrder';
import SalesOrderLine from '../db/models/SalesOrderLine';
import CreditNote from '../db/models/CreditNote';
import CreditNoteLine from '../db/models/CreditNoteLine';
import { saveCompanyConfig } from '../config/companyConfig';

/**
 * Custom sync client matching the backend's apps.mobile_sync pull/push
 * endpoints (a pragmatic fixed-collection protocol — see
 * docs/architecture.md — rather than WatermelonDB's built-in
 * synchronize()). WatermelonDB here is "just" the local reactive SQLite
 * store; this module owns the actual sync logic.
 */

let lastPulledAt: string | null = null;

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function pull(): Promise<void> {
  const query = lastPulledAt
    ? `?since=${encodeURIComponent(lastPulledAt)}`
    : '';
  const response = await apiFetch(`/api/sync/pull/${query}`);
  if (!response.ok) {
    throw new Error(`Pull failed: ${response.status}`);
  }
  const data = await response.json();

  await database.write(async () => {
    await upsertCollection('customers', data.customers, (c) => ({
      serverId: c.id,
      code: c.code,
      name: c.name,
      gstin: c.gstin,
      phone: c.phone,
      creditLimit: Number(c.credit_limit),
      creditDays: c.credit_days,
      outstandingBalance: Number(c.outstanding_balance),
      isBlocked: c.is_blocked,
      creditStatus: c.credit_status,
      updatedAt: Date.parse(c.updated_at),
    }));

    await upsertCollection('items', data.items, (i) => ({
      serverId: i.id,
      sku: i.sku,
      name: i.name,
      barcode: i.barcode,
      baseUom: i.base_uom,
      hsnCode: i.hsn_code,
      gstRate: Number(i.gst_rate),
      isActive: i.is_active,
      updatedAt: Date.parse(i.updated_at),
    }));

    await upsertCollection(
      'gst_registrations',
      data.gst_registrations,
      (g) => ({
        serverId: g.id,
        state: g.state,
        gstin: g.gstin,
        isDefault: g.is_default,
      })
    );

    await upsertCollection('van_stock', data.van_stock, (v) => ({
      serverId: v.id,
      godownServerId: v.godown,
      itemServerId: v.item,
      itemSku: v.item_sku,
      itemName: v.item_name,
      qtyOnHand: Number(v.qty_on_hand),
    }));

    for (const priceList of data.price_lists || []) {
      await upsertCollection(
        'price_list_items',
        priceList.items || [],
        (p) => ({
          serverId: p.id,
          itemServerId: p.item,
          rate: Number(p.rate),
        })
      );
    }

    await upsertCollection('beats', data.beats, (b) => ({
      serverId: b.id,
      name: b.name,
    }));
    for (const beat of data.beats || []) {
      await upsertBeatCustomers(beat.id, beat.stops || []);
    }
  });

  if (data.company) {
    await saveCompanyConfig({
      legalName: data.company.legal_name,
      displayName: data.company.display_name,
      upiVpa: data.company.upi_vpa,
    });
  }

  lastPulledAt = data.server_timestamp;
}

/** beat_customers is a join table with no server_id of its own — matched
 * on (beat_server_id, customer_server_id) instead. Kept separate from
 * upsertCollection(), whose single-key `server_id` match doesn't apply
 * here (that table has no such column at all — matching on it would
 * throw against the schema, not just fail to find a row). */
async function upsertBeatCustomers(beatServerId: string, stops: any[]) {
  const collection = database.get('beat_customers');
  for (const stop of stops) {
    // Keys here must be the model's camelCase JS property names
    // (beatServerId, customerServerId, visitSequence — see
    // db/models/BeatCustomer.ts), not the raw snake_case DB columns.
    // Object.assign(record, mapped) sets plain JS properties by exact
    // name; WatermelonDB's @field/@text decorators only intercept
    // assignment through the camelCase accessor they define, so a
    // snake_case key silently creates an inert stray property instead
    // of writing the column — every field goes in as its default/empty
    // value with no error anywhere in the chain.
    const mapped = {
      beatServerId,
      customerServerId: stop.customer,
      visitSequence: stop.visit_sequence,
    };
    const existing = await collection
      .query(
        Q.where('beat_server_id', beatServerId),
        Q.where('customer_server_id', stop.customer)
      )
      .fetch();
    if (existing.length > 0) {
      await existing[0].update((record: any) => Object.assign(record, mapped));
    } else {
      await collection.create((record: any) => Object.assign(record, mapped));
    }
  }
}

/** mapFn must return camelCase keys matching each model's decorated JS
 * property names (serverId, creditLimit, ...), not the raw snake_case
 * DB columns — see the note in upsertBeatCustomers() for why. */
async function upsertCollection<T extends { serverId: string }>(
  tableName: string,
  records: any[],
  mapFn: (r: any) => T
) {
  const collection = database.get(tableName);
  for (const raw of records) {
    const mapped = mapFn(raw);
    const existing = await collection
      .query(Q.where('server_id', mapped.serverId))
      .fetch();
    if (existing.length > 0) {
      await existing[0].update((record: any) => Object.assign(record, mapped));
    } else {
      await collection.create((record: any) => Object.assign(record, mapped));
    }
  }
}

/** Pushes every not-yet-synced invoice and trip. Each item is idempotent
 * server-side via its server_id (see apps.mobile_sync.PushRequestLog) —
 * safe to call repeatedly, including after a partial failure. */
export async function push(): Promise<{ pushed: number; failed: number }> {
  let pushed = 0;
  let failed = 0;

  const pendingInvoices = await database
    .get<Invoice>('invoices')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const invoice of pendingInvoices) {
    const lines = await invoice.lines.fetch();
    const payload = {
      id: invoice.serverId,
      customer: invoice.customerServerId,
      godown: invoice.godownServerId,
      gst_registration: invoice.gstRegistrationServerId,
      place_of_supply_state: invoice.placeOfSupplyState,
      invoice_date: invoice.invoiceDate,
      lines: lines.map((l: InvoiceLine) => ({
        item: l.itemServerId,
        qty: l.qty,
        rate: l.rate,
      })),
    };
    const { ok, error } = await pushItem('invoice', payload);
    await database.write(async () => {
      await invoice.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  const pendingTrips = await database
    .get<Trip>('trips')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  // Tracks which trips are confirmed to exist server-side by the end of
  // this push cycle — either just pushed successfully, or already synced
  // in a previous cycle — since a checkpoint can only be pushed once its
  // parent trip exists remotely.
  const tripsConfirmedOnServer = new Set<string>();

  for (const trip of pendingTrips) {
    const payload = {
      id: trip.serverId,
      vehicle: trip.vehicleServerId || null,
      beat: trip.beatServerId || null,
      status: trip.status,
      start_time: trip.startTime
        ? new Date(trip.startTime).toISOString()
        : null,
      end_time: trip.endTime ? new Date(trip.endTime).toISOString() : null,
      start_odometer: trip.startOdometer || null,
      end_odometer: trip.endOdometer || null,
      start_latitude: trip.startLatitude ?? null,
      start_longitude: trip.startLongitude ?? null,
      end_latitude: trip.endLatitude ?? null,
      end_longitude: trip.endLongitude ?? null,
    };
    const { ok, error } = await pushItem('trip', payload);
    await database.write(async () => {
      await trip.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
    if (ok) {
      tripsConfirmedOnServer.add(trip.id);
    }
  }

  // Push every pending checkpoint whose trip is confirmed on the server —
  // covers both checkpoints from a trip just pushed above, and
  // checkpoints added *after* their trip had already synced in an
  // earlier cycle (which the trip-scoped loop alone would miss).
  const alreadySyncedTrips = await database
    .get<Trip>('trips')
    .query(Q.where('sync_status', SYNC_SYNCED))
    .fetch();
  alreadySyncedTrips.forEach((t) => tripsConfirmedOnServer.add(t.id));

  const pendingCheckpoints = await database
    .get<TripCheckpoint>('trip_checkpoints')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const checkpoint of pendingCheckpoints) {
    const parentTrip = await checkpoint.trip.fetch();
    if (!parentTrip || !tripsConfirmedOnServer.has(parentTrip.id)) {
      continue;
    }

    const { ok: cpOk, error: cpError } = await pushItem('trip_checkpoint', {
      id: checkpoint.serverId,
      trip: parentTrip.serverId,
      customer: checkpoint.customerServerId,
      check_in_time: checkpoint.checkInTime
        ? new Date(checkpoint.checkInTime).toISOString()
        : null,
      check_out_time: checkpoint.checkOutTime
        ? new Date(checkpoint.checkOutTime).toISOString()
        : null,
      check_in_latitude: checkpoint.checkInLatitude ?? null,
      check_in_longitude: checkpoint.checkInLongitude ?? null,
      check_out_latitude: checkpoint.checkOutLatitude ?? null,
      check_out_longitude: checkpoint.checkOutLongitude ?? null,
    });
    await database.write(async () => {
      await checkpoint.update((rec) => {
        rec.localSyncStatus = cpOk ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = cpOk ? '' : cpError || rec.syncError;
      });
    });
    cpOk ? pushed++ : failed++;
  }

  const pendingExpenses = await database
    .get<Expense>('expenses')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const expense of pendingExpenses) {
    const payload = {
      id: expense.serverId,
      trip: expense.tripServerId || null,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      expense_date: expense.expenseDate,
      device_created_at: expense.deviceCreatedAt
        ? new Date(expense.deviceCreatedAt).toISOString()
        : null,
    };
    const { ok, error } = await pushItem('expense', payload);
    await database.write(async () => {
      await expense.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  const pendingReceipts = await database
    .get<Receipt>('receipts')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const receipt of pendingReceipts) {
    const payload = {
      id: receipt.serverId,
      customer: receipt.customerServerId,
      trip: receipt.tripServerId || null,
      mode: receipt.mode,
      amount: receipt.amount,
      reference_no: receipt.referenceNo,
      received_at: new Date(receipt.receivedAt).toISOString(),
      // Payment-on-account: the backend decrements the customer's whole
      // outstanding balance; per-invoice allocation is a later extension
      // (needs outstanding invoices in the pull payload first).
      allocations: [],
    };
    const { ok, error } = await pushItem('receipt', payload);
    await database.write(async () => {
      await receipt.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  const pendingOrders = await database
    .get<SalesOrder>('sales_orders')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const order of pendingOrders) {
    const orderLines = await order.lines.fetch();
    const payload = {
      id: order.serverId,
      customer: order.customerServerId,
      trip: order.tripServerId || null,
      order_date: order.orderDate,
      notes: order.notes,
      lines: orderLines.map((l: SalesOrderLine) => ({
        item: l.itemServerId,
        qty: l.qty,
        rate: l.rate,
      })),
    };
    const { ok, error } = await pushItem('sales_order', payload);
    await database.write(async () => {
      await order.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  const pendingCreditNotes = await database
    .get<CreditNote>('credit_notes')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const note of pendingCreditNotes) {
    const noteLines = await note.lines.fetch();
    const payload = {
      id: note.serverId,
      original_invoice: note.originalInvoiceServerId,
      customer: note.customerServerId,
      trip: note.tripServerId || null,
      reason_code: note.reasonCode,
      note_date: note.noteDate,
      lines: noteLines.map((l: CreditNoteLine) => ({
        item: l.itemServerId,
        qty: l.qty,
        rate: l.rate,
        condition: l.condition,
      })),
    };
    const { ok, error } = await pushItem('credit_note', payload);
    await database.write(async () => {
      await note.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  const pendingPings = await database
    .get<LocationPing>('location_pings')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const ping of pendingPings) {
    const payload = {
      id: ping.serverId,
      trip: ping.tripServerId || null,
      latitude: ping.latitude,
      longitude: ping.longitude,
      recorded_at: new Date(ping.recordedAt).toISOString(),
    };
    const { ok, error } = await pushItem('location_ping', payload);
    await database.write(async () => {
      await ping.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  // Attendance check-in only — check-out is a direct online action against
  // an existing record (see AttendanceScreen), not a second push of the
  // same id: the backend's push idempotency log treats any repeat push of
  // an id as an already-applied no-op, so re-pushing an updated payload
  // would silently never reach the database (the same trap Trip's
  // start/end update-via-repush pattern has — avoided here on purpose).
  const pendingAttendance = await database
    .get<Attendance>('attendance')
    .query(Q.where('sync_status', Q.oneOf([SYNC_PENDING, SYNC_FAILED])))
    .fetch();

  for (const record of pendingAttendance) {
    const payload = {
      id: record.serverId,
      check_in_at: new Date(record.checkInAt).toISOString(),
      check_in_latitude: record.checkInLatitude ?? null,
      check_in_longitude: record.checkInLongitude ?? null,
      device_created_at: record.deviceCreatedAt
        ? new Date(record.deviceCreatedAt).toISOString()
        : null,
    };
    const { ok, error } = await pushItem('attendance', payload);
    await database.write(async () => {
      await record.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
        rec.syncError = ok ? '' : error || rec.syncError;
      });
    });
    ok ? pushed++ : failed++;
  }

  return { pushed, failed };
}

/**
 * Uploads any local photo/signature files whose parent record has
 * already synced (a file can only be attached to a row that exists
 * server-side). Deliberately separate from push(): these are multipart
 * requests, not JSON, and a failed upload doesn't affect the underlying
 * invoice/expense's own sync status — it just retries next cycle.
 */
async function uploadPendingAttachments(): Promise<void> {
  const invoicesNeedingSignature = await database
    .get<Invoice>('invoices')
    .query(
      Q.where('sync_status', SYNC_SYNCED),
      Q.where('signature_uploaded', false)
    )
    .fetch();

  for (const invoice of invoicesNeedingSignature) {
    if (!invoice.signatureLocalUri) {
      continue;
    }
    try {
      const response = await apiUploadFile(
        `/api/sales/invoices/${invoice.serverId}/`,
        'signature_image',
        invoice.signatureLocalUri,
        'signature.png',
        'image/png'
      );
      if (response.ok) {
        await database.write(async () => {
          await invoice.update((rec) => {
            rec.signatureUploaded = true;
          });
        });
      }
    } catch {
      // stays pending; picked up by the next sync attempt
    }
  }

  const expensesNeedingReceipt = await database
    .get<Expense>('expenses')
    .query(
      Q.where('sync_status', SYNC_SYNCED),
      Q.where('receipt_uploaded', false)
    )
    .fetch();

  for (const expense of expensesNeedingReceipt) {
    if (!expense.receiptLocalUri) {
      continue;
    }
    try {
      const response = await apiUploadFile(
        `/api/expenses/${expense.serverId}/`,
        'receipt_photo',
        expense.receiptLocalUri,
        'receipt.jpg'
      );
      if (response.ok) {
        await database.write(async () => {
          await expense.update((rec) => {
            rec.receiptUploaded = true;
          });
        });
      }
    } catch {
      // stays pending; picked up by the next sync attempt
    }
  }
}

/** Returns the backend's rejection reason on failure so callers can
 * store it in the record's sync_error — that's what the home screen's
 * sync-failure banner shows the salesman. An empty error with ok=false
 * means a network-level failure (offline/timeout), which is transient
 * by nature and shouldn't overwrite a real validation message. */
async function pushItem(
  entityType: string,
  payload: unknown
): Promise<{ ok: boolean; error: string }> {
  try {
    const response = await apiFetch('/api/sync/push/', {
      method: 'POST',
      body: JSON.stringify({ items: [{ entity_type: entityType, payload }] }),
    });
    if (!response.ok) {
      return { ok: false, error: `Server error (HTTP ${response.status})` };
    }
    const data = await response.json();
    const result = data.results?.[0];
    if (result?.status === 'applied') {
      return { ok: true, error: '' };
    }
    return { ok: false, error: result?.error || 'Rejected by server' };
  } catch {
    // Network-level failure — stays pending; picked up by the next sync.
    return { ok: false, error: '' };
  }
}

/** Full sync cycle: push first (so today's work reaches the server as
 * soon as possible), then pull (so master data reflects any server-side
 * changes, e.g. a credit-limit update). Call on app foreground, on
 * reconnect, on a timer, and from a manual "Sync Now" button. */
export async function synchronize(): Promise<{
  pushed: number;
  failed: number;
}> {
  if (!(await isOnline())) {
    return { pushed: 0, failed: 0 };
  }
  const result = await push();
  await uploadPendingAttachments();
  await pull();
  return result;
}
