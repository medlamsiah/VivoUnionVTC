import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  ca: z.number().nonnegative(),
  net: z.number().nonnegative(),
  leadId: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const sim = await prisma.simulation.create({
    data: {
      ca: parsed.data.ca,
      net: parsed.data.net,
      leadId: parsed.data.leadId ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: sim.id });
}
