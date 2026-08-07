import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Attendance extends Model {
  static table = 'attendance';

  @text('server_id') serverId!: string;
  @field('check_in_at') checkInAt!: number;
  @field('check_in_latitude') checkInLatitude!: number | null;
  @field('check_in_longitude') checkInLongitude!: number | null;
  @field('check_out_at') checkOutAt!: number | null;
  @field('check_out_latitude') checkOutLatitude!: number | null;
  @field('check_out_longitude') checkOutLongitude!: number | null;
  @field('device_created_at') deviceCreatedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;
}
