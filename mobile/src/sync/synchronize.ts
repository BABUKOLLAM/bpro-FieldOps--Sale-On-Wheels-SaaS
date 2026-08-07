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
      server_id: c.id,
      code: c.code,
      name: c.name,
      gstin: c.gstin,
      phone: c.phone,
      credit_limit: Number(c.credit_limit),
      credit_days: c.credit_days,
      outstanding_balance: Number(c.outstanding_balance),
      is_blocked: c.is_blocked,
      credit_status: c.credit_status,
      updated_at: Date.parse(c.updated_at),
    }));

    await upsertCollection('items', data.items, (i) => ({
      server_id: i.id,
      sku: i.sku,
      name: i.name,
      barcode: i.barcode,
      base_uom: i.base_uom,
      hsn_code: i.hsn_code,
      gst_rate: Number(i.gst_rate),
      is_active: i.is_active,
      updated_at: Date.parse(i.updated_at),
    }));

    await upsertCollection(
      'gst_registrations',
      data.gst_registrations,
      (g) => ({
        server_id: g.id,
        state: g.state,
        gstin: g.gstin,
        is_default: g.is_default,
      })
    );

    await upsertCollection('van_stock', data.van_stock, (v) => ({
      server_id: v.id,
      godown_server_id: v.godown,
      item_server_id: v.item,
      item_sku: v.item_sku,
      item_name: v.item_name,
      qty_on_hand: Number(v.qty_on_hand),
    }));

    for (const priceList of data.price_lists || []) {
      await upsertCollection(
        'price_list_items',
        priceList.items || [],
        (p) => ({
          server_id: p.id,
          item_server_id: p.item,
          rate: Number(p.rate),
        })
      );
    }

    await upsertCollection('beats', data.beats, (b) => ({
      server_id: b.id,
      name: b.name,
    }));
    for (const beat of data.beats || []) {
      await upsertBeatCustomers(beat.id, beat.stops || []);
    }
  });

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
    const mapped = {
      beat_server_id: beatServerId,
      customer_server_id: stop.customer,
      visit_sequence: stop.visit_sequence,
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

async function upsertCollection<T extends { server_id: string }>(
  tableName: string,
  records: any[],
  mapFn: (r: any) => T
) {
  const collection = database.get(tableName);
  for (const raw of records) {
    const mapped = mapFn(raw);
    const existing = await collection
      .query(Q.where('server_id', mapped.server_id))
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
    const ok = await pushItem('invoice', payload);
    await database.write(async () => {
      await invoice.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
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
    const ok = await pushItem('trip', payload);
    await database.write(async () => {
      await trip.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
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

    const cpOk = await pushItem('trip_checkpoint', {
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
    const ok = await pushItem('expense', payload);
    await database.write(async () => {
      await expense.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
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
    const ok = await pushItem('location_ping', payload);
    await database.write(async () => {
      await ping.update((rec) => {
        rec.localSyncStatus = ok ? SYNC_SYNCED : SYNC_FAILED;
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

async function pushItem(
  entityType: string,
  payload: unknown
): Promise<boolean> {
  try {
    const response = await apiFetch('/api/sync/push/', {
      method: 'POST',
      body: JSON.stringify({ items: [{ entity_type: entityType, payload }] }),
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.results?.[0]?.status === 'applied';
  } catch {
    return false; // stays pending; picked up by the next sync attempt
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
