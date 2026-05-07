import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { WeeklyDriverInput } from "@/lib/integrations/bolt-scraper";

export const LOCATION_TYPE_KEYS = ["ECO", "COMFORT", "BERLINE", "HAUTE_GAMME"] as const;

export type LocationTypeKey = (typeof LOCATION_TYPE_KEYS)[number];

export type LocationTypePricing = {
  key: LocationTypeKey;
  label: string;
  price: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DriverWeeklyLocationSetting = {
  id: string;
  driverName: string;
  driverNameKey: string;
  weekValue: string;
  vehicleType: string | null;
  location: number;
  acompte: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DriverWeeklyLocationEditorRow = {
  driverName: string;
  driverNameKey: string;
  weekValue: string;
  week: string;
  companies: string[];
  uber: number;
  bolt: number;
  heetch: number;
  totalBrut: number;
  vehicleType: LocationTypeKey | null;
  location: number;
  acompte: number;
};

const DEFAULT_LOCATION_TYPE_PRICINGS: Array<{
  key: LocationTypeKey;
  label: string;
  price: number;
  sortOrder: number;
}> = [
  { key: "ECO", label: "ECO", price: 250, sortOrder: 1 },
  { key: "COMFORT", label: "Comfort", price: 270, sortOrder: 2 },
  { key: "BERLINE", label: "Berline", price: 300, sortOrder: 3 },
  { key: "HAUTE_GAMME", label: "Haute gamme", price: 330, sortOrder: 4 },
];

export async function listLocationTypePricings(): Promise<LocationTypePricing[]> {
  await ensureDefaultLocationTypePricings();

  try {
    const rows = await prisma.$queryRaw<LocationTypePricing[]>`
      SELECT
        "key",
        "label",
        "price",
        "sortOrder",
        "createdAt",
        "updatedAt"
      FROM "LocationTypePricing"
      ORDER BY "sortOrder" ASC, "label" ASC
    `;

    return rows.map((row) => ({
      ...row,
      key: toLocationTypeKey(row.key),
      price: round2(row.price),
    }));
  } catch (error) {
    console.warn("Unable to load location type pricings from Prisma.", error);
    return DEFAULT_LOCATION_TYPE_PRICINGS.map((row) => ({
      ...row,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }));
  }
}

export async function upsertLocationTypePricing(input: {
  key: LocationTypeKey;
  label: string;
  price: number;
  sortOrder: number;
}): Promise<void> {
  const key = toLocationTypeKey(input.key);
  const label = input.label.trim();
  const price = round2(Math.max(input.price, 0));
  const sortOrder = Math.max(0, Math.trunc(input.sortOrder));

  await prisma.$executeRaw`
    INSERT INTO "LocationTypePricing" (
      "key",
      "label",
      "price",
      "sortOrder",
      "createdAt",
      "updatedAt"
    )
    VALUES (${key}, ${label}, ${price}, ${sortOrder}, NOW(), NOW())
    ON CONFLICT ("key")
    DO UPDATE SET
      "label" = EXCLUDED."label",
      "price" = EXCLUDED."price",
      "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = NOW()
  `;
}

export function getWeeklySettingAmount(
  settings: DriverWeeklyLocationSetting[],
  pricings: LocationTypePricing[],
  driverName: string,
  weekValue: string,
): { vehicleType: LocationTypeKey | null; location: number; acompte: number } {
  const key = getSettingKey(normalizeDriverNameKey(driverName), weekValue);
  const setting = settings.find((row) => getSettingKey(row.driverNameKey, row.weekValue) === key);
  const vehicleType = setting?.vehicleType ? toLocationTypeKey(setting.vehicleType) : null;
  const priceMap = buildLocationPricingMap(pricings);
  const fallbackLocation = round2(setting?.location ?? 0);
  const location =
    vehicleType && priceMap.has(vehicleType) ? round2(priceMap.get(vehicleType) ?? 0) : fallbackLocation;

  return {
    vehicleType,
    location,
    acompte: round2(setting?.acompte ?? 0),
  };
}

export async function listDriverWeeklyLocationSettings(): Promise<DriverWeeklyLocationSetting[]> {
  try {
    return await prisma.$queryRaw<DriverWeeklyLocationSetting[]>`
      SELECT
        "id",
        "driverName",
        "driverNameKey",
        "weekValue",
        "vehicleType",
        "location",
        "acompte",
        "createdAt",
        "updatedAt"
      FROM "DriverWeeklySetting"
      ORDER BY "weekValue" DESC, "driverName" ASC
    `;
  } catch (error) {
    console.warn("Unable to load driver weekly settings from Prisma.", error);
    return [];
  }
}

export async function upsertDriverWeeklyLocationSetting(input: {
  driverName: string;
  weekValue: string;
  vehicleType: LocationTypeKey | null;
  location: number;
  acompte: number;
}): Promise<void> {
  const driverName = input.driverName.trim();
  const weekValue = input.weekValue.trim();
  const vehicleType = input.vehicleType ? toLocationTypeKey(input.vehicleType) : null;
  const location = round2(Math.max(input.location, 0));
  const acompte = round2(Math.max(input.acompte, 0));
  const driverNameKey = normalizeDriverNameKey(driverName);
  const id = randomUUID().replace(/-/g, "");

  await prisma.$executeRaw`
    INSERT INTO "DriverWeeklySetting" (
      "id",
      "createdAt",
      "updatedAt",
      "driverName",
      "driverNameKey",
      "weekValue",
      "vehicleType",
      "location",
      "acompte"
    )
    VALUES (${id}, NOW(), NOW(), ${driverName}, ${driverNameKey}, ${weekValue}, ${vehicleType}, ${location}, ${acompte})
    ON CONFLICT ("driverNameKey", "weekValue")
    DO UPDATE SET
      "driverName" = EXCLUDED."driverName",
      "vehicleType" = EXCLUDED."vehicleType",
      "location" = EXCLUDED."location",
      "acompte" = EXCLUDED."acompte",
      "updatedAt" = NOW()
  `;
}

export function applyDriverWeeklyLocationSettings(
  drivers: WeeklyDriverInput[],
  settings: DriverWeeklyLocationSetting[],
  pricings: LocationTypePricing[],
): WeeklyDriverInput[] {
  const settingMap = new Map(settings.map((setting) => [getSettingKey(setting.driverNameKey, setting.weekValue), setting]));
  const groupedDrivers = new Map<string, WeeklyDriverInput[]>();
  const priceMap = buildLocationPricingMap(pricings);

  for (const driver of drivers) {
    const key = getSettingKey(normalizeDriverNameKey(driver.name), driver.weekValue);
    const group = groupedDrivers.get(key) ?? [];
    group.push({ ...driver });
    groupedDrivers.set(key, group);
  }

  const adjustedDrivers: WeeklyDriverInput[] = [];

  for (const [key, group] of groupedDrivers) {
    const setting = settingMap.get(key);
    const vehicleType = setting?.vehicleType ? toLocationTypeKey(setting.vehicleType) : null;
    const targetLocation =
      vehicleType && priceMap.has(vehicleType)
        ? round2(priceMap.get(vehicleType) ?? 0)
        : round2(setting?.location ?? group.reduce((total, row) => total + row.location, 0));
    const targetAcompte = round2(setting?.acompte ?? group.reduce((total, row) => total + row.acompte, 0));
    const distributedLocations = distributeAmountAcrossRows(group, targetLocation);
    const distributedAcomptes = distributeAmountAcrossRows(group, targetAcompte);

    group.forEach((row, index) => {
      adjustedDrivers.push({
        ...row,
        location: distributedLocations[index] ?? 0,
        acompte: distributedAcomptes[index] ?? 0,
      });
    });
  }

  return adjustedDrivers;
}

export function buildDriverWeeklyLocationEditorRows(
  drivers: WeeklyDriverInput[],
  settings: DriverWeeklyLocationSetting[],
  pricings: LocationTypePricing[],
): DriverWeeklyLocationEditorRow[] {
  const groupedDrivers = buildGroupedWeeklyDriverMap(drivers, settings, pricings);

  return [...groupedDrivers.values()]
    .map((row) => ({
      driverName: row.name,
      driverNameKey: normalizeDriverNameKey(row.name),
      weekValue: row.weekValue,
      week: row.week,
      companies: row.company.split(" + "),
      uber: row.uber,
      bolt: row.bolt,
      heetch: row.heetch,
      totalBrut: round2(row.uber + row.bolt + row.heetch),
      vehicleType: (row as WeeklyDriverInput & { vehicleType?: LocationTypeKey | null }).vehicleType ?? null,
      location: row.location,
      acompte: row.acompte,
    }))
    .sort((a, b) => {
      const weekCompare = b.weekValue.localeCompare(a.weekValue);
      if (weekCompare !== 0) {
        return weekCompare;
      }

      return a.driverName.localeCompare(b.driverName);
    });
}

export function buildDriverWeeklyDashboardRows(
  drivers: WeeklyDriverInput[],
  settings: DriverWeeklyLocationSetting[],
  pricings: LocationTypePricing[],
): WeeklyDriverInput[] {
  return [...buildGroupedWeeklyDriverMap(drivers, settings, pricings).values()].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return a.weekValue.localeCompare(b.weekValue);
  });
}

