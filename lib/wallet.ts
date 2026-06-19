/*
 * Wallet provider discovery via EIP-6963.
 * Wallets announce themselves; we keep a running registry and let the
 * caller pick one (by rdns, by preference order, or first available).
 */

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isRabby?: boolean;
  isMetaMask?: boolean;
}

interface ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

// Wallets we reach for first when the user has not pinned a choice.
const PREFERENCE = ["io.rabby", "io.metamask"];

// Storage key is assembled from parts so it reads distinctly per app.
const STORE_NAMESPACE = "ts";
const STORE_FIELD = "preferredRdns";
const RDNS_KEY = `${STORE_NAMESPACE}:${STORE_FIELD}`;

// Live registry of announced providers, keyed by rdns on insertion.
const registry: ProviderDetail[] = [];

function remember(detail?: ProviderDetail) {
  if (!detail?.info?.rdns || !detail.provider) return;
  const at = registry.findIndex((d) => d.info.rdns === detail.info.rdns);
  if (at === -1) registry.push(detail);
  else registry[at] = detail;
}

// Begin listening for announcements as soon as this module loads in the browser.
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e: Event) => {
    remember((e as CustomEvent<ProviderDetail>).detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// --- persisted choice --------------------------------------------------

export function setChosenRdns(rdns: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RDNS_KEY, rdns);
  } catch {
    /* ignore */
  }
}

export function getChosenRdns(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(RDNS_KEY) || "";
  } catch {
    return "";
  }
}

// --- discovery ---------------------------------------------------------

export function refreshWallets() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function ensureDiscovered(timeoutMs = 250): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (registry.length) {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const onAnnounce = () => finish();
    function finish() {
      if (settled) return;
      settled = true;
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve();
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(finish, timeoutMs);
  });
}

export function listWallets() {
  refreshWallets();
  return registry.map((d) => ({ name: d.info.name, rdns: d.info.rdns, icon: d.info.icon }));
}

// --- selection ---------------------------------------------------------

export function pickDetail(rdns?: string): { provider: Eip1193Provider; rdns: string } | undefined {
  refreshWallets();
  const want = rdns ?? getChosenRdns();
  if (want) {
    const hit = registry.find((d) => d.info.rdns === want);
    if (hit) return { provider: hit.provider, rdns: hit.info.rdns };
  }
  for (const r of PREFERENCE) {
    const hit = registry.find((d) => d.info.rdns === r);
    if (hit) return { provider: hit.provider, rdns: hit.info.rdns };
  }
  if (registry[0]) return { provider: registry[0].provider, rdns: registry[0].info.rdns };
  return undefined;
}

export function pickProvider(rdns?: string): Eip1193Provider | undefined {
  const d = pickDetail(rdns);
  if (d) return d.provider;
  return typeof window !== "undefined" ? (window.ethereum as Eip1193Provider | undefined) : undefined;
}
