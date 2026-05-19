import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function num(v: any) {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[€\s]/g, "").replace(",", ".")) || 0;
}

function val(row: any, name: string) {
  return row[name] ?? "";
}

async function main() {
  const csvFile = fs.readdirSync(process.cwd()).find(
    (f) => f.includes("payments_driver") && f.endsWith(".csv")
  );

  if (!csvFile) throw new Error("CSV introuvable");

  const csv = fs.readFileSync(path.join(process.cwd(), csvFile), "utf8");

  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  const snapshotDate = new Date();
  const periodStart = new Date("2026-05-01");
  const periodEnd = new Date("2026-05-19");

  let imported = 0;

  for (const row of parsed.data as any[]) {
    const driverUuid = val(row, "UUID du chauffeur");
    const firstName = val(row, "Prénom du chauffeur") || val(row, "Pr├®nom du chauffeur");
    const lastName = val(row, "Nom du chauffeur");
    const driverName = `${firstName} ${lastName}`.trim();

    if (!driverUuid || !driverName) continue;
    if (driverUuid === "20a91cc4-45d1-4fde-b11a-d05be3ac481a") continue;

    await prisma.uberDriverRevenueSnapshot.create({
      data: {
        snapshotDate,
        periodStart,
        periodEnd,
        driverUuid,
        driverName,
        driverNameKey: driverName.toLowerCase(),

        totalRevenue: num(val(row, "Revenus totaux")),
        netTripPrice: num(val(row, "Revenus totaux : Prix net de la course")),
        bonus: num(val(row, "Revenus totaux : Bonus")),
        reimbursements: num(val(row, "Remboursements et notes de frais")),
        payouts: num(val(row, "Versements")),
        bankTransfers: num(val(row, "Versements : Transferts vers un compte bancaire")),
        cashCollected: num(val(row, "Versements : Espèces collectées")) || num(val(row, "Versements : Esp├¿ces collect├®es")),
        thirdPartyPaid: num(val(row, "Montant versé à des tiers")) || num(val(row, "Montant vers├® ├á des tiers")),
        tolls: num(val(row, "Remboursements et notes de frais:Remboursements:Péage")) || num(val(row, "Remboursements et notes de frais:Remboursements:P├®age")),
        postTripAdjustments: num(val(row, "Montant versé à des tiers:Ajustements après la course")) || num(val(row, "Montant vers├® ├á des tiers:Ajustements apr├¿s la course")),
        tips: num(val(row, "Revenus totaux:Pourboire")),
        otherAdjustments: num(val(row, "Revenus totaux:Autres revenus:Ajustement")),
      },
    });

    imported++;
  }

  console.log(`Imported ${imported} drivers`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());