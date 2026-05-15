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
  status?: string;
};

type BoltOrder = {
  driverId: string;
  driverName?: string;
  companyId: string;
  net: number;
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

type BoltApiCall = {
  ok: boolean;
  status: number;
  payload: unknown;
  message: string;
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
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9,.-]/g, "").replace(",", ".").trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }

    const record = toRecord(value);
    if (record) {
      const nested = firstNumber(record.amount, record.value, record.gross, record.total, record.price);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function collectObjects(input: unknown, depth = 0): UnknownRecord[] {
  if (depth > 8) return [];

  if (Array.isArray(input)) {
    return input.flatMap((item) => collectObjects(item, depth + 1));
  }

  const record = toRecord(input);
  if (!record) return [];

  return [record, ...Object.values(record).flatMap((value) => collectObjects(value, depth + 1))];
}

function collectCandidateArrays(input: unknown, keys: string[]): UnknownRecord[] {
  const record = toRecord(input);
  const found: UnknownRecord[] = [];

  function walk(value: unknown, depth = 0) {
    if (depth > 8) return;
    if (Array.isArray(value)) {
      const records = value.map((item) => toRecord(item)).filter((item): item is UnknownRecord => Boolean(item));
      if (records.length > 0) found.push(...records);
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    const current = toRecord(value);
    if (!current) return;
    for (const key of keys) {
      const child = current[key];
      if (Array.isArray(child)) {
        found.push(...child.map((item) => toRecord(item)).filter((item): item is UnknownRecord => Boolean(item)));
      }
    }
    Object.values(current).forEach((child) => walk(child, depth + 1));
  }

  walk(record ?? input);
  return dedupeRecords(found);
}

function dedupeRecords(items: UnknownRecord[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDateRangeTs() {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date();

  return {
    start_ts: Math.floor(start.getTime() / 1000),
    end_ts: Math.floor(end.getTime() / 1000),
  };
}

function isoWeekParts(dateInput: string) {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return { week: "S1", weekValue: "1970-W01" };
  }

  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return { week: `S${weekNumber}`, weekValue: `${year}-W${weekString}` };
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Bolt API returned non-JSON payload (${response.status}): ${text.slice(0, 180)}`);
  }
}

function isBoltOk(payload: unknown) {
  const record = toRecord(payload);
  const code = firstNumber(record?.code);
  return code === null || code === 0;
}

async function requestBoltAccessToken() {
  const clientId = getEnv("BOLT_CLIENT_ID");
  const clientSecret = getEnv("BOLT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Identifiants Bolt manquants dans Vercel (BOLT_CLIENT_ID / BOLT_CLIENT_SECRET).");
  }

  if (boltTokenCache && boltTokenCache.expiresAt > Date.now() + 10000) {
    return boltTokenCache.value;
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: getBoltScope(),
  });

  const response = await fetch(getBoltTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
    cache: "no-store",
  });

  const payload = (await parseJsonSafe(response)) as BoltAccessTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || "verifie Client ID / Secret / scope";
    throw new Error(`Bolt token request failed (${response.status}) : ${detail}`);
  }

  boltTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 600) - 30) * 1000,
  };

  return payload.access_token;
}

async function fetchBoltApi(path: string, method: "GET" | "POST", body?: unknown): Promise<BoltApiCall> {
  const accessToken = await requestBoltAccessToken();
  const response = await fetch(`${getBoltApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    cache: "no-store",
  });

  const payload = await parseJsonSafe(response);
  const message = response.ok
    ? `${path} OK (${response.status})`
    : `${path} FAILED (${response.status}) ${extractErrorMessage(payload)}`;

  return { ok: response.ok, status: response.status, payload, message };
}

function extractErrorMessage(payload: unknown) {
  const record = toRecord(payload);
  return firstString(record?.message, record?.error, record?.error_description, record?.detail) ?? "";
}

function getDateWindowBody(companyId: string) {
  const to = new Date();
  const from = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);
  const base = companyId ? { company_id: companyId, companyId } : {};

  return [
    { ...base, date_from: fromDate, date_to: toDate },
    { ...base, start_date: fromDate, end_date: toDate },
    { ...base, from: fromDate, to: toDate },
    { ...base, start: from.toISOString(), end: to.toISOString() },
    base,
    companyId ? { company_ids: [companyId] } : {},
    companyId ? { companyIds: [companyId] } : {},
  ];
}

async function fetchCompanies(diagnostics: string[]) {
  const result = await fetchBoltApi("/fleetIntegration/v1/getCompanies", "GET");
  diagnostics.push(result.message);
  if (!result.ok) return [];

  const companies = collectCandidateArrays(result.payload, ["companies", "company_list", "items", "data", "result"])
    .concat(collectObjects(result.payload))
    .map((item) => {
      const id = firstString(item.companyId, item.company_id, item.id, item.uuid, item.fleetId, item.fleet_id);
      const name = firstString(item.companyName, item.company_name, item.name, item.title, item.legalName, item.legal_name);
      return id && name ? { id, name } : null;
    })
    .filter((item): item is BoltCompany => Boolean(item));

  return dedupeBy(companies, (company) => company.id);
}

function parseDriversFromPayload(payload: unknown, companyId: string, companyName?: string) {
  return collectCandidateArrays(payload, ["drivers", "driver_list", "items", "data", "result", "users"])
    .concat(collectObjects(payload))
    .map((item): BoltDriver | null => {
      const nestedUser = toRecord(item.user);
      const id = firstString(item.driverId, item.driver_id, item.id, item.uuid, item.userId, item.user_id, nestedUser?.id);
      const firstName = firstString(item.firstName, item.first_name, nestedUser?.firstName, nestedUser?.first_name);
      const lastName = firstString(item.lastName, item.last_name, nestedUser?.lastName, nestedUser?.last_name);
      const displayName =
        firstString(item.name, item.fullName, item.full_name, item.displayName, item.display_name, nestedUser?.name, nestedUser?.fullName) ??
        [firstName, lastName].filter(Boolean).join(" ").trim();
      if (!id || !displayName) return null;
      return {
        id,
        name: displayName,
        companyId: firstString(item.companyId, item.company_id, item.fleetId, item.fleet_id) ?? companyId,
        companyName,
        status: firstString(item.status, item.state, item.activityStatus, item.activity_status) ?? undefined,
      };
    })
    .filter((item): item is BoltDriver => item !== null);
}

async function fetchDrivers(companyId: string, companyName: string | undefined, diagnostics: string[]) {
  for (const body of getDateWindowBody(companyId)) {
    const result = await fetchBoltApi("/fleetIntegration/v1/getDrivers", "POST", body);
    diagnostics.push(`${result.message} body=${JSON.stringify(body)}`);
    if (!result.ok) continue;
    const drivers = parseDriversFromPayload(result.payload, companyId, companyName);
    if (drivers.length > 0) return drivers;
  }
  return [];
}

function resolveGrossValue(order: UnknownRecord) {
  const financial = toRecord(order.financials) ?? toRecord(order.finance) ?? toRecord(order.payment) ?? toRecord(order.fare) ?? {};
  return firstNumber(
    order.grossEarnings,
    order.gross_earnings,
    order.totalRevenue,
    order.total_revenue,
    order.driverRevenue,
    order.driver_revenue,
    order.earnings,
    order.revenue,
    order.amount,
    order.total,
    order.price,
    order.final_price,
    financial.gross,
    financial.total,
    financial.amount,
    financial.price,
  ) ?? 0;
}

function resolveOrderTime(order: UnknownRecord) {
  return firstString(
    order.finishedAt,
    order.finished_at,
    order.completedAt,
    order.completed_at,
    order.dropoffTime,
    order.dropoff_time,
    order.createdAt,
    order.created_at,
    order.startTime,
    order.start_time,
    order.date,
    order.timestamp,
  ) ?? new Date().toISOString();
}

function parseOrdersFromPayload(payload: unknown, companyId: string, companyName?: string) {
  return collectCandidateArrays(payload, ["orders", "rides", "trips", "items", "data", "result"])
    .concat(collectObjects(payload))
    .map((item): BoltOrder | null => {
      const nestedDriver = toRecord(item.driver) ?? toRecord(item.partner_driver) ?? toRecord(item.courier);
      const driverId = firstString(
        item.driverId,
        item.driver_id,
        item.partnerDriverId,
        item.partner_driver_id,
        item.courierId,
        item.courier_id,
        item.chauffeurId,
        item.chauffeur_id,
        nestedDriver?.id,
        nestedDriver?.driverId,
        nestedDriver?.driver_id,
        nestedDriver?.partnerDriverId,
        item.userId,
      );
      const driverName = firstString(
        item.driverName,
        item.driver_name,
        item.partnerDriverName,
        item.partner_driver_name,
        item.courierName,
        item.courier_name,
        item.chauffeurName,
        item.chauffeur_name,
        nestedDriver?.name,
        nestedDriver?.fullName,
        nestedDriver?.full_name,
      );
      const resolvedDriverId = driverId ?? (driverName ? `name:${driverName.toLowerCase().trim()}` : null);
      if (!resolvedDriverId) return null;
      return {
        driverId: resolvedDriverId,
        driverName: driverName ?? undefined,
        companyId: firstString(item.companyId, item.company_id, item.fleetId, item.fleet_id) ?? companyId,
        companyName,
        gross: resolveGrossValue(item),
        occurredAt: resolveOrderTime(item),
      };
    })
    .filter((item): item is BoltOrder => item !== null);
}

async function fetchOrders(companyId: string, companyName: string | undefined, diagnostics: string[]) {
  for (const body of getDateWindowBody(companyId)) {
    const result = await fetchBoltApi("/fleetIntegration/v1/getFleetOrders", "POST", body);
    diagnostics.push(`${result.message} body=${JSON.stringify(body)}`);
    if (!result.ok) continue;
    const orders = parseOrdersFromPayload(result.payload, companyId, companyName);
    if (orders.length > 0) return orders;
  }
  return [];
}

function buildWeeklyRows(companies: BoltCompany[], drivers: BoltDriver[], orders: BoltOrder[]) {
  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
  const driverById = new Map(drivers.map((driver) => [driver.id, { name: driver.name, companyId: driver.companyId, companyName: driver.companyName }]));
  const rows = new Map<string, WeeklyDriverInput>();
  let id = 1;

  for (const order of orders) {
    const driverInfo = driverById.get(order.driverId);
    const driverName = order.driverName ?? driverInfo?.name ?? `Chauffeur ${order.driverId.slice(-4)}`;
    const companyId = order.companyId || driverInfo?.companyId || "bolt";
    const companyName = order.companyName ?? driverInfo?.companyName ?? companyNameById.get(companyId) ?? "Bolt";
    const { week, weekValue } = isoWeekParts(order.occurredAt);
    const key = `${companyName}::${driverName}::${weekValue}`;
    const current = rows.get(key) ?? {
      id: syntheticId++, name: driverName, company: companyName, uber: 0, bolt: 0, heetch: 0,
      location: 0, acompte: 0, week, weekValue, status: ACTIVITY_STATUS,
    };
    current.bolt = Number((current.bolt + order.gross).toFixed(2));
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort((left, right) => left.weekValue === right.weekValue ? left.name.localeCompare(right.name, "fr") : right.weekValue.localeCompare(left.weekValue));
}

function buildFallbackRowsFromDrivers(companies: BoltCompany[], drivers: BoltDriver[]): WeeklyDriverInput[] {
  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
  const { week, weekValue } = isoWeekParts(new Date().toISOString());
  let syntheticId = 1;
  return dedupeBy(drivers, (driver) => `${driver.companyId}:${driver.id}`).map((driver) => ({
    id: syntheticId++,
    name: driver.name,
    company: driver.companyName ?? companyNameById.get(driver.companyId) ?? "Bolt",
    uber: 0,
    bolt: 0,
    heetch: 0,
    location: 0,
    acompte: 0,
    week,
    weekValue,
    status: ACTIVITY_STATUS,
  })).sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let boltCache: BoltSyncResult | null = null;
let boltCacheTime = 0;

export async function scrapeBoltWeeklyRevenuesResult(): Promise<BoltSyncResult> {
  const diagnostics: string[] = [];
  const companies = await fetchCompanies(diagnostics);
  const allDrivers: BoltDriver[] = [];
  const allOrders: BoltOrder[] = [];

  const targets = companies.length > 0 ? companies : [{ id: "", name: "Bolt" }];
  for (const company of targets) {
    const [drivers, orders] = await Promise.all([
      fetchDrivers(company.id, company.name, diagnostics),
      fetchOrders(company.id, company.name, diagnostics),
    ]);
    allDrivers.push(...drivers);
    allOrders.push(...orders);
  }

  if (companies.length > 0 && allDrivers.length === 0 && allOrders.length === 0) {
    const [drivers, orders] = await Promise.all([
      fetchDrivers("", undefined, diagnostics),
      fetchOrders("", undefined, diagnostics),
    ]);
    allDrivers.push(...drivers);
    allOrders.push(...orders);
  }

  const rows = allOrders.length > 0 ? buildWeeklyRows(companies, allDrivers, allOrders) : buildFallbackRowsFromDrivers(companies, allDrivers);
  diagnostics.push(`Bolt parsed: ${allDrivers.length} chauffeurs, ${allOrders.length} courses, ${rows.length} lignes dashboard.`);

  return { rows, updatedAt: new Date().toISOString(), diagnostics };
}

export async function scrapeBoltWeeklyRevenues() {
  const result = await scrapeBoltWeeklyRevenuesResult();
  return result.rows;
}