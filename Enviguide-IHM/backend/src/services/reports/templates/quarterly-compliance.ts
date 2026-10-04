// ─── IHM Report — HTML template ───────────────────────────────────────────
// Renders the finalized A4 IHM compliance report. Structure mirrors the
// Hong Kong Convention / EU-SRR / MEPC Res. 379(80) / EMSA standard layout.
//
// Pages (in order):
//   1. Cover                — brand header, title, vessel line, photo,
//                             meta table, compliance references.
//   2. Vessel Specifications — owner/ship details table.
//   3. Table of Contents     — dotted-leader TOC.
//   4. IHM Movement          — quarterly delta table + summary.
//   5. Ship Hazmat Overview  — 16-tile colored grid + dynamic pie chart.
//   6. IHM Details           — Part I (I-1, I-2, I-3), Part II, Part III
//                              with legend box and 10-column table.
//   7+ HM Marked Decks       — one page per material that has a GA plan
//                              + pin coordinates (others are skipped).
//
// Puppeteer renders this as the document body; per-page IMO + page number
// are injected via Puppeteer's footerTemplate option (see footerTemplate()
// below). CSS @page named-content rules are intentionally not used —
// Puppeteer ignores them.

import type {
  ReportData, MaterialRow, MaterialGroup, HazmatTile,
} from '../data.js';

// ─── HTML escape ──────────────────────────────────────────────────────────
export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const dash = (s: string | null | undefined) => (s && String(s).trim() ? esc(s) : '&mdash;');

// ─── Hazmat tile colours (from finalized template) ────────────────────────
// Each entry maps the catalog `code` to {bg, ink}. Used for both the
// dashboard tiles and the pie-chart slices so the legend matches.
const TILE_COLOURS: Record<string, { bg: string; ink: string }> = {
  Asb:   { bg: '#4DA6E0', ink: '#FFFFFF' },
  PCB:   { bg: '#8B4F9F', ink: '#FFFFFF' },
  ODS:   { bg: '#F4D03F', ink: '#FFFFFF' },
  OC:    { bg: '#A8E6CF', ink: '#2A6B4F' },
  Cd:    { bg: '#F08C3C', ink: '#FFFFFF' },
  Cr:    { bg: '#8B2E2E', ink: '#FFFFFF' },
  Pb:    { bg: '#E8C547', ink: '#5A4500' },
  Hg:    { bg: '#B8B8B8', ink: '#333333' },
  PBB:   { bg: '#E8C5E0', ink: '#6B3A60' },
  PBDE:  { bg: '#7FD9E8', ink: '#1F5F6B' },
  PCN:   { bg: '#E84C9A', ink: '#FFFFFF' },
  RM:    { bg: '#C5E84C', ink: '#4F6320' },
  CSCP:  { bg: '#3FA858', ink: '#FFFFFF' },
  PFOS:  { bg: '#F5C5C5', ink: '#7A3030' },
  HBCDD: { bg: '#3F7C7C', ink: '#FFFFFF' },
  Cb:    { bg: '#5DCFC0', ink: '#1F5752' },
};

export const tileBg  = (code: string) => TILE_COLOURS[code]?.bg  ?? '#94A3B8';
export const tileInk = (code: string) => TILE_COLOURS[code]?.ink ?? '#FFFFFF';

// ─── Brand header (used on every page) ────────────────────────────────────
export const BRAND_HEADER = `
<div class="brand-header">
  <div class="brand-logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v13"/>
      <path d="M5 12a7 7 0 0 0 14 0"/>
      <path d="M9 12H5"/>
      <path d="M19 12h-4"/>
    </svg>
  </div>
  <div class="brand-text">
    <div class="brand-name">Enviguide<span> IHM</span></div>
    <div class="brand-tagline">Inventory of Hazardous Materials | Maritime Compliance</div>
  </div>
</div>`;

