import {
  type IssueMotorTag,
  type MotorisationKind,
  usesDieselModelRisks,
  usesEssenceModelRisks,
} from "./motorisation";

export interface KnownIssue {
  issue: string;
  kmThreshold?: number;
  costMin: number;
  costMax: number;
  /** diesel | essence | any (les deux thermiques) */
  motor: IssueMotorTag;
}

export interface EngineProfile {
  patterns: RegExp[];
  reliability: number;
  resale: number;
  export: number;
  knownIssues: KnownIssue[];
}

export interface BrandProfile {
  resale: number;
  export: number;
  models: Record<string, EngineProfile>;
  defaultEngine: EngineProfile;
}

const dieselCommonIssues: KnownIssue[] = [
  {
    issue: "FAP encrassé / régénération",
    kmThreshold: 120000,
    costMin: 400,
    costMax: 1800,
    motor: "diesel",
  },
  {
    issue: "Vanne EGR",
    kmThreshold: 150000,
    costMin: 250,
    costMax: 900,
    motor: "diesel",
  },
  {
    issue: "Turbo (usure)",
    kmThreshold: 180000,
    costMin: 800,
    costMax: 2500,
    motor: "diesel",
  },
  {
    issue: "Injecteurs diesel",
    kmThreshold: 180000,
    costMin: 400,
    costMax: 1500,
    motor: "diesel",
  },
];

const petrolCommonIssues: KnownIssue[] = [
  {
    issue: "Consommation d'huile excessive",
    kmThreshold: 120000,
    costMin: 400,
    costMax: 2000,
    motor: "essence",
  },
  {
    issue: "Bobines / bougies d'allumage",
    kmThreshold: 100000,
    costMin: 150,
    costMax: 700,
    motor: "essence",
  },
];

const timingBeltIssue: KnownIssue = {
  issue: "Courroie de distribution",
  kmThreshold: 100000,
  costMin: 600,
  costMax: 1200,
  motor: "any",
};

const timingChainIssue: KnownIssue = {
  issue: "Chaîne de distribution",
  kmThreshold: 150000,
  costMin: 1200,
  costMax: 3500,
  motor: "any",
};

const defaultFallbackIssues: KnownIssue[] = [
  ...dieselCommonIssues,
  ...petrolCommonIssues,
  timingBeltIssue,
];

/** Ne garde que les risques cohérents avec la motorisation réelle. */
export function filterKnownIssuesForMotor(
  issues: KnownIssue[],
  motor: MotorisationKind,
  fuel?: string,
  trim = ""
): KnownIssue[] {
  if (motor === "electrique") {
    return issues.filter((i) => i.motor === "any" && i.issue.toLowerCase().includes("batterie"));
  }

  const dieselOk = usesDieselModelRisks(motor, fuel, trim);
  const essenceOk = usesEssenceModelRisks(motor, fuel, trim);

  return issues.filter((issue) => {
    if (issue.motor === "any") return dieselOk || essenceOk;
    if (issue.motor === "diesel") return dieselOk;
    if (issue.motor === "essence") return essenceOk;
    return false;
  });
}

