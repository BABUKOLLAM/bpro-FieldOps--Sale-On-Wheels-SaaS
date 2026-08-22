import { lookup } from "node:dns/promises";
import net from "node:net";
import { Agent } from "undici";

/**
 * fetch() to the backend by *hostname* (e.g. http://backend:8000)
 * reproducibly hangs with UND_ERR_CONNECT_TIMEOUT on the production
 * VPS's Docker bridge network — confirmed live, step by step, NOT a DNS
 * or basic-connectivity problem: dns.lookup() resolves the hostname
 * instantly to a single IPv4 address, a raw net.connect() to that
 * address is instant, and fetch() to the resolved IP completes a full
 * HTTP round trip correctly (confirmed: hitting the backend by IP got
 * Django's real 400 response for an unrecognized Host header — the
 * whole HTTP stack works, only the hostname-triggered connect path
 * hangs). Also confirmed NOT Node's Happy Eyeballs (autoSelectFamily):
 * still hangs with --no-network-family-autoselection set.
 *
 * First attempt at this fix passed `connect: { host: address }` to
 * Agent — that does NOT work: undici's own connector
 * (undici/lib/core/connect.js) spreads the options object in and then
 * unconditionally overwrites `host` with the request's own parsed
 * hostname on the very next line, so any `connect.host` override is
 * silently discarded and it keeps dialing the hostname. Confirmed live
 * (same ~10s UND_ERR_CONNECT_TIMEOUT, "attempted address: backend:8000"
 * — the literal hostname, not the IP — even with that option set).
 *
 * The only way to actually control the socket target is to pass
 * `connect` as a FUNCTION instead of an options object — undici's
 * Client only calls buildConnector() (the thing that clobbers `host`)
 * when `typeof connect !== 'function'`; a function is used as-is. So
 * this dials `net.connect` straight to the resolved IP ourselves. This
 * does not touch the Host header fetch() sends (still derived from the
 * request's own URL/origin, i.e. "backend:8000" — required for
 * Django's ALLOWED_HOSTS check) or any other fetch/Response behavior.
 * Re-resolves fresh on every call rather than caching one Agent/IP,
 * since a container's IP can change across a restart or recreation.
 */
export async function backendDispatcher(baseUrl: string) {
  const { hostname } = new URL(baseUrl);
  const { address } = await lookup(hostname);
  return new Agent({
    connect(options, callback) {
      const socket = net.connect({ host: address, port: Number(options.port) });
      socket.once("connect", () => callback(null, socket));
      socket.once("error", (err) => callback(err, null));
    },
  });
}
