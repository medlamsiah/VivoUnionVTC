"use client";

import { useMemo, useState } from "react";
import { computeNetRevenue, formatMoney } from "@/lib/calc";

export function Simulator() {
  const [ca, setCa] = useState<string>("3500");

  const result = useMemo(() => computeNetRevenue(Number(ca.replace(",", "."))), [ca]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card p-6">
        <div className="label">Chiffre d'affaires mensuel (CA)</div>
        <input
          className="input mt-2"
          inputMode="decimal"
          value={ca}
          onChange={(e) => setCa(e.target.value)}
          placeholder="Ex: 3500"
        />
        <div className="helper mt-2">Astuce : vous pouvez mettre 3500, 3500.50, 3 500…</div>

        <div className="mt-6 rounded-2xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Règle 1</div>
          <div className="mt-1 font-semibold">CA / 100 * 85</div>
          <div className="mt-2 text-sm text-gray-600">
            Base après 85% : <b>{formatMoney(result.base85)}</b>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Règle 2</div>
          <div className="mt-1 font-semibold">Déduction par tranche</div>
          <div className="mt-2 text-sm text-gray-600">
            Taux appliqué : <b>{Math.round(result.deductionRate * 100)}%</b>
          </div>
          <ul className="mt-3 list-disc pl-5 text-sm text-gray-600">
            <li>&gt; 4000 → 12%</li>
            <li>2000 à 4000 → 14%</li>
            <li>0 à 2000 → 16%</li>
          </ul>
        </div>
      </div>

      <div className="card p-6">
        <div className="text-sm text-gray-500">Résultat estimé</div>
        <div className="mt-2 text-5xl font-semibold tracking-tight">{formatMoney(result.net)}</div>
        <div className="mt-2 text-sm text-gray-600">
          (Base {formatMoney(result.base85)} - {Math.round(result.deductionRate * 100)}%)
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 p-5">
          <div className="text-sm font-semibold">Enregistrer une simulation</div>
          <p className="mt-1 text-sm text-gray-600">
            Optionnel : vous pouvez sauvegarder les simulations (utile côté dashboard).
          </p>
          <SaveSimButton ca={result.ca} net={result.net} />
        </div>

        <div className="mt-6 text-sm text-gray-500">
          Attention : ceci est une estimation. Vos coûts (carburant, location, etc.) ne sont pas inclus.
        </div>
      </div>
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
    <button className="btn mt-4 w-full" onClick={save} disabled={state === "loading"}>
      {state === "idle" && "Sauvegarder"}
      {state === "loading" && "Enregistrement..."}
      {state === "ok" && "OK ✅"}
      {state === "err" && "Erreur ❌"}
    </button>
  );
}
