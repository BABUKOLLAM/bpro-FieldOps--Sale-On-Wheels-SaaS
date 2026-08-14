import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';
import SalesOrderLine from './SalesOrderLine';

/**
 * Pre-order (order today, deliver later) — same device-originated
 * create-then-sync shape as Invoice, minus GST/godown since no stock
 * moves until fulfilment happens back-office side.
 */
export default class SalesOrder extends Model {
  static table = 'sales_orders';
  static associations = {
    sales_order_lines: {
      type: 'has_many' as const,
      foreignKey: 'order_local_id',
    },
  };

  @text('server_id') serverId!: string;
  @text('customer_server_id') customerServerId!: string;
  @text('trip_server_id') tripServerId!: string;
  @text('order_date') orderDate!: string;
  @text('notes') notes!: string;
  @field('device_created_at') deviceCreatedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;

  @children('sales_order_lines') lines!: Query<SalesOrderLine>;
}
