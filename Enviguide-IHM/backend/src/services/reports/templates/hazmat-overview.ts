// ─── Global Hazmat Overview Report — HTML template ────────────────────────
// Risk-focused dossier. The Compliance/Inventory reports cover legal +
// inventory state; this one is the hazmat-only dashboard for the
// HSEQ/EHS desk.
//
// Pages (in order):
//   1. Cover                — brand header, title, vessel line, photo,
//                             meta table, compliance references.
//   2. Vessel Specifications — owner/ship details table.
//   3. Hazmat Dashboard      — 16 colour tiles + non-zero pie.
//   4. Threshold Flags       — compounds bucketed by severity (Normal /
//                              Elevated / Critical) with the count next
//                              to each. Thresholds are a fixed product
//                              decision: 1-3 Normal, 4-9 Elevated, 10+
//                              Critical. None = 0.
//   5. Risk Hotspots         — top 5 decks ranked by total hazmat-bearing
//                              materials. Helps the EHS lead prioritise
//                              walk-downs.
//   6. Compound Locations    — for each non-zero compound, the list of
//                              decks (and counts) where it lives.

import type { ReportData, MaterialRow, HazmatTile } from '../data.js';
import {
  esc,
  BRAND_HEADER,
  STYLESHEET,
  tileBg,
  tileInk,
  renderHazmatTiles,
  renderPieChart,
  renderCoverPage,
  renderSpecsPage,
} from './quarterly-compliance.js';

type Severity = 'None' | 'Normal' | 'Elevated' | 'Critical';

function severityOf(count: number): Severity {
  if (count <= 0) return 'None';
  if (count <= 3) return 'Normal';
  if (count <= 9) return 'Elevated';
  return 'Critical';
}

const SEVERITY_COLOURS: Record<Severity, { bg: string; ink: string }> = {
  None:     { bg: '#E2E8F0', ink: '#475569' },
  Normal:   { bg: '#DCFCE7', ink: '#166534' },
  Elevated: { bg: '#FEF3C7', ink: '#92400E' },
  Critical: { bg: '#FEE2E2', ink: '#991B1B' },
};

