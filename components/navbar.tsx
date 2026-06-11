"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/simulateur", label: "Simulateur" },
  { href: "/candidature", label: "Candidature" },
  { href: "/admin", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="hidden border-b border-slate-100 bg-slate-50/90 py-2 text-sm text-slate-700 sm:block">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["/avatars/a1.png", "/avatars/a2.png", "/avatars/a3.png"].map((avatar) => (
                <Image
                  key={avatar}
                  src={avatar}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <span className="font-medium">Rejoindre 1&nbsp;500+ chauffeurs</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Image
              src="/avatars/a2.png"
              alt=""
              width={26}
              height={26}
              className="h-6 w-6 rounded-full border-2 border-white object-cover"
            />
            <span>Une question ?</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <BrandLogo priority className="shrink-0 border-0 bg-transparent px-0 shadow-none" imageClassName="h-9 sm:h-10" />

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                pathname === link.href
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/candidature" className="btn btn-primary px-5 py-2.5 text-sm">
            Candidater
          </Link>
          <Link href="/simulateur" className="btn border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-800 hover:bg-emerald-100">
            Simuler mes revenus
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-sm lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <span className="text-lg font-semibold">{open ? "×" : "☰"}</span>
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="grid gap-2 pt-2 sm:hidden">
              <Link href="/candidature" onClick={() => setOpen(false)} className="btn btn-primary w-full">
                Candidater
              </Link>
              <Link href="/simulateur" onClick={() => setOpen(false)} className="btn w-full">
                Simuler mes revenus
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
