import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { Camera } from 'react-native-camera-kit';
import SignatureScreen from 'react-native-signature-canvas';
import QRCode from 'react-native-qrcode-svg';
import { database } from '../../db';
import Customer from '../../db/models/Customer';
import Item from '../../db/models/Item';
import PriceListItem from '../../db/models/PriceListItem';
import GSTRegistration from '../../db/models/GSTRegistration';
import VanStock from '../../db/models/VanStock';
import Invoice, { SYNC_PENDING } from '../../db/models/Invoice';
import InvoiceLine from '../../db/models/InvoiceLine';
import { synchronize } from '../../sync/synchronize';
import { apiPostJson } from '../../api/client';
import { buildReceiptText } from '../../printing/receiptText';
import { printReceipt } from '../../printing/bluetoothPrinter';
import { colors } from '../../theme/colors';
import {
  getCompanyConfig,
  type CompanyConfig,
} from '../../config/companyConfig';
import { buildUpiUri } from '../../payments/upiQr';

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
  // OTP is the alternative proof-of-delivery to a signature (FR-12), but
  // unlike signature (uploaded later, at sync time), the OTP endpoints
  // act on the server-side invoice by id right now — so this path only
  // works once the invoice has actually been pushed, i.e. online.
  const [otpStep, setOtpStep] = useState<
    'closed' | 'sending' | 'entering' | 'verifying'
  >('closed');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig | null>(
    null
  );
  const [showUpiQr, setShowUpiQr] = useState(false);

  useEffect(() => {
    getCompanyConfig().then(setCompanyConfig);
  }, []);

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

  const upiUri = savedInvoice
    ? buildUpiUri(
        companyConfig,
        savedInvoice.grandTotal,
        savedInvoice.serverId.slice(0, 8)
      )
    : null;

  function handleShowUpiQr() {
    if (!upiUri) {
      Alert.alert(
        'UPI not configured',
        'No UPI ID has been set up for this deployment yet — ask your admin to add one in Master Settings.'
      );
      return;
    }
    setShowUpiQr(true);
  }

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

  async function handleSendOtp() {
    if (!savedInvoice) {
      return;
    }
    setOtpError(null);
    setOtpStep('sending');
    try {
      // The invoice must exist server-side before an OTP can be sent
      // against it — push it now rather than waiting for a background
      // sync, since the customer is standing there waiting for the code.
      await synchronize();
      await apiPostJson(
        `/api/sales/invoices/${savedInvoice.serverId}/send-delivery-otp/`,
        {}
      );
      setOtpStep('entering');
    } catch {
      setOtpError(
        'Could not send OTP — needs an internet connection. Use signature instead, or try again.'
      );
      setOtpStep('closed');
    }
  }

  async function handleVerifyOtp() {
    if (!savedInvoice) {
      return;
    }
    setOtpError(null);
    setOtpStep('verifying');
    try {
      await apiPostJson(
        `/api/sales/invoices/${savedInvoice.serverId}/verify-delivery-otp/`,
        { code: otpCode }
      );
      navigation.goBack();
    } catch (err: any) {
      setOtpError(err?.body?.detail || 'Incorrect or expired OTP.');
      setOtpStep('entering');
    }
  }

  function currentReceiptText() {
    return buildReceiptText({
      customerName: customer?.name || 'Walk-in customer',
      lines: cartLines.map((l) => ({
        name: l.item.name,
        qty: Number(l.qty || 0),
        rate: l.rate,
      })),
      subtotal: estimatedSubtotal,
      tax: estimatedTax,
      total: estimatedTotal,
    });
  }

  /** FR-03: native OS share sheet (SMS/WhatsApp/email/etc) — built into
   * React Native, no extra native module needed. */
  async function handleShareReceipt() {
    try {
      await Share.share({ message: currentReceiptText() });
    } catch {
      // User cancelled the share sheet — not an error worth surfacing.
    }
  }

  /** FR-03: Bluetooth thermal printing — see printing/bluetoothPrinter.ts
   * for the "first paired printer" scope note. */
  async function handlePrintReceipt() {
    setPrinting(true);
    try {
      await printReceipt(currentReceiptText());
    } catch (err: any) {
      Alert.alert(
        'Print failed',
        err?.message ||
          'Could not print — check the printer is paired and powered on.'
      );
    } finally {
      setPrinting(false);
    }
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

  if (savedInvoice && otpStep !== 'closed') {
    return (
      <View style={styles.container}>
        <Text style={styles.customerName}>Confirm via OTP</Text>
        <Text style={styles.customerMeta}>
          {otpStep === 'sending' &&
            'Sending OTP to the customer’s registered phone…'}
          {(otpStep === 'entering' || otpStep === 'verifying') &&
            'Enter the 6-digit code sent to the customer.'}
        </Text>
        {otpError && <Text style={styles.otpError}>{otpError}</Text>}
        {(otpStep === 'entering' || otpStep === 'verifying') && (
          <>
            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={styles.tripButtonLike}
              onPress={handleVerifyOtp}
              disabled={otpStep === 'verifying' || otpCode.length !== 6}
            >
              <Text style={styles.tripButtonLikeText}>
                {otpStep === 'verifying' ? 'Verifying…' : 'Verify OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => setOtpStep('closed')}
        >
          <Text style={styles.skipButtonText}>Back to signature</Text>
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
        {otpError && <Text style={styles.otpError}>{otpError}</Text>}
        <TouchableOpacity style={styles.tripButtonLike} onPress={handleSendOtp}>
          <Text style={styles.tripButtonLikeText}>Confirm via OTP instead</Text>
        </TouchableOpacity>
        <View style={styles.receiptActionsRow}>
          <TouchableOpacity
            style={styles.receiptActionButton}
            onPress={handleShareReceipt}
          >
            <Text style={styles.receiptActionButtonText}>Share Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.receiptActionButton}
            onPress={handlePrintReceipt}
            disabled={printing}
          >
            <Text style={styles.receiptActionButtonText}>
              {printing ? 'Printing…' : 'Print via Bluetooth'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.receiptActionButton}
            onPress={handleShowUpiQr}
          >
            <Text style={styles.receiptActionButtonText}>Collect via UPI</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipButtonText}>Skip signature</Text>
        </TouchableOpacity>

        <Modal
          visible={showUpiQr}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUpiQr(false)}
        >
          <View style={styles.qrModalBackdrop}>
            <View style={styles.qrModalCard}>
              <Text style={styles.customerName}>Scan to pay via UPI</Text>
              {upiUri && (
                <View style={styles.qrCodeWrapper}>
                  <QRCode value={upiUri} size={220} />
                </View>
              )}
              <Text style={styles.customerMeta}>
                ₹{savedInvoice.grandTotal.toFixed(2)} to{' '}
                {companyConfig?.displayName || companyConfig?.legalName}
              </Text>
              <TouchableOpacity
                style={styles.tripButtonLike}
                onPress={() => setShowUpiQr(false)}
              >
                <Text style={styles.tripButtonLikeText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    // Tapping outside the focused qty field didn't dismiss the keyboard at
    // all — a plain <Text> (the customer name header) doesn't claim the
    // touch the way a real button does, so there was nothing to resign
    // first responder. Confirmed directly in CI: a 10s wait for the
    // keyboard's own "1" key to disappear after tapping the header still
    // timed out. Wrapping the screen in TouchableWithoutFeedback with an
    // explicit Keyboard.dismiss() is the standard fix — and a real user
    // hits the same dead end tapping anywhere else on this screen today,
    // not just in the test.
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          style={styles.itemList}
          data={items}
          keyExtractor={(item) => item.serverId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.sku} · ₹{rates[item.serverId] ?? '—'} · GST{' '}
                  {item.gstRate}%
                </Text>
              </View>
              <TextInput
                testID={`qty-input-${item.sku}`}
                style={styles.qtyInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={cart[item.serverId]?.qty ?? ''}
                onChangeText={(text) => updateQty(item, text)}
              />
            </View>
          )}
          // Summary + Save Invoice live inside the list as a footer, not as
          // fixed siblings after it. A sibling after a plain FlatList sits
          // outside the list's own UIScrollView and gets no keyboard-avoidance
          // for free — it stayed exactly where the keyboard renders no matter
          // how KeyboardAvoidingView was configured (verified: identical
          // bounds, y=[602,658], across multiple runs and fix attempts on
          // 2026-08-12, always fully inside the keyboard's own region starting
          // at y=561). As the list's footer, this content scrolls into view
          // above the keyboard using iOS's native scroll-view keyboard inset
          // handling, which just works, instead of JS-computed padding that
          // wasn't taking effect for reasons this session couldn't pin down.
          ListFooterComponent={
            <>
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
            </>
          }
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  // Without flex: 1 here, the list sizes itself to its content instead
  // of a bounded, internally-scrollable region — the summary and Save
  // Invoice button then get pushed down by however tall the catalog
  // is, past where the keyboard renders once a qty field is focused.
  // KeyboardAvoidingView on its own can't compensate for that; both
  // fixes are needed together.
  itemList: { flex: 1 },
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
  tripButtonLike: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  tripButtonLikeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  otpInput: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  otpError: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  receiptActionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  receiptActionButton: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  receiptActionButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  qrCodeWrapper: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
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