// ─── Pie chart (dynamic, by hazmat counts) ────────────────────────────────
// Builds an SVG pie from the non-zero hazmat tiles. Each slice's colour
// comes from TILE_COLOURS so the legend matches the dashboard above.
export function renderPieChart(overview: HazmatTile[]): string {
  const slices = overview.filter((t) => t.count > 0);
  const total = slices.reduce((sum, t) => sum + t.count, 0);

  if (total === 0 || slices.length === 0) {
    return `
      <div class="pie-wrapper">
        <div class="pie-empty">No hazmat compounds present</div>
      </div>`;
  }

  // Single-slice case — degenerate path, draw a full circle instead.
  if (slices.length === 1) {
    const s = slices[0]!; // length === 1 guaranteed by the check above
    return `
      <div class="pie-wrapper">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="50" fill="${tileBg(s.code)}"/>
        </svg>
        <div class="pie-labels">
          <div><span class="swatch" style="background:${tileBg(s.code)}"></span>${esc(s.code)} - ${s.count}</div>
        </div>
      </div>`;
  }

  let cumulative = 0;
  const paths: string[] = [];
  for (const s of slices) {
    const fraction = s.count / total;
    const startAngle = cumulative * 2 * Math.PI;
    const endAngle = (cumulative + fraction) * 2 * Math.PI;
    cumulative += fraction;

    // Convert polar (radius=50, centre=50,50) to cartesian. SVG y-axis
    // is flipped so subtract from 50 to draw clockwise from 12 o'clock.
    const x1 = 50 + 50 * Math.sin(startAngle);
    const y1 = 50 - 50 * Math.cos(startAngle);
    const x2 = 50 + 50 * Math.sin(endAngle);
    const y2 = 50 - 50 * Math.cos(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    paths.push(
      `<path d="M 50,50 L ${x1.toFixed(2)},${y1.toFixed(2)} A 50,50 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${tileBg(s.code)}"/>`,
    );
  }

  const labels = slices
    .map((s) => `<div><span class="swatch" style="background:${tileBg(s.code)}"></span>${esc(s.code)} - ${s.count}</div>`)
    .join('');

  return `
    <div class="pie-wrapper">
      <svg viewBox="0 0 100 100">${paths.join('')}</svg>
      <div class="pie-labels">${labels}</div>
    </div>`;
}

// ─── Hazmat tile grid (16 tiles, all rendered, dimmed when count === 0) ──
export function renderHazmatTiles(overview: HazmatTile[]): string {
  return overview
    .map((t) => {
      const dim = t.count === 0 ? ' zero' : '';
      const bg = tileBg(t.code);
      const ink = tileInk(t.code);
      return `
        <div class="hazmat-tile${dim}" style="background:${bg};color:${ink}">
          <div class="tile-label">${esc(t.name)} - ${esc(t.code)}</div>
          <div class="tile-count">${t.count}</div>
        </div>`;
    })
    .join('');
}

// ─── Material rows (Part I-1 / I-2 / I-3 / II / III) ──────────────────────
function renderMaterialTable(group: MaterialGroup, startNo = 1): string {
  if (!group.rows || group.rows.length === 0) {
    return `<div class="none-found">None of the relevant materials have been identified onboard</div>`;
  }
  const rows = group.rows
    .map((r, i) => `
      <tr>
        <td style="text-align:center;">${startNo + i}</td>
        <td style="text-align:center;">${esc(r.createdOn)}</td>
        <td style="text-align:center;">${esc(r.updatedOn)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.location)}</td>
        <td>${esc(r.classification)}</td>
        <td>${esc(r.qty)}</td>
        <td>${esc(r.partsWhereUsed)}</td>
        <td>${esc(r.remarks)}</td>
        <td>${esc(r.status)}</td>
      </tr>`)
    .join('');
  return `
    <table class="details">
      <thead>
        <tr>
          <th>No.</th>
          <th>Created On</th>
          <th>Updated On</th>
          <th>Name</th>
          <th>Location</th>
          <th>Material<br/>(Appendix 1)</th>
          <th>Apprx. Qty<br/>Qty-UOM</th>
          <th>Parts where used</th>
          <th>Remarks</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── HM Marked Decks pages ────────────────────────────────────────────────
// One page per *deck area* — each page shows just that deck's region
// of the GA plan (cropped from the full image), with numbered pin
// markers and a legend table below. The full GA plan is never rendered
// in the report; the deck_areas.x/y/width/height rect on each material
// drives a CSS-based crop so the reader sees the relevant deck only.
export function renderHmMarkedDecksPages(groups: MaterialGroup[]): string {
  const allMaterials: MaterialRow[] = groups.flatMap((g) => g.rows);
  // Only materials with both a GA plan and a deck-area rect can be
  // cropped — without the rect we have nothing to crop to.
  const withRect = allMaterials.filter((m) => m.gaPlanUrl && m.rect);
  if (withRect.length === 0) return '';

  // Group by (gaPlanUrl, rect). Same rect = same deck area, even if
  // multiple materials live there.
  const byArea = new Map<string, MaterialRow[]>();
  for (const m of withRect) {
    const r = m.rect!;
    const key = `${m.gaPlanUrl}|${r.x.toFixed(2)},${r.y.toFixed(2)},${r.w.toFixed(2)},${r.h.toFixed(2)}`;
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key)!.push(m);
  }

  const pages: string[] = [];
  for (const [, materials] of byArea.entries()) {
    const m0 = materials[0]!;
    const rect = m0.rect!;
    const planUrl = m0.gaPlanUrl!;
    const deckName = m0.location || m0.gaPlanName || 'Deck';

    // Pins in deck-area-local fractional coordinates [0..1].
    // pinX/pinY are stored in image pixel space; subtract the rect
    // origin and divide by rect size. If the data is already
    // fractional (legacy 0-1 of the full image), we can't recover the
    // rect-relative position without image dims — fall back to rect
    // centre in that case.
    const looksLikePixels = materials.some(
      (m) => (m.pinX !== null && m.pinX > 1) || (m.pinY !== null && m.pinY > 1),
    );

    const markers = materials
      .map((m, idx) => {
        let leftFrac = 0.5;
        let topFrac = 0.5;
        if (m.pinX !== null && m.pinY !== null && looksLikePixels) {
          leftFrac = (m.pinX - rect.x) / rect.w;
          topFrac = (m.pinY - rect.y) / rect.h;
          // Clamp so a stray pin can't escape the cropped frame.
          leftFrac = Math.max(0, Math.min(1, leftFrac));
          topFrac = Math.max(0, Math.min(1, topFrac));
        }
        return `<div class="pin-number" style="left:${(leftFrac * 100).toFixed(2)}%; top:${(topFrac * 100).toFixed(2)}%;">${idx + 1}</div>`;
      })
      .join('');

    const legendRows = materials
      .map((m, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${esc(m.name)}</td>
          <td>${esc(m.classification) || '&mdash;'}</td>
          <td>${esc(m.qty) || '&mdash;'}</td>
          <td>${esc(m.status)}</td>
        </tr>`)
      .join('');

    pages.push(`
<section class="page">
  ${BRAND_HEADER}
  <h3>HM Marked Decks &mdash; ${esc(deckName)}</h3>
  <div class="deck-frame"
       data-rx="${rect.x}" data-ry="${rect.y}"
       data-rw="${rect.w}" data-rh="${rect.h}"
       style="aspect-ratio: ${rect.w.toFixed(2)} / ${rect.h.toFixed(2)};">
    <img class="deck-bg" src="${esc(planUrl)}" alt="" />
    ${markers}
  </div>
  <table class="hm-legend">
    <thead>
      <tr>
        <th style="width:10mm;">No</th>
        <th>Name</th>
        <th>Hazmat</th>
        <th>Qty</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${legendRows}</tbody>
  </table>
</section>`);
  }
  return pages.join('');
}

