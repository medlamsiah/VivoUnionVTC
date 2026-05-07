import Link from "next/link";

export function DriverTestimonial() {
  return (
    <section className="bg-[linear-gradient(180deg,#f3fbf6_0%,#ffffff_100%)] py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-10">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Témoignage chauffeur
          </span>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Ils font confiance à VIVOUnion
          </h2>

          <p className="text-base leading-7 text-slate-700">
            Une plateforme pensée exclusivement pour les chauffeurs VTC en France.
          </p>

          <p className="text-base leading-7 text-slate-600">
            Découvrez comment VIVOUnion aide les chauffeurs à gagner du temps, optimiser leurs revenus et travailler plus sereinement.
          </p>

          <blockquote className="rounded-2xl border border-emerald-100 bg-white p-5 text-[15px] leading-7 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            “Avec VIVOUnion, je travaille plus sereinement. La plateforme est simple, fiable et m’apporte des courses régulières.”
          </blockquote>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/candidature"
              className="inline-flex items-center justify-center rounded-full bg-[#16a34a] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(22,163,74,0.28)] transition hover:scale-[1.02] hover:bg-[#15803d]"
            >
              Rejoindre VIVOUnion
            </Link>
            <Link
              href="/simulateur"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              En savoir plus
            </Link>
          </div>
        </div>

        <div className="group ml-auto w-full max-w-[390px] rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_16px_45px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)]">
          <div className="h-[690px] overflow-hidden rounded-xl max-md:h-[560px]">
            <video
              className="h-full w-full rounded-xl bg-black object-cover object-center"
              controls
              preload="metadata"
              playsInline
            >
              <source src="/videos/vivo-driver.mp4" type="video/mp4" />
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
