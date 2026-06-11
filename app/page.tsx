import Image from "next/image";
import Link from "next/link";
import { Accordion, type AccordionItem } from "@/components/accordion";

const manifestoItems: AccordionItem[] = [
  {
    title: "Un secteur en plein déséquilibre",
    content:
      "Les plateformes évoluent vite, les prix changent et les chauffeurs doivent prendre de bonnes décisions avec peu de visibilité.",
  },
  {
    title: "Des conditions de travail exigeantes",
    content:
      "Entre les horaires, les charges, la fatigue et l'administratif, il devient essentiel de mieux piloter son activité.",
  },
  {
    title: "+45h sur la route / semaine",
    content:
      "VIVO Union aide les chauffeurs à transformer leur temps de travail en données claires, utiles et exploitables.",
  },
];

const solutionCards = [
  {
    title: "Revenus centralisés",
    text: "Une vision lisible de vos revenus pour mieux comprendre vos semaines et vos mois.",
  },
  {
    title: "Suivi en temps réel",
    text: "Des indicateurs simples pour suivre l'activité et garder le contrôle.",
  },
  {
    title: "Simulation claire",
    text: "Des estimations rapides pour anticiper vos objectifs de revenus.",
  },
  {
    title: "Accompagnement personnalisé",
    text: "Une équipe qui comprend le terrain et accompagne les chauffeurs dans la durée.",
  },
];

const appFeatures = [
  {
    title: "Suivez votre activité en temps réel",
    text: "Chiffre d'affaires, heures d'activité, rentabilité, pourboires et objectifs sont regroupés dans un tableau de bord clair.",
  },
  {
    title: "Centralisez Uber, Bolt, Heetch et vos plateformes",
    text: "Gardez une vision unique de vos revenus, même quand vos courses viennent de plusieurs applications VTC.",
  },
  {
    title: "Anticipez vos versements",
    text: "Consultez vos prochaines rémunérations, vos acomptes disponibles et l'historique de vos paiements.",
  },
  {
    title: "Déclarez vos frais en quelques minutes",
    text: "Ajoutez vos frais professionnels, documents ou justificatifs directement depuis votre espace chauffeur.",
  },
];

const testimonials = [
  {
    name: "Mohamed",
    meta: "Chauffeur VTC | 8 mois",
    image: "/testimonials/amine-ai-photo.png",
  },
  {
    name: "Yassine",
    meta: "Chauffeur VTC | 1 an",
    image: "/testimonials/sofiane-ai-photo.png",
  },
  {
    name: "Noureddine",
    meta: "Chauffeur VTC | 6 mois",
    image: "/testimonials/nourdine-ai-photo.png",
  },
];

const steps = [
  {
    label: "Étape 1",
    title: "Simulation",
    text: "Estimez rapidement votre potentiel de revenus.",
  },
  {
    label: "Étape 2",
    title: "Candidature",
    text: "Partagez votre profil en quelques minutes.",
  },
  {
    label: "Étape 3",
    title: "Suivi des revenus",
    text: "Pilotez votre activité avec plus de clarté.",
  },
];

const vtcPlatforms = [
  { name: "Heetch", className: "bg-rose-500 text-white" },
  { name: "FreeNow", className: "bg-red-600 text-white" },
  { name: "Uber", className: "z-10 scale-110 bg-slate-950 text-white ring-2 ring-white" },
  { name: "Allocab", className: "bg-orange-500 text-white" },
  { name: "Bolt", className: "bg-emerald-500 text-white" },
];

const showcasePlatformLogos = [
  { name: "Uber", label: "Uber", className: "bg-white text-slate-950", textClassName: "font-black tracking-tight" },
  { name: "Bolt", label: "Bolt", className: "bg-[#35d072] text-[#063b24]", textClassName: "font-black" },
  { name: "Heetch", label: "HEETCH", className: "bg-[#ff2e83] text-white", textClassName: "text-sm font-black tracking-[0.14em]" },
  { name: "FreeNow", label: "FREE NOW", className: "bg-white text-[#123c8c]", textClassName: "text-sm font-black tracking-[0.08em]" },
  { name: "LeCab", label: "LeCab", className: "bg-[#102a56] text-white", textClassName: "font-black" },
  { name: "VIVO", label: "VIVO", className: "bg-emerald-50 text-emerald-700", textClassName: "font-black tracking-tight" },
];