export function normalizeDriverNameKey(driverName: string): string {
  return driverName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function distributeAmountAcrossRows(rows: WeeklyDriverInput[], targetAmount: number): number[] {
  if (rows.length === 0) {
    return [];
  }

  if (rows.length === 1) {
    return [round2(targetAmount)];
  }

  const grossTotals = rows.map((row) => round2(row.uber + row.bolt + row.heetch));
  const grossSum = round2(grossTotals.reduce((total, value) => total + value, 0));

  if (grossSum <= 0) {
    return rows.map((_, index) => (index === 0 ? round2(targetAmount) : 0));
  }

  const distributed = rows.map((row, index) => {
    if (index === rows.length - 1) {
      return 0;
    }

    const weight = round2(row.uber + row.bolt + row.heetch) / grossSum;
    return round2(targetAmount * weight);
  });

  const assigned = round2(distributed.reduce((total, value) => total + value, 0));
  distributed.push(round2(targetAmount - assigned));
  return distributed;
}

function getSettingKey(driverNameKey: string, weekValue: string): string {
  return `${driverNameKey}::${weekValue}`;
}

function buildGroupedWeeklyDriverMap(
  drivers: WeeklyDriverInput[],
  settings: DriverWeeklyLocationSetting[],
  pricings: LocationTypePricing[],
): Map<string, WeeklyDriverInput> {
  const groupedRows = new Map<string, WeeklyDriverInput>();

  for (const driver of drivers) {
    const key = getSettingKey(normalizeDriverNameKey(driver.name), driver.weekValue);
    const existing = groupedRows.get(key);

    if (!existing) {
      const weeklySetting = getWeeklySettingAmount(settings, pricings, driver.name, driver.weekValue);
      groupedRows.set(key, {
        ...driver,
        company: driver.company,
        location: weeklySetting.location,
        acompte: weeklySetting.acompte,
        vehicleType: weeklySetting.vehicleType,
      } as WeeklyDriverInput);
      continue;
    }

    const companyNames = uniqueStrings([...existing.company.split(" + "), driver.company]);
    groupedRows.set(key, {
      ...existing,
      company: companyNames.join(" + "),
      uber: round2(existing.uber + driver.uber),
      bolt: round2(existing.bolt + driver.bolt),
      heetch: round2(existing.heetch + driver.heetch),
    });
  }

  return groupedRows;
}

async function ensureDefaultLocationTypePricings(): Promise<void> {
  try {
    for (const pricing of DEFAULT_LOCATION_TYPE_PRICINGS) {
      await upsertLocationTypePricing(pricing);
    }
  } catch (error) {
    console.warn("Unable to seed default location type pricings.", error);
  }
}

function buildLocationPricingMap(pricings: LocationTypePricing[]): Map<LocationTypeKey, number> {
  const map = new Map<LocationTypeKey, number>();

  for (const pricing of pricings) {
    map.set(toLocationTypeKey(pricing.key), round2(pricing.price));
  }

  for (const pricing of DEFAULT_LOCATION_TYPE_PRICINGS) {
    if (!map.has(pricing.key)) {
      map.set(pricing.key, round2(pricing.price));
    }
  }

  return map;
}

function toLocationTypeKey(value: string): LocationTypeKey {
  return LOCATION_TYPE_KEYS.includes(value as LocationTypeKey) ? (value as LocationTypeKey) : "ECO";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
