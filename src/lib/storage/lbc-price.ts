const LBC_PRICE_KEY = "alcopa-lbc-prices";

type LbcPriceStore = Record<string, number>;

function readStore(): LbcPriceStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LBC_PRICE_KEY);
    return raw ? (JSON.parse(raw) as LbcPriceStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: LbcPriceStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LBC_PRICE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("alcopa-lbc-prices-updated"));
}

export function loadLbcPrice(vehicleUrl: string): number | null {
  const v = readStore()[vehicleUrl];
  return typeof v === "number" && v > 0 ? v : null;
}

export function loadAllLbcPrices(): LbcPriceStore {
  return readStore();
}

export function saveLbcPrice(vehicleUrl: string, price: number | null): void {
  const store = readStore();
  if (price === null || price <= 0 || !Number.isFinite(price)) {
    delete store[vehicleUrl];
  } else {
    store[vehicleUrl] = Math.round(price);
  }
  const keys = Object.keys(store);
  if (keys.length > 800) {
    for (const k of keys.slice(0, keys.length - 800)) delete store[k];
  }
  writeStore(store);
}
