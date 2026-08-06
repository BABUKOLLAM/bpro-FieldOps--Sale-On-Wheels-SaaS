import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers';

  @text('server_id') serverId!: string;
  @text('code') code!: string;
  @text('name') name!: string;
  @text('gstin') gstin!: string;
  @text('phone') phone!: string;
  @field('credit_limit') creditLimit!: number;
  @field('credit_days') creditDays!: number;
  @field('outstanding_balance') outstandingBalance!: number;
  @field('is_blocked') isBlocked!: boolean;
  @text('credit_status') creditStatus!: string;
  @field('updated_at') updatedAt!: number;
}
