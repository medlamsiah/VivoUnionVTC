import { Simulator } from "@/components/simulator";
import { SectionTitle } from "@/components/ui";

export default function SimulateurPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <SectionTitle
        title="Simulateur de revenus"
        subtitle="Entrez votre chiffre d'affaires (CA) mensuel. Le simulateur applique la règle : CA * 85% puis une déduction selon la tranche."
      />
      <Simulator />
      <div className="mt-8 text-sm text-gray-500">
        Note : la logique de calcul est configurable dans <code className="rounded bg-gray-100 px-2 py-1">lib/calc.ts</code>.
      </div>
    </section>
  );
}
