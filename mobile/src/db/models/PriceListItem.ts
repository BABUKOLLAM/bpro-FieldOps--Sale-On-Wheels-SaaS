import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class PriceListItem extends Model {
  static table = 'price_list_items';

  @text('server_id') serverId!: string;
  @text('item_server_id') itemServerId!: string;
  @field('rate') rate!: number;
}
