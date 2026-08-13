import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import migrations from './migrations';
import Customer from './models/Customer';
import Item from './models/Item';
import PriceListItem from './models/PriceListItem';
import GSTRegistration from './models/GSTRegistration';
import VanStock from './models/VanStock';
import Beat from './models/Beat';
import BeatCustomer from './models/BeatCustomer';
import Invoice from './models/Invoice';
import InvoiceLine from './models/InvoiceLine';
import Trip from './models/Trip';
import TripCheckpoint from './models/TripCheckpoint';
import Expense from './models/Expense';
import LocationPing from './models/LocationPing';
import Attendance from './models/Attendance';
import Receipt from './models/Receipt';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    // A corrupt local DB should never crash a field agent's app silently —
    // surface it loudly during development; production should log to a
    // crash reporter here.
    console.error('WatermelonDB setup failed', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Customer,
    Item,
    PriceListItem,
    GSTRegistration,
    VanStock,
    Beat,
    BeatCustomer,
    Invoice,
    InvoiceLine,
    Trip,
    TripCheckpoint,
    Expense,
    LocationPing,
    Attendance,
    Receipt,
  ],
});
