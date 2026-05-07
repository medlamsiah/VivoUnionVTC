export type RevenueResult = {
  ca: number;
  base85: number;
  deductionRate: number;
  net: number;
};

export function computeNetRevenue(ca: number): RevenueResult {
  const safe = Number.isFinite(ca) ? Math.max(0, ca) : 0;
  const base85 = (safe / 100) * 85; // CA * 0.85

  // Règles du client (d'après le doc) : on applique une déduction supplémentaire
  // selon la tranche de CA.
  let deductionRate = 0.16;
  if (safe > 4000) deductionRate = 0.12;
  else if (safe >= 2000) deductionRate = 0.14;

  const net = base85 * (1 - deductionRate);

  return { ca: safe, base85, deductionRate, net };
}

export function formatMoney(n: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}
