import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import Trip from './Trip';

export default class LocationPing extends Model {
  static table = 'location_pings';
  static associations = {
    trips: { type: 'belongs_to' as const, key: 'trip_local_id' },
  };

  @text('server_id') serverId!: string;
  @text('trip_server_id') tripServerId!: string;
  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @field('recorded_at') recordedAt!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;

  @relation('trips', 'trip_local_id') trip!: Relation<Trip>;
}
