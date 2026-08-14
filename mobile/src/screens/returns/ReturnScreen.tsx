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
import Invoice, { SYNC_PENDING, SYNC_SYNCED } from '../../db/models/Invoice';
import InvoiceLine from '../../db/models/InvoiceLine';
import Trip, { TRIP_IN_PROGRESS } from '../../db/models/Trip';
import CreditNote, {
  CONDITION_DAMAGED,
  CONDITION_EXPIRED,
  CONDITION_SELLABLE,
} from '../../db/models/CreditNote';
import CreditNoteLine from '../../db/models/CreditNoteLine';
import { synchronize } from '../../sync/synchronize';
import { useTranslation } from '../../i18n/LanguageContext';
import { colors } from '../../theme/colors';

/**
 * Returns & replacements (BRD FR-04): pick one of this device's already-
 * synced invoices, choose returned quantities per line with a condition
 * (sellable / damaged / expired — the condition drives the backend's
 * reverse-logistics stock posting, FM-11). Only *synced* invoices are
 * offered: the backend's finalize_credit_note posts against the parent
 * invoice, so it must exist server-side before the return can apply.
 */
type ReturnLine = {
  invoiceLine: InvoiceLine;
  itemName: string;
  qty: string;
  condition: string;
};

export default function ReturnScreen({ navigation }: any) {
  const { t } = useTranslation();
  const CONDITIONS: { value: string; label: string }[] = [
    { value: CONDITION_SELLABLE, label: t.return.sellable },
    { value: CONDITION_DAMAGED, label: t.return.damaged },
    { value: CONDITION_EXPIRED, label: t.return.expired },
  ];
  const REASONS: { value: string; label: string }[] = [
    { value: 'damaged_in_transit', label: t.return.reasonDamagedInTransit },
    { value: 'expired_stock', label: t.return.reasonExpired },
    { value: 'wrong_item', label: t.return.reasonWrongItem },
    { value: 'customer_rejection', label: t.return.reasonCustomerRejection },
  ];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>(
    {}
  );
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState(REASONS[0].value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const synced = await database
        .get<Invoice>('invoices')
        .query(Q.where('sync_status', SYNC_SYNCED))
        .fetch();
      setInvoices(synced);
      const customers = await database
        .get<Customer>('customers')
        .query()
        .fetch();
      const names: Record<string, string> = {};
      customers.forEach((c) => (names[c.serverId] = c.name));
      setCustomerNames(names);
    })();
  }, []);

  const selected = invoices.find((inv) => inv.id === invoiceId) || null;

  async function pickInvoice(invoice: Invoice) {
    setInvoiceId(invoice.id);
    const invoiceLines = await invoice.lines.fetch();
    const items = await database.get<Item>('items').query().fetch();
    const itemNames: Record<string, string> = {};
    items.forEach((i) => (itemNames[i.serverId] = i.name));
    setLines(
      invoiceLines.map((l) => ({
        invoiceLine: l,
        itemName: itemNames[l.itemServerId] || l.itemServerId,
        qty: '',
        condition: CONDITION_SELLABLE,
      }))
    );
  }

  function updateLine(index: number, patch: Partial<ReturnLine>) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  }

  async function handleSave() {
    if (!selected) {
      Alert.alert(t.return.selectInvoice);
      return;
    }
    const returning = lines.filter((l) => Number(l.qty) > 0);
    if (returning.length === 0) {
      Alert.alert(t.return.enterQty);
      return;
    }
    const overReturn = returning.find((l) => Number(l.qty) > l.invoiceLine.qty);
    if (overReturn) {
      Alert.alert(
        `${t.return.overReturnPrefix} ${overReturn.invoiceLine.qty} ${t.return.overReturnMiddle} ${overReturn.itemName}.`
      );
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
        const note = await database
          .get<CreditNote>('credit_notes')
          .create((rec) => {
            rec.serverId = uuidv4();
            rec.originalInvoiceServerId = selected.serverId;
            rec.customerServerId = selected.customerServerId;
            rec.tripServerId = activeTrip ? activeTrip.serverId : '';
            rec.reasonCode = reason;
            rec.noteDate = new Date().toISOString().slice(0, 10);
            rec.deviceCreatedAt = Date.now();
            rec.localSyncStatus = SYNC_PENDING;
            rec.syncError = '';
          });
        for (const line of returning) {
          await database
            .get<CreditNoteLine>('credit_note_lines')
            .create((rec) => {
              rec.creditNote.set(note);
              rec.itemServerId = line.invoiceLine.itemServerId;
              rec.qty = Number(line.qty);
              rec.rate = line.invoiceLine.rate;
              rec.condition = line.condition;
            });
        }
      });

      Alert.alert(t.return.saved, t.common.savedOfflineBody, [
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
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>{t.return.title}</Text>

      <Text style={styles.label}>{t.return.invoice}</Text>
      {invoices.length === 0 && (
        <Text style={styles.emptyText}>{t.return.noInvoices}</Text>
      )}
      {invoices.map((inv) => (
        <TouchableOpacity
          key={inv.id}
          style={[styles.pickRow, invoiceId === inv.id && styles.pickRowActive]}
          onPress={() => pickInvoice(inv)}
        >
          <Text style={styles.pickName}>
            {customerNames[inv.customerServerId] || t.return.unknownCustomer}
          </Text>
          <Text style={styles.pickMeta}>
            {inv.invoiceDate} · ₹{inv.grandTotal}
          </Text>
        </TouchableOpacity>
      ))}

      {selected && (
        <>
          <Text style={styles.label}>{t.return.returnedItems}</Text>
          {lines.map((line, index) => (
            <View key={line.invoiceLine.id} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <View style={styles.lineInfo}>
                  <Text style={styles.itemName}>{line.itemName}</Text>
                  <Text style={styles.itemMeta}>
                    {t.return.soldPrefix}
                    {line.invoiceLine.qty} · ₹{line.invoiceLine.rate}
                  </Text>
                </View>
                <TextInput
                  testID={`return-qty-input-${index}`}
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={line.qty}
                  onChangeText={(v) => updateLine(index, { qty: v })}
                />
              </View>
              {Number(line.qty) > 0 && (
                <View style={styles.chipRow}>
                  {CONDITIONS.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.chip,
                        line.condition === c.value && styles.chipActive,
                      ]}
                      onPress={() => updateLine(index, { condition: c.value })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          line.condition === c.value && styles.chipTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          <Text style={styles.label}>{t.return.reason}</Text>
          <View style={styles.chipRow}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.chip, reason === r.value && styles.chipActive]}
                onPress={() => setReason(r.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    reason === r.value && styles.chipTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? t.common.saving : t.return.save}
            </Text>
          </TouchableOpacity>
        </>
      )}
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
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  pickRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  pickRowActive: { borderColor: colors.primary, borderWidth: 2 },
  pickName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  pickMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  lineCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  lineHeader: { flexDirection: 'row', alignItems: 'center' },
  lineInfo: { flex: 1 },
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  chipTextActive: { color: colors.onPrimary, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
