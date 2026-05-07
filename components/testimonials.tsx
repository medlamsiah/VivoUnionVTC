import Link from "next/link";
import Image from "next/image";

type Testimonial = {
  name: string;
  title: string;
  company: string;
  quote: string;
  image: string;
  accent: string;
};

const items: Testimonial[] = [
  {
    name: "Nourdine Benali",
    title: "Chauffeur VTC premium",
    company: "Paris",
    quote:
      "J’ai complété mon dossier très vite, puis l’équipe VIVO m’a rappelé avec un plan clair. Le parcours inspire confiance du début à la mise en route.",
    image: "/testimonials/nourdine-ai-photo.png",
    accent: "from-[#0e7b74] via-[#12a39d] to-[#7de4db]",
  },
  {
    name: "Sofiane Khellaf",
    title: "Chauffeur partenaire",
    company: "Île-de-France",
    quote:
      "Le simulateur m’a permis de comparer mes semaines réelles avec une projection simple. On voit tout de suite si le modèle correspond à son objectif.",
    image: "/testimonials/sofiane-ai-photo.png",
    accent: "from-[#0d5f7a] via-[#1185aa] to-[#9be3f4]",
  },
  {
    name: "Amine Harrouni",
    title: "Candidat VTC",
    company: "Seine-Saint-Denis",
    quote:
      "L’interface est propre, les étapes sont nettes et je n’ai jamais eu l’impression de remplir un formulaire générique. C’est rapide et professionnel.",
    image: "/testimonials/amine-ai-photo.png",
    accent: "from-[#0b6a61] via-[#109185] to-[#9ff0df]",
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f7fbfa_100%)] p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] sm:p-10">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(32,201,151,0.18)_0%,_rgba(32,201,151,0)_72%)]" />
        <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(15,118,110,0.12)_0%,_rgba(15,118,110,0)_72%)]" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Témoignages
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.6rem] md:leading-[1.05]">
              Des profils VTC présentés avec une image plus premium et plus crédible.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Une section pensée comme une vitrine de confiance : portraits soignés, retours lisibles et tonalité plus
              professionnelle pour rassurer les candidats dès la première visite.
            </p>
          </div>

          <Link
            href="/candidature"
            className="inline-flex items-center justify-center rounded-full bg-[#17b6ad] px-6 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(23,182,173,0.28)] transition hover:translate-y-[-1px] hover:bg-[#12a39b]"
          >
            Candidater maintenant
          </Link>
        </div>

        <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
          {items.map((item, index) => (
            <article
              key={item.name}
              className="group relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(15,23,42,0.1)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />
              <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950">
                <Image
                  src={item.image}
                  alt={`Portrait témoin de ${item.name}`}
                  width={960}
                  height={720}
                  className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  priority={index === 0}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(5,15,24,0.02)_0%,_rgba(5,15,24,0.08)_48%,_rgba(5,15,24,0.48)_100%)]" />
                <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur">
                  Portrait IA
                </div>
              </div>

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[1.35rem] font-semibold tracking-tight text-slate-950">{item.name}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-600">{item.title}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {item.company}
                </div>
              </div>

              <div className="mt-4 rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-3xl leading-none text-[#17b6ad]">“</div>
                <p className="mt-2 text-[15px] leading-7 text-slate-700">{item.quote}</p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${item.accent}`} />
                  Témoignage vérifié
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">VTC / VIVO</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