// Inline script that runs at render time inside Puppeteer. Each
// .deck-frame holds an <img> of the *full* GA plan plus the rect's
// pixel coordinates in data-r{x,y,w,h}. Once the image has loaded
// (so naturalWidth/Height are known) we set the img to its natural
// size scaled so that rect.w fills the frame width, and shift it so
// the rect aligns with the frame's top-left corner. The frame has
// overflow:hidden so only the rect region is visible. Pins above the
// img are positioned in % of the frame, which already maps 1:1 to
// rect-local fractions because the frame IS the rect view.
//
// Exposes window.__cropDeckFrames so the PDF renderer can invoke it
// after images decode, removing any race between image-load events
// and Puppeteer's pdf() call.
export const DECK_CROP_SCRIPT = `
<script>
(function () {
  function fit(frame) {
    var img = frame.querySelector('.deck-bg');
    if (!img || !img.naturalWidth) return;
    var rx = parseFloat(frame.dataset.rx);
    var ry = parseFloat(frame.dataset.ry);
    var rw = parseFloat(frame.dataset.rw);
    var cw = frame.clientWidth;
    if (!cw || !rw) return;
    var scale = cw / rw;
    img.style.width  = (img.naturalWidth  * scale) + 'px';
    img.style.height = (img.naturalHeight * scale) + 'px';
    img.style.left   = (-rx * scale) + 'px';
    img.style.top    = (-ry * scale) + 'px';
  }
  window.__cropDeckFrames = function () {
    document.querySelectorAll('.deck-frame').forEach(function (frame) { fit(frame); });
  };
  function init() {
    document.querySelectorAll('.deck-frame').forEach(function (frame) {
      var img = frame.querySelector('.deck-bg');
      if (!img) return;
      if (img.complete && img.naturalWidth > 0) fit(frame);
      else img.addEventListener('load', function () { fit(frame); });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;

// ─── Vessel photograph block ──────────────────────────────────────────────
// Uses the real image when available; otherwise falls back to the
// gradient placeholder from the finalized template.
export function renderVesselPhoto(image: string | null): string {
  if (image && image.trim()) {
    return `<div class="ship-image-real" style="background-image:url('${esc(image)}')"></div>`;
  }
  return `<div class="ship-image-placeholder"><span>Vessel Photograph</span></div>`;
}

// ─── Cover page ───────────────────────────────────────────────────────────
export function renderCoverPage(data: ReportData, title = 'IHM Report'): string {
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} - ${data.period.end.toLocaleDateString('en-GB')}`;
  return `
<section class="page">
  ${BRAND_HEADER}
  <div class="cover-title">
    <div class="report-heading">${esc(title)} (${esc(periodLabel)})</div>
    <div class="vessel-line">${esc(data.vessel.name)} (IMO : ${esc(data.vessel.imoNumber)})</div>
  </div>
  ${renderVesselPhoto(data.vessel.image)}
  <table class="cover-meta">
    <tr><th>Document Number:</th><td>${esc(data.docNumber)}</td></tr>
    <tr><th>Version #:</th><td>1.0.0</td></tr>
    <tr><th>Generated By:</th><td>${esc(data.generatedBy) || 'Enviguide IHM'}</td></tr>
    <tr><th>Date of Report Generation:</th><td>${esc(data.generatedAt)}</td></tr>
    <tr><th>SOC Reference:</th><td>${dash(data.vessel.socReference)}</td></tr>
    <tr><th>Initial IHM Reference:</th><td>${dash(data.vessel.ihmReference)}</td></tr>
  </table>
  <div class="compliance-block">
    <div class="label">According to:</div>
    <ul>
      <li>Hong Kong International Convention for the Safe and Environmentally Sound Recycling of Ships (SR/CONF 45)</li>
      <li>Guidelines for the Preparation of Inventory of Hazardous Materials (MEPC Res. 379(80))</li>
      <li>EU Regulation on Ship Recycling (EU-SRR No. 1257/2013)</li>
      <li>EMSA's Best Practice Guidance on the Inventory of Hazardous Materials</li>
    </ul>
  </div>
</section>`;
}

