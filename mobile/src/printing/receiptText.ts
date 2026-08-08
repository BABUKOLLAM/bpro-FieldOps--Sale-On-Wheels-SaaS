type ReceiptLine = { name: string; qty: number; rate: number };

type ReceiptInput = {
  customerName: string;
  lines: ReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
};

const WIDTH = 32; // standard 58mm thermal paper, ~32 chars/line

function padRow(left: string, right: string): string {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

/** FR-03: a plain-text receipt shared to both the Bluetooth thermal
 * printer and the native OS Share sheet, so the two features render
 * identically instead of maintaining two formats. Client-side estimate
 * only, same caveat as the on-screen cart total — the server recomputes
 * GST/discounts at sync time. */
export function buildReceiptText({
  customerName,
  lines,
  subtotal,
  tax,
  total,
}: ReceiptInput): string {
  const rows = [
    'Van Sales',
    '-'.repeat(WIDTH),
    customerName,
    new Date().toLocaleString(),
    '-'.repeat(WIDTH),
    ...lines.map((l) =>
      padRow(`${l.name.slice(0, 18)} x${l.qty}`, (l.qty * l.rate).toFixed(2))
    ),
    '-'.repeat(WIDTH),
    padRow('Subtotal', subtotal.toFixed(2)),
    padRow('Tax', tax.toFixed(2)),
    padRow('Total', total.toFixed(2)),
    '-'.repeat(WIDTH),
    'Thank you!',
  ];
  return rows.join('\n');
}
