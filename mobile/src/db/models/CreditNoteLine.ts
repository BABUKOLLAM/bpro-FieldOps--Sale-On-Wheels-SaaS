import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import CreditNote from './CreditNote';

export default class CreditNoteLine extends Model {
  static table = 'credit_note_lines';
  static associations = {
    credit_notes: { type: 'belongs_to' as const, key: 'credit_note_local_id' },
  };

  @text('item_server_id') itemServerId!: string;
  @field('qty') qty!: number;
  @field('rate') rate!: number;
  @text('condition') condition!: string;

  @relation('credit_notes', 'credit_note_local_id')
  creditNote!: Relation<CreditNote>;
}
