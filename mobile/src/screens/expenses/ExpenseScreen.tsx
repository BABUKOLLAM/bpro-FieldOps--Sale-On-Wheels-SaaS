import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../../db';
import Expense, {
  CATEGORY_FOOD,
  CATEGORY_FUEL,
  CATEGORY_MISC,
  CATEGORY_TOLL,
} from '../../db/models/Expense';
import { SYNC_PENDING } from '../../db/models/Invoice';
import { synchronize } from '../../sync/synchronize';
import { useTranslation } from '../../i18n/LanguageContext';
import { colors } from '../../theme/colors';

/**
 * Field expense capture (BRD FR-06): category, amount, and a receipt
 * photo, saved offline first — identical create-then-sync pattern to
 * Spot Billing and Trip. The photo itself is stored on-device (local
 * file uri) and uploaded separately once the expense record has synced
 * (see sync/synchronize.ts::uploadPendingReceiptPhotos), the same
 * two-step pattern used for invoice signatures.
 */
export default function ExpenseScreen({ navigation }: any) {
  const { t } = useTranslation();
  const CATEGORIES: { value: string; label: string }[] = [
    { value: CATEGORY_FUEL, label: t.expense.categoryFuel },
    { value: CATEGORY_TOLL, label: t.expense.categoryToll },
    { value: CATEGORY_FOOD, label: t.expense.categoryFood },
    { value: CATEGORY_MISC, label: t.expense.categoryMisc },
  ];
  const [category, setCategory] = useState(CATEGORY_FUEL);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickReceipt(fromCamera: boolean) {
    const result = fromCamera
      ? await launchCamera({ mediaType: 'photo', quality: 0.7 })
      : await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
    const uri = result.assets?.[0]?.uri;
    if (uri) {
      setReceiptUri(uri);
    }
  }

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(t.expense.invalidAmount);
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        await database.get<Expense>('expenses').create((rec) => {
          rec.serverId = uuidv4();
          rec.category = category;
          rec.amount = numericAmount;
          rec.description = description;
          rec.expenseDate = new Date().toISOString().slice(0, 10);
          rec.receiptLocalUri = receiptUri || '';
          rec.receiptUploaded = false;
          rec.status = 'submitted';
          rec.deviceCreatedAt = Date.now();
          rec.localSyncStatus = SYNC_PENDING;
          rec.syncError = '';
        });
      });

      Alert.alert(t.expense.saved, t.common.savedOfflineBody, [
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
    >
      <Text style={styles.title}>{t.expense.title}</Text>

      <Text style={styles.label}>{t.expense.category}</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[
              styles.categoryChip,
              category === c.value && styles.categoryChipActive,
            ]}
            onPress={() => setCategory(c.value)}
          >
            <Text
              style={[
                styles.categoryChipText,
                category === c.value && styles.categoryChipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t.expense.amount}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>{t.expense.notesOptional}</Text>
      <TextInput
        style={styles.input}
        placeholder={t.expense.notesPlaceholder}
        placeholderTextColor={colors.textSecondary}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>{t.expense.receiptPhotoOptional}</Text>
      <View style={styles.receiptRow}>
        <TouchableOpacity
          style={styles.receiptButton}
          onPress={() => pickReceipt(true)}
        >
          <Text style={styles.receiptButtonText}>{t.expense.takePhoto}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.receiptButton}
          onPress={() => pickReceipt(false)}
        >
          <Text style={styles.receiptButtonText}>
            {t.expense.chooseFromGallery}
          </Text>
        </TouchableOpacity>
      </View>
      {receiptUri && (
        <Text style={styles.receiptAttached}>{t.expense.receiptAttached}</Text>
      )}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? t.common.saving : t.expense.save}
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: { color: colors.textPrimary, fontSize: 14 },
  categoryChipTextActive: { color: colors.onPrimary, fontWeight: '600' },
  receiptRow: { flexDirection: 'row', gap: 10 },
  receiptButton: {
    flex: 1,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  receiptButtonText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  receiptAttached: { color: colors.success, fontSize: 13, marginTop: 8 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
