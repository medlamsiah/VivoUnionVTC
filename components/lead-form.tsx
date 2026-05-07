"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { AvatarGroup } from "@/components/avatar-group";

const phoneRegex = /^[+\d\s().-]{8,20}$/;

const schema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis"),
  email: z.string().trim().email("Email invalide"),
  phone: z.string().trim().regex(phoneRegex, "Téléphone invalide"),
  city: z.string().trim().min(2, "Ville requise"),
  hasCardVTC: z.enum(["yes", "no"]),
  hasVehicle: z.enum(["yes", "no"]),
  experience: z.enum(["0-1", "1-3", "3+"]),
  platforms: z.array(z.string()).min(1, "Choisissez au moins une plateforme"),
  weeklyHours: z.coerce.number().int().min(1).max(90),
  message: z.string().trim().max(800, "Message trop long").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const platformOptions = ["Uber", "Bolt", "Heetch", "FreeNow", "LeCab", "Autre"];

function Progress({ value }: { value: number }) {
  return (
    <div className="mb-6">
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-vivo transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function ChoiceGrid({
  options,
  onPick,
  value,
  cols = 2,
}: {
  options: { label: string; value: string; hint?: string }[];
  onPick: (v: string) => void;
  value?: string;
  cols?: 1 | 2 | 3;
}) {
  const gridCols = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              active ? "border-vivo bg-vivo/10" : "border-gray-200 hover:border-vivo/60 hover:bg-gray-50",
            ].join(" ")}
          >
            <div className="font-semibold">{opt.label}</div>
            {opt.hint ? <div className="mt-1 text-sm text-gray-600">{opt.hint}</div> : null}
          </button>
        );
      })}
    </div>
  );
}

