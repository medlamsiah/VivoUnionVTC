import Link from "next/link";
import { Simulator } from "@/components/simulator";
import { Accordion, type AccordionItem } from "@/components/accordion";
import { PartnersMarquee } from "@/components/partners-marquee";
import { DriverTestimonial } from "@/components/DriverTestimonial";

const proofItems = [
  "Inscription rapide en quelques clics",
  "Accompagnement administratif dédié",
  "Suivi de revenus clair et centralisé",
];

const faqItems: AccordionItem[] = [
  {
    title: "Comment fonctionne l’accompagnement VIVO ?",
    content:
      "Vous candidatez, nous analysons votre profil, puis on vous guide étape par étape sur l’administratif, la mise en route et le suivi des revenus.",
  },
  {
    title: "Le simulateur est-il gratuit ?",
    content:
      "Oui, le simulateur est gratuit. Il permet d’estimer rapidement votre revenu net selon votre rythme de travail et vos objectifs.",
  },
  {
    title: "En combien de temps je reçois une réponse ?",
    content:
      "En général sous 24h ouvrées. Une fois la candidature envoyée, l’équipe vous contacte avec la prochaine étape claire.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.65), rgba(0,0,0,0.25)), url('/images/hero-vivo-premium.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1200px] items-center px-4 py-12 md:px-6">
          <div className="grid w-full items-center gap-10 lg:grid-cols-2">
            <div className="space-y-6 text-white max-lg:text-center">
              <p className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold tracking-wide text-white/95 backdrop-blur">
                Plateforme VTC nouvelle génération
              </p>

              <h1
                className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
                style={{ textShadow: "0 3px 14px rgba(0,0,0,0.35)" }}
              >
                VIVO simplifie votre quotidien de chauffeur VTC
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg max-lg:mx-auto">
                Augmentez vos revenus, gérez vos courses et développez votre activité avec une plateforme simple et rapide.
              </p>

              <div className="flex flex-wrap gap-3 max-lg:justify-center">
                <Link href="/candidature" className="btn btn-primary px-8 py-3">
                  Démarrer maintenant
                </Link>
                <Link href="/simulateur" className="btn border-white/70 bg-white text-black hover:bg-white/90">
                  Voir le simulateur
                </Link>
              </div>

              <ul className="grid gap-2 text-sm text-white/90 sm:grid-cols-2 lg:grid-cols-1">
                {proofItems.map((item) => (
                  <li key={item} className="flex items-center gap-2 max-lg:justify-center">
                    <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="max-w-xl justify-self-center lg:justify-self-end">
              <div
                className="rounded-[20px] border border-white/25 p-6 text-white"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                }}
              >
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                  Simulation express
                </p>

                <h2 className="text-2xl font-semibold">Estimez votre revenu hebdomadaire</h2>
                <p className="mt-2 text-sm text-white/85">
                  Configurez votre activité en 1 minute et visualisez immédiatement votre potentiel net.
                </p>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-widest text-white/80">Niveau chauffeur</p>
                    <p className="mt-1 text-sm font-semibold">Débutant à confirmé</p>
                  </div>
                  <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-widest text-white/80">Données</p>
                    <p className="mt-1 text-sm font-semibold">Calcul transparent et détaillé</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/simulateur" className="btn btn-primary flex-1">
                    Simuler mes revenus
                  </Link>
                  <Link href="/candidature" className="btn flex-1 bg-white text-black hover:bg-white/90">
                    Candidater
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PartnersMarquee />

      <section className="bg-[#f8fbfa] py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-3xl font-semibold tracking-tight text-gray-900">Simulateur de revenus</h2>
          <Simulator />
        </div>
      </section>

      <DriverTestimonial />

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="card p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">Questions fréquentes</h2>
          <p className="mt-2 text-sm text-gray-600">Les réponses clés avant de démarrer votre candidature.</p>
          <div className="mt-6">
            <Accordion items={faqItems} />
          </div>
        </div>
      </section>
    </>
  );
}
