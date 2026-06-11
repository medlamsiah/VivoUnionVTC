"use client";

import { useState } from "react";

export type AccordionItem = {
  title: string;
  content: string;
};

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <div className="grid gap-4">
      {items.map((it, idx) => {
        const open = idx === openIndex;
        return (
          <button
            key={it.title}
            type="button"
            onClick={() => setOpenIndex(open ? -1 : idx)}
            className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-left shadow-[0_18px_55px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_70px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-base font-semibold text-slate-950">{it.title}</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-sm font-semibold text-slate-700">
                {open ? "-" : "+"}
              </div>
            </div>
            {open ? (
              <div className="mt-4 text-sm leading-7 text-slate-600">{it.content}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

