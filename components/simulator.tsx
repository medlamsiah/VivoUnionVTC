"use client";

import { useMemo, useState } from "react";
import { computeNetRevenue, formatMoney } from "@/lib/calc";

export function Simulator() {
  const [ca, setCa] = useState<string>("3500");
  const result = useMemo(() => computeNetRevenue(Number(ca.replace(",", "."))), [ca]);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.05)]">
        <label className="label">Chiffre d'affaires mensuel</label>
        <input
          className="input mt-3 text-lg"
          inputMode="decimal"
          value={ca}
          onChange={(event) => setCa(event.target.value)}
          placeholder="Ex : 3500"
        />
        <p className="helper mt-3">Vous pouvez saisir 3500, 3500.50 ou 3 500.</p>

        <div className="mt-6 grid gap-4">
          <RuleCard
            label="Règle 1"
            title="Base de calcul à 85%"
            text={`Base après 85% : ${formatMoney(result.base85)}`}
          />
          <RuleCard
            label="Règle 2"
            title="Déduction par tranche"
            text={`Taux appliqué : ${Math.round(result.deductionRate * 100)}%`}
          />
        </div>
      </div>

      <div className="rounded-3xl bg-[#061a18] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Résultat estimé</div>
        <div className="mt-4 text-6xl font-semibold tracking-tight">{formatMoney(result.net)}</div>
        <p className="mt-4 max-w-md text-sm leading-7 text-white/70">
          Estimation basée sur {formatMoney(result.base85)} avec une déduction de {Math.round(result.deductionRate * 100)}%.
        </p>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <div className="text-sm font-semibold">Barème appliqué</div>
          <div className="grid gap-2 text-sm text-white/75">
            <span>Plus de 4 000 € : 12%</span>
            <span>De 2 000 € à 4 000 € : 14%</span>
            <span>De 0 € à 2 000 € : 16%</span>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <div className="text-sm font-semibold">Enregistrer une simulation</div>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Optionnel : gardez une trace de cette estimation pour votre suivi.
          </p>
          <SaveSimButton ca={result.ca} net={result.net} />
        </div>

        <p className="mt-6 text-sm leading-6 text-white/60">
          Cette simulation reste indicative. Les frais réels comme carburant, location ou assurance ne sont pas inclus.
        </p>
      </div>
    </div>
  );
}

function RuleCard({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{text}</div>
    </div>
  );
}

function SaveSimButton({ ca, net }: { ca: number; net: number }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");

  async function save() {
    setState("loading");
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ca, net }),
      });
      if (!res.ok) throw new Error("bad status");
      setState("ok");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <button className="btn mt-4 w-full border-white/10 bg-white text-slate-950 hover:bg-white/90" onClick={save} disabled={state === "loading"}>
      {state === "idle" && "Sauvegarder"}
      {state === "loading" && "Enregistrement..."}
      {state === "ok" && "Simulation enregistrée"}
      {state === "err" && "Erreur d'enregistrement"}
    </button>
  );
}
