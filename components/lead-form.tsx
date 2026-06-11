"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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

const steps = [
  { title: "Avez-vous déjà une carte VTC ?", subtitle: "Pas de souci si ce n'est pas encore le cas, on vous accompagne." },
  { title: "Disposez-vous d'un véhicule ?", subtitle: "Véhicule personnel ou solution de location, indiquez votre situation." },
  { title: "Quelle est votre expérience ?", subtitle: "Cela nous aide à mieux comprendre votre profil." },
  { title: "Avec quelles plateformes souhaitez-vous travailler ?", subtitle: "Sélectionnez une ou plusieurs plateformes." },
  { title: "Combien d'heures par semaine ?", subtitle: "Une estimation simple pour mieux préparer votre accompagnement." },
  { title: "Vos coordonnées", subtitle: "Tous les champs sont requis sauf le commentaire." },
  { title: "Vérification", subtitle: "Relisez vos informations avant l'envoi." },
];

export function LeadForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [data, setData] = useState<Partial<FormData>>({
    platforms: [],
    weeklyHours: 35,
    fullName: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  function next() {
    setServerMsg(null);
    if (step === 0 && !data.hasCardVTC) return setServerMsg("Choisissez une réponse pour continuer.");
    if (step === 1 && !data.hasVehicle) return setServerMsg("Choisissez une réponse pour continuer.");
    if (step === 2 && !data.experience) return setServerMsg("Choisissez une expérience pour continuer.");
    if (step === 3 && (!data.platforms || data.platforms.length === 0)) return setServerMsg("Sélectionnez au moins une plateforme.");
    if (step === 4 && (!data.weeklyHours || Number(data.weeklyHours) < 1 || Number(data.weeklyHours) > 90)) {
      return setServerMsg("Le volume horaire doit être compris entre 1 et 90 heures.");
    }
    if (step === 5) {
      if (!data.fullName || String(data.fullName).trim().length < 2) return setServerMsg("Nom complet requis.");
      if (!data.city || String(data.city).trim().length < 2) return setServerMsg("Ville requise.");
      if (!data.email || !z.string().email().safeParse(String(data.email).trim()).success) return setServerMsg("Email invalide.");
      if (!data.phone || !phoneRegex.test(String(data.phone).trim())) return setServerMsg("Téléphone invalide.");
    }
    setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  function back() {
    setServerMsg(null);
    setStep((value) => Math.max(0, value - 1));
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

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Impossible d'envoyer la candidature pour le moment.");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setServerMsg(error instanceof Error ? error.message : "Erreur inattendue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#f7fbfa]">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Candidature</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
            Candidatez auprès de VIVO Union
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Quelques questions suffisent pour comprendre votre profil, vos objectifs et la meilleure façon de vous accompagner.
          </p>
          <div className="mt-8">
            <AvatarGroup />
          </div>
          <div className="mt-8 grid gap-3 text-sm text-slate-700">
            <InfoPill text="Une question par écran" />
            <InfoPill text="Progression visible" />
            <InfoPill text="Réponse claire et accompagnement humain" />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="mb-7 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="mb-7">
            <div className="text-sm font-semibold text-emerald-700">Étape {step + 1} sur {steps.length}</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{steps[step].title}</h2>
            <p className="mt-2 leading-7 text-slate-600">{steps[step].subtitle}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep(step, data, setData)}
            </motion.div>
          </AnimatePresence>

          {serverMsg ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {serverMsg}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={back} disabled={step === 0 || submitting} className="btn disabled:cursor-not-allowed disabled:opacity-50">
              Retour
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={next} disabled={submitting} className="btn btn-primary">
                Continuer
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary">
                {submitting ? "Envoi..." : "Envoyer ma candidature"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function renderStep(
  step: number,
  data: Partial<FormData>,
  setData: Dispatch<SetStateAction<Partial<FormData>>>,
) {
  if (step === 0) {
    return (
      <ChoiceGrid
        value={data.hasCardVTC}
        onPick={(value) => setData((current) => ({ ...current, hasCardVTC: value as FormData["hasCardVTC"] }))}
        options={[
          { label: "Oui", value: "yes", hint: "Je suis déjà opérationnel." },
          { label: "Non", value: "no", hint: "Je souhaite être accompagné." },
        ]}
      />
    );
  }

  if (step === 1) {
    return (
      <ChoiceGrid
        value={data.hasVehicle}
        onPick={(value) => setData((current) => ({ ...current, hasVehicle: value as FormData["hasVehicle"] }))}
        options={[
          { label: "Oui", value: "yes", hint: "J'ai un véhicule." },
          { label: "Non", value: "no", hint: "Je cherche une solution." },
        ]}
      />
    );
  }

  if (step === 2) {
    return (
      <ChoiceGrid
        value={data.experience}
        onPick={(value) => setData((current) => ({ ...current, experience: value as FormData["experience"] }))}
        cols={3}
        options={[
          { label: "0 à 1 an", value: "0-1", hint: "Je débute." },
          { label: "1 à 3 ans", value: "1-3", hint: "J'ai déjà roulé." },
          { label: "3 ans et plus", value: "3+", hint: "Je suis expérimenté." },
        ]}
      />
    );
  }

  if (step === 3) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {platformOptions.map((platform) => {
          const active = (data.platforms || []).includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() =>
                setData((current) => {
                  const platforms = new Set(current.platforms || []);
                  platforms.has(platform) ? platforms.delete(platform) : platforms.add(platform);
                  return { ...current, platforms: Array.from(platforms) };
                })
              }
              className={choiceClass(active)}
            >
              <span className="font-semibold">{platform}</span>
              <span className="mt-1 block text-sm text-slate-500">{active ? "Sélectionné" : "Cliquer pour sélectionner"}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (step === 4) {
    return (
      <div>
        <label className="label">Heures par semaine</label>
        <input
          className="input mt-3"
          type="number"
          min={1}
          max={90}
          value={Number(data.weeklyHours ?? 35)}
          onChange={(event) => setData((current) => ({ ...current, weeklyHours: Number(event.target.value) }))}
        />
        <p className="helper mt-3">Exemple : 35h correspond à une activité à temps plein.</p>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nom complet" value={data.fullName ?? ""} onChange={(value) => setData((current) => ({ ...current, fullName: value }))} />
          <TextField label="Ville" value={data.city ?? ""} onChange={(value) => setData((current) => ({ ...current, city: value }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" type="email" value={data.email ?? ""} onChange={(value) => setData((current) => ({ ...current, email: value }))} />
          <TextField label="Téléphone" value={data.phone ?? ""} onChange={(value) => setData((current) => ({ ...current, phone: value }))} />
        </div>
        <label className="block">
          <span className="label">Commentaire optionnel</span>
          <textarea
            className="input mt-3 min-h-[120px]"
            value={data.message ?? ""}
            onChange={(event) => setData((current) => ({ ...current, message: event.target.value }))}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Summary label="Carte VTC" value={data.hasCardVTC === "yes" ? "Oui" : "Non"} />
        <Summary label="Véhicule" value={data.hasVehicle === "yes" ? "Oui" : "Non"} />
        <Summary label="Expérience" value={data.experience ?? "-"} />
        <Summary label="Heures/semaine" value={String(data.weeklyHours ?? "-")} />
        <Summary label="Plateformes" value={(data.platforms || []).join(", ")} wide />
        <Summary label="Nom" value={data.fullName ?? "-"} wide />
        <Summary label="Ville" value={data.city ?? "-"} />
        <Summary label="Contact" value={`${data.email ?? "-"} / ${data.phone ?? "-"}`} />
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
  onPick: (value: string) => void;
  value?: string;
  cols?: 1 | 2 | 3;
}) {
  const gridCols = cols === 3 ? "grid-cols-1 md:grid-cols-3" : cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button key={option.value} type="button" onClick={() => onPick(option.value)} className={choiceClass(active)}>
            <span className="font-semibold">{option.label}</span>
            {option.hint ? <span className="mt-1 block text-sm text-slate-500">{option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input mt-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Summary({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className="text-slate-500">{label} : </span>
      <span className="font-semibold text-slate-950">{value || "-"}</span>
    </div>
  );
}

function InfoPill({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.04)]">{text}</div>;
}

function choiceClass(active: boolean) {
  return [
    "rounded-3xl border p-5 text-left transition",
    active ? "border-emerald-500 bg-emerald-50 text-slate-950" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
  ].join(" ");
}
