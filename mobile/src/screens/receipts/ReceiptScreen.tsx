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
import Trip, { TRIP_IN_PROGRESS } from '../../db/models/Trip';
import Receipt, {
  MODE_CARD,
  MODE_CASH,
  MODE_CHEQUE,
  MODE_UPI,
} from '../../db/models/Receipt';
import { SYNC_PENDING } from '../../db/models/Invoice';
import { synchronize } from '../../sync/synchronize';
import { useTranslation } from '../../i18n/LanguageContext';
import { colors } from '../../theme/colors';

/**
 * Collections (BRD FR-03): record a payment received from an outlet
 * against their account — offline-first, identical create-then-sync
 * pattern to Spot Billing and Expense. Payment-on-account only for now:
 * the backend decrements the customer's whole outstanding balance;
 * allocating against specific invoices needs outstanding invoices in
 * the pull payload first (see the receipts table note in db/schema.ts).
 */
export default function ReceiptScreen({ navigation }: any) {
  const { t } = useTranslation();
  const MODES: { value: string; label: string }[] = [
    { value: MODE_CASH, label: t.receipt.modeCash },
    { value: MODE_CHEQUE, label: t.receipt.modeCheque },
    { value: MODE_UPI, label: t.receipt.modeUpi },
    { value: MODE_CARD, label: t.receipt.modeCard },
  ];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mode, setMode] = useState(MODE_CASH);
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    database
      .get<Customer>('customers')
      .query()
      .fetch()
      .then((rows) =>
        setCustomers(rows.sort((a, b) => a.name.localeCompare(b.name)))
      );
  }, []);

  const selected = customers.find((c) => c.serverId === customerId) || null;

  async function handleSave() {
    if (!selected) {
      Alert.alert(t.receipt.selectCustomer);
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(t.receipt.invalidAmount);
      return;
    }
    if (mode !== MODE_CASH && !referenceNo.trim()) {
      Alert.alert(t.receipt.enterReference);
      return;
    }

    setSaving(true);
    try {
      // Best-effort trip tag, same as Expense — a collection outside an
      // active trip is still a valid collection.
      const trips = await database
        .get<Trip>('trips')
        .query(Q.where('status', TRIP_IN_PROGRESS))
        .fetch();
      const activeTrip = trips[0] || null;

      await database.write(async () => {
        await database.get<Receipt>('receipts').create((rec) => {
          rec.serverId = uuidv4();
          rec.customerServerId = selected.serverId;
          rec.tripServerId = activeTrip ? activeTrip.serverId : '';
          rec.mode = mode;
          rec.amount = numericAmount;
          rec.referenceNo = referenceNo.trim();
          rec.receivedAt = Date.now();
          rec.deviceCreatedAt = Date.now();
          rec.localSyncStatus = SYNC_PENDING;
          rec.syncError = '';
        });
      });

      Alert.alert(t.receipt.saved, t.common.savedOfflineBody, [
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
      // The numeric keypad has no Done key on iOS and covers the Save
      // button — same trap SpotBillingScreen hit (see its TouchableWith-
      // outFeedback comment). For a ScrollView the standard fix is drag-
      // to-dismiss, which also gives the E2E flow a deterministic way to
      // clear the keyboard (a scroll) before tapping Save.
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>{t.receipt.title}</Text>

      <Text style={styles.label}>{t.receipt.customer}</Text>
      {customers.length === 0 && (
        <Text style={styles.emptyText}>{t.receipt.noCustomers}</Text>
      )}
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
          <Text style={styles.customerMeta}>
            {t.common.outstandingPrefix}
            {c.outstandingBalance}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>{t.receipt.paymentMode}</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.modeChip, mode === m.value && styles.modeChipActive]}
            onPress={() => setMode(m.value)}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === m.value && styles.modeChipTextActive,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t.receipt.amount}</Text>
      <TextInput
        testID="receipt-amount-input"
        style={styles.input}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        value={amount}
        onChangeText={setAmount}
      />

      {mode !== MODE_CASH && (
        <>
          <Text style={styles.label}>
            {mode === MODE_CHEQUE
              ? t.receipt.chequeNumber
              : t.receipt.transactionReference}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={
              mode === MODE_CHEQUE
                ? t.receipt.chequePlaceholder
                : t.receipt.upiRefPlaceholder
            }
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            value={referenceNo}
            onChangeText={setReferenceNo}
          />
        </>
      )}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? t.common.saving : t.receipt.save}
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
  emptyText: { color: colors.textSecondary, fontSize: 14 },
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
  customerMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: { color: colors.textPrimary, fontSize: 14 },
  modeChipTextActive: { color: colors.onPrimary, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
