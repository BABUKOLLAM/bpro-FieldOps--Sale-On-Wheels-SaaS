import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';
import CreditNoteLine from './CreditNoteLine';

export const CONDITION_SELLABLE = 'sellable';
export const CONDITION_DAMAGED = 'damaged';
export const CONDITION_EXPIRED = 'expired';

/**
 * A return against a previously-synced invoice (FR-04). The Return
 * screen only offers invoices that have already synced — the backend's
 * finalize_credit_note posts stock movements against the parent invoice,
 * so it must exist server-side first.
 */
export default class CreditNote extends Model {
  static table = 'credit_notes';
  static associations = {
    credit_note_lines: {
      type: 'has_many' as const,
      foreignKey: 'credit_note_local_id',
    },
  };

  @text('server_id') serverId!: string;
  @text('original_invoice_server_id') originalInvoiceServerId!: string;
  @text('customer_server_id') customerServerId!: string;
  @text('trip_server_id') tripServerId!: string;
  @text('reason_code') reasonCode!: string;
  @text('note_date') noteDate!: string;
  @field('device_created_at') deviceCreatedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;

  @children('credit_note_lines') lines!: Query<CreditNoteLine>;
}
