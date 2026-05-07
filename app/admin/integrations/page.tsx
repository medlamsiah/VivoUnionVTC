import Link from "next/link";
import { redirect } from "next/navigation";

import { reconnectHeetchSession } from "@/lib/integrations/heetch-scraper";
import { reconnectUberSession } from "@/lib/integrations/uber-scraper";
import { getPlatformSyncStatuses, scrapeWeeklyRevenuesResult } from "@/lib/integrations/weekly-revenues";

export const dynamic = "force-dynamic";

const PLATFORM_CONFIG = {
  uber: {
    label: "Uber",
    loginUrl: "https://supplier.uber.com/",
    helper: "Reconnecte le compte Uber si la synchronisation live est perdue.",
  },
  heetch: {
    label: "Heetch",
    loginUrl: "https://driver.heetch.com/earnings",
    helper: "Tente une reconnexion serveur Heetch puis relance la recuperation live.",
  },
  bolt: {
    label: "Bolt",
    loginUrl: "https://fleets.bolt.eu/login/?lang=fr-fr&tab=email_username",
    helper: "Reconnecte Bolt si les identifiants ou la session ont expire.",
  },
} as const;

type AdminIntegrationsPageProps = {
  searchParams?: {
    synced?: string;
    heetch?: string;
    uber?: string;
  };
};

export default async function AdminIntegrationsPage({ searchParams }: AdminIntegrationsPageProps) {
  const params = searchParams ?? {};
  const statuses = getPlatformSyncStatuses();
  const offlineCount = statuses.filter((status) => status.state !== "live").length;

  async function manualSyncAction() {
    "use server";

    await scrapeWeeklyRevenuesResult();
    redirect("/admin/integrations?synced=1");
  }

  async function reconnectHeetchAction() {
    "use server";

    const ok = await reconnectHeetchSession();
    redirect(`/admin/integrations?heetch=${ok ? "ok" : "fail"}`);
  }

  async function reconnectUberAction() {
    "use server";

    const ok = await reconnectUberSession();
    redirect(`/admin/integrations?uber=${ok ? "ok" : "fail"}`);
  }

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,_#f5f9f7_0%,_#edf4f1_44%,_#f8fbfa_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Integrations
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Reconnexion des campagnes
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Cette page te permet de verifier l&apos;etat des comptes Uber, Heetch et Bolt, puis de
                relancer facilement la connexion si une campagne perd le live.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {offlineCount === 0 ? "Toutes les campagnes sont en live." : `${offlineCount} campagne(s) demandent une verification.`}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {statuses.map((status) => {
              const config = PLATFORM_CONFIG[status.platform];
              const isLive = status.state === "live";
              const badgeClass = isLive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status.state === "cache"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700";
              const badgeLabel = isLive ? "Live" : status.state === "cache" ? "Cache" : "Expire";

              return (
                <div key={status.platform} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold text-slate-950">{config.label}</div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>{badgeLabel}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{config.helper}</p>
                  <p className="mt-3 text-sm font-medium text-slate-700">{status.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {status.updatedAt ? `Derniere synchro reussie: ${status.updatedAt}` : "Aucune date disponible"}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {status.platform === "uber" ? (
                      <form action={reconnectUberAction}>
                        <button
                          type="submit"
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Reconnecter {config.label}
                        </button>
                      </form>
                    ) : status.platform === "heetch" ? (
                      <form action={reconnectHeetchAction}>
                        <button
                          type="submit"
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Reconnecter {config.label}
                        </button>
                      </form>
                    ) : (
                      <a
                        href={config.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Reconnecter {config.label}
                      </a>
                    )}
                    {status.platform === "uber" || status.platform === "heetch" ? (
                      <a
                        href={config.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                      >
                        Ouvrir {config.label}
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Verification immediate</div>
                <div className="mt-1 text-sm text-slate-600">
                  Une fois la reconnexion faite sur Uber, Heetch ou Bolt, lance une synchronisation immediate pour mettre a jour les statuts sans attendre les 2 heures.
                </div>
              </div>
              <form action={manualSyncAction}>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Lancer une verification live
                </button>
              </form>
            </div>
            {params.synced === "1" ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Verification terminee. Les statuts ci-dessus ont ete recalcules.
              </div>
            ) : null}
            {params.heetch === "ok" ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Session serveur Heetch recapturee. Lance maintenant une verification live pour confirmer le retour en direct.
              </div>
            ) : null}
            {params.uber === "ok" ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Session serveur Uber recapturee. Lance maintenant une verification live pour confirmer le retour en direct.
              </div>
            ) : null}
            {params.heetch === "fail" ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                La reconnexion serveur Heetch a echoue. Verifie `HEETCH_EMAIL` et `HEETCH_PASSWORD`, ou ouvre Heetch pour voir si une verification supplementaire est demandee.
              </div>
            ) : null}
            {params.uber === "fail" ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                La reconnexion serveur Uber a echoue. Verifie `UBER_EMAIL` et `UBER_PASSWORD`, ou ouvre Uber pour voir si une verification supplementaire est demandee.
              </div>
            ) : null}
          </div>

          <div className="mt-8 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
            <div className="text-sm font-semibold text-slate-900">Mode d&apos;emploi</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-600">1. Uber et Heetch tentent maintenant une reconnexion serveur automatique. Bolt ouvre encore sa page de connexion.</div>
              <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-600">2. Si une verification supplementaire est demandee par la plateforme, termine-la puis reviens ici.</div>
              <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-600">3. Relance ensuite la verification du live pour mettre a jour le statut final.</div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/admin"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
