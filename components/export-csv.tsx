"use client";

import { useState } from "react";

export function ExportCsvButton() {
  const [loading, setLoading] = useState(false);

  async function dl() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vivo-leads.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn" onClick={dl} disabled={loading}>
      {loading ? "Export..." : "Exporter CSV"}
    </button>
  );
}
