import { prisma } from "@/lib/prisma";

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function row(cells: string[]): string {
  return `<Row>${cells
    .map(
      (cell) =>
        `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`,
    )
    .join("")}</Row>`;
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  const header = row([
    "Date",
    "Nom complet",
    "Email",
    "Telephone",
    "Ville",
    "Carte VTC",
    "Vehicule",
    "Experience",
    "Plateformes",
    "Heures / semaine",
    "Message",
  ]);

  const body = leads
    .map((lead) =>
      row([
        lead.createdAt.toLocaleString("fr-FR"),
        lead.fullName,
        lead.email ?? "",
        lead.phone ?? "",
        lead.city ?? "",
        lead.hasCardVTC ? "Oui" : "Non",
        lead.hasVehicle ? "Oui" : "Non",
        lead.experience,
        lead.platforms,
        lead.weeklyHours != null ? String(lead.weeklyHours) : "",
        lead.message ?? "",
      ]),
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#DFF7EF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Candidatures">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Nom complet</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Email</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Telephone</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Ville</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Carte VTC</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Vehicule</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Experience</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Plateformes</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Heures / semaine</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Message</Data></Cell>
      </Row>
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": 'attachment; filename="vivo-candidatures.xls"',
      "cache-control": "no-store",
    },
  });
}
