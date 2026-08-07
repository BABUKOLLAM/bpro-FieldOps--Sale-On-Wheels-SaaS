import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';
import TripCheckpoint from './TripCheckpoint';

export const TRIP_PLANNED = 'planned';
export const TRIP_IN_PROGRESS = 'in_progress';
export const TRIP_COMPLETED = 'completed';

export default class Trip extends Model {
  static table = 'trips';
  static associations = {
    trip_checkpoints: {
      type: 'has_many' as const,
      foreignKey: 'trip_local_id',
    },
  };

  @text('server_id') serverId!: string;
  @text('vehicle_server_id') vehicleServerId!: string;
  @text('beat_server_id') beatServerId!: string;
  @text('status') status!: string;
  @field('start_time') startTime!: number;
  @field('end_time') endTime!: number;
  @field('start_odometer') startOdometer!: number;
  @field('end_odometer') endOdometer!: number;
  @text('sync_status') localSyncStatus!: string;
  @text('sync_error') syncError!: string;

  @children('trip_checkpoints') checkpoints!: Query<TripCheckpoint>;
}
