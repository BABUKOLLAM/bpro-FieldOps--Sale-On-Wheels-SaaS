import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export const MODE_CASH = 'cash';
export const MODE_CHEQUE = 'cheque';
export const MODE_UPI = 'upi';
export const MODE_CARD = 'card';

/**
 * A collection against a customer's account (FR-03) — payment-on-account
 * with no per-invoice allocation yet; the backend's finalize_receipt
 * decrements the customer's outstanding balance as a whole. Same
 * device-originated create-only pattern as Invoice/Expense: client
 * UUID in server_id, sync_status pending until pushed.
 */
export default class Receipt extends Model {
  static table = 'receipts';

  @text('server_id') serverId!: string;
  @text('customer_server_id') customerServerId!: string;
  @text('trip_server_id') tripServerId!: string;
  @text('mode') mode!: string;
  @field('amount') amount!: number;
  @text('reference_no') referenceNo!: string;
  @field('received_at') receivedAt!: number;
  @field('device_created_at') deviceCreatedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;
}
