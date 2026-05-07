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
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left shadow-soft transition hover:border-vivo/50"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-base font-semibold text-gray-900">{it.title}</div>
              <div className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                {open ? "-" : "+"}
              </div>
            </div>
            {open ? (
              <div className="mt-3 text-sm leading-relaxed text-gray-600">{it.content}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

