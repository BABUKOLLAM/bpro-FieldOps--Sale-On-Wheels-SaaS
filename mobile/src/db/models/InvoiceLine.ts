import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import Invoice from './Invoice';

export default class InvoiceLine extends Model {
  static table = 'invoice_lines';
  static associations = {
    invoices: { type: 'belongs_to' as const, key: 'invoice_local_id' },
  };

  @text('item_server_id') itemServerId!: string;
  @field('qty') qty!: number;
  @field('rate') rate!: number;

  @relation('invoices', 'invoice_local_id') invoice!: Relation<Invoice>;
}
