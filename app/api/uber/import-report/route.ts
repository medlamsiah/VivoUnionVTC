import { NextResponse } from "next/server";

import { importUberSupplierReport } from "@/lib/integrations/uber-report-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        {
          ok: false,
          provider: "uber",
          error: "Envoyez le rapport Uber avec un formulaire multipart.",
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          provider: "uber",
          error: "Fichier rapport Uber manquant.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importUberSupplierReport({
      filename: file.name,
      contentType: file.type,
      buffer,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Uber supplier report import failed.", error);
    const message = error instanceof Error ? error.message : "Import du rapport Uber impossible.";
    const status = isImportInputError(message) ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: message,
      },
      { status },
    );
  }
}

function isImportInputError(message: string): boolean {
  return (
    message.includes("rapport d'activite") ||
    message.includes("Colonne") ||
    message.includes("Format non supporte") ||
    message.includes("fichier Excel")
  );
}
