import { BLEPrinter } from 'react-native-thermal-receipt-printer';

/**
 * FR-03 Bluetooth thermal receipt printing. Deliberately minimal: prints
 * to the first already-paired BLE printer rather than offering a device
 * picker — a reasonable MVP assumption for a single printer per van, not
 * a full multi-printer management UI. The device must already be paired
 * via the OS Bluetooth settings; this module doesn't handle pairing.
 *
 * Unverified in this environment like every other native module here —
 * no Bluetooth hardware or native project to test against (see
 * mobile/README.md).
 */
export async function printReceipt(text: string): Promise<void> {
  await BLEPrinter.init();
  const devices = await BLEPrinter.getDeviceList();
  if (devices.length === 0) {
    throw new Error(
      'No paired Bluetooth printer found. Pair one in your device Bluetooth settings first.'
    );
  }
  await BLEPrinter.connectPrinter(devices[0].inner_mac_address);
  try {
    // printText() itself isn't awaitable (fire-and-forget over BLE) — a
    // short delay before closing the connection avoids cutting off the
    // print job mid-transfer, a known gotcha with this library.
    BLEPrinter.printText(`${text}\n\n\n`, { beep: true, cut: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } finally {
    await BLEPrinter.closeConn();
  }
}
