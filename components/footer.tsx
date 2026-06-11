import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <BrandLogo className="w-fit border-0 bg-transparent px-0 shadow-none" imageClassName="h-10" />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
              VIVO Union accompagne les chauffeurs VTC avec des outils simples, un suivi clair et un accompagnement professionnel.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Liens rapides</h3>
            <div className="mt-4 grid gap-3 text-sm font-medium text-slate-700">
              <Link className="hover:text-emerald-700" href="/">Accueil</Link>
              <Link className="hover:text-emerald-700" href="/simulateur">Simulateur</Link>
              <Link className="hover:text-emerald-700" href="/candidature">Candidature</Link>
              <Link className="hover:text-emerald-700" href="/admin">Dashboard</Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Contact</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <span>Accompagnement chauffeur VTC</span>
              <span>Suivi des revenus</span>
              <Link className="font-semibold text-emerald-700 hover:text-emerald-800" href="/candidature">
                Candidater maintenant
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 VIVO Union. Tous droits réservés.</span>
          <span>Plateforme claire, moderne et pensée pour les chauffeurs.</span>
        </div>
      </div>
    </footer>
  );
}
