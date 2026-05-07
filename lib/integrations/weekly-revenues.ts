import {
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
