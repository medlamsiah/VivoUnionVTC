const partners = [
  { name: "Uber", className: "text-[#111827]" },
  { name: "Bolt", className: "text-[#22c55e]" },
  { name: "Heetch", className: "text-[#ff2f8b]" },
];

export function PartnersMarquee() {
  const loop = [...partners, ...partners, ...partners];

  return (
    <section className="relative overflow-hidden border-y border-[#d8ece6] bg-[#f4fbf8] py-8">
      <div className="mx-auto mb-5 flex max-w-6xl items-center justify-between px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0f766e]">
          Plateformes partenaires
        </p>
        <span className="rounded-full border border-[#bfe5dc] bg-white px-3 py-1 text-xs font-medium text-[#0f172a]">
          Sync compatible
        </span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#f4fbf8] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#f4fbf8] to-transparent" />

        <div
          className="vivo-partners-track flex w-max items-center gap-4 px-4"
        >
          {loop.map((partner, index) => (
            <div
              key={`${partner.name}-${index}`}
              className="min-w-[190px] rounded-2xl border border-[#d7e9e3] bg-white px-6 py-4 text-center shadow-[0_6px_24px_rgba(2,12,27,0.06)]"
            >
              <span className={`text-3xl font-bold tracking-tight ${partner.className}`}>{partner.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
