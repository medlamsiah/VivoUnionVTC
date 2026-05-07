import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const yesNoToBool = (v: unknown) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["yes", "oui", "true", "1"].includes(s)) return true;
    if (["no", "non", "false", "0"].includes(s)) return false;
  }
  return v;
};

const toNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return v;
};

const toPlatformsArray = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return v;
};

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  hasCardVTC: z.preprocess(yesNoToBool, z.boolean()),
  hasVehicle: z.preprocess(yesNoToBool, z.boolean()),
  experience: z.enum(["0-1", "1-3", "3+"]),
  platforms: z.preprocess(toPlatformsArray, z.array(z.string()).min(1)),
  weeklyHours: z.preprocess(toNumber, z.number().int().min(1).max(90)).optional(),
  message: z.string().max(800).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      hasCardVTC: parsed.data.hasCardVTC,
      hasVehicle: parsed.data.hasVehicle,
      experience: parsed.data.experience,
      platforms: parsed.data.platforms.join(","),
      weeklyHours: parsed.data.weeklyHours ?? null,
      message: parsed.data.message || null,
    },
  });

  return NextResponse.json({ ok: true, id: lead.id });
}

export async function GET() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ ok: true, leads });
}
