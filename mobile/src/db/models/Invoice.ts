import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';
import InvoiceLine from './InvoiceLine';

export const SYNC_PENDING = 'pending';
export const SYNC_SYNCED = 'synced';
export const SYNC_FAILED = 'failed';

export default class Invoice extends Model {
  static table = 'invoices';
  static associations = {
    invoice_lines: { type: 'has_many' as const, foreignKey: 'invoice_local_id' },
  };

  @text('server_id') serverId!: string;
  @text('customer_server_id') customerServerId!: string;
  @text('godown_server_id') godownServerId!: string;
  @text('gst_registration_server_id') gstRegistrationServerId!: string;
  @text('place_of_supply_state') placeOfSupplyState!: string;
  @text('invoice_date') invoiceDate!: string;
  @field('grand_total') grandTotal!: number;
  @text('sync_status') syncStatus!: string;
  @text('sync_error') syncError!: string;
  @field('device_created_at') deviceCreatedAt!: number;

  @children('invoice_lines') lines!: Query<InvoiceLine>;
}
