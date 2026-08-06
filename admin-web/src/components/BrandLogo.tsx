/** The bpro wordmark sits on its own navy chip so it stays legible at any
 * size regardless of the page background (light or dark theme). */
export default function BrandLogo({ height = 36, className = "" }: { height?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg bg-[#05113B] ${className}`}
      style={{ padding: `${Math.round(height * 0.16)}px ${Math.round(height * 0.32)}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bpro-logo-wordmark.png" alt="bpro" style={{ height, width: "auto" }} className="block object-contain" />
    </span>
  );
}