export function LeadForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState<string | null>(null);

  const [data, setData] = useState<Partial<FormData>>({
    hasCardVTC: undefined,
    hasVehicle: undefined,
    experience: undefined,
    platforms: [],
    weeklyHours: 35,
    fullName: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });

  const steps = useMemo(
    () => [
      { title: "Avez-vous déjà une carte VTC ?", subtitle: "Pas grave si non, on vous accompagne." },
      { title: "Disposez-vous d’un véhicule ?", subtitle: "Location ou véhicule personnel, on s’adapte." },
      { title: "Quelle est votre expérience ?", subtitle: "Pour estimer votre progression." },
      { title: "Vous souhaitez travailler avec…", subtitle: "Choisissez une ou plusieurs plateformes." },
      { title: "Combien d’heures par semaine ?", subtitle: "Estimation pour le simulateur et le matching." },
      { title: "Vos coordonnées", subtitle: "Tous les champs sont requis sauf le commentaire." },
      { title: "Vérification", subtitle: "Un dernier coup d’œil avant l’envoi." },
    ],
    []
  );

  const progress = ((step + 1) / steps.length) * 100;

  function next() {
    setServerMsg(null);
    if (step === 0 && !data.hasCardVTC) return setServerMsg("Choisissez une réponse pour continuer.");
    if (step === 1 && !data.hasVehicle) return setServerMsg("Choisissez une réponse pour continuer.");
    if (step === 2 && !data.experience) return setServerMsg("Choisissez une expérience pour continuer.");
    if (step === 3 && (!data.platforms || data.platforms.length === 0)) return setServerMsg("Sélectionnez au moins une plateforme.");
    if (step === 4 && (!data.weeklyHours || Number(data.weeklyHours) < 1 || Number(data.weeklyHours) > 90)) {
      return setServerMsg("Heures/semaine: entre 1 et 90.");
    }
    if (step === 5) {
      if (!data.fullName || String(data.fullName).trim().length < 2) return setServerMsg("Nom complet requis.");
      if (!data.city || String(data.city).trim().length < 2) return setServerMsg("Ville requise.");
      if (!data.email || !z.string().email().safeParse(String(data.email).trim()).success) return setServerMsg("Email invalide.");
      if (!data.phone || !phoneRegex.test(String(data.phone).trim())) return setServerMsg("Téléphone invalide.");
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function back() {
    setServerMsg(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setServerMsg(null);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      setServerMsg(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...parsed.data,
        hasCardVTC: parsed.data.hasCardVTC === "yes",
        hasVehicle: parsed.data.hasVehicle === "yes",
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Erreur serveur");
      }

      router.push("/");
      router.refresh();
    } catch (e: any) {
      setServerMsg(e?.message || "Erreur inattendue.");
    } finally {
      setSubmitting(false);
    }
  }

  const card = "mx-auto w-full max-w-2xl rounded-3xl border border-white/30 bg-white/85 p-6 shadow-soft backdrop-blur md:p-8";
  const header = (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-3 inline-flex items-center rounded-full bg-vivo/10 px-3 py-1 text-xs font-semibold text-vivo-dark">
        Questionnaire VIVO
      </div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{steps[step].title}</h1>
      <p className="mt-2 text-gray-600">{steps[step].subtitle}</p>
    </div>
  );

  const stepVariants = {
    initial: { opacity: 0, y: 14, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -14, filter: "blur(2px)" },
  };

  return (
    <div className="min-h-[80vh]">
      <div className="gradient-dark">
        <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                <span className="h-2 w-2 rounded-full bg-vivo" />
                Rejoignez les chauffeurs VIVO
              </div>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Candidatez en 1 minute</h1>

              <p className="mt-4 max-w-xl text-white/85">
                Remplissez le questionnaire en quelques étapes. À la fin, vous vérifiez vos réponses puis vous envoyez votre candidature.
              </p>

              <div className="mt-6">
                <AvatarGroup />
              </div>

              <div className="mt-6 grid gap-3 text-sm text-white/85">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">1 question par écran • progression visible</div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">Données sécurisées • réponse rapide</div>
              </div>

              <div className="mt-6 text-xs text-white/70">
                En soumettant vos informations, vous acceptez d’être contacté par l’équipe VIVO.
              </div>
            </div>

            <div className={card}>
              <Progress value={progress} />
              {header}

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {step === 0 ? (
                    <ChoiceGrid
                      value={data.hasCardVTC}
                      onPick={(v) => setData((d) => ({ ...d, hasCardVTC: v as FormData["hasCardVTC"] }))}
                      options={[
                        { label: "Oui", value: "yes", hint: "Je suis déjà opérationnel." },
                        { label: "Non", value: "no", hint: "Je souhaite être accompagné." },
                      ]}
                    />
                  ) : null}

                  {step === 1 ? (
                    <ChoiceGrid
                      value={data.hasVehicle}
                      onPick={(v) => setData((d) => ({ ...d, hasVehicle: v as FormData["hasVehicle"] }))}
                      options={[
                        { label: "Oui", value: "yes", hint: "J’ai un véhicule." },
                        { label: "Non", value: "no", hint: "Je veux une solution (location/partenaires)." },
                      ]}
                    />
                  ) : null}

                  {step === 2 ? (
                    <ChoiceGrid
                      value={data.experience}
                      onPick={(v) => setData((d) => ({ ...d, experience: v as FormData["experience"] }))}
                      cols={3}
                      options={[
                        { label: "0–1 an", value: "0-1", hint: "Je débute / junior." },
                        { label: "1–3 ans", value: "1-3", hint: "J’ai déjà roulé." },
                        { label: "3+ ans", value: "3+", hint: "Je suis expérimenté." },
                      ]}
                    />
                  ) : null}

                  {step === 3 ? (
                    <div className="grid gap-3">
                      <div className="text-sm text-gray-600">Sélection multiple possible.</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {platformOptions.map((p) => {
                          const active = (data.platforms || []).includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() =>
                                setData((d) => {
                                  const current = new Set(d.platforms || []);
                                  current.has(p) ? current.delete(p) : current.add(p);
                                  return { ...d, platforms: Array.from(current) };
                                })
                              }
                              className={[
                                "rounded-2xl border p-4 text-left transition",
                                active ? "border-vivo bg-vivo/10" : "border-gray-200 hover:border-vivo/60 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              <div className="font-semibold">{p}</div>
                              <div className="mt-1 text-sm text-gray-600">{active ? "Sélectionné" : "Cliquer pour sélectionner"}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="grid gap-4">
                      <label className="label">Heures par semaine (1 à 90) *</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={90}
                        value={Number(data.weeklyHours ?? 35)}
                        onChange={(e) => setData((d) => ({ ...d, weeklyHours: Number(e.target.value) }))}
                      />
                      <p className="helper">Astuce : 35h ≈ temps plein.</p>
                    </div>
                  ) : null}

                  {step === 5 ? (
                    <div className="grid gap-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="label">Nom complet *</label>
                          <input className="input" value={data.fullName ?? ""} onChange={(e) => setData((d) => ({ ...d, fullName: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Ville *</label>
                          <input className="input" value={data.city ?? ""} onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))} />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="label">Email *</label>
                          <input className="input" type="email" value={data.email ?? ""} onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Téléphone *</label>
                          <input className="input" value={data.phone ?? ""} onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))} />
                        </div>
                      </div>

                      <div>
                        <label className="label">Commentaire (optionnel)</label>
                        <textarea
                          className="input min-h-[110px]"
                          value={data.message ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, message: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : null}

                  {step === 6 ? (
                    <div className="grid gap-3 text-sm">
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div><span className="text-gray-500">Carte VTC:</span> <span className="font-semibold">{data.hasCardVTC === "yes" ? "Oui" : "Non"}</span></div>
                          <div><span className="text-gray-500">Véhicule:</span> <span className="font-semibold">{data.hasVehicle === "yes" ? "Oui" : "Non"}</span></div>
                          <div><span className="text-gray-500">Expérience:</span> <span className="font-semibold">{data.experience}</span></div>
                          <div><span className="text-gray-500">Heures/sem:</span> <span className="font-semibold">{data.weeklyHours}</span></div>
                          <div className="md:col-span-2"><span className="text-gray-500">Plateformes:</span> <span className="font-semibold">{(data.platforms || []).join(", ")}</span></div>
                          <div className="md:col-span-2"><span className="text-gray-500">Nom:</span> <span className="font-semibold">{data.fullName}</span></div>
                          <div><span className="text-gray-500">Ville:</span> <span className="font-semibold">{data.city}</span></div>
                          <div><span className="text-gray-500">Contact:</span> <span className="font-semibold">{data.email} / {data.phone}</span></div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {serverMsg ? <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 text-sm">{serverMsg}</div> : null}

              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <button type="button" onClick={back} disabled={step === 0 || submitting} className="btn">
                  Retour
                </button>

                {step < steps.length - 1 ? (
                  <button type="button" onClick={next} disabled={submitting} className="btn btn-primary">
                    Continuer →
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary">
                    {submitting ? "Envoi..." : "Envoyer ma candidature"}
                  </button>
                )}
              </div>

              <div className="mt-6 text-center text-xs text-gray-500">
                En continuant, vous acceptez d’être contacté par l’équipe VIVO.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
