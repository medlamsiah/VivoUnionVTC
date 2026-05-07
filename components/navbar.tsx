"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BrandLogo } from "@/components/brand-logo";

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-emerald-50 text-vivo" : "text-gray-700 hover:bg-gray-100"
      )}
    >
      {children}
    </Link>
  );
};

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        <BrandLogo priority className="shrink-0" imageClassName="h-9 sm:h-10" />

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink href="/">Accueil</NavLink>
          <NavLink href="/simulateur">Simulateur</NavLink>
          <NavLink href="/candidature">Candidature</NavLink>
          <NavLink href="/admin">Dashboard</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/simulateur" className="btn hidden sm:inline-flex">
            Simuler mes revenus
          </Link>
          <Link href="/candidature" className="btn btn-primary">
            Candidater
          </Link>
        </div>
      </div>
    </header>
  );
}

