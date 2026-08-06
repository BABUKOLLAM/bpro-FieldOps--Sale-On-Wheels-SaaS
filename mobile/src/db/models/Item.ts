import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Item extends Model {
  static table = 'items';

  @text('server_id') serverId!: string;
  @text('sku') sku!: string;
  @text('name') name!: string;
  @text('barcode') barcode!: string;
  @text('base_uom') baseUom!: string;
  @text('hsn_code') hsnCode!: string;
  @field('gst_rate') gstRate!: number;
  @field('is_active') isActive!: boolean;
  @field('updated_at') updatedAt!: number;
}
