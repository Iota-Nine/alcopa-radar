const REPAIR_PICK_KEY = "alcopa-repair-picks";

type RepairPickStore = Record<string, string[]>;

function readStore(): RepairPickStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REPAIR_PICK_KEY);
    return raw ? (JSON.parse(raw) as RepairPickStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: RepairPickStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REPAIR_PICK_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("alcopa-repair-picks-updated"));
}

/** Choix réparations cochées pour une fiche (persisté entre onglets / rechargements). */
export function loadRepairSelection(vehicleUrl: string): string[] | null {
  const ids = readStore()[vehicleUrl];
  return ids && ids.length >= 0 ? ids : null;
}

export function saveRepairSelection(vehicleUrl: string, includedIds: Set<string>): void {
  const store = readStore();
  store[vehicleUrl] = [...includedIds];
  const keys = Object.keys(store);
  if (keys.length > 800) {
    for (const k of keys.slice(0, keys.length - 800)) delete store[k];
  }
  writeStore(store);
}

export function clearRepairSelection(vehicleUrl: string): void {
  const store = readStore();
  delete store[vehicleUrl];
  writeStore(store);
}
