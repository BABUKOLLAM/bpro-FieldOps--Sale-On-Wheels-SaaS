import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import SalesOrder from './SalesOrder';

export default class SalesOrderLine extends Model {
  static table = 'sales_order_lines';
  static associations = {
    sales_orders: { type: 'belongs_to' as const, key: 'order_local_id' },
  };

  @text('item_server_id') itemServerId!: string;
  @field('qty') qty!: number;
  @field('rate') rate!: number;

  @relation('sales_orders', 'order_local_id') order!: Relation<SalesOrder>;
}
