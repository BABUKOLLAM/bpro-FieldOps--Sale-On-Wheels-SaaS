import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../../db';
import Customer from '../../db/models/Customer';
import Item from '../../db/models/Item';
import PriceListItem from '../../db/models/PriceListItem';
import Trip, { TRIP_IN_PROGRESS } from '../../db/models/Trip';
import SalesOrder from '../../db/models/SalesOrder';
import SalesOrderLine from '../../db/models/SalesOrderLine';
import { SYNC_PENDING } from '../../db/models/Invoice';
import { synchronize } from '../../sync/synchronize';
import { useTranslation } from '../../i18n/LanguageContext';
import { colors } from '../../theme/colors';

/**
 * Pre-order capture (order today, deliver later) — the Pre-Sales /
 * Order Booker's core flow, also useful when a van is out of stock.
 * Same offline create-then-sync shape as Spot Billing, minus GST/stock:
 * nothing moves until the back office fulfils the order.
 */
export default function OrderScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    database
      .get<Customer>('customers')
      .query()
      .fetch()
      .then((rows) =>
        setCustomers(rows.sort((a, b) => a.name.localeCompare(b.name)))
      );
    database
      .get<Item>('items')
      .query()
      .fetch()
      .then((rows) =>
        setItems(rows.sort((a, b) => a.name.localeCompare(b.name)))
      );
    database
      .get<PriceListItem>('price_list_items')
      .query()
      .fetch()
      .then((priceListItems) => {
        const rateMap: Record<string, number> = {};
        priceListItems.forEach((p) => (rateMap[p.itemServerId] = p.rate));
        setRates(rateMap);
      });
  }, []);

  const selected = customers.find((c) => c.serverId === customerId) || null;
  const orderLines = items
    .map((item) => ({
      item,
      rate: rates[item.serverId] ?? 0,
      qty: Number(qtys[item.serverId] || 0),
    }))
    .filter((l) => l.qty > 0);
  const estimatedTotal = orderLines.reduce((sum, l) => sum + l.qty * l.rate, 0);

  async function handleSave() {
    if (!selected) {
      Alert.alert(t.order.selectCustomer);
      return;
    }
    if (orderLines.length === 0) {
      Alert.alert(t.order.enterQty);
      return;
    }

    setSaving(true);
    try {
      const trips = await database
        .get<Trip>('trips')
        .query(Q.where('status', TRIP_IN_PROGRESS))
        .fetch();
      const activeTrip = trips[0] || null;

      await database.write(async () => {
        const order = await database
          .get<SalesOrder>('sales_orders')
          .create((rec) => {
            rec.serverId = uuidv4();
            rec.customerServerId = selected.serverId;
            rec.tripServerId = activeTrip ? activeTrip.serverId : '';
            rec.orderDate = new Date().toISOString().slice(0, 10);
            rec.notes = notes.trim();
            rec.deviceCreatedAt = Date.now();
            rec.localSyncStatus = SYNC_PENDING;
            rec.syncError = '';
          });
        for (const line of orderLines) {
          await database
            .get<SalesOrderLine>('sales_order_lines')
            .create((rec) => {
              rec.order.set(order);
              rec.itemServerId = line.item.serverId;
              rec.qty = line.qty;
              rec.rate = line.rate;
            });
        }
      });

      Alert.alert(t.order.saved, t.common.savedOfflineBody, [
        { text: t.common.ok, onPress: () => navigation.goBack() },
      ]);
      synchronize().catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      keyboardShouldPersistTaps="handled"
      // Same numeric-keypad trap as ReceiptScreen — drag dismisses the
      // keyboard so Save is reachable (and E2E-deterministic).
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>{t.order.title}</Text>

      <Text style={styles.label}>{t.order.customer}</Text>
      {customers.map((c) => (
        <TouchableOpacity
          key={c.serverId}
          style={[
            styles.customerRow,
            customerId === c.serverId && styles.customerRowActive,
          ]}
          onPress={() => setCustomerId(c.serverId)}
        >
          <Text style={styles.customerName}>{c.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>{t.order.items}</Text>
      {items.map((item) => (
        <View key={item.serverId} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              {item.sku} · ₹{rates[item.serverId] ?? 0}
            </Text>
          </View>
          <TextInput
            testID={`order-qty-input-${item.sku}`}
            style={styles.qtyInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            value={qtys[item.serverId] || ''}
            onChangeText={(v) =>
              setQtys((prev) => ({ ...prev, [item.serverId]: v }))
            }
          />
        </View>
      ))}

      <Text style={styles.label}>{t.order.notesOptional}</Text>
      <TextInput
        style={styles.input}
        placeholder={t.order.notesPlaceholder}
        placeholderTextColor={colors.textSecondary}
        value={notes}
        onChangeText={setNotes}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t.order.estimatedTotalPrefix}
          {estimatedTotal.toFixed(2)}
        </Text>
        <Text style={styles.summaryNote}>{t.order.finalPricingNote}</Text>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? t.common.saving : t.order.save}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 6,
  },
  customerRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  customerRowActive: { borderColor: colors.primary, borderWidth: 2 },
  customerName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: { flex: 1 },
  itemName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  itemMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  qtyInput: {
    width: 64,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  summary: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  summaryText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  summaryNote: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
