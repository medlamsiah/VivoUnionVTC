"use client";

import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";

type Group = { [k: string]: any; _count: { _all: number } };

function toPie(data: Group[], label: (d: Group) => string) {
  return data.map((d) => ({ name: label(d), value: d._count._all }));
}

export function LeadsCharts({
  byCard,
  byVehicle,
  byExp,
}: {
  byCard: Group[];
  byVehicle: Group[];
  byExp: Group[];
}) {
  return (
    <div className="card p-6">
      <div className="text-sm font-semibold">Répartition (MVP)</div>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <ChartBlock title="Carte VTC" data={toPie(byCard, (d) => (d.hasCardVTC ? "Oui" : "Non"))} />
        <ChartBlock title="Véhicule" data={toPie(byVehicle, (d) => (d.hasVehicle ? "Oui" : "Non"))} />
      </div>

      <div className="mt-8">
        <div className="text-sm font-semibold">Expérience</div>
        <div className="mt-3 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toPie(byExp, (d) => String(d.experience))}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChartBlock({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={70} />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