const independentCosts = [
  ["Net en poche", "2 690€ / mois"],
  ["TVA collectée", "-400€"],
  ["Cotisations URSSAF", "-792€"],
  ["Impôts", "-68€"],
  ["CFE", "-50€"],
];

const vivoCosts = [
  ["Net en poche", "+363€ 3 053€ / mois"],
  ["TVA à payer", "-160€"],
  ["Frais de service", "-499€"],
  ["Cotisations sociales", "-260€"],
  ["Prélèvement à la source", "-28€"],
];

export default function HomePage() {
  return (
    <div className="bg-[#f7fbfa] text-slate-950">
      <section className="relative min-h-[calc(100vh-105px)] overflow-hidden bg-[#041716] text-white">
        <Image
          src="/images/chauffeur-vtc.jpg"
          alt="Chauffeur VTC VIVO Union au volant"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#041716]/95 via-[#041716]/76 to-[#041716]/22" />
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative mx-auto flex min-h-[calc(100vh-105px)] max-w-7xl flex-col justify-between px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Chauffeur VTC accompagné
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-[4.6rem]">
              VIVO Union simplifie le quotidien des chauffeurs VTC
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/84 sm:text-xl">
              Centralisez vos revenus, suivez vos performances et développez votre activité avec une plateforme simple, transparente et pensée pour les chauffeurs.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/88">
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-300">✓</span>
                Suivi des revenus
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-300">✓</span>
                Accompagnement chauffeur
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/candidature" className="btn btn-primary px-7 py-4">
                Candidater maintenant
              </Link>
              <Link href="/simulateur" className="btn border-white/80 bg-white px-7 py-4 text-emerald-800 hover:bg-emerald-50">
                Simuler mes revenus
              </Link>
            </div>
          </div>

          <div className="mt-10 pb-8 lg:pb-0">
            <p className="text-sm font-semibold text-white/88">10+ plateformes VTC partenaires</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-2xl font-semibold tracking-tight text-white">
              <span>Uber</span>
              <span>HEETCH</span>
              <span>Bolt</span>
              <span className="text-xl">FREENOW</span>
              <span>allocab</span>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 right-0 hidden h-36 w-[420px] bg-white text-slate-950 shadow-[0_-18px_60px_rgba(4,23,22,0.12)] lg:block"
          style={{ clipPath: "polygon(28% 0, 100% 0, 100% 100%, 0 100%)" }}
        >
          <div className="ml-36 mt-8">
            <div className="text-5xl font-semibold tracking-tight text-emerald-600">1 500+</div>
            <div className="mt-1 text-sm font-medium text-slate-700">Chauffeurs VIVO Union</div>
          </div>
        </div>

        <div className="relative mx-4 -mt-20 mb-8 rounded-[28px] bg-white p-6 text-slate-950 shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:mx-6 lg:hidden">
          <div className="text-4xl font-semibold tracking-tight text-emerald-600">1 500+</div>
          <div className="mt-1 text-sm font-medium text-slate-700">Chauffeurs VIVO Union</div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Manifeste</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Chauffeur VTC n'est pas un métier facile
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Temps de travail élevé, revenus variables, manque de visibilité... VIVO Union aide les chauffeurs à mieux piloter leur activité.
          </p>
        </div>
        <Accordion items={manifestoItems} />
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Solution</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Une plateforme pensée pour les chauffeurs
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {solutionCards.map((card, index) => (
              <article key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(15,23,42,0.09)]">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f766e] text-white shadow-[0_14px_30px_rgba(15,118,110,0.22)]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                    {index === 0 ? (
                      <path fill="currentColor" d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2h-2V7a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1h13a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H6a4 4 0 0 1-4-4V8h2v7a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H4V7Zm12 5h3v3h-3v-3Z" />
                    ) : index === 1 ? (
                      <path fill="currentColor" d="M4 19V5h2v10.6l3.7-3.7 3 3L19.6 8 21 9.4 12.7 17.7l-3-3L5.4 19H4Zm14-14h3v3h-2V7.4l-5.3 5.3-3-3L7.4 13 6 11.6l4.7-4.7 3 3L17.6 6H18V5Z" />
                    ) : index === 2 ? (
                      <path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v4h10V5H7Zm2 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 9 12Zm4 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 13 12Zm4 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 17 12Zm-8 4a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 9 16Zm4 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 13 16Zm4 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 17 16Z" />
                    ) : (
                      <path fill="currentColor" d="M8.5 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7 1a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7ZM2 20.5C2 16.9 4.7 14 8.5 14c1.5 0 2.8.4 3.9 1.2A7.5 7.5 0 0 0 11 20.5V21H2v-.5Zm11 0c0-3 2-5.5 4.8-5.5 2.1 0 3.7 1.1 4.2 2.8l-1.8.7c-.3-.9-1.2-1.5-2.4-1.5-1.7 0-2.8 1.5-2.8 3.5v.5h-2v-.5Z" />
                    )}
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-950">{card.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="application-chauffeur" className="overflow-hidden bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Application chauffeur</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-[#07133d] sm:text-5xl">
              Gérez votre activité VTC
              <span className="block text-emerald-600">du bout des doigts</span>
            </h2>
          </div>

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              {appFeatures.map((feature, index) => (
                <article
                  key={feature.title}
                  className={`group flex gap-4 rounded-[24px] border p-5 transition hover:-translate-y-1 ${
                    index === 0
                      ? "border-emerald-100 bg-[#f4fbf8] shadow-[0_20px_70px_rgba(15,23,42,0.08)]"
                      : "border-transparent bg-white hover:border-emerald-100 hover:bg-emerald-50/40"
                  }`}
                >
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      {index === 0 ? (
                        <path fill="currentColor" d="M6 3h9a3 3 0 0 1 3 3v2h-2V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5v2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2 5h6v2H8V8Zm0 4h4v2H8v-2Zm9 0a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-.75 1h1.5v2.15l1.55.9-.75 1.3-2.3-1.35V15Z" />
                      ) : index === 1 ? (
                        <path fill="currentColor" d="M5 5h14v4H5V5Zm0 6h6v8H5v-8Zm8 0h6v8h-6v-8Z" />
                      ) : index === 2 ? (
                        <path fill="currentColor" d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1v1h12V7a1 1 0 0 0-1-1H7Zm11 6H6v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5Zm-9 2h5v2H9v-2Z" />
                      ) : (
                        <path fill="currentColor" d="M7 3h8l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm7 2v4h4l-4-4ZM7 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10V11h-5V5H7Zm1 9h7v2H8v-2Zm0-3h4v2H8v-2Z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#07133d]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{feature.text}</p>
                  </div>
                </article>
              ))}

              <div className="pt-4">
                <Link href="/simulateur" className="btn btn-primary px-7">
                  Découvrir le simulateur
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[420px] lg:max-w-[440px]">
              <div className="absolute inset-x-10 bottom-4 h-24 rounded-full bg-emerald-300/18 blur-3xl" />
              <div className="relative mx-auto flex justify-center rounded-[40px] bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-[0_28px_90px_rgba(7,19,61,0.10)] sm:p-5">
                <div className="pointer-events-none absolute left-[24%] top-[14%] z-10 rounded-xl bg-white/95 px-2.5 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
                  <Image
                    src="/brand/vivo-union-logo.jpeg"
                    alt="VIVO union"
                    width={1919}
                    height={533}
                    className="h-5 w-auto object-contain sm:h-6"
                  />
                </div>
                <Image
                  src="/images/vivo-mobile-app-dashboard.png"
                  alt="Application mobile VIVO Union pour suivre les revenus chauffeur"
                  width={820}
                  height={1735}
                  className="relative h-auto max-h-[640px] w-auto max-w-full object-contain drop-shadow-[0_28px_70px_rgba(7,19,61,0.24)] lg:max-h-[690px]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modele-vivo" className="relative overflow-hidden bg-[#06164d] py-24 text-white sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(20,184,166,0.22),transparent_34%),radial-gradient(circle_at_82%_74%,rgba(34,197,94,0.18),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,18,54,0.96),rgba(6,22,77,0.9)_48%,rgba(3,93,95,0.82))]" />

        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center">
            <span className="block h-5 w-10 -skew-x-12 bg-white" />
          </div>
          <h2 className="mx-auto mt-8 max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Le modèle VIVO Union
            <span className="block">On avance quand vous gagnez&nbsp;!</span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/82 sm:text-lg">
            Aucun frais fixe inutile. VIVO Union vous aide à mieux lire vos revenus, à centraliser vos plateformes et à piloter votre activité avec plus de sérénité.
          </p>

          <div className="mt-12 flex justify-center">
            <div className="flex items-center -space-x-3">
              {vtcPlatforms.map((platform) => (
                <span
                  key={platform.name}
                  className={`inline-flex h-14 min-w-16 items-center justify-center rounded-2xl border-2 border-white px-3 text-sm font-black shadow-[0_14px_35px_rgba(0,0,0,0.22)] ${platform.className}`}
                >
                  {platform.name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <div className="font-serif text-6xl font-semibold leading-none tracking-tight sm:text-7xl">4000€</div>
            <p className="mt-2 text-xl font-semibold text-white/90">de chiffre d'affaires</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-10 lg:grid-cols-2 lg:gap-8">
            <div className="hidden justify-center lg:flex">
              <span className="text-8xl font-light leading-none text-white/48">↘</span>
            </div>
            <div className="hidden justify-center lg:flex">
              <span className="text-8xl font-light leading-none text-white/48">↙</span>
            </div>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 text-left lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[28px] border-4 border-white/20 bg-white p-8 text-[#07133d] shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
              <h3 className="font-serif text-2xl font-semibold">Chauffeur indépendant</h3>
              <div className="mt-7 space-y-4">
                {independentCosts.map(([label, value], index) => (
                  <div key={label} className={`flex items-center justify-between gap-4 text-sm ${index === 0 ? "border-b border-slate-200 pb-4 text-base font-semibold" : ""}`}>
                    <span>{label}</span>
                    <span className={index === 0 ? "font-semibold" : "text-slate-700"}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 border-t border-slate-200 pt-5">
                <h4 className="font-semibold">Et pour ne rien arranger</h4>
                <div className="mt-4 space-y-3 text-sm">
                  {["Assurance chômage", "Cotisation retraite"].map((item) => (
                    <div key={item} className="flex items-center justify-between gap-4">
                      <span>{item}</span>
                      <span className="inline-flex items-center gap-2 text-slate-500">Non <span className="grid h-5 w-5 place-items-center rounded-full bg-red-50 text-red-500">×</span></span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4">
                    <span>Gestion administrative</span>
                    <span className="inline-flex items-center gap-2 text-slate-500">Oui <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600">✓</span></span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-3 w-full bg-[linear-gradient(135deg,transparent_25%,#06164d_25%,#06164d_50%,transparent_50%,transparent_75%,#06164d_75%)] bg-[length:24px_24px]" />
            </article>

            <article className="relative overflow-hidden rounded-[28px] border-4 border-emerald-300/50 bg-white p-8 text-[#07133d] shadow-[0_28px_90px_rgba(16,185,129,0.24)]">
              <h3 className="font-serif text-2xl font-semibold">Chauffeur VIVO Union accompagné</h3>
              <div className="mt-7 space-y-4">
                {vivoCosts.map(([label, value], index) => (
                  <div key={label} className={`flex items-center justify-between gap-4 text-sm ${index === 0 ? "border-b border-slate-200 pb-4 text-base font-semibold" : ""}`}>
                    <span>{label}</span>
                    <span className={index === 0 ? "font-semibold text-emerald-700" : "text-slate-700"}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 border-t border-slate-200 pt-5">
                <h4 className="font-semibold">Et en bonus avec VIVO</h4>
                <div className="mt-4 space-y-3 text-sm">
                  {["Assurance chômage", "Cotisation pour la retraite", "Suivi des revenus"].map((item) => (
                    <div key={item} className="flex items-center justify-between gap-4">
                      <span>{item}</span>
                      <span className="inline-flex items-center gap-2 text-slate-500">Inclus <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600">✓</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-3 w-full bg-[linear-gradient(135deg,transparent_25%,#06164d_25%,#06164d_50%,transparent_50%,transparent_75%,#06164d_75%)] bg-[length:24px_24px]" />
            </article>
          </div>

          <Link href="/simulateur" className="btn btn-primary mt-12 px-7 py-4">
            Simuler vos revenus
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Témoignages</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Ils avancent avec VIVO Union
            </h2>
          </div>
          <Link href="/candidature" className="btn btn-primary md:self-center">
            Candidater maintenant
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="group overflow-hidden rounded-3xl bg-slate-950 shadow-[0_22px_70px_rgba(15,23,42,0.12)]">
              <div className="relative aspect-[4/5]">
                <Image src={item.image} alt={item.name} fill className="object-cover opacity-85 transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-xl font-semibold text-slate-950 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                    ▶
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-2xl font-semibold">{item.name}</h3>
                  <p className="mt-1 text-sm text-white/80">{item.meta}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="plateformes-vtc" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            <article className="group relative min-h-[520px] overflow-hidden rounded-[32px] bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
              <Image
                src="/images/vivo-tesla-vtc-card.png"
                alt="Tesla VTC accompagnée par VIVO Union"
                fill
                className="object-cover opacity-85 transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight">
                  Pas de véhicule ? VIVO Union vous aide à avancer
                </h2>
                <p className="mt-5 max-w-sm text-base leading-7 text-white/78">
                  Nous vous orientons vers des solutions adaptées pour louer, démarrer ou structurer votre activité.
                </p>
              </div>
            </article>

            <article className="relative min-h-[520px] overflow-hidden rounded-[32px] bg-[#0f766e] p-7 text-white shadow-[0_24px_80px_rgba(15,118,110,0.22)]">
              <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-[#22c55e]/30 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-56 w-48 skew-x-[-12deg] bg-[#061a18]/20" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight">
                    Travaillez avec vos plateformes VTC, sans complexité
                  </h2>
                  <p className="mt-6 max-w-sm text-base leading-7 text-white/82">
                    VIVO Union vous aide à centraliser votre activité et à garder une lecture claire de vos revenus.
                  </p>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-4">
                  {showcasePlatformLogos.map((platform) => (
                    <div
                      key={platform.name}
                      className="flex h-[72px] items-center justify-center rounded-2xl border border-white/18 bg-white/12 px-4 backdrop-blur transition hover:-translate-y-1 hover:bg-white/18"
                    >
                      <span
                        className={`inline-flex min-h-10 min-w-28 items-center justify-center rounded-xl px-4 py-2 text-center shadow-[0_12px_28px_rgba(0,0,0,0.16)] ${platform.className} ${platform.textClassName}`}
                      >
                        {platform.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="group relative min-h-[520px] overflow-hidden rounded-[32px] bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
              <Image
                src="/images/vivo-driver-revenue-card.png"
                alt="Chauffeur VTC consultant ses performances"
                fill
                className="object-cover opacity-85 transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight">
                  Suivez vos revenus et vos performances avec clarté
                </h2>
                <p className="mt-5 max-w-sm text-base leading-7 text-white/78">
                  Depuis votre espace, vous gardez une vision simple de votre activité, semaine après semaine.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#061a18] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Parcours</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Rejoindre VIVO Union en 3 étapes
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
                <div className="text-sm font-semibold text-emerald-300">{step.label}</div>
                <h3 className="mt-4 text-2xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-7 text-white/70">{step.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/candidature" className="btn btn-primary">
              Candidater maintenant
            </Link>
            <Link href="/simulateur" className="btn border-white/15 bg-white/10 text-white hover:bg-white/15">
              Simuler mes revenus
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