// ─── Hazmat Dashboard ─────────────────────────────────────────────────────
function renderHazmatDashboardPage(data: ReportData): string {
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Ship Hazmat Overview</h2>
  <div class="hazmat-section">
    <div class="hazmat-grid-wrap">
      <div class="hazmat-grid">${renderHazmatTiles(data.hazmatOverview)}</div>
    </div>
    ${renderPieChart(data.hazmatOverview)}
  </div>
</section>`;
}

// ─── Threshold Flags ──────────────────────────────────────────────────────
function renderThresholdFlagsPage(data: ReportData): string {
  // Sort: present first (count desc), then absent.
  const sorted = [...data.hazmatOverview].sort((a, b) => b.count - a.count);
  const rows = sorted
    .map((t) => {
      const sev = severityOf(t.count);
      const sc = SEVERITY_COLOURS[sev];
      return `
        <tr>
          <td>
            <span class="code-chip" style="background:${tileBg(t.code)};color:${tileInk(t.code)}">${esc(t.code)}</span>
            ${esc(t.name)}
          </td>
          <td style="text-align:right;">${t.count}</td>
          <td style="text-align:center;">
            <span class="sev-pill" style="background:${sc.bg};color:${sc.ink}">${sev}</span>
          </td>
        </tr>`;
    })
    .join('');
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Threshold Flags</h2>
  <p class="caption">
    Severity buckets: <b>None</b> = 0 occurrences, <b>Normal</b> = 1&ndash;3,
    <b>Elevated</b> = 4&ndash;9, <b>Critical</b> = 10+.
  </p>
  <table class="details flag-table">
    <thead>
      <tr>
        <th>Compound</th>
        <th style="width:22mm;">Count</th>
        <th style="width:32mm;">Severity</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

// ─── Risk Hotspots ────────────────────────────────────────────────────────
// Group hazmat-bearing materials by deck, sort by count desc, top 5.
function renderRiskHotspotsPage(data: ReportData): string {
  const all: MaterialRow[] = data.materialGroups.flatMap((g) => g.rows);
  const hazmatOnly = all.filter((m) => m.classification && m.classification.trim());
  const byDeck = new Map<string, { count: number; compounds: Set<string> }>();
  for (const m of hazmatOnly) {
    const deck = (m.location || '').trim() || 'Unassigned';
    if (!byDeck.has(deck)) byDeck.set(deck, { count: 0, compounds: new Set() });
    const e = byDeck.get(deck)!;
    e.count += 1;
    e.compounds.add(m.classification.trim());
  }
  const ranked = Array.from(byDeck.entries())
    .map(([deck, e]) => ({ deck, count: e.count, compounds: Array.from(e.compounds) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (ranked.length === 0) {
    return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Risk Hotspots</h2>
  <div class="none-found">No hazmat-bearing materials mapped yet.</div>
</section>`;
  }

  const rows = ranked
    .map((r, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${esc(r.deck)}</td>
        <td style="text-align:right;">${r.count}</td>
        <td>${r.compounds.map((c) => `<span class="cmp-pill">${esc(c)}</span>`).join(' ')}</td>
      </tr>`)
    .join('');

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Risk Hotspots</h2>
  <p class="caption">Top decks ranked by the number of hazmat-bearing materials currently mapped to them.</p>
  <table class="details">
    <thead>
      <tr>
        <th style="width:10mm;">Rank</th>
        <th>Deck</th>
        <th style="width:24mm;">Materials</th>
        <th>Compounds present</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

// ─── Compound → Locations ────────────────────────────────────────────────
function renderCompoundLocationsPage(data: ReportData): string {
  const all: MaterialRow[] = data.materialGroups.flatMap((g) => g.rows);
  const present = data.hazmatOverview.filter((t) => t.count > 0);
  if (present.length === 0) {
    return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Compound Locations</h2>
  <div class="none-found">No hazmat compounds present onboard.</div>
</section>`;
  }

  const blocks = present
    .map((t: HazmatTile) => {
      // Match on classification string (case-insensitive).
      const matched = all.filter(
        (m) => m.classification && m.classification.trim().toLowerCase() === t.name.toLowerCase(),
      );
      const byDeck = new Map<string, number>();
      for (const m of matched) {
        const deck = (m.location || '').trim() || 'Unassigned';
        byDeck.set(deck, (byDeck.get(deck) || 0) + 1);
      }
      const decksList = Array.from(byDeck.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([deck, n]) => `<li><b>${esc(deck)}</b> &mdash; ${n}</li>`)
        .join('');

      return `
        <div class="compound-card">
          <div class="compound-head">
            <span class="code-chip" style="background:${tileBg(t.code)};color:${tileInk(t.code)}">${esc(t.code)}</span>
            <span class="compound-name">${esc(t.name)}</span>
            <span class="compound-total">${t.count} total</span>
          </div>
          <ul class="compound-list">${decksList || '<li class="muted">No deck mapped</li>'}</ul>
        </div>`;
    })
    .join('');

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Compound Locations</h2>
  <p class="caption">For each present compound, the decks where instances are mapped (with counts).</p>
  <div class="compound-grid">${blocks}</div>
</section>`;
}

const EXTRA_CSS = `
.caption { font-size: 9.5pt; color: #475569; margin: 2mm 0 4mm; }
.code-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 9pt;
  margin-right: 6px;
  min-width: 28px;
  text-align: center;
}
.sev-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 9pt;
}
.cmp-pill {
  display: inline-block;
  padding: 1px 7px;
  margin: 1px 2px;
  border-radius: 3px;
  background: #F1F5F9;
  color: #334155;
  font-size: 8.5pt;
}
table.flag-table tbody tr { page-break-inside: avoid; }
.compound-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
  margin-top: 2mm;
}
.compound-card {
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 3mm 4mm;
  page-break-inside: avoid;
}
.compound-head {
  display: flex;
  align-items: center;
  margin-bottom: 2mm;
  padding-bottom: 2mm;
  border-bottom: 1px solid #E2E8F0;
}
.compound-name { font-weight: 700; flex: 1; }
.compound-total {
  font-size: 9pt;
  color: #64748B;
  font-weight: 700;
}
.compound-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 9.5pt;
}
.compound-list li {
  padding: 1px 0 1px 8px;
  position: relative;
}
.compound-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #94A3B8;
}
.compound-list li.muted { color: #94A3B8; font-style: italic; }
`;

export function renderHazmatOverviewHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Enviguide IHM &mdash; Global Hazmat Overview Report</title>
<style>${STYLESHEET}${EXTRA_CSS}</style>
</head>
<body>
${renderCoverPage(data, 'Global Hazmat Overview Report')}
${renderSpecsPage(data)}
${renderHazmatDashboardPage(data)}
${renderThresholdFlagsPage(data)}
${renderRiskHotspotsPage(data)}
${renderCompoundLocationsPage(data)}
</body>
</html>`;
}
