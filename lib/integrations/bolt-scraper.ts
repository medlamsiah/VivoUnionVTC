const ACTIVITY_STATUS = "Actif" as const;

type UnknownRecord = Record<string, unknown>;

export type WeeklyDriverInput = {
  id: number;
  name: string;
  company: string;
  uber: number;
  bolt: number;
  heetch: number;
  location: number;
  acompte: number;
  week: string;
  weekValue: string;
  status: "Actif";
};

type BoltAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type BoltCompany = {
  id: string;
  name: string;
};

type BoltDriver = {
  id: string;
  name: string;
  companyId: string;
  companyName?: string;
};

type BoltOrder = {
  driverId: string;
  driverName?: string;
  companyId: string;
  companyName?: string;
  gross: number;
  occurredAt: string;
};

type BoltSyncResult = {
  rows: WeeklyDriverInput[];
  updatedAt: string;
  diagnostics: string[];
};

type TokenCache = {
  value: string;
  expiresAt: number;
};

let boltTokenCache: TokenCache | null = null;

function getEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getBoltTokenUrl() {
  return getEnv("BOLT_TOKEN_URL") || "https://oidc.bolt.eu/token";
}

function getBoltApiBaseUrl() {
  return (getEnv("BOLT_API_BASE_URL") || "https://node.bolt.eu/fleet-integration-gateway").replace(/\/$/, "");
}

function getBoltScope() {
  return getEnv("BOLT_API_SCOPE") || "fleet-integration:api";
}

function toRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function isoWeekParts(dateInput: string) {
  const date = new Date(dateInput);
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);

  const year = temp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekString = String(week).padStart(2, "0");

  return {
    week: `S${week}`,
    weekValue: `${year}-W${weekString}`,
  };
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Bolt API returned non-JSON payload (${response.status})`);
  }
}

async function requestBoltAccessToken() {
  const clientId = getEnv("BOLT_CLIENT_ID");
  const clientSecret = getEnv("BOLT_CLIENT_SECRET");

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: getBoltScope(),
  });

  const response = await fetch(getBoltTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  const payload = (await parseJsonSafe(response)) as BoltAccessTokenResponse;

  if (!payload?.access_token) {
    throw new Error("Impossible de récupérer token Bolt");
  }

  boltTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 600) * 1000),
  };

  return payload.access_token;
}

async function getAccessToken() {
  if (boltTokenCache && boltTokenCache.expiresAt > Date.now()) {
    return boltTokenCache.value;
  }
  return requestBoltAccessToken();
}

async function fetchBoltApi(path: string, body?: unknown) {
  const token = await getAccessToken();

  const response = await fetch(`${getBoltApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  return parseJsonSafe(response);
}

function getDateChunks() {
  const chunks = [];
  const start = new Date("2026-01-01T00:00:00Z");
  const now = new Date();

  let current = new Date(start);

  while (current < now) {
    const end = new Date(current);
    end.setDate(end.getDate() + 30);

    chunks.push({
      start_ts: Math.floor(current.getTime() / 1000),
      end_ts: Math.floor(Math.min(end.getTime(), now.getTime()) / 1000),
    });

    current = new Date(end);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}

export async function scrapeBoltWeeklyRevenuesResult(): Promise<BoltSyncResult> {
  const diagnostics: string[] = [];

  const companiesPayload = await fetch(`${getBoltApiBaseUrl()}/fleetIntegration/v1/getCompanies`, {
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      Accept: "application/json",
    },
  });

  const companiesJson = await parseJsonSafe(companiesPayload);
  const companyIds = companiesJson?.data?.company_ids ?? [];

  const rowsMap = new Map<string, WeeklyDriverInput>();
  let syntheticId = 1;

  for (const companyId of companyIds) {
    for (const chunk of getDateChunks()) {
      try {
        const payload = await fetchBoltApi("/fleetIntegration/v1/getFleetOrders", {
          company_ids: [companyId],
          start_ts: chunk.start_ts,
          end_ts: chunk.end_ts,
          limit: 1000,
          offset: 0,
        });

        const orders = payload?.data?.orders ?? [];

        for (const order of orders) {
          const driverName = order.driver_name ?? "Unknown";
          const companyName = order.category_info?.name ?? "Bolt";
          const amount = 0;
          const date = new Date((order.order_created_timestamp ?? 0) * 1000).toISOString();
          const { week, weekValue } = isoWeekParts(date);

          const key = `${driverName}-${weekValue}`;

          if (!rowsMap.has(key)) {
            rowsMap.set(key, {
              id: syntheticId++,
              name: driverName,
              company: companyName,
              uber: 0,
              bolt: 0,
              heetch: 0,
              location: 0,
              acompte: 0,
              week,
              weekValue,
              status: ACTIVITY_STATUS,
            });
          }

          rowsMap.get(key)!.bolt += amount;
        }
      } catch (e) {
        diagnostics.push(String(e));
      }
    }
  }

  return {
    rows: Array.from(rowsMap.values()),
    updatedAt: new Date().toISOString(),
    diagnostics,
  };
}

export async function scrapeBoltWeeklyRevenues() {
  const result = await scrapeBoltWeeklyRevenuesResult();
  return result.rows;
}