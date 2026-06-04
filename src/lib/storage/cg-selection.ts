const CG_PICK_KEY = "alcopa-cg-in-margin";

type CgPickStore = Record<string, boolean>;

function readStore(): CgPickStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CG_PICK_KEY);
    return raw ? (JSON.parse(raw) as CgPickStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CgPickStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CG_PICK_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("alcopa-cg-picks-updated"));
}

/** true = compter la CG dans la marge (défaut). false = ignorer (0 €). */
export function loadCarteGriseInMarginChoice(vehicleUrl: string): boolean | null {
  const v = readStore()[vehicleUrl];
  return typeof v === "boolean" ? v : null;
}

export function saveCarteGriseInMarginChoice(vehicleUrl: string, include: boolean): void {
  const store = readStore();
  store[vehicleUrl] = include;
  const keys = Object.keys(store);
  if (keys.length > 800) {
    for (const k of keys.slice(0, keys.length - 800)) delete store[k];
  }
  writeStore(store);
}

export function resolveCarteGriseInMargin(userChoice: boolean | null): boolean {
  if (userChoice !== null) return userChoice;
  return true;
}
