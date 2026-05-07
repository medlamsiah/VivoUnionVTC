import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  return (
    <footer className="border-t border-emerald-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <BrandLogo className="w-fit" imageClassName="h-10" />
            <div className="max-w-md text-sm text-gray-500">
              Une interface simple et professionnelle pour candidater, suivre vos revenus et piloter votre activité VTC avec l'identité VIVO union.
            </div>
          </div>

          <div className="flex gap-3 text-sm text-gray-600">
            <Link className="hover:text-black" href="/simulateur">Simulateur</Link>
            <Link className="hover:text-black" href="/candidature">Candidature</Link>
            <Link className="hover:text-black" href="/admin">Dashboard</Link>
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-500">© {new Date().getFullYear()} VIVO union. Tous droits réservés.</div>
      </div>
    </footer>
  );
}

