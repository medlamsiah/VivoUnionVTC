import Link from "next/link";
import { Simulator } from "@/components/simulator";

export default function SimulateurPage() {
  return (
    <div className="bg-[#f7fbfa]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Simulateur</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
              Simulez vos revenus VTC en quelques secondes
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="text-lg leading-8 text-slate-600">
              Entrez votre chiffre d'affaires mensuel. VIVO Union estime votre revenu net selon une logique claire et lisible.
            </p>
            <div className="mt-6">
              <Link href="/candidature" className="btn btn-primary">
                Candidater maintenant
              </Link>
            </div>
          </div>
        </div>

        <Simulator />
      </section>
    </div>
  );
}
