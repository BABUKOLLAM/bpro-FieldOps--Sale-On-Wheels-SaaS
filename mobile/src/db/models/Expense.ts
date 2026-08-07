import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export const CATEGORY_FUEL = 'fuel';
export const CATEGORY_TOLL = 'toll';
export const CATEGORY_FOOD = 'food';
export const CATEGORY_MISC = 'misc';

export default class Expense extends Model {
  static table = 'expenses';

  @text('server_id') serverId!: string;
  @text('trip_server_id') tripServerId!: string;
  @text('category') category!: string;
  @field('amount') amount!: number;
  @text('description') description!: string;
  @text('expense_date') expenseDate!: string;
  @text('receipt_local_uri') receiptLocalUri!: string;
  @field('receipt_uploaded') receiptUploaded!: boolean;
  @text('status') status!: string;
  @field('device_created_at') deviceCreatedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;
}
