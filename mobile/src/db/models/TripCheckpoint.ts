import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import Trip from './Trip';

export default class TripCheckpoint extends Model {
  static table = 'trip_checkpoints';
  static associations = {
    trips: { type: 'belongs_to' as const, key: 'trip_local_id' },
  };

  @text('server_id') serverId!: string;
  @text('trip_server_id') tripServerId!: string;
  @text('customer_server_id') customerServerId!: string;
  @field('check_in_time') checkInTime!: number;
  @field('check_out_time') checkOutTime!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;

  @relation('trips', 'trip_local_id') trip!: Relation<Trip>;
}