// ─── Vessel specifications page ───────────────────────────────────────────
export function renderSpecsPage(data: ReportData): string {
  const v = data.vessel;
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Vessel Specifications and Ship Owner Information</h2>
  <table class="specs">
    <tr><th>IMO Number</th><td>${esc(v.imoNumber)}</td></tr>
    <tr><th>Name of Ship</th><td>${esc(v.name)}</td></tr>
    <tr><th>Type</th><td>${dash(v.vesselType)}</td></tr>
    <tr><th>Flag State</th><td>${dash(v.flagState)}</td></tr>
    <tr><th>Port of Registry</th><td>${dash(v.portOfRegistry)}</td></tr>
    <tr><th>Vessel Class</th><td>${dash(v.vesselClass)}</td></tr>
    <tr><th>Gross Tonnage (GT)</th><td>${dash(v.grossTonnage)}</td></tr>
    <tr><th>Date Built</th><td>${dash(v.keelLaidDate)}</td></tr>
    <tr><th>Date Delivered</th><td>${dash(v.deliveryDate)}</td></tr>
    <tr><th>Ship Builder</th><td>${dash(v.shipBuilder)}</td></tr>
    <tr><th>Ship Owner</th><td>${dash(v.registeredOwner)}</td></tr>
    <tr><th>Ship Manager</th><td>${dash(v.shipManager)}</td></tr>
  </table>
</section>`;
}

// ─── Table of Contents ────────────────────────────────────────────────────
function renderTocPage(): string {
  return `
<section class="page">
  ${BRAND_HEADER}
  <h3>Table of Contents</h3>
  <ul class="toc-list">
    <li><span class="toc-name">IHM Movement</span><span class="toc-dots"></span><span class="toc-pg">1</span></li>
    <li><span class="toc-name">Ship Hazmat Overview</span><span class="toc-dots"></span><span class="toc-pg">2</span></li>
    <li><span class="toc-name">IHM Details</span><span class="toc-dots"></span><span class="toc-pg">3</span></li>
    <li><span class="toc-name">HM Marked Decks</span><span class="toc-dots"></span><span class="toc-pg">12</span></li>
  </ul>
</section>`;
}

// ─── IHM Movement page ────────────────────────────────────────────────────
function renderMovementPage(data: ReportData): string {
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} to ${data.period.end.toLocaleDateString('en-GB')}`;
  // Movement rows come from the data layer in Part I-1, I-2, I-3, II, III
  // order — match that shape to the labels expected by the template.
  const labels = ['Part I &ndash; I1', 'Part I &ndash; I2', 'Part I &ndash; I3', 'Part II', 'Part III'];
  const rows = data.movement
    .map((m, i) => `
      <tr>
        <th>${labels[i] ?? esc(m.partLabel)}</th>
        <td>${m.startCount}</td>
        <td>${m.added}</td>
        <td>${m.updated}</td>
        <td>0</td>
        <td>${m.endCount}</td>
      </tr>`)
    .join('');
  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>IHM Movement (${esc(periodLabel)})</h2>
  <table class="movement">
    <thead>
      <tr>
        <th></th>
        <th>Total number of HMs<br/>"Date" (Last Quarter)</th>
        <th>HMs Added in<br/>this Quarter</th>
        <th>HMs Relocated<br/>in this Quarter</th>
        <th>HMs Landed<br/>ashore</th>
        <th>Total number of HMs "Date"<br/>(Present Quarter)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="summary">
    <tr><th>Number of POs Received in this Quarter</th><td>${data.totals.posReceivedInQuarter}</td></tr>
    <tr><th>No of MDs and SDoCs requested in this quarter</th><td>${data.totals.docsRequested}</td></tr>
    <tr><th>No of MDs and SDoCs received in this quarter</th><td>${data.totals.docsReceived}</td></tr>
  </table>
</section>`;
}

// ─── Hazmat Overview page ─────────────────────────────────────────────────
function renderHazmatPage(data: ReportData): string {
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

// ─── Purchase Orders page ────────────────────────────────────────────────
// Full listing of POs received in the period, with supplier, date,
// item count, amount, status and a count of suspected-hazmat lines so
// the reader can see at a glance which POs need further attention.
export function renderPurchaseOrdersPage(data: ReportData): string {
  // If there are no POs in the period, skip the section entirely so we
  // don't waste a page on a "none" placeholder. The Movement page's
  // "POs received in this Quarter: 0" already conveys the information.
  if (!data.purchaseOrders || data.purchaseOrders.length === 0) return '';
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} to ${data.period.end.toLocaleDateString('en-GB')}`;

  const rows = data.purchaseOrders
    .map((p, i) => {
      const flag = p.suspectedCount > 0
        ? `<span class="po-flag">${p.suspectedCount} suspected</span>`
        : `<span class="po-flag clean">Clean</span>`;
      return `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${esc(p.poNumber)}</td>
          <td>${esc(p.supplier) || '&mdash;'}</td>
          <td style="text-align:center;">${esc(p.poDate)}</td>
          <td style="text-align:center;">${esc(p.receivedOn)}</td>
          <td style="text-align:center;">${p.totalItems}</td>
          <td>${esc(p.sampleItem) || '&mdash;'}</td>
          <td style="text-align:center;">${flag}</td>
        </tr>`;
    })
    .join('');

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Purchase Orders (${esc(periodLabel)})</h2>
  <table class="details po-table">
    <thead>
      <tr>
        <th style="width:10mm;">No.</th>
        <th style="width:34mm;">PO Number</th>
        <th>Supplier</th>
        <th style="width:22mm;">PO Date</th>
        <th style="width:22mm;">Received On</th>
        <th style="width:14mm;">Items</th>
        <th>Sample item</th>
        <th style="width:24mm;">Hazmat</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

// ─── MD/SDoC Tracking page ───────────────────────────────────────────────
// Surfaces clarification-request KPIs (vendors contacted, submitted vs
// pending, reminders sent) and a per-vendor breakdown so the reader
// can see which suppliers still owe documentation.
export function renderMdSdocPage(data: ReportData): string {
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} to ${data.period.end.toLocaleDateString('en-GB')}`;
  const t = data.mdSdoc.totals;
  if (t.totalRequests === 0) return '';

  const respondPct =
    t.totalRequests > 0
      ? `${Math.round((t.submittedRequests / t.totalRequests) * 100)}%`
      : '—';

  const kpis = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-num">${t.distinctVendors}</div><div class="kpi-label">Vendors contacted</div></div>
      <div class="kpi-card"><div class="kpi-num">${t.totalRequests}</div><div class="kpi-label">Clarification requests</div></div>
      <div class="kpi-card good"><div class="kpi-num">${t.submittedRequests}</div><div class="kpi-label">Submitted by vendor</div></div>
      <div class="kpi-card warn"><div class="kpi-num">${t.pendingRequests}</div><div class="kpi-label">Awaiting response</div></div>
      <div class="kpi-card"><div class="kpi-num">${t.totalReminders}</div><div class="kpi-label">Reminders sent</div></div>
      <div class="kpi-card"><div class="kpi-num">${respondPct}</div><div class="kpi-label">Response rate</div></div>
    </div>
    <table class="summary md-totals">
      <tr><th>MDs received / requested</th><td>${t.mdsReceived} / ${t.mdsReceived + t.mdsPending}</td></tr>
      <tr><th>SDoCs received / requested</th><td>${t.sdocsReceived} / ${t.sdocsReceived + t.sdocsPending}</td></tr>
      <tr><th>Total line items in clarifications</th><td>${t.totalItems}</td></tr>
    </table>`;

  const vendorRows = data.mdSdoc.byVendor
    .map((v, i) => {
      const respondedAll = v.pending === 0 && v.submitted > 0;
      const statusBadge = respondedAll
        ? `<span class="po-flag clean">Submitted</span>`
        : v.submitted > 0
          ? `<span class="po-flag partial">Partial</span>`
          : `<span class="po-flag">Awaiting</span>`;
      return `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${esc(v.vendor)}<div class="vendor-email">${esc(v.email)}</div></td>
          <td style="text-align:center;">${v.totalRequests}</td>
          <td style="text-align:center;">${v.submitted}</td>
          <td style="text-align:center;">${v.pending}</td>
          <td style="text-align:center;">${v.reminders}</td>
          <td style="text-align:center;">${v.mdsReceived} / ${v.mdsRequested}</td>
          <td style="text-align:center;">${v.sdocsReceived} / ${v.sdocsRequested}</td>
          <td style="text-align:center;">${esc(v.lastSentAt)}</td>
          <td style="text-align:center;">${statusBadge}</td>
        </tr>`;
    })
    .join('');

  const vendorBlock = data.mdSdoc.byVendor.length > 0
    ? `
      <h3>By Vendor</h3>
      <table class="details md-vendor-table">
        <thead>
          <tr>
            <th style="width:9mm;">No.</th>
            <th>Vendor</th>
            <th style="width:20mm;">Requests</th>
            <th style="width:20mm;">Submitted</th>
            <th style="width:20mm;">Pending</th>
            <th style="width:20mm;">Reminders</th>
            <th style="width:24mm;">MDs (recv/req)</th>
            <th style="width:24mm;">SDoCs (recv/req)</th>
            <th style="width:22mm;">Last Sent</th>
            <th style="width:22mm;">Status</th>
          </tr>
        </thead>
        <tbody>${vendorRows}</tbody>
      </table>`
    : '';

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>MD &amp; SDoC Tracking (${esc(periodLabel)})</h2>
  ${kpis}
  ${vendorBlock}
</section>`;
}

// ─── Suspected Hazmat — by Supplier page ─────────────────────────────────
// Drill-down for the suspected items called out in the main PO listing.
// Grouped per supplier so the reader can see at a glance which vendors
// are responsible for the suspected-hazmat lines.
export function renderSuspectedHazmatPage(data: ReportData): string {
  if (!data.suspectedItems || data.suspectedItems.length === 0) return '';
  const periodLabel = `${data.period.start.toLocaleDateString('en-GB')} to ${data.period.end.toLocaleDateString('en-GB')}`;

  // Group items by supplier preserving the SQL ORDER BY (already
  // supplier-sorted, so a single pass keeps suppliers in alpha order).
  const bySupplier = new Map<string, typeof data.suspectedItems>();
  for (const item of data.suspectedItems) {
    if (!bySupplier.has(item.supplier)) bySupplier.set(item.supplier, []);
    bySupplier.get(item.supplier)!.push(item);
  }

  const supplierBlocks = Array.from(bySupplier.entries())
    .map(([supplier, items]) => {
      const distinctPoNumbers = new Set(items.map((i) => i.poNumber)).size;
      const rows = items
        .map((it, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${esc(it.poNumber)}</td>
            <td style="text-align:center;">${esc(it.poDate)}</td>
            <td>${esc(it.itemDescription) || '&mdash;'}</td>
            <td>${esc(it.equipment) || '&mdash;'}</td>
            <td>${esc(it.maker) || '&mdash;'}</td>
            <td>${esc(it.partNumber) || '&mdash;'}</td>
            <td style="text-align:center;">${esc(it.quantity)}${it.unit ? ' ' + esc(it.unit) : ''}</td>
          </tr>`)
        .join('');
      return `
        <div class="supplier-block">
          <div class="supplier-head">
            <span class="supplier-name">${esc(supplier)}</span>
            <span class="supplier-stat">${items.length} suspected ${items.length === 1 ? 'item' : 'items'} across ${distinctPoNumbers} ${distinctPoNumbers === 1 ? 'PO' : 'POs'}</span>
          </div>
          <table class="details suspected-table">
            <thead>
              <tr>
                <th style="width:9mm;">No.</th>
                <th style="width:32mm;">PO Number</th>
                <th style="width:20mm;">PO Date</th>
                <th>Item Description</th>
                <th>Equipment</th>
                <th>Maker</th>
                <th>Part #</th>
                <th style="width:18mm;">Qty</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>Suspected Hazmat &mdash; By Supplier (${esc(periodLabel)})</h2>
  <p class="caption">${data.suspectedItems.length} suspected line ${data.suspectedItems.length === 1 ? 'item' : 'items'} across ${bySupplier.size} ${bySupplier.size === 1 ? 'supplier' : 'suppliers'}. Each block below lists every line item the audit flagged as suspected for that supplier.</p>
  ${supplierBlocks}
</section>`;
}

