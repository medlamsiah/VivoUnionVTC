"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";

type UberSessionStatus = {
  ok: boolean;
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

export default function UberSessionPage() {
  const [cookie, setCookie] = useState("");
  const [orgUuid, setOrgUuid] = useState("");
  const [csrfToken, setCsrfToken] = useState("x");
  const [status, setStatus] = useState<UberSessionStatus | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    refreshStatus();
  }, []);

  async function refreshStatus() {
    const response = await fetch("/api/integrations/uber/session", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (payload) {
      setStatus(payload);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/integrations/uber/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cookie,
          orgUuid,
          csrfToken,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(payload?.error ?? "Session Uber impossible a enregistrer.");
        return;
      }

      setCookie("");
      setCsrfToken("x");
      setMessage("Session Uber enregistree cote serveur.");
      await refreshStatus();
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Session Uber</h1>
            <p className="mt-2 text-sm text-slate-600">Connexion manuelle Uber Supplier pour l'import serveur.</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Retour dashboard
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Statut</div>
            <div className="mt-4 space-y-3 text-sm">
              <StatusLine label="Etat" value={statusLabel(status?.status)} strong />
              <StatusLine label="Source" value={status?.source ?? "none"} />
              <StatusLine label="Cookie" value={status?.hasCookie ? "enregistre et masque" : "manquant"} />
              <StatusLine label="Org UUID" value={status?.orgUuidMasked ?? "manquant"} />
              <StatusLine label="CSRF" value={status?.csrfTokenMasked ?? "x par defaut"} />
              <StatusLine label="Derniere maj" value={formatDate(status?.updatedAt)} />
            </div>
            {status?.lastError ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {status.lastError}
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Ajouter une session</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Connecte-toi a Uber Supplier, copie les valeurs serveur, puis enregistre ici.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.open("https://supplier.uber.com/", "_blank", "noopener,noreferrer")}
                className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ouvrir Uber Supplier
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">UBER_COOKIE</span>
                <textarea
                  value={cookie}
                  onChange={(event) => setCookie(event.target.value)}
                  required
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                  placeholder="Colle le header Cookie complet ici"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">UBER_ORG_UUID</span>
                <input
                  value={orgUuid}
                  onChange={(event) => setOrgUuid(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">UBER_CSRF_TOKEN</span>
                <input
                  value={csrfToken}
                  onChange={(event) => setCsrfToken(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                  placeholder="x"
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Enregistrement..." : "Enregistrer la session Uber"}
              </button>
            </form>

            {message ? <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-semibold text-slate-950" : "text-slate-800"}>{value}</span>
    </div>
  );
}

function statusLabel(status: UberSessionStatus["status"] | undefined): string {
  if (status === "active") {
    return "active";
  }

  if (status === "expired") {
    return "expiree";
  }

  return "manquante";
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "aucune";
  }

  return new Date(value).toLocaleString("fr-FR");
}
