import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";

const PROVIDER = "uber";
const DEFAULT_CSRF_TOKEN = "x";

export type UberSessionInput = {
  cookie: string;
  orgUuid: string;
  csrfToken?: string | null;
};

export type UberServerSession = {
  cookie: string;
  orgUuid: string;
  csrfToken: string;
  source: "database" | "environment";
};

export type UberSessionStatus = {
  ok: boolean;
  provider: "uber";
  status: "active" | "expired" | "missing";
  hasCookie: boolean;
  hasOrgUuid: boolean;
  orgUuidMasked: string | null;
  csrfTokenMasked: string | null;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
  source: "database" | "environment" | "none";
};

export class UberSessionMissingError extends Error {
  constructor() {
    super("Session Uber manquante. Ajoutez le cookie Uber ou identifiez-vous.");
    this.name = "UberSessionMissingError";
  }
}

export class UberSessionExpiredError extends Error {
  constructor() {
    super("Session Uber expiree. Reconnectez-vous puis relancez la synchronisation.");
    this.name = "UberSessionExpiredError";
  }
}

export async function saveUberSession(input: UberSessionInput): Promise<UberSessionStatus> {
  const cookie = input.cookie.trim();
  const orgUuid = input.orgUuid.trim();
  const csrfToken = (input.csrfToken ?? DEFAULT_CSRF_TOKEN).trim() || DEFAULT_CSRF_TOKEN;

  if (!cookie || !orgUuid) {
    throw new UberSessionMissingError();
  }

  await prisma.uberSession.upsert({
    where: {
      provider: PROVIDER,
    },
    create: {
      provider: PROVIDER,
      cookieCiphertext: encryptSecret(cookie),
      csrfTokenCiphertext: encryptSecret(csrfToken),
      orgUuid,
      status: "active",
      lastValidatedAt: new Date(),
      lastError: null,
    },
    update: {
      cookieCiphertext: encryptSecret(cookie),
      csrfTokenCiphertext: encryptSecret(csrfToken),
      orgUuid,
      status: "active",
      lastValidatedAt: new Date(),
      lastError: null,
    },
  });

  return getUberSessionStatus();
}

export async function getUberServerSession(): Promise<UberServerSession> {
  const dbSession = await prisma.uberSession.findUnique({
    where: {
      provider: PROVIDER,
    },
  });

  if (dbSession?.cookieCiphertext && dbSession.orgUuid) {
    return {
      cookie: decryptSecret(dbSession.cookieCiphertext),
      orgUuid: dbSession.orgUuid,
      csrfToken: dbSession.csrfTokenCiphertext ? decryptSecret(dbSession.csrfTokenCiphertext) : DEFAULT_CSRF_TOKEN,
      source: "database",
    };
  }

  const cookie = process.env.UBER_COOKIE?.trim();
  const orgUuid = (process.env.UBER_ORG_UUID ?? process.env.UBER_SUPPLIER_UUID)?.trim();
  const csrfToken = process.env.UBER_CSRF_TOKEN?.trim() || process.env.UBER_X_CSRF_TOKEN?.trim() || DEFAULT_CSRF_TOKEN;

  if (cookie && orgUuid) {
    return {
      cookie,
      orgUuid,
      csrfToken,
      source: "environment",
    };
  }

  throw new UberSessionMissingError();
}

export async function getUberSessionStatus(): Promise<UberSessionStatus> {
  const dbSession = await prisma.uberSession.findUnique({
    where: {
      provider: PROVIDER,
    },
  });

  if (dbSession && (dbSession.cookieCiphertext || dbSession.status === "expired")) {
    return {
      ok: dbSession.status === "active",
      provider: PROVIDER,
      status: normalizeStatus(dbSession.status),
      hasCookie: Boolean(dbSession.cookieCiphertext),
      hasOrgUuid: Boolean(dbSession.orgUuid),
      orgUuidMasked: maskUuid(dbSession.orgUuid),
      csrfTokenMasked: dbSession.csrfTokenCiphertext ? "****" : null,
      updatedAt: dbSession.updatedAt.toISOString(),
      lastValidatedAt: dbSession.lastValidatedAt?.toISOString() ?? null,
      lastError: dbSession.lastError,
      source: "database",
    };
  }

  const envCookie = process.env.UBER_COOKIE?.trim();
  const envOrgUuid = (process.env.UBER_ORG_UUID ?? process.env.UBER_SUPPLIER_UUID)?.trim();
  const envCsrf = process.env.UBER_CSRF_TOKEN?.trim() || process.env.UBER_X_CSRF_TOKEN?.trim();

  if (envCookie || envOrgUuid) {
    return {
      ok: Boolean(envCookie && envOrgUuid),
      provider: PROVIDER,
      status: envCookie && envOrgUuid ? "active" : "missing",
      hasCookie: Boolean(envCookie),
      hasOrgUuid: Boolean(envOrgUuid),
      orgUuidMasked: maskUuid(envOrgUuid ?? null),
      csrfTokenMasked: envCsrf ? "****" : null,
      updatedAt: null,
      lastValidatedAt: null,
      lastError: envCookie && envOrgUuid ? null : "Session Uber incomplete dans les variables serveur.",
      source: "environment",
    };
  }

  return {
    ok: false,
    provider: PROVIDER,
    status: "missing",
    hasCookie: false,
    hasOrgUuid: false,
    orgUuidMasked: null,
    csrfTokenMasked: null,
    updatedAt: null,
    lastValidatedAt: null,
    lastError: "Session Uber manquante. Ajoutez le cookie Uber ou identifiez-vous.",
    source: "none",
  };
}

export async function markUberSessionExpired(errorMessage: string): Promise<void> {
  await prisma.uberSession.upsert({
    where: {
      provider: PROVIDER,
    },
    create: {
      provider: PROVIDER,
      status: "expired",
      lastError: sanitizeError(errorMessage),
    },
    update: {
      status: "expired",
      lastError: sanitizeError(errorMessage),
    },
  });
}

export async function markUberSessionActive(): Promise<void> {
  await prisma.uberSession
    .update({
      where: {
        provider: PROVIDER,
      },
      data: {
        status: "active",
        lastValidatedAt: new Date(),
        lastError: null,
      },
    })
    .catch(() => undefined);
}

function normalizeStatus(status: string): "active" | "expired" | "missing" {
  if (status === "active" || status === "expired") {
    return status;
  }

  return "missing";
}

function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "enc",
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptSecret(value: string): string {
  const [prefix, version, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (prefix !== "enc" || version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted Uber session value.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.UBER_SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL ??
    "vivo-uber-session-development-secret";

  return crypto.createHash("sha256").update(secret).digest();
}

function maskUuid(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= 12) {
    return "****";
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function sanitizeError(value: string): string {
  return value.replace(/cookie=[^;\s]+/gi, "cookie=****").slice(0, 300);
}
