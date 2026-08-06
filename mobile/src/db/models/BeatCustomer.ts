import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class BeatCustomer extends Model {
  static table = 'beat_customers';

  @text('beat_server_id') beatServerId!: string;
  @text('customer_server_id') customerServerId!: string;
  @field('visit_sequence') visitSequence!: number;
}
