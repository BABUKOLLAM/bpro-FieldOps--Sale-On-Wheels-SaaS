import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class Beat extends Model {
  static table = 'beats';

  @text('server_id') serverId!: string;
  @text('name') name!: string;
}
