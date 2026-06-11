import {
  loadCachedBoltStatus,
  loadCachedBoltWeeklyRevenues,
  scrapeBoltWeeklyRevenuesResult,
  type WeeklyDriverInput,
} from "@/lib/integrations/bolt-scraper";

export type PlatformSyncState = "live" | "cache" | "fallback";

export type PlatformSyncStatus = {
  platform: "bolt" | "uber" | "heetch";
  state: PlatformSyncState;
  updatedAt: string | null;
  message: string;
  diagnostics?: string[];
};

export type WeeklyRevenuesResult = {
  drivers: WeeklyDriverInput[];
  syncStatuses: PlatformSyncStatus[];
};

const DISABLED_PLATFORM_MESSAGE = "Désactivé temporairement pour la production.";
const MISSING_BOLT_CREDENTIALS_MESSAGE = "Identifiants Bolt manquants dans Vercel";

export async function scrapeWeeklyRevenuesResult(): Promise<WeeklyRevenuesResult> {
  if (!process.env.BOLT_CLIENT_ID || !process.env.BOLT_CLIENT_SECRET) {
    return {
      drivers: [],
      syncStatuses: [
        {
          platform: "bolt",
          state: "fallback",
          updatedAt: null,
          message: MISSING_BOLT_CREDENTIALS_MESSAGE,
        },
        {
          platform: "uber",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
        {
          platform: "heetch",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
      ],
    };
  }

  try {
    const boltResult = await scrapeBoltWeeklyRevenuesResult();

    return {
      drivers: boltResult.rows,
      syncStatuses: [
        {
          platform: "bolt",
          state: "live",
          updatedAt: boltResult.updatedAt,
          message: boltResult.rows.length > 0
            ? "Synchro Bolt réussie via l'API officielle."
            : "Synchro Bolt réussie, mais aucune course/chauffeur exploitable trouvé.",
          diagnostics: boltResult.diagnostics,
        },
        {
          platform: "uber",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
        {
          platform: "heetch",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
      ],
    };
  } catch (error) {
    console.warn("Bolt API sync failed.", error);
    const cachedRows = loadCachedBoltWeeklyRevenues();
    const cachedStatus = loadCachedBoltStatus();

    if (cachedRows.length > 0) {
      return {
        drivers: cachedRows,
        syncStatuses: [
          {
            platform: "bolt",
            state: "cache",
            updatedAt: cachedStatus.updatedAt,
            message: "Synchro Bolt indisponible. Donnees chargees depuis le cache.",
            diagnostics: [error instanceof Error ? error.message : "Synchro Bolt echouee."],
          },
          {
            platform: "uber",
            state: "fallback",
            updatedAt: null,
            message: DISABLED_PLATFORM_MESSAGE,
          },
          {
            platform: "heetch",
            state: "fallback",
            updatedAt: null,
            message: DISABLED_PLATFORM_MESSAGE,
          },
        ],
      };
    }

    return {
      drivers: [],
      syncStatuses: [
        {
          platform: "bolt",
          state: "fallback",
          updatedAt: null,
          message:
            error instanceof Error
              ? `Synchro Bolt échouée: ${error.message}`
              : "Synchro Bolt échouée.",
        },
        {
          platform: "uber",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
        {
          platform: "heetch",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
      ],
    };
  }
}

export async function scrapeWeeklyRevenues(): Promise<WeeklyDriverInput[]> {
  const result = await scrapeWeeklyRevenuesResult();

  return result.drivers;
}

export function readWeeklyRevenuesSnapshot(): WeeklyRevenuesResult {
  const cachedRows = loadCachedBoltWeeklyRevenues();
  const cachedStatus = loadCachedBoltStatus();

  if (cachedRows.length > 0) {
    return {
      drivers: cachedRows,
      syncStatuses: [
        {
          platform: "bolt",
          state: "cache",
          updatedAt: cachedStatus.updatedAt,
          message: cachedStatus.message || "Donnees Bolt chargees depuis le cache.",
        },
        {
          platform: "uber",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
        {
          platform: "heetch",
          state: "fallback",
          updatedAt: null,
          message: DISABLED_PLATFORM_MESSAGE,
        },
      ],
    };
  }

  return {
    drivers: [],
    syncStatuses: getPlatformSyncStatuses(),
  };
}

export function getPlatformSyncStatuses(): PlatformSyncStatus[] {
  return [
    {
      platform: "bolt",
      state: "fallback",
      updatedAt: null,
      message: process.env.BOLT_CLIENT_ID && process.env.BOLT_CLIENT_SECRET
        ? "Synchro Bolt non lancée pour le moment."
        : MISSING_BOLT_CREDENTIALS_MESSAGE,
    },
    {
      platform: "uber",
      state: "fallback",
      updatedAt: null,
      message: DISABLED_PLATFORM_MESSAGE,
    },
    {
      platform: "heetch",
      state: "fallback",
      updatedAt: null,
      message: DISABLED_PLATFORM_MESSAGE,
    },
  ];
}
