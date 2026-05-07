"use client";

type LocationEditorSelectorProps = {
  driverOptions: Array<{
    driverName: string;
    weekOptions: Array<{ value: string; label: string }>;
  }>;
  selectedDriver: string;
  selectedWeekValue: string;
};

export function LocationEditorSelector({
  driverOptions,
  selectedDriver,
  selectedWeekValue,
}: LocationEditorSelectorProps) {
  const selectedDriverConfig = driverOptions.find((option) => option.driverName === selectedDriver) ?? driverOptions[0];
  const currentWeekOptions = selectedDriverConfig?.weekOptions ?? [];

  return (
    <div className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Chauffeur
        </span>
        <select
          value={selectedDriverConfig?.driverName ?? ""}
          onChange={(event) => {
            const nextDriver = event.target.value;
            const nextDriverConfig = driverOptions.find((option) => option.driverName === nextDriver);
            const nextWeekValue = nextDriverConfig?.weekOptions[0]?.value ?? "";
            const query = new URLSearchParams({ driver: nextDriver });
            if (nextWeekValue) {
              query.set("weekValue", nextWeekValue);
            }
            window.location.assign(`/admin/locations?${query.toString()}`);
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300"
        >
          {driverOptions.map((option) => (
            <option key={option.driverName} value={option.driverName}>
              {option.driverName}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Semaine
        </span>
        <select
          value={selectedWeekValue}
          onChange={(event) => {
            const nextWeekValue = event.target.value;
            const query = new URLSearchParams({
              driver: selectedDriverConfig?.driverName ?? "",
              weekValue: nextWeekValue,
            });
            window.location.assign(`/admin/locations?${query.toString()}`);
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300"
        >
          {currentWeekOptions.map((weekOption) => (
            <option key={weekOption.value} value={weekOption.value}>
              {weekOption.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
