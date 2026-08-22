import { lookup } from "node:dns/promises";
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
 * still hangs with --no-network-family-autoselection set. The precise
 * undici-internal cause wasn't isolated further.
 *
 * Rather than depend on correctly guessing undici's internals, this
 * resolves the hostname ourselves (proven reliable above) and hands
 * fetch() a custom dispatcher that connects the raw socket straight to
 * that literal IP, while leaving everything else — the Host header
 * fetch() sends, request/response body handling including multipart
 * form-data, the whole Response API — exactly as undici's own fetch()
 * already implements it. Re-resolves fresh on every call rather than
 * caching one Agent/IP, since a container's IP can change across a
 * restart or recreation.
 */
export async function backendDispatcher(baseUrl: string) {
  const { hostname } = new URL(baseUrl);
  const { address } = await lookup(hostname);
  return new Agent({ connect: { host: address } });
}