// ─── IHM Details page ─────────────────────────────────────────────────────
function renderDetailsPage(data: ReportData): string {
  const findGroup = (key: MaterialGroup['groupKey']) =>
    data.materialGroups.find((g) => g.groupKey === key)
      ?? { groupKey: key, title: '', rows: [] };

  const i1 = findGroup('I-1');
  const i2 = findGroup('I-2');
  const i3 = findGroup('I-3');
  const partII = findGroup('II');
  const partIII = findGroup('III');

  // Continuous numbering across the three Part I sub-sections so the user
  // can read row numbers as a vessel-wide index.
  let no = 1;
  const i1Block = renderMaterialTable(i1, no);
  no += i1.rows.length;
  const i2Block = renderMaterialTable(i2, no);
  no += i2.rows.length;
  const i3Block = renderMaterialTable(i3, no);
  no += i3.rows.length;

  // Part II / III start their own numbering — they are conceptually
  // separate inventories.
  const partIIBlock  = renderMaterialTable(partII, 1);
  const partIIIBlock = renderMaterialTable(partIII, 1);

  return `
<section class="page">
  ${BRAND_HEADER}
  <h2>IHM Details</h2>
  <h3>Part I Materials contained in ship structure or equipment</h3>
  <div class="legend-box">
    <div class="legend-title">LEGEND</div>
    <div class="legend-row"><b>C/F:</b> Carried forward from last Quarter</div>
    <div class="legend-row"><b>Added:</b> New Addition in the given period</div>
    <div class="legend-row"><b>Removed:</b> Removed in the given period</div>
    <div class="legend-row"><b>MTS:</b> Moved from Part I to Part II or Part III</div>
    <div class="legend-row"><b>MFW:</b> Moved from Part II or Part III to Part I</div>
  </div>
  <h4>I-1 Paints and coating systems</h4>
  ${i1Block}
  <h4 style="clear: both;">I-2 Equipment and machinery</h4>
  ${i2Block}
  <h4>I-3 Structure and hull</h4>
  ${i3Block}
  <h3>Part II Operationally generated wastes</h3>
  ${partIIBlock}
  <h3>Part III Stores</h3>
  ${partIIIBlock}
</section>`;
}

