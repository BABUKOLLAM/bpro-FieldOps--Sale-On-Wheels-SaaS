import type { NextConfig } from "next";

// Duplicated at the nginx edge (infra/nginx/vansales.conf.example) —
// kept here too so the app is protected even when reached without nginx
// in front (local dev, direct container port).
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
