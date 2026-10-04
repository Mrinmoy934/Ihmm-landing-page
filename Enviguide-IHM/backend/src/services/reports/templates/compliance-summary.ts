// ─── Compliance Summary Report — HTML template ────────────────────────────
// Slim, high-level snapshot for management consumption. Does NOT include
// the full materials inventory or HM Marked Decks pages — those live in
// the Inventory and Overall reports respectively.
//
// Pages (in order):
//   1. Cover                — brand header, title, vessel line, photo,
//                             meta table, compliance references.
//   2. Vessel Specifications — owner/ship details table.
//   3. Compliance Snapshot   — SOC ref, IHM ref, mapped-deck coverage,
//                              outstanding action item totals.
//   4. Action Items          — pending clarifications, suspected-hazmat
//                              POs, POs awaiting declarations.
//   5. Period Activity       — POs received, MD/SDoC requested+received.

import type { ReportData } from '../data.js';
import {
  esc,
  dash,
  BRAND_HEADER,
  STYLESHEET,
  renderCoverPage,
  renderSpecsPage,
  renderSuspectedHazmatPage,
  renderMdSdocPage,
} from './quarterly-compliance.js';

function renderComplianceSnapshotPage(data: ReportData): string {
  const v = data.vessel;
  const allMaterials = data.materialGroups.flatMap((g) => g.rows);
  const distinctDecks = new Set(allMaterials.map((m) => m.location).filter(Boolean));
  const mappedDecks = new Set(
    allMaterials
      .filter((m) => m.gaPlanUrl && (m.pinX !== null || m.rect))
      .map((m) => m.location)
      .filter(Boolean),
  );

  const totalMaterials = allMaterials.length;
  const totalDecks = distinctDecks.size;
  const mappedDeckCount = mappedDecks.size;
  const coveragePct =
    totalDecks > 0 ? `${Math.round((mappedDeckCount / totalDecks) * 100)}%` : '&mdash;';

  // Outstanding totals — used as headline figures on the snapshot.
  const pendingClarifications = data.appendices.posAwaitingDeclaration.length;
  const suspectedPos = data.appendices.posWithHazmat.length;

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Compliance Snapshot</h2>
  <table class="kv">
    <tr><th>Statement of Compliance (SOC)</th><td>${dash(v.socReference)}</td></tr>
    <tr><th>Initial IHM Reference</th><td>${dash(v.ihmReference)}</td></tr>
    <tr><th>Total Materials in Inventory</th><td>${totalMaterials}</td></tr>
    <tr><th>Decks with mapped materials</th><td>${totalDecks}</td></tr>
    <tr><th>Decks with HM-marked GA plans</th><td>${mappedDeckCount}</td></tr>
    <tr><th>HM-marked deck coverage</th><td>${coveragePct}</td></tr>
    <tr><th>POs awaiting declaration</th><td>${pendingClarifications}</td></tr>
    <tr><th>POs with suspected hazmat</th><td>${suspectedPos}</td></tr>
  </table>

  <div class="compliance-block" style="margin-top:8mm;">
    <div class="label">Compliance References:</div>
    <ul>
      <li>Hong Kong International Convention for the Safe and Environmentally Sound Recycling of Ships (SR/CONF 45)</li>
      <li>Guidelines for the Preparation of Inventory of Hazardous Materials (MEPC Res. 379(80))</li>
      <li>EU Regulation on Ship Recycling (EU-SRR No. 1257/2013)</li>
      <li>EMSA's Best Practice Guidance on the Inventory of Hazardous Materials</li>
    </ul>
  </div>
</section>`;
}

function renderActionItemsPage(data: ReportData): string {
  const renderList = (rows: { poNumber: string; receivedDate: string }[], emptyText: string): string => {
    if (rows.length === 0) {
      return `<div class="none-found">${emptyText}</div>`;
    }
    const body = rows
      .slice(0, 25) // cap so the page doesn't explode; full list is in Inventory
      .map((r, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${esc(r.poNumber)}</td>
          <td style="text-align:center;">${esc(r.receivedDate)}</td>
        </tr>`)
      .join('');
    return `
      <table class="details">
        <thead>
          <tr>
            <th style="width:14mm;">No.</th>
            <th>PO Number</th>
            <th style="width:34mm;">Received Date</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      ${rows.length > 25 ? `<div class="muted-note">Showing first 25 of ${rows.length}. Full list in the Detailed Materials Inventory Report.</div>` : ''}
    `;
  };

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Action Items</h2>

  <h3>POs Awaiting Material/SDoC Declaration</h3>
  ${renderList(data.appendices.posAwaitingDeclaration, 'No outstanding declaration requests in this period.')}

  <h3>POs with Suspected Hazmat</h3>
  ${renderList(data.appendices.posWithHazmat, 'No suspected-hazmat purchase orders in this period.')}
</section>`;
}

function renderPeriodActivityPage(data: ReportData): string {
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} to ${data.period.end.toLocaleDateString('en-GB')}`;
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Period Activity (${esc(periodLabel)})</h2>
  <table class="summary wide">
    <tr><th>POs received in this period</th><td>${data.totals.posReceivedInQuarter}</td></tr>
    <tr><th>MD/SDoC documents requested</th><td>${data.totals.docsRequested}</td></tr>
    <tr><th>MD/SDoC documents received</th><td>${data.totals.docsReceived}</td></tr>
  </table>
</section>`;
}

const EXTRA_CSS = `
table.kv { font-size: 11pt; }
table.kv th { width: 55%; text-align: left; }
table.kv td { text-align: right; font-weight: 700; }
table.summary.wide { width: 100%; }
table.summary.wide td { width: 30%; }
.muted-note { font-style: italic; color: #555; font-size: 9.5pt; margin-top: 2mm; }
`;

export function renderComplianceSummaryHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Enviguide IHM &mdash; Compliance Summary Report</title>
<style>${STYLESHEET}${EXTRA_CSS}</style>
</head>
<body>
${renderCoverPage(data, 'Compliance Summary Report')}
${renderSpecsPage(data)}
${renderComplianceSnapshotPage(data)}
${renderActionItemsPage(data)}
${renderMdSdocPage(data)}
${renderSuspectedHazmatPage(data)}
${renderPeriodActivityPage(data)}
</body>
</html>`;
}