// ─── Stylesheet (inlined — no external deps at render time) ───────────────
export const STYLESHEET = `
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  color: #000;
  font-family: 'Carlito', 'Calibri', sans-serif;
  font-size: 11pt;
  line-height: 1.4;
}

.page { page-break-after: always; padding: 0 14mm; padding-top: 6mm; padding-bottom: 6mm; }
.page:last-child { page-break-after: auto; }

.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10mm;
}
.brand-logo {
  width: 42px; height: 42px;
  background: linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.brand-logo svg { width: 26px; height: 26px; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-name {
  font-weight: 700;
  font-size: 16pt;
  color: #075985;
  letter-spacing: -0.01em;
}
.brand-name span { color: #0EA5E9; }
.brand-tagline {
  font-size: 8pt;
  color: #555555;
  font-weight: 400;
  margin-top: 2px;
}

h1 { font-size: 20pt; font-weight: 700; text-align: center; text-decoration: underline; margin-bottom: 6mm; }
h2 { font-size: 14pt; font-weight: 700; text-align: center; text-decoration: underline; margin: 4mm 0 5mm; }
h3 { font-size: 12pt; font-weight: 700; text-decoration: underline; margin: 5mm 0 3mm; }
h4 { font-size: 11pt; font-weight: 700; margin: 4mm 0 2mm; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5pt;
  margin: 3mm 0;
}
table th, table td {
  border: 1px solid #000;
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}
table th { font-weight: 700; }

table.cover-meta { margin-top: 5mm; }
table.cover-meta th { width: 35%; }

table.specs th { width: 35%; }

table.movement { font-size: 10pt; }
table.movement th, table.movement td {
  text-align: center;
  vertical-align: middle;
  padding: 8px 4px;
}
table.movement tbody th { text-align: left; padding-left: 8px; }

table.summary { width: 70%; margin-top: 4mm; }
table.summary td { width: 60px; text-align: center; }

table.details { font-size: 9pt; }
table.details th, table.details td {
  padding: 4px 5px;
  vertical-align: middle;
}
table.details thead th { text-align: center; line-height: 1.3; }

table.hm-meta { font-size: 10.5pt; }
table.hm-meta th { width: 22%; }

.cover-title { text-align: center; margin-top: 2mm; }
.cover-title .report-heading {
  font-size: 18pt;
  font-weight: 700;
  text-decoration: underline;
  margin-bottom: 4mm;
}
.cover-title .vessel-line {
  font-size: 16pt;
  margin-bottom: 5mm;
}

.ship-image-placeholder {
  width: 100%; height: 60mm;
  margin: 3mm 0 5mm;
  background: linear-gradient(180deg, #B3D9F2 0%, #5FA3D8 60%, #2E7AB8 100%);
  display: flex; align-items: center; justify-content: center;
}
.ship-image-placeholder span {
  background: rgba(0,0,0,0.5);
  color: #FFFFFF;
  padding: 6px 16px;
  font-size: 9pt;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.ship-image-real {
  width: 100%; height: 60mm;
  margin: 3mm 0 5mm;
  background-color: #E2E8F0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.compliance-block { margin-top: 4mm; }
.compliance-block .label { font-weight: 700; margin-bottom: 2mm; }
.compliance-block ul { list-style: none; padding-left: 4mm; }
.compliance-block li {
  padding: 1mm 0 1mm 4mm;
  position: relative;
}
.compliance-block li::before {
  content: "•";
  position: absolute;
  left: 0;
  font-weight: 700;
}

.toc-list { list-style: none; margin-top: 4mm; }
.toc-list li {
  display: flex;
  align-items: baseline;
  font-size: 11pt;
  padding: 2mm 0;
}
.toc-list .toc-name { font-weight: 700; }
.toc-list .toc-dots {
  flex: 1;
  border-bottom: 1px dotted #000;
  margin: 0 4px;
  height: 1px;
}
.toc-list .toc-pg { font-weight: 700; }

.hazmat-section {
  display: flex;
  gap: 6mm;
  margin-top: 3mm;
}
.hazmat-grid-wrap { flex: 1.5; }
.hazmat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}
.hazmat-tile {
  height: 23mm;
  padding: 4px;
  display: flex; flex-direction: column; justify-content: space-between;
  text-align: center;
}
.hazmat-tile .tile-label { font-size: 7pt; font-weight: 700; line-height: 1.15; }
.hazmat-tile .tile-count { font-size: 18pt; font-weight: 700; line-height: 1; }
.hazmat-tile.zero { opacity: 0.55; }

.pie-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6mm;
}
.pie-wrapper svg { width: 50mm; height: 50mm; margin-bottom: 4mm; }
.pie-empty {
  font-style: italic;
  color: #777;
  font-size: 9.5pt;
  text-align: center;
  margin-top: 18mm;
}
.pie-labels { font-size: 9.5pt; }
.pie-labels div {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
  white-space: nowrap;
}
.pie-labels .swatch {
  width: 10px; height: 10px;
  display: inline-block;
  flex-shrink: 0;
}

.legend-box {
  float: right;
  width: 70mm;
  border: 1px solid #BBBBBB;
  padding: 3mm 4mm;
  margin: 0 0 4mm 4mm;
  font-size: 9.5pt;
  font-style: italic;
  background: #F8F8F8;
}
.legend-box .legend-title { font-weight: 700; text-align: center; margin-bottom: 2mm; }
.legend-box .legend-row { line-height: 1.5; }
.legend-box .legend-row b { font-style: normal; }

.none-found {
  font-style: italic;
  font-size: 10.5pt;
  padding: 3mm 0;
  color: #555555;
}

.deck-frame {
  margin-top: 3mm;
  width: 100%;
  max-height: 130mm;
  border: 1px solid #000;
  background-color: #FFFFFF;
  position: relative;
  overflow: hidden;
}
.deck-frame .deck-bg {
  position: absolute;
  display: block;
  /* width / height / left / top set by inline script at render time
     so the rect fills the frame and only that region is visible. */
  max-width: none;
}
.pin-number {
  position: absolute;
  width: 22px; height: 22px;
  background: #F08C3C;
  border: 1.5px solid #FFFFFF;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #FFFFFF;
  font-size: 9pt;
  font-weight: 700;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px #8C4A1F;
}
.hm-legend {
  font-size: 9pt;
  margin-top: 3mm;
  page-break-inside: auto;
}
.hm-legend th, .hm-legend td {
  padding: 3px 5px;
  vertical-align: middle;
}
.hm-legend thead th { text-align: center; }
.hm-legend tbody tr { page-break-inside: avoid; }

table.po-table { font-size: 9pt; }
table.po-table tbody tr { page-break-inside: avoid; }
.po-flag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 8.5pt;
  font-weight: 700;
  background: #FEE2E2;
  color: #991B1B;
}
.po-flag.clean {
  background: #DCFCE7;
  color: #166534;
}

.caption { font-size: 9.5pt; color: #475569; margin: 2mm 0 4mm; }
.supplier-block {
  margin: 4mm 0;
  page-break-inside: avoid;
}
.supplier-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  background: #FEF3C7;
  border-left: 3px solid #F59E0B;
  padding: 2mm 4mm;
  margin-bottom: 1mm;
}
.supplier-name { font-weight: 700; font-size: 11pt; color: #78350F; }
.supplier-stat { font-size: 9pt; color: #92400E; }
table.suspected-table { font-size: 8.5pt; margin-top: 0; }
table.suspected-table tbody tr { page-break-inside: avoid; }

.po-flag.partial { background: #FEF3C7; color: #92400E; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3mm;
  margin: 3mm 0 4mm;
}
.kpi-card {
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 3mm 4mm;
  text-align: center;
  background: #F8FAFC;
  page-break-inside: avoid;
}
.kpi-card.good { background: #DCFCE7; border-color: #86EFAC; }
.kpi-card.warn { background: #FEF3C7; border-color: #FCD34D; }
.kpi-num { font-size: 18pt; font-weight: 700; line-height: 1.1; }
.kpi-label { font-size: 8.5pt; color: #475569; margin-top: 1mm; }

table.summary.md-totals { width: 100%; margin-top: 2mm; }
table.summary.md-totals th { width: 70%; }
table.summary.md-totals td { width: 30%; text-align: center; }

table.md-vendor-table { font-size: 9pt; }
table.md-vendor-table tbody tr { page-break-inside: avoid; }
.vendor-email { font-size: 8pt; color: #64748B; margin-top: 1px; }
`;

