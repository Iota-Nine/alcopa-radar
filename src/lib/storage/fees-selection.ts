const FEES_PICK_KEY = "alcopa-fees-picks";

type FeesPickStore = Record<string, boolean>;

function readStore(): FeesPickStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FEES_PICK_KEY);
    return raw ? (JSON.parse(raw) as FeesPickStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: FeesPickStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FEES_PICK_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("alcopa-fees-picks-updated"));
}

/** Choix utilisateur : true = inclus, false = en sus. null = utiliser la détection Alcopa. */
export function loadFeesChoice(vehicleUrl: string): boolean | null {
  const v = readStore()[vehicleUrl];
  return typeof v === "boolean" ? v : null;
}

export function saveFeesChoice(vehicleUrl: string, feesIncluded: boolean): void {
  const store = readStore();
  store[vehicleUrl] = feesIncluded;
  const keys = Object.keys(store);
  if (keys.length > 800) {
    for (const k of keys.slice(0, keys.length - 800)) delete store[k];
  }
  writeStore(store);
}

export function clearFeesChoice(vehicleUrl: string): void {
  const store = readStore();
  delete store[vehicleUrl];
  writeStore(store);
}
