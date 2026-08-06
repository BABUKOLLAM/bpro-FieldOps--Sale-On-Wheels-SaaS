import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class GSTRegistration extends Model {
  static table = 'gst_registrations';

  @text('server_id') serverId!: string;
  @text('state') state!: string;
  @text('gstin') gstin!: string;
  @field('is_default') isDefault!: boolean;
}