// ─── Main entry ───────────────────────────────────────────────────────────
export function renderQuarterlyComplianceHtml(data: ReportData, coverTitle = 'IHM Report'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Enviguide IHM &mdash; ${esc(coverTitle)}</title>
<style>${STYLESHEET}</style>
</head>
<body>
${renderCoverPage(data, coverTitle)}
${renderSpecsPage(data)}
${renderTocPage()}
${renderMovementPage(data)}
${renderHazmatPage(data)}
${renderDetailsPage(data)}
${renderMdSdocPage(data)}
${renderSuspectedHazmatPage(data)}
${renderHmMarkedDecksPages(data.materialGroups)}
${DECK_CROP_SCRIPT}
</body>
</html>`;
}

// ─── Footer template (Puppeteer injects per-page) ─────────────────────────
// Left: IMO • Right: page X of Y. Matches the cover-page convention from
// the finalized template (the @page named-content rules in that HTML are
// dropped because Puppeteer doesn't honor them; this is the equivalent).
export function footerTemplate(data: ReportData): string {
  return `
    <div style="font-family: 'Carlito', 'Calibri', sans-serif; font-size: 9pt; color: #888888; width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
      <span>IMO &ndash; ${esc(data.vessel.imoNumber)}</span>
      <span><span class="pageNumber"></span> | Page</span>
    </div>`;
}