export const BRAND_DATABASE: Record<string, BrandProfile> = {
  toyota: {
    resale: 9,
    export: 8,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 9,
      resale: 9,
      export: 8,
      knownIssues: [
        {
          issue: "Embrayage (usage intensif)",
          kmThreshold: 180000,
          costMin: 600,
          costMax: 1100,
          motor: "any",
        },
        timingBeltIssue,
        ...petrolCommonIssues,
      ],
    },
    models: {
      avensis: {
        patterns: [/d-?4d/i, /hybrid/i],
        reliability: 9,
        resale: 9,
        export: 9,
        knownIssues: [
          ...dieselCommonIssues.slice(0, 2),
          dieselCommonIssues[3],
          timingBeltIssue,
        ],
      },
      yaris: {
        patterns: [/.*/],
        reliability: 9.5,
        resale: 8.5,
        export: 7,
        knownIssues: [
          {
            issue: "Embrayage",
            kmThreshold: 150000,
            costMin: 500,
            costMax: 900,
            motor: "any",
          },
        ],
      },
    },
  },
  audi: {
    resale: 8,
    export: 7,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 6.5,
      resale: 8,
      export: 7,
      knownIssues: [
        ...dieselCommonIssues,
        timingChainIssue,
        {
          issue: "Boîte S-Tronic / DSG",
          kmThreshold: 120000,
          costMin: 1500,
          costMax: 4000,
          motor: "any",
        },
        ...petrolCommonIssues,
      ],
    },
    models: {
      a4: {
        patterns: [/2\.0.*tdi/i, /35 tdi/i, /40 tdi/i],
        reliability: 6,
        resale: 8.5,
        export: 7,
        knownIssues: [
          ...dieselCommonIssues,
          timingChainIssue,
          {
            issue: "Turbocompresseur 2.0 TDI",
            kmThreshold: 160000,
            costMin: 1200,
            costMax: 2800,
            motor: "diesel",
          },
          {
            issue: "Boîte multitronic / S-Tronic",
            kmThreshold: 100000,
            costMin: 2000,
            costMax: 5000,
            motor: "any",
          },
        ],
      },
      a3: {
        patterns: [/.*/],
        reliability: 7,
        resale: 8,
        export: 7,
        knownIssues: [...dieselCommonIssues, timingChainIssue, ...petrolCommonIssues],
      },
    },
  },
  bmw: {
    resale: 8,
    export: 7,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 6,
      resale: 8,
      export: 7,
      knownIssues: [
        timingChainIssue,
        {
          issue: "Injecteurs / rampe common rail",
          kmThreshold: 150000,
          costMin: 800,
          costMax: 2000,
          motor: "diesel",
        },
        {
          issue: "Boîte automatique ZF (fuite huile)",
          kmThreshold: 120000,
          costMin: 500,
          costMax: 2500,
          motor: "any",
        },
        ...petrolCommonIssues,
      ],
    },
    models: {
      x1: {
        patterns: [/n47/i, /2\.0.*d/i],
        reliability: 5.5,
        resale: 7.5,
        export: 6,
        knownIssues: [
          {
            issue: "Chaîne distribution N47 (critique)",
            kmThreshold: 120000,
            costMin: 2000,
            costMax: 4500,
            motor: "any",
          },
          ...dieselCommonIssues,
        ],
      },
      "série 3": {
        patterns: [/n47/i],
        reliability: 5.5,
        resale: 8,
        export: 7,
        knownIssues: [
          {
            issue: "Chaîne distribution N47",
            kmThreshold: 120000,
            costMin: 2000,
            costMax: 4500,
            motor: "any",
          },
          ...dieselCommonIssues,
        ],
      },
    },
  },
  mercedes: {
    resale: 8,
    export: 7,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 6.5,
      resale: 8,
      export: 7,
      knownIssues: [
        ...dieselCommonIssues,
        {
          issue: "Capteur PM / AdBlue",
          kmThreshold: 150000,
          costMin: 300,
          costMax: 1500,
          motor: "diesel",
        },
        {
          issue: "Boîte 7G-Tronic / 9G",
          kmThreshold: 150000,
          costMin: 1500,
          costMax: 4000,
          motor: "any",
        },
        ...petrolCommonIssues,
        timingBeltIssue,
      ],
    },
    models: {},
  },
  peugeot: {
    resale: 6.5,
    export: 5,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 5.5,
      resale: 6,
      export: 5,
      knownIssues: [
        ...dieselCommonIssues,
        {
          issue: "Boîte EAT6/EAT8 (calage)",
          kmThreshold: 100000,
          costMin: 800,
          costMax: 2500,
          motor: "any",
        },
        timingBeltIssue,
        ...petrolCommonIssues,
      ],
    },
    models: {},
  },
  renault: {
    resale: 6.5,
    export: 6,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 6,
      resale: 6.5,
      export: 6,
      knownIssues: [
        {
          issue: "Turbo 1.5 dCi",
          kmThreshold: 150000,
          costMin: 700,
          costMax: 1800,
          motor: "diesel",
        },
        ...dieselCommonIssues.slice(0, 2),
        dieselCommonIssues[3],
        {
          issue: "Boîte EDC / DCT",
          kmThreshold: 100000,
          costMin: 1200,
          costMax: 3500,
          motor: "any",
        },
        ...petrolCommonIssues,
        timingBeltIssue,
      ],
    },
    models: {},
  },
  volkswagen: {
    resale: 7.5,
    export: 7,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 6.5,
      resale: 7.5,
      export: 7,
      knownIssues: [
        ...dieselCommonIssues,
        {
          issue: "Boîte DSG 7 rapports",
          kmThreshold: 100000,
          costMin: 1500,
          costMax: 4000,
          motor: "any",
        },
        timingBeltIssue,
        timingChainIssue,
        ...petrolCommonIssues,
      ],
    },
    models: {},
  },
  ford: {
    resale: 6,
    export: 5,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 5.5,
      resale: 6,
      export: 5,
      knownIssues: [
        {
          issue: "Embrayage Powershift (DSG Ford)",
          kmThreshold: 80000,
          costMin: 1500,
          costMax: 3500,
          motor: "any",
        },
        ...dieselCommonIssues.slice(0, 2),
        ...petrolCommonIssues,
        timingBeltIssue,
      ],
    },
    models: {},
  },
  citroen: {
    resale: 6,
    export: 5,
    defaultEngine: {
      patterns: [/.*/],
      reliability: 5.5,
      resale: 6,
      export: 5,
      knownIssues: [...dieselCommonIssues, timingBeltIssue, ...petrolCommonIssues],
    },
    models: {},
  },
};

export function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getEngineProfile(brand: string, model: string, trim = ""): EngineProfile {
  const bKey = normalizeBrand(brand);
  const mKey = model.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const brandProfile = BRAND_DATABASE[bKey];
  if (!brandProfile) {
    return {
      patterns: [/.*/],
      reliability: 6,
      resale: 6,
      export: 5,
      knownIssues: defaultFallbackIssues,
    };
  }

  for (const [modelKey, profile] of Object.entries(brandProfile.models)) {
    if (mKey.includes(modelKey)) {
      const text = `${trim} ${model}`;
      const matchesEngine = profile.patterns.some((p) => p.test(text));
      if (matchesEngine || profile.patterns.every((p) => p.source === ".*")) {
        return profile;
      }
    }
  }

  const text = `${trim} ${model} ${brand}`;
  for (const profile of Object.values(brandProfile.models)) {
    if (profile.patterns.some((p) => p.test(text) && p.source !== ".*")) {
      return profile;
    }
  }

  return brandProfile.defaultEngine;
}

export function getBrandResale(brand: string): number {
  const bKey = normalizeBrand(brand);
  return BRAND_DATABASE[bKey]?.resale ?? 6;
}
