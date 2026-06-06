import Link from "next/link";
import { redirect } from "next/navigation";

import { LocationEditorSelector } from "@/components/location-editor-selector";
import {
  LOCATION_TYPE_KEYS,
  applyDriverWeeklyLocationSettings,
  buildDriverWeeklyLocationEditorRows,
  getWeeklySettingAmount,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
  type LocationTypeKey,
  upsertDriverWeeklyLocationSetting,
  upsertLocationTypePricing,
} from "@/lib/driver-weekly-settings";
import { readWeeklyRevenuesSnapshot } from "@/lib/integrations/weekly-revenues";
import { formatCurrency, formatPercent } from "@/lib/vivo-dashboard";

export const dynamic = "force-dynamic";

type PageSearchParams = {
  driver?: string;
  weekValue?: string;
  saved?: string;
  pricingSaved?: string;
  error?: string;
  context?: string;
  maxAcompte?: string;
  maxLocation?: string;
  acompteDraft?: string;
  vehicleTypeDraft?: string;
};

type AdminLocationsPageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function AdminLocationsPage({ searchParams }: AdminLocationsPageProps) {
  const params = await resolveSearchParams(searchParams);
  const revenuesResult = readWeeklyRevenuesSnapshot();
  const [weeklySettings, locationTypePricings] = await Promise.all([
    listDriverWeeklyLocationSettings(),
    listLocationTypePricings(),
  ]);

  const adjustedDrivers = applyDriverWeeklyLocationSettings(
    revenuesResult.drivers,
    weeklySettings,
    locationTypePricings,
  );
  const editorRows = buildDriverWeeklyLocationEditorRows(
    revenuesResult.drivers,
    weeklySettings,
    locationTypePricings,
  );

  const driverOptions = editorRows
    .reduce<Array<{ driverName: string; weekOptions: Array<{ value: string; label: string }> }>>((accumulator, row) => {
      const existing = accumulator.find((option) => option.driverName === row.driverName);
      const weekOption = { value: row.weekValue, label: `${row.week} - ${row.weekValue}` };

      if (existing) {
        if (!existing.weekOptions.some((item) => item.value === weekOption.value)) {
          existing.weekOptions.push(weekOption);
        }
      } else {
        accumulator.push({
          driverName: row.driverName,
          weekOptions: [weekOption],
        });
      }

      return accumulator;
    }, [])
    .map((option) => ({
      ...option,
      weekOptions: option.weekOptions.sort((a, b) => b.value.localeCompare(a.value)),
    }))
    .sort((a, b) => a.driverName.localeCompare(b.driverName));

  const selectedDriver = params.driver ?? driverOptions[0]?.driverName ?? "";
  const weekOptionsForDriver = driverOptions.find((option) => option.driverName === selectedDriver)?.weekOptions ?? [];
  const requestedWeekValue = params.weekValue ?? "";
  const selectedWeekValue = weekOptionsForDriver.some((weekOption) => weekOption.value === requestedWeekValue)
    ? requestedWeekValue
    : weekOptionsForDriver[0]?.value ?? "";

  const selectedRow =
    editorRows.find((row) => row.driverName === selectedDriver && row.weekValue === selectedWeekValue) ?? null;
  const selectedTechnicalRows = adjustedDrivers.filter(
    (row) => row.name === selectedDriver && row.weekValue === selectedWeekValue,
  );

  const selectedWeeklySetting = selectedRow
    ? getWeeklySettingAmount(weeklySettings, locationTypePricings, selectedRow.driverName, selectedRow.weekValue)
    : { vehicleType: null, location: 0, acompte: 0 };

  const maxLocationForSelectedWeek = selectedRow ? getTotalHorsCharge(selectedRow.totalBrut) : 0;
  const allowedLocationTypePricings = locationTypePricings.filter(
    (pricing) => pricing.price <= maxLocationForSelectedWeek,
  );
  const draftVehicleType = params.vehicleTypeDraft?.trim() ?? "";
  const selectedVehicleType = LOCATION_TYPE_KEYS.includes(draftVehicleType as LocationTypeKey)
    ? (draftVehicleType as LocationTypeKey)
    : selectedWeeklySetting.vehicleType ??
      allowedLocationTypePricings[0]?.key ??
      locationTypePricings[0]?.key ??
      "ECO";
  const activeTypePricing =
    locationTypePricings.find((pricing) => pricing.key === selectedVehicleType) ?? locationTypePricings[0] ?? null;
  const effectiveLocation = activeTypePricing?.price ?? 0;
  const draftAcompte = params.acompteDraft ? Number(params.acompteDraft) : Number.NaN;
  const formAcompte = Number.isFinite(draftAcompte) ? draftAcompte : selectedWeeklySetting.acompte;
  const maxAcompteForForm = selectedRow ? Math.max(0, getRetraitDisponible(selectedRow.totalBrut, effectiveLocation)) : 0;

  async function saveWeeklyAmountsAction(formData: FormData) {
    "use server";

    const driverName = String(formData.get("driverName") ?? "").trim();
    const weekValue = String(formData.get("weekValue") ?? "").trim();
    const vehicleTypeInput = String(formData.get("vehicleType") ?? "").trim();
    const acompteInput = String(formData.get("acompte") ?? "0").replace(",", ".").trim();
    const acompte = Number(acompteInput);
    const vehicleType = LOCATION_TYPE_KEYS.includes(vehicleTypeInput as LocationTypeKey)
      ? (vehicleTypeInput as LocationTypeKey)
      : "ECO";

    if (!driverName || !weekValue || !Number.isFinite(acompte) || acompte < 0) {
      redirect(`/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}`);
    }

    const [latestSettings, latestPricings] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
    ]);
    const revenuesSnapshot = readWeeklyRevenuesSnapshot();
    const groupedRows = buildDriverWeeklyLocationEditorRows(revenuesSnapshot.drivers, latestSettings, latestPricings);
    const selectedWeeklyRow =
      groupedRows.find((row) => row.driverName === driverName && row.weekValue === weekValue) ?? null;

    if (!selectedWeeklyRow) {
      redirect(`/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}`);
    }

    const selectedPricing =
      latestPricings.find((pricing) => pricing.key === vehicleType) ?? latestPricings[0] ?? { price: 0 };
    const location = selectedPricing.price;
    const maxLocation = getTotalHorsCharge(selectedWeeklyRow.totalBrut);

    if (location > maxLocation) {
      redirect(
        `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&error=location-max&context=main&maxLocation=${encodeURIComponent(maxLocation.toFixed(2))}&vehicleTypeDraft=${encodeURIComponent(vehicleType)}&acompteDraft=${encodeURIComponent(acompte.toFixed(2))}`,
      );
    }

    const maxAcompte = Math.max(0, getRetraitDisponible(selectedWeeklyRow.totalBrut, location));
    if (acompte > maxAcompte) {
      redirect(
        `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&error=acompte-max&context=main&maxAcompte=${encodeURIComponent(maxAcompte.toFixed(2))}&vehicleTypeDraft=${encodeURIComponent(vehicleType)}&acompteDraft=${encodeURIComponent(acompte.toFixed(2))}`,
      );
    }

    await upsertDriverWeeklyLocationSetting({
      driverName,
      weekValue,
      vehicleType,
      location,
      acompte,
    });

    redirect(
      `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&saved=1`,
    );
  }

  async function saveLocationPricingAction(formData: FormData) {
    "use server";

    for (const key of LOCATION_TYPE_KEYS) {
      const label = String(formData.get(`label-${key}`) ?? key).trim();
      const rawPrice = String(formData.get(`price-${key}`) ?? "0").replace(",", ".").trim();
      const price = Number(rawPrice);

      if (!Number.isFinite(price) || price < 0) {
        continue;
      }

      const currentSortOrder =
        locationTypePricings.find((pricing) => pricing.key === key)?.sortOrder ??
        LOCATION_TYPE_KEYS.indexOf(key) + 1;

      await upsertLocationTypePricing({
        key,
        label,
        price,
        sortOrder: currentSortOrder,
      });
    }

    redirect(
      `/admin/locations?driver=${encodeURIComponent(selectedDriver)}&weekValue=${encodeURIComponent(selectedWeekValue)}&pricingSaved=1`,
    );
  }

  async function quickAssignTypeAction(formData: FormData) {
    "use server";

    const driverName = String(formData.get("driverName") ?? "").trim();
    const weekValue = String(formData.get("weekValue") ?? "").trim();
    const vehicleTypeInput = String(formData.get("vehicleType") ?? "").trim();
    const vehicleType = LOCATION_TYPE_KEYS.includes(vehicleTypeInput as LocationTypeKey)
      ? (vehicleTypeInput as LocationTypeKey)
      : "ECO";

    const [latestSettings, latestPricings] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
    ]);
    const revenuesSnapshot = readWeeklyRevenuesSnapshot();
    const groupedRows = buildDriverWeeklyLocationEditorRows(revenuesSnapshot.drivers, latestSettings, latestPricings);
    const selectedWeeklyRow =
      groupedRows.find((row) => row.driverName === driverName && row.weekValue === weekValue) ?? null;

    if (!selectedWeeklyRow) {
      redirect(`/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}`);
    }

    const selectedPricing =
      latestPricings.find((pricing) => pricing.key === vehicleType) ?? latestPricings[0] ?? { price: 0 };
    const location = selectedPricing.price;
    const maxLocation = getTotalHorsCharge(selectedWeeklyRow.totalBrut);

    if (location > maxLocation) {
      redirect(
        `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&error=location-max&context=table&maxLocation=${encodeURIComponent(maxLocation.toFixed(2))}`,
      );
    }

    const existingSetting = getWeeklySettingAmount(latestSettings, latestPricings, driverName, weekValue);
    const maxAcompte = Math.max(0, getRetraitDisponible(selectedWeeklyRow.totalBrut, location));
    if (existingSetting.acompte > maxAcompte) {
      redirect(
        `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&error=acompte-max&context=table&maxAcompte=${encodeURIComponent(maxAcompte.toFixed(2))}`,
      );
    }

    await upsertDriverWeeklyLocationSetting({
      driverName,
      weekValue,
      vehicleType,
      location,
      acompte: existingSetting.acompte,
    });

    redirect(
      `/admin/locations?driver=${encodeURIComponent(driverName)}&weekValue=${encodeURIComponent(weekValue)}&saved=1`,
    );
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.10),_transparent_24%),linear-gradient(180deg,_#f3fbf7_0%,_#edf5f1_42%,_#f8fbfa_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[36px] border border-emerald-100/80 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.1)]">
          <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,_rgba(236,253,245,0.96)_0%,_rgba(255,255,255,0.98)_55%,_rgba(240,253,250,0.92)_100%)] px-6 py-8 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 shadow-sm backdrop-blur">
                  Admin location
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                  Tarifs globaux et édition hebdomadaire
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                  Une interface simple et claire : à gauche tu gères les tarifs de référence, à droite tu appliques
                  un type de location par chauffeur et par semaine.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  Retour au dashboard
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <IntroStat
                label="Semaine active"
                value={selectedRow ? `${selectedRow.week} / ${selectedRow.weekValue}` : "--"}
                helper="Période en cours d'édition"
              />
              <IntroStat
                label="Chauffeur"
                value={selectedRow?.driverName ?? "--"}
                helper="Fiche actuellement chargée"
              />
              <IntroStat
                label="Type retenu"
                value={activeTypePricing?.label ?? "--"}
                helper="Tarif appliqué partout"
              />
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
              <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Sélection rapide</div>
                      <div className="mt-1 text-sm text-slate-500">Choisis un chauffeur puis sa semaine.</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Dynamique
                    </div>
                  </div>

                  <LocationEditorSelector
                    driverOptions={driverOptions}
                    selectedDriver={selectedDriver}
                    selectedWeekValue={selectedWeekValue}
                  />
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Tarifs de location</div>
                      <div className="mt-1 text-sm text-slate-500">Référence unique pour tout le dashboard admin.</div>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                      Global
                    </div>
                  </div>

                  <form action={saveLocationPricingAction} className="mt-5">
                    <div className="overflow-hidden rounded-[24px] border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Type</th>
                            <th className="px-4 py-3 font-semibold">Code</th>
                            <th className="px-4 py-3 font-semibold text-right">Prix hebdo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {locationTypePricings.map((pricing) => (
                            <tr key={pricing.key} className="border-t border-slate-100 bg-white">
                              <td className="px-4 py-3">
                                <input type="hidden" name={`label-${pricing.key}`} value={pricing.label} />
                                <div className="font-semibold text-slate-950">{pricing.label}</div>
                              </td>
                              <td className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                                {pricing.key}
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  name={`price-${pricing.key}`}
                                  step="0.01"
                                  min="0"
                                  defaultValue={pricing.price.toFixed(2)}
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-base font-semibold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="submit"
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition hover:bg-slate-900"
                    >
                      Enregistrer les tarifs globaux
                    </button>
                  </form>

                  {params.pricingSaved === "1" ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Tarifs globaux enregistrés. Toutes les fiches utilisent déjà ces nouveaux montants.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-6">
                {selectedRow ? (
                  <>
                    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_rgba(248,250,252,0.98)_0%,_rgba(255,255,255,1)_55%,_rgba(236,253,245,0.85)_100%)] px-5 py-5 md:px-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-500">Fiche hebdomadaire</div>
                            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                              {selectedRow.driverName}
                            </h2>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                                {selectedRow.week} - {selectedRow.weekValue}
                              </span>
                              {selectedRow.companies.map((company) => (
                                <span
                                  key={company}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                                >
                                  {company}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                            <TopAmountCard label="Location actuelle" value={formatCurrency(effectiveLocation)} />
                            <TopAmountCard label="Acompte actuel" value={formatCurrency(selectedWeeklySetting.acompte)} />
                          </div>
                        </div>
                      </div>

                      <div className="p-5 md:p-6">
                        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                          <SummaryKpi label="Total brut" value={formatCurrency(selectedRow.totalBrut)} tone="dark" />
                          <SummaryKpi label="% VIVO" value={formatPercent(getVivoRate(selectedRow.totalBrut))} tone="mint" />
                          <SummaryKpi label="Total hors charge" value={formatCurrency(getTotalHorsCharge(selectedRow.totalBrut))} />
                          <SummaryKpi
                            label="Total après charge"
                            value={formatCurrency(getTotalAfterLocation(selectedRow.totalBrut, effectiveLocation))}
                            tone="dark"
                          />
                          <SummaryKpi
                            label="Retrait disponible"
                            value={formatCurrency(getRetraitDisponible(selectedRow.totalBrut, effectiveLocation))}
                            tone="mint"
                          />
                          <SummaryKpi
                            label="Total restant"
                            value={formatCurrency(
                              getTotalRestant(selectedRow.totalBrut, effectiveLocation, selectedWeeklySetting.acompte),
                            )}
                            tone="dark"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)] md:p-6">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-950">Modifier la semaine</div>
                          <div className="mt-1 text-sm text-slate-600">
                            Choisis un type de véhicule, puis saisis l’acompte si la formule le permet.
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Formule conservée
                        </div>
                      </div>

                      <form
                        action={saveWeeklyAmountsAction}
                        className="mt-5 grid gap-4 rounded-[26px] border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px] lg:items-end"
                      >
                        <input type="hidden" name="driverName" value={selectedRow.driverName} />
                        <input type="hidden" name="weekValue" value={selectedRow.weekValue} />

                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Type de location
                          </span>
                          <select
                            name="vehicleType"
                            defaultValue={selectedVehicleType}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-medium text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                          >
                            {locationTypePricings.map((pricing) => {
                              const isAllowed = pricing.price <= maxLocationForSelectedWeek;
                              return (
                                <option key={pricing.key} value={pricing.key} disabled={!isAllowed}>
                                  {pricing.label} - {formatCurrency(pricing.price)}
                                </option>
                              );
                            })}
                          </select>
                          <span className="mt-2 block text-xs text-slate-500">
                            Montant appliqué à cette semaine : {formatCurrency(effectiveLocation)}.
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Maximum supporté par cette semaine : {formatCurrency(maxLocationForSelectedWeek)}.
                          </span>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Acompte
                          </span>
                          <input
                            type="number"
                            name="acompte"
                            step="0.01"
                            min="0"
                            max={maxAcompteForForm}
                            defaultValue={formAcompte.toFixed(2)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-medium text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                          />
                          <span className="mt-2 block text-xs text-slate-500">
                            Maximum autorisé : {formatCurrency(maxAcompteForForm)}.
                          </span>
                        </label>

                        <button
                          type="submit"
                          className="inline-flex h-[58px] items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(16,185,129,0.28)] transition hover:bg-emerald-500"
                        >
                          Enregistrer
                        </button>
                      </form>

                      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <form action={saveWeeklyAmountsAction}>
                          <input type="hidden" name="driverName" value={selectedRow.driverName} />
                          <input type="hidden" name="weekValue" value={selectedRow.weekValue} />
                          <input type="hidden" name="vehicleType" value={selectedVehicleType} />
                          <input type="hidden" name="acompte" value="0" />
                          <button
                            type="submit"
                            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                          >
                            Remettre acompte à 0 EUR
                          </button>
                        </form>

                        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                          Total restant = retrait disponible - acompte
                        </div>
                      </div>

                      {params.saved === "1" ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          Semaine enregistrée. Le dashboard admin utilise déjà ce type et cet acompte dans tous les calculs.
                        </div>
                      ) : null}
                      {params.error === "acompte-max" && params.context !== "table" ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          Acompte refusé : maximum autorisé {formatCurrency(Number(params.maxAcompte ?? "0"))}.
                        </div>
                      ) : null}
                      {params.error === "location-max" && params.context !== "table" ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Type refusé : cette semaine ne supporte pas une location au-dessus de{" "}
                          {formatCurrency(Number(params.maxLocation ?? "0"))}.
                        </div>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
                      <div className="border-b border-slate-200 px-5 py-4 md:px-6">
                        <div className="text-lg font-semibold text-slate-950">Tableau d’action rapide</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Change directement le type depuis la liste et sauvegarde en une action.
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-5 py-4 font-semibold">Chauffeur</th>
                              <th className="px-5 py-4 font-semibold">Semaine</th>
                              <th className="px-5 py-4 font-semibold">Brut</th>
                              <th className="px-5 py-4 font-semibold">Type</th>
                              <th className="px-5 py-4 font-semibold">Location</th>
                              <th className="px-5 py-4 font-semibold">Acompte</th>
                              <th className="px-5 py-4 font-semibold text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editorRows.slice(0, 24).map((row) => {
                              const maxLocationForRow = getTotalHorsCharge(row.totalBrut);
                              return (
                                <tr key={`${row.driverName}-${row.weekValue}`} className="border-t border-slate-100">
                                  <td className="px-5 py-4 font-semibold text-slate-900">{row.driverName}</td>
                                  <td className="px-5 py-4 text-slate-700">
                                    {row.week} - {row.weekValue}
                                  </td>
                                  <td className="px-5 py-4 text-slate-700">{formatCurrency(row.totalBrut)}</td>
                                  <td className="px-5 py-4">
                                    <form action={quickAssignTypeAction} className="flex items-center gap-2">
                                      <input type="hidden" name="driverName" value={row.driverName} />
                                      <input type="hidden" name="weekValue" value={row.weekValue} />
                                      <select
                                        name="vehicleType"
                                        defaultValue={row.vehicleType ?? locationTypePricings[0]?.key}
                                        className="min-w-[210px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-300"
                                      >
                                        {locationTypePricings.map((pricing) => {
                                          const isAllowed = pricing.price <= maxLocationForRow;
                                          return (
                                            <option key={pricing.key} value={pricing.key} disabled={!isAllowed}>
                                              {pricing.label} - {formatCurrency(pricing.price)}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      <button
                                        type="submit"
                                        className="inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                                      >
                                        Sauvegarder
                                      </button>
                                    </form>
                                  </td>
                                  <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(row.location)}</td>
                                  <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(row.acompte)}</td>
                                  <td className="px-5 py-4 text-right">
                                    <Link
                                      href={`/admin/locations?driver=${encodeURIComponent(row.driverName)}&weekValue=${encodeURIComponent(row.weekValue)}`}
                                      className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                                    >
                                      Ouvrir
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {params.error === "location-max" && params.context === "table" ? (
                        <div className="border-t border-slate-200 px-5 py-4 text-sm text-amber-900 md:px-6">
                          Type refusé depuis le tableau : maximum supporté {formatCurrency(Number(params.maxLocation ?? "0"))}.
                        </div>
                      ) : null}
                      {params.error === "acompte-max" && params.context === "table" ? (
                        <div className="border-t border-slate-200 px-5 py-4 text-sm text-amber-900 md:px-6">
                          Type non appliqué depuis le tableau : l’acompte actuel dépasse le nouveau maximum autorisé de{" "}
                          {formatCurrency(Number(params.maxAcompte ?? "0"))}.
                        </div>
                      ) : null}
                    </div>

                    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
                      <div className="border-b border-slate-200 px-5 py-4 md:px-6">
                        <div className="text-lg font-semibold text-slate-950">Répartition technique par campagne</div>
                        <div className="mt-1 text-sm text-slate-500">
                          La location globale choisie est ensuite redistribuée automatiquement sur les campagnes de la semaine.
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-5 py-4 font-semibold">Uber</th>
                              <th className="px-5 py-4 font-semibold">Bolt</th>
                              <th className="px-5 py-4 font-semibold">Heetch</th>
                              <th className="px-5 py-4 font-semibold">Brut</th>
                              <th className="px-5 py-4 font-semibold">Location affectée</th>
                              <th className="px-5 py-4 font-semibold">Acompte affecté</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTechnicalRows.map((row) => (
                              <tr key={`${row.company}-${row.weekValue}`} className="border-t border-slate-100">
                                <td className="px-5 py-4 text-slate-700">{formatCurrency(row.uber)}</td>
                                <td className="px-5 py-4 text-slate-700">{formatCurrency(row.bolt)}</td>
                                <td className="px-5 py-4 text-slate-700">{formatCurrency(row.heetch)}</td>
                                <td className="px-5 py-4 font-semibold text-slate-900">
                                  {formatCurrency(row.uber + row.bolt + row.heetch)}
                                </td>
                                <td className="px-5 py-4 text-slate-700">{formatCurrency(row.location)}</td>
                                <td className="px-5 py-4 text-slate-700">{formatCurrency(row.acompte)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                    Aucune ligne disponible pour cette sélection.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

async function resolveSearchParams(
  searchParams?: Promise<PageSearchParams> | PageSearchParams,
): Promise<PageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (typeof (searchParams as Promise<PageSearchParams>).then === "function") {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

function SummaryKpi({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "mint" | "dark";
}) {
  const toneClasses =
    tone === "dark"
      ? "border-slate-900 bg-slate-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)]"
      : tone === "mint"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-slate-200 bg-slate-50 text-slate-950";
  const labelClasses =
    tone === "dark"
      ? "text-white/65"
      : tone === "mint"
        ? "text-emerald-700"
        : "text-slate-500";

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneClasses}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${labelClasses}`}>{label}</div>
      <div className="mt-3 text-[34px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function TopAmountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/95 px-4 py-4 text-right shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-[38px] font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function IntroStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/70 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function getVivoRate(totalBrut: number): number {
  if (totalBrut < 500) {
    return 0.16;
  }

  if (totalBrut < 1000) {
    return 0.14;
  }

  return 0.12;
}

function getTotalHorsCharge(totalBrut: number): number {
  return round2(totalBrut - totalBrut * getVivoRate(totalBrut));
}

function getTotalAfterLocation(totalBrut: number, location: number): number {
  return round2(getTotalHorsCharge(totalBrut) - location);
}

function getRetraitDisponible(totalBrut: number, location: number): number {
  return round2(getTotalAfterLocation(totalBrut, location) / 2);
}

function getTotalRestant(totalBrut: number, location: number, acompte: number): number {
  return round2(getRetraitDisponible(totalBrut, location) - acompte);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
