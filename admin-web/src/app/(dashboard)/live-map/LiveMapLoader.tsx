"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type LiveMapClientType from "./LiveMapClient";

// Leaflet touches `window` at module-evaluation time, which breaks even a
// "use client" component during Next's server-side render pass. `next/dynamic`
// with `ssr: false` is only usable from inside a Client Component (this
// file) — page.tsx itself is a Server Component and can't call it directly.
const LiveMapClient = dynamic(() => import("./LiveMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-400">
      Loading map…
    </div>
  ),
});

export default function LiveMapLoader(props: ComponentProps<typeof LiveMapClientType>) {
  return <LiveMapClient {...props} />;
}
