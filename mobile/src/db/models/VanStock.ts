import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class VanStock extends Model {
  static table = 'van_stock';

  @text('server_id') serverId!: string;
  @text('godown_server_id') godownServerId!: string;
  @text('item_server_id') itemServerId!: string;
  @text('item_sku') itemSku!: string;
  @text('item_name') itemName!: string;
  @field('qty_on_hand') qtyOnHand!: number;
}
