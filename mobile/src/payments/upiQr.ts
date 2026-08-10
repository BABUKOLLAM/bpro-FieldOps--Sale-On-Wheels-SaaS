import type { CompanyConfig } from '../config/companyConfig';

/**
 * §18 UPI QR at point of sale — mirrors apps.sales.upi_qr.build_upi_uri
 * on the backend, but built entirely from data already on the device
 * (see config/companyConfig.ts) so it needs no network call at the one
 * moment a customer is standing there waiting to pay. Returns null when
 * no VPA has been configured for this deployment yet (Master Settings).
 */
export function buildUpiUri(
  company: CompanyConfig | null,
  amount: number,
  invoiceRef: string
): string | null {
  const vpa = company?.upiVpa?.trim();
  if (!vpa) {
    return null;
  }
  const payeeName = company?.displayName || company?.legalName || 'Van Sales';
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: `Invoice ${invoiceRef}`,
  });
  return `upi://pay?${params.toString()}`;
}
