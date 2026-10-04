// ─── Detailed Materials Inventory Report — HTML template ──────────────────
// Material-focused dossier. One section per deck, listing every mapped
// material with creation timestamp + age-in-inventory. Closes with the
// HM Marked Decks pages (one per GA plan with numbered pin overlays).
//
// Pages (in order):
//   1. Cover                — brand header, title, vessel line, photo,
//                             meta table, compliance references.
//   2. Vessel Specifications — owner/ship details table.
//   3. Inventory Summary     — totals per IHM Part group.
//   4+ Per-deck breakdown    — one section per deck with the materials
//                              on it, columns including Created On and
//                              Days in Inventory.
//   N+ HM Marked Decks       — numbered pin pages (re-uses the renderer
//                              from the Overall report).

import type { ReportData, MaterialRow, MaterialGroup } from '../data.js';
import {
  esc,
  BRAND_HEADER,
  STYLESHEET,
  renderCoverPage,
  renderSpecsPage,
  renderHmMarkedDecksPages,
  DECK_CROP_SCRIPT,
} from './quarterly-compliance.js';

// ─── Helpers ──────────────────────────────────────────────────────────────
function daysInInventory(createdOn: string, asOf: Date): number {
  // createdOn is dd/mm/yyyy. Reverse → yyyy-mm-dd → Date.
  const parts = createdOn.split('/');
  if (parts.length !== 3) return 0;
  const iso = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - t) / (1000 * 60 * 60 * 24)));
}

function partLabelOf(groupKey: MaterialGroup['groupKey']): string {
  switch (groupKey) {
    case 'I-1': return 'Part I-1';
    case 'I-2': return 'Part I-2';
    case 'I-3': return 'Part I-3';
    case 'II':  return 'Part II';
    case 'III': return 'Part III';
  }
}

// ─── Inventory Summary ────────────────────────────────────────────────────
function renderInventorySummaryPage(data: ReportData): string {
  const rows = data.materialGroups
    .map((g) => `
      <tr>
        <th>${partLabelOf(g.groupKey)}</th>
        <td style="text-align:right;">${g.rows.length}</td>
      </tr>`)
    .join('');
  const total = data.materialGroups.reduce((n, g) => n + g.rows.length, 0);
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Inventory Summary</h2>
  <table class="kv">
    ${rows}
    <tr class="total-row"><th>Total</th><td style="text-align:right;">${total}</td></tr>
  </table>
</section>`;
}

// ─── Per-deck breakdown ───────────────────────────────────────────────────
// One <section class="page"> per deck. Materials grouped by location
// (deck name); Unmapped go into a trailing "Unassigned" section.
function renderPerDeckPages(data: ReportData): string {
  const allMaterials: MaterialRow[] = data.materialGroups.flatMap((g) =>
    g.rows.map((r) => ({ ...r, _partLabel: partLabelOf(g.groupKey) } as MaterialRow & { _partLabel: string })),
  );

  // Bucket by location (deck name). Empty location → 'Unassigned'.
  const byDeck = new Map<string, Array<MaterialRow & { _partLabel: string }>>();
  for (const m of allMaterials as Array<MaterialRow & { _partLabel: string }>) {
    const key = (m.location || '').trim() || 'Unassigned';
    if (!byDeck.has(key)) byDeck.set(key, []);
    byDeck.get(key)!.push(m);
  }

  if (byDeck.size === 0) {
    return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Materials by Deck</h2>
  <div class="none-found">No materials mapped on this vessel yet.</div>
</section>`;
  }

  const asOf = data.period.end;
  const pages: string[] = [];
  for (const [deckName, mats] of byDeck.entries()) {
    const rows = mats
      .map((m, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${esc(m.name)}</td>
          <td>${esc((m as MaterialRow & { _partLabel: string })._partLabel)}</td>
          <td>${esc(m.classification) || '&mdash;'}</td>
          <td>${esc(m.qty) || '&mdash;'}</td>
          <td style="text-align:center;">${esc(m.createdOn)}</td>
          <td style="text-align:center;">${daysInInventory(m.createdOn, asOf)}</td>
          <td style="text-align:center;">${esc(m.status)}</td>
        </tr>`)
      .join('');
    pages.push(`
<section class="page">
  ${BRAND_HEADER}
  <h3>Deck &mdash; ${esc(deckName)} <span class="badge-soft">${mats.length} materials</span></h3>
  <table class="details inventory-table">
    <thead>
      <tr>
        <th style="width:10mm;">No.</th>
        <th>Name</th>
        <th style="width:18mm;">IHM Part</th>
        <th>Hazmat</th>
        <th>Qty</th>
        <th style="width:24mm;">Created On</th>
        <th style="width:18mm;">Days In</th>
        <th style="width:24mm;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`);
  }
  return pages.join('');
}

const EXTRA_CSS = `
table.kv { font-size: 11pt; width: 60%; }
table.kv th { width: 60%; text-align: left; }
table.kv .total-row th, table.kv .total-row td { background: #F2F2F2; font-weight: 700; }
.badge-soft {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  background: #E0F2FE;
  color: #075985;
  border-radius: 999px;
  font-size: 9pt;
  font-weight: 700;
  vertical-align: middle;
}
table.details.inventory-table { font-size: 9pt; }
table.details.inventory-table tbody tr { page-break-inside: avoid; }
`;

// ─── Main entry ───────────────────────────────────────────────────────────
export function renderMaterialsInventoryHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Enviguide IHM &mdash; Detailed Materials Inventory Report</title>
<style>${STYLESHEET}${EXTRA_CSS}</style>
</head>
<body>
${renderCoverPage(data, 'Detailed Materials Inventory Report')}
${renderSpecsPage(data)}
${renderInventorySummaryPage(data)}
${renderPerDeckPages(data)}
${renderHmMarkedDecksPages(data.materialGroups)}
${DECK_CROP_SCRIPT}
</body>
</html>`;
}
