import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { Camera } from 'react-native-camera-kit';
import SignatureScreen from 'react-native-signature-canvas';
import { database } from '../../db';
import Customer from '../../db/models/Customer';
import Item from '../../db/models/Item';
import PriceListItem from '../../db/models/PriceListItem';
import GSTRegistration from '../../db/models/GSTRegistration';
import VanStock from '../../db/models/VanStock';
import Invoice, { SYNC_PENDING } from '../../db/models/Invoice';
import InvoiceLine from '../../db/models/InvoiceLine';
import { synchronize } from '../../sync/synchronize';
import { colors } from '../../theme/colors';

type CartLine = { item: Item; rate: number; qty: string };

/**
 * The offline-first reference flow (BRD FR-01 Spot Billing, FR-11
 * Offline Mode, FR-12 signature capture, FR-13 barcode scanning):
 * everything here reads/writes only the local WatermelonDB store. The
 * invoice is fully usable — saved, listed, re-viewable — with zero
 * network access. Totals shown are a client-side estimate only; the
 * server is the source of truth and recomputes GST/discounts at sync time
 * (see apps.sales.services.recompute_invoice on the backend).
 */
export default function SpotBillingScreen({ route, navigation }: any) {
  const { customerServerId } = route.params || {};
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Once set, the cart is locked and the screen shows the post-save
  // signature step instead — the invoice already exists locally at this
  // point, so "skip" is just leaving it unsigned, not losing the sale.
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    (async () => {
      if (customerServerId) {
        const matches = await database
          .get<Customer>('customers')
          .query(Q.where('server_id', customerServerId))
          .fetch();
        setCustomer(matches[0] || null);
      }
      const activeItems = await database
        .get<Item>('items')
        .query(Q.where('is_active', true))
        .fetch();
      setItems(activeItems);

      const priceListItems = await database
        .get<PriceListItem>('price_list_items')
        .query()
        .fetch();
      const rateMap: Record<string, number> = {};
      priceListItems.forEach((p) => (rateMap[p.itemServerId] = p.rate));
      setRates(rateMap);
    })();
  }, [customerServerId]);

  function updateQty(item: Item, qty: string) {
    setCart((prev) => {
      if (!qty || qty === '0') {
        const next = { ...prev };
        delete next[item.serverId];
        return next;
      }
      return {
        ...prev,
        [item.serverId]: { item, rate: rates[item.serverId] ?? 0, qty },
      };
    });
  }

  /** FR-13: scan a barcode and add/increment that item in the cart — a
   * pure local lookup against the already-synced `items` table, so this
   * works fully offline, same as the rest of billing. */
  async function handleBarcodeScanned(code: string) {
    setScanning(false);
    const matches = await database
      .get<Item>('items')
      .query(Q.where('barcode', code))
      .fetch();
    const item = matches[0];
    if (!item) {
      Alert.alert('Item not found', `No item matches barcode ${code}.`);
      return;
    }
    const currentQty = Number(cart[item.serverId]?.qty || '0');
    updateQty(item, String(currentQty + 1));
  }

  const cartLines = Object.values(cart);
  const estimatedSubtotal = cartLines.reduce(
    (sum, l) => sum + Number(l.qty || 0) * l.rate,
    0
  );
  const estimatedTax = cartLines.reduce(
    (sum, l) => sum + (Number(l.qty || 0) * l.rate * l.item.gstRate) / 100,
    0
  );
  const estimatedTotal = estimatedSubtotal + estimatedTax;

  async function handleSave() {
    if (!customer) {
      Alert.alert('Select a customer first.');
      return;
    }
    if (cartLines.length === 0) {
      Alert.alert('Add at least one item.');
      return;
    }

    setSaving(true);
    try {
      const vanStock = await database
        .get<VanStock>('van_stock')
        .query()
        .fetch();
      const godownServerId = vanStock[0]?.godownServerId;
      const gstRegistrations = await database
        .get<GSTRegistration>('gst_registrations')
        .query()
        .fetch();
      const defaultGst =
        gstRegistrations.find((g) => g.isDefault) || gstRegistrations[0];

      if (!godownServerId || !defaultGst) {
        Alert.alert(
          'Missing setup data',
          'Sync at least once before billing so van stock and GST setup are available offline.'
        );
        setSaving(false);
        return;
      }

      const invoiceId = uuidv4();
      const today = new Date().toISOString().slice(0, 10);

      const createdInvoice = await database.write(async () => {
        const invoice = await database
          .get<Invoice>('invoices')
          .create((rec) => {
            rec.serverId = invoiceId;
            rec.customerServerId = customer.serverId;
            rec.godownServerId = godownServerId;
            rec.gstRegistrationServerId = defaultGst.serverId;
            rec.placeOfSupplyState = defaultGst.state;
            rec.invoiceDate = today;
            rec.grandTotal = Number(estimatedTotal.toFixed(2));
            rec.localSyncStatus = SYNC_PENDING;
            rec.syncError = '';
            rec.deviceCreatedAt = Date.now();
            rec.signatureLocalUri = '';
            rec.signatureUploaded = false;
          });

        for (const line of cartLines) {
          await database.get<InvoiceLine>('invoice_lines').create((rec) => {
            rec.invoice.set(invoice);
            rec.itemServerId = line.item.serverId;
            rec.qty = Number(line.qty);
            rec.rate = line.rate;
          });
        }
        return invoice;
      });

      // Fire-and-forget: try to sync immediately if online, but the
      // invoice is already durably saved regardless of the outcome.
      synchronize().catch(() => {});

      // Move to the signature step rather than leaving immediately —
      // capture happens at point of sale (FR-12), while the customer is
      // still there.
      setSavedInvoice(createdInvoice);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignatureCaptured(base64Png: string) {
    if (!savedInvoice) {
      return;
    }
    await database.write(async () => {
      await savedInvoice.update((rec) => {
        rec.signatureLocalUri = base64Png; // a data: URI — apiUploadFile accepts this directly
        rec.signatureUploaded = false;
      });
    });
    synchronize().catch(() => {});
    navigation.goBack();
  }

  if (scanning) {
    return (
      <View style={{ flex: 1 }}>
        <Camera
          style={{ flex: 1 }}
          scanBarcode
          onReadCode={(event: any) =>
            handleBarcodeScanned(event.nativeEvent.codeStringValue)
          }
        />
        <TouchableOpacity
          style={styles.cancelScanButton}
          onPress={() => setScanning(false)}
        >
          <Text style={styles.cancelScanButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (savedInvoice) {
    return (
      <View style={styles.container}>
        <Text style={styles.customerName}>
          Invoice saved — capture signature
        </Text>
        <Text style={styles.customerMeta}>
          Optional proof of delivery (FR-12). Skip if not needed.
        </Text>
        <View style={{ flex: 1 }}>
          <SignatureScreen
            onOK={handleSignatureCaptured}
            onEmpty={() =>
              Alert.alert('Nothing to save', 'Draw a signature first, or skip.')
            }
            descriptionText="Sign to confirm delivery"
          />
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipButtonText}>Skip signature</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.customerName}>
        {customer ? customer.name : 'No customer selected'}
      </Text>
      {customer && (
        <Text style={styles.customerMeta}>
          Outstanding ₹{customer.outstandingBalance} · {customer.creditStatus}
        </Text>
      )}

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setScanning(true)}
      >
        <Text style={styles.scanButtonText}>Scan Barcode</Text>
      </TouchableOpacity>

      <FlatList
        data={items}
        keyExtractor={(item) => item.serverId}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.sku} · ₹{rates[item.serverId] ?? '—'} · GST {item.gstRate}
                %
              </Text>
            </View>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              value={cart[item.serverId]?.qty ?? ''}
              onChangeText={(text) => updateQty(item, text)}
            />
          </View>
        )}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Estimated total: ₹{estimatedTotal.toFixed(2)}
        </Text>
        <Text style={styles.summaryNote}>
          Final GST/discount recomputed by the server at sync.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving…' : 'Save Invoice'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  customerName: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  customerMeta: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  scanButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  cancelScanButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelScanButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: { padding: 16, alignItems: 'center' },
  skipButtonText: { color: colors.textSecondary, fontSize: 14 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  itemMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  qtyInput: {
    width: 60,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 16,
  },
  summary: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  summaryNote: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
