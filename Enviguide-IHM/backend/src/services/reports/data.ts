// -- Report data fetchers --------------------------------------------------
// Single function that gathers every row a Quarterly Compliance Report
// needs, then hands a clean shape to the template. Querying happens here,
// not in the template, so the template stays pure presentation and easy
// to swap when the design lands.

import { getDb } from '../../config/database.js';

export interface ReportPeriod {
  start: Date;
  end: Date;
  /** Human label like "Q4 2025" or "Ad Hoc 2026-04-30" */
  label: string;
}

export interface VesselSpecs {
  id: string;
  name: string;
  imoNumber: string;
  vesselType: string | null;
  flagState: string | null;
  portOfRegistry: string | null;
  vesselClass: string | null;
  grossTonnage: string | null;
  keelLaidDate: string | null;
  deliveryDate: string | null;
  registeredOwner: string | null;
  shipManager: string | null;
  /** Yard / builder — vessels.name_of_yard. Cover page → Ship Builder row. */
  shipBuilder: string | null;
  /** vessels.image — file path or URL. If present, replaces the gradient
   *  placeholder on the cover Vessel Photograph block. Resolved to a
   *  absolute URL or data: URI before the template runs. */
  image: string | null;
  /** vessels.soc_reference — Statement of Compliance reference. */
  socReference: string | null;
  /** vessels.ihm_reference — Initial IHM Reference (cover meta). */
  ihmReference: string | null;
}

export interface MovementRow {
  partLabel: string;        // 'Part I – I1', 'Part I – I2', etc.
  startCount: number;
  added: number;
  updated: number;
  endCount: number;
}

export interface HazmatTile {
  code: string;             // 'Pb', 'Cd', 'Asb', ...
  name: string;             // 'Lead (and compounds)', etc.
  count: number;
}

export interface MaterialRow {
  id: string;
  no: number;
  createdOn: string;        // formatted dd/mm/yyyy
  updatedOn: string;
  name: string;
  location: string;
  classification: string;
  qty: string;
  partsWhereUsed: string;
  remarks: string;
  status: 'Added' | 'Updated' | 'Carried Forward';
  /** For HM Marked Decks page — null if no GA plan / pin set. */
  gaPlanUrl: string | null;
  gaPlanName: string | null;
  pinX: number | null;
  pinY: number | null;
  rect: { x: number; y: number; w: number; h: number } | null;
}

export interface MaterialGroup {
  groupKey: 'I-1' | 'I-2' | 'I-3' | 'II' | 'III';
  title: string;
  rows: MaterialRow[];
}

export interface PoAppendixRow {
  poNumber: string;
  receivedDate: string;
}

export interface PoDetailRow {
  poNumber: string;
  supplier: string;
  poDate: string;             // formatted dd/mm/yyyy (po_sent_date if set, else created_at)
  receivedOn: string;         // formatted dd/mm/yyyy (audit_line_items.created_at)
  totalItems: number;
  suspectedCount: number;     // line items with is_suspected = Yes
  /** Up to ~60 chars of the first item description, for context. */
  sampleItem: string;
}

/** Aggregate + per-vendor breakdown for the MD/SDoC tracking section.
 *  Sourced from clarification_requests + clarification_items. */
export interface MdSdocVendorRow {
  vendor: string;
  email: string;
  totalRequests: number;
  submitted: number;
  pending: number;
  reminders: number;
  mdsRequested: number;
  mdsReceived: number;
  sdocsRequested: number;
  sdocsReceived: number;
  lastSentAt: string;
}

export interface MdSdocStats {
  totals: {
    totalRequests: number;
    distinctVendors: number;
    submittedRequests: number;
    pendingRequests: number;
    totalReminders: number;
    totalItems: number;
    mdsPending: number;
    mdsReceived: number;
    sdocsPending: number;
    sdocsReceived: number;
  };
  byVendor: MdSdocVendorRow[];
}

/** Row in the Suspected Hazmat section — one entry per suspected
 *  line item, grouped by supplier in the renderer. */
export interface SuspectedItemRow {
  supplier: string;
  poNumber: string;
  poDate: string;
  receivedOn: string;
  itemDescription: string;
  equipment: string;
  maker: string;
  partNumber: string;
  quantity: string;
  unit: string;
  vendorRemark: string;
}

export interface ReportData {
  vessel: VesselSpecs;
  period: ReportPeriod;
  movement: MovementRow[];
  totals: {
    posReceivedInQuarter: number;
    docsRequested: number;
    docsReceived: number;
  };
  hazmatOverview: HazmatTile[];
  materialGroups: MaterialGroup[];
  appendices: {
    posWithHazmat: PoAppendixRow[];
    posAllHazmatFree: PoAppendixRow[];
    posAwaitingDeclaration: PoAppendixRow[];
  };
  /** Full PO listing for the period — supplier, date, items, amount,
   *  status, suspected-hazmat count. Used by the Purchase Orders page
   *  in the Ship Overall and Compliance Summary reports. */
  purchaseOrders: PoDetailRow[];
  /** Just the suspected-hazmat line items, one row each, sorted by
   *  supplier so the renderer can produce a per-supplier breakdown. */
  suspectedItems: SuspectedItemRow[];
  /** MD/SDoC tracking — aggregate KPIs and per-vendor breakdown. */
  mdSdoc: MdSdocStats;
  /** Auto-generated doc number for the cover page. */
  docNumber: string;
  /** Operator who triggered the generation, for the cover. */
  generatedBy: string;
  /** Date the report was generated (formatted dd/mm/yyyy) — separate
   *  from the period dates which describe what the report covers. */
  generatedAt: string;
}

// ─── The 16 hazmat compounds Varuna's report tracks ──────────────────────
// Order matters — drives the tile grid on the overview page.
const HAZMAT_CATALOG: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'Asb',   name: 'Asbestos' },
  { code: 'PCB',   name: 'Polychlorinated Biphenyls (PCB)' },
  { code: 'ODS',   name: 'Ozone Depleting Substance' },
  { code: 'OC',    name: 'Organotin Compounds' },
  { code: 'Cd',    name: 'Cadmium (and compounds)' },
  { code: 'Cr',    name: 'Chromium (and compounds)' },
  { code: 'Pb',    name: 'Lead (and compounds)' },
  { code: 'Hg',    name: 'Mercury (and compounds)' },
  { code: 'PBB',   name: 'Polybrominated Biphenyl (PBB)' },
  { code: 'PBDE',  name: 'Polybrominated Diphenyl Ethers (PBDE)' },
  { code: 'PCN',   name: 'Polychloronaphthalenes (Cl >= 3)' },
  { code: 'RM',    name: 'Radioactive Material' },
  { code: 'CSCP',  name: 'Certain Shortchain Chlorinated Paraffins' },
  { code: 'PFOS',  name: 'Perfluorooctane Sulfonic Acid (PFOS)' },
  { code: 'HBCDD', name: 'Hexabromocyclododecane (HBCDD)' },
  { code: 'Cb',    name: 'Cybutryne' },
];

function fmtDate(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function partGroupOf(
  ihmPart: string | null,
  name: string | null,
  hazard: string | null,
): MaterialGroup['groupKey'] {
  const s = (ihmPart || '').toLowerCase();
  if (s.includes('part iii')) return 'III';
  if (s.includes('part ii')) return 'II';

  const nm = `${name ?? ''} ${hazard ?? ''}`.toLowerCase();
  if (/(paint|coating|primer|varnish)/.test(nm)) return 'I-1';
  if (/(hull|structur(e|al)|deck plate|frame)/.test(nm)) return 'I-3';
  return 'I-2';
}

function statusOf(createdAt: Date, updatedAt: Date, period: ReportPeriod): MaterialRow['status'] {
  const created = createdAt.getTime();
  const updated = updatedAt.getTime();
  const start = period.start.getTime();
  const end = period.end.getTime();
  if (created >= start && created <= end) return 'Added';
  if (updated >= start && updated <= end && created < start) return 'Updated';
  return 'Carried Forward';
}

/** Build a quarterly period for the calendar quarter that contains `ref`. */
export function quarterContaining(ref: Date = new Date()): ReportPeriod {
  const y = ref.getFullYear();
  const q = Math.floor(ref.getMonth() / 3); // 0..3
  const start = new Date(Date.UTC(y, q * 3, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, q * 3 + 3, 0, 23, 59, 59));
  return { start, end, label: `Q${q + 1} ${y}` };
}

/** Vessel-lifetime period — onboarding date through today. Used by the
 *  'overall' report type which is a full snapshot rather than a quarter. */
export async function lifetimePeriod(vesselId: string): Promise<ReportPeriod> {
  const db = getDb();
  const vessel = await db.collection('vessels').findOne({ _id: vesselId }, { projection: { created_at: 1 } });
  if (!vessel) throw new Error('Vessel not found');
  const start = new Date(vessel.created_at);
  const end = new Date();
  return { start, end, label: 'Overall' };
}

/** Walks every calendar quarter from the one containing `from` through
 *  the one containing `until` (inclusive), oldest first. Used to build
 *  the Quarterly Archive timeline — one card per elapsed quarter since
 *  the vessel was onboarded. */
export function quartersSince(from: Date, until: Date = new Date()): ReportPeriod[] {
  const out: ReportPeriod[] = [];
  let y = from.getUTCFullYear();
  let q = Math.floor(from.getUTCMonth() / 3); // 0..3
  const endY = until.getUTCFullYear();
  const endQ = Math.floor(until.getUTCMonth() / 3);

  let safety = 0;
  while ((y < endY || (y === endY && q <= endQ)) && safety++ < 200) {
    const start = new Date(Date.UTC(y, q * 3, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, q * 3 + 3, 0, 23, 59, 59));
    out.push({ start, end, label: `Q${q + 1} ${y}` });
    q += 1;
    if (q > 3) { q = 0; y += 1; }
  }
  return out;
}

// ─── Main entry ───────────────────────────────────────────────────────────

export async function buildQuarterlyComplianceData(
  vesselId: string,
  period: ReportPeriod,
  generatedBy: string,
): Promise<ReportData> {
  const db = getDb();

  // 1. Vessel specs
  const v = await db.collection('vessels').findOne({ _id: vesselId });
  if (!v) throw new Error('Vessel not found');

  const vessel: VesselSpecs = {
    id: String(v._id),
    name: String(v.name ?? ''),
    imoNumber: String(v.imo_number ?? ''),
    vesselType: (v.vessel_type as string) ?? null,
    flagState: (v.flag_state as string) ?? null,
    portOfRegistry: (v.port_of_registry as string) ?? null,
    vesselClass: (v.vessel_class as string) ?? null,
    grossTonnage: (v.gross_tonnage as string) ?? null,
    keelLaidDate: fmtDate(v.keel_laid_date) || null,
    deliveryDate: fmtDate(v.delivery_date) || null,
    registeredOwner: (v.registered_owner as string) ?? null,
    shipManager: (v.ship_manager as string) ?? null,
    shipBuilder: (v.name_of_yard as string) ?? null,
    image: (v.image as string) ?? null,
    socReference: (v.soc_reference as string) ?? null,
    ihmReference: (v.ihm_reference as string) ?? null,
  };

  // 2. All materials for this vessel + their location + GA plan + rect
  const materialsRows = await db.collection('materials').aggregate([
    { $match: { vessel_id: vesselId } },
    {
      $lookup: {
        from: 'decks',
        localField: 'deck_id',
        foreignField: '_id',
        as: 'deck'
      }
    },
    { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'deck_areas',
        localField: 'deck_area_id',
        foreignField: '_id',
        as: 'deck_area'
      }
    },
    { $unwind: { path: '$deck_area', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'ga_plans',
        localField: 'deck_area.ga_plan_id',
        foreignField: '_id',
        as: 'ga_plan'
      }
    },
    { $unwind: { path: '$ga_plan', preserveNullAndEmptyArrays: true } },
    { $sort: { ihm_part: 1, created_at: 1 } }
  ]).toArray();

  const groupsByKey: Record<MaterialGroup['groupKey'], MaterialRow[]> = {
    'I-1': [], 'I-2': [], 'I-3': [], 'II': [], 'III': [],
  };

  let no = 0;
  for (const row of materialsRows) {
    no += 1;
    const createdAt = new Date(row.created_at);
    const updatedAt = new Date(row.updated_at);
    const group = partGroupOf(
      (row.ihm_part as string) ?? null,
      (row.name as string) ?? null,
      (row.hazard_type as string) ?? null,
    );
    const qtyParts: string[] = [];
    if (row.no_of_pieces) qtyParts.push(`${row.no_of_pieces} PCS`);
    if (row.quantity) qtyParts.push(`${row.quantity}${row.unit ? ' ' + row.unit : ''}`);
    const qty = qtyParts.join(' | ') || '-';

    const rect = row.deck_area?.width && row.deck_area?.height
      ? {
          x: Number(row.deck_area.x ?? 0),
          y: Number(row.deck_area.y ?? 0),
          w: Number(row.deck_area.width),
          h: Number(row.deck_area.height),
        }
      : null;

    const mat: MaterialRow = {
      id: String(row._id),
      no,
      createdOn: fmtDate(row.created_at),
      updatedOn: fmtDate(row.updated_at),
      name: String(row.name ?? ''),
      location: String(row.deck_area?.name ?? row.compartment ?? row.position ?? ''),
      classification: String(row.hazard_type ?? row.material_name ?? ''),
      qty,
      partsWhereUsed: String(row.component ?? row.equipment ?? ''),
      remarks: String(row.remarks ?? ''),
      status: statusOf(createdAt, updatedAt, period),
      gaPlanUrl: (row.ga_plan?.file_path as string) ?? null,
      gaPlanName: (row.ga_plan?.name as string) ?? null,
      pinX: row.pin_x !== null && row.pin_x !== undefined ? Number(row.pin_x) : null,
      pinY: row.pin_y !== null && row.pin_y !== undefined ? Number(row.pin_y) : null,
      rect,
    };
    groupsByKey[group].push(mat);
  }

  const materialGroups: MaterialGroup[] = [
    { groupKey: 'I-1', title: 'I-1 Paints and coating systems',  rows: groupsByKey['I-1'] },
    { groupKey: 'I-2', title: 'I-2 Equipment and machinery',      rows: groupsByKey['I-2'] },
    { groupKey: 'I-3', title: 'I-3 Structure and hull',           rows: groupsByKey['I-3'] },
    { groupKey: 'II',  title: 'Part II Operationally generated wastes', rows: groupsByKey['II'] },
    { groupKey: 'III', title: 'Part III Stores',                  rows: groupsByKey['III'] },
  ];

  // 3. IHM Movement counts — start, added, updated, end — per Part group.
  const movement: MovementRow[] = materialGroups.map((g) => {
    let startCount = 0, added = 0, updated = 0, endCount = 0;
    for (const r of g.rows) {
      const created = new Date(r.createdOn.split('/').reverse().join('-')).getTime();
      const isAdded = r.status === 'Added';
      const isUpdated = r.status === 'Updated';
      if (created < period.start.getTime()) startCount += 1;
      if (isAdded) added += 1;
      if (isUpdated) updated += 1;
      if (created <= period.end.getTime()) endCount += 1;
    }
    const partLabel = g.groupKey.startsWith('I-') ? `Part I – ${g.groupKey.slice(2)}` : `Part ${g.groupKey}`;
    return { partLabel, startCount, added, updated, endCount };
  });

  // 4. Hazmat overview — count materials per compound code.
  const overviewRows = await db.collection('materials').aggregate([
    { $match: { vessel_id: vesselId, hazard_type: { $nin: [null, ''] } } },
    { $group: { _id: '$hazard_type', count: { $sum: 1 } } }
  ]).toArray();

  const countsByName = new Map<string, number>();
  for (const r of overviewRows) {
    countsByName.set((r._id || '').trim().toLowerCase(), Number(r.count));
  }
  const hazmatOverview: HazmatTile[] = HAZMAT_CATALOG.map(({ code, name }) => ({
    code,
    name,
    count: countsByName.get(name.toLowerCase()) ?? 0,
  }));

  // 5. Period totals
  const lineItemsInPeriod = await db.collection('audit_line_items').find({
    vessel_id: vesselId,
    created_at: { $gte: period.start, $lte: period.end },
    po_number: { $nin: [null, ''] }
  }).toArray();
  const uniquePoNumbers = new Set(lineItemsInPeriod.map(item => item.po_number));
  const posReceivedInQuarter = uniquePoNumbers.size;

  const periodReqs = await db.collection('clarification_requests').find({
    vessel_id: vesselId,
    created_at: { $gte: period.start, $lte: period.end }
  }).toArray();
  const periodReqIds = periodReqs.map(r => r._id);

  const docsRequested = await db.collection('clarification_items').countDocuments({
    clarification_id: { $in: periodReqIds }
  });

  const vesselRequests = await db.collection('clarification_requests').find({ vessel_id: vesselId }, { projection: { _id: 1 } }).toArray();
  const vesselReqIds = vesselRequests.map(r => r._id);
  const docsReceived = await db.collection('clarification_items').countDocuments({
    clarification_id: { $in: vesselReqIds },
    $or: [
      { mds_received_at: { $gte: period.start, $lte: period.end } },
      { sdoc_received_at: { $gte: period.start, $lte: period.end } }
    ]
  });

  const totals = {
    posReceivedInQuarter,
    docsRequested,
    docsReceived,
  };

  // 6. PO Grouping in memory
  const poGroups = new Map<string, { poNumber: string; created_at: Date; items: any[] }>();
  for (const item of lineItemsInPeriod) {
    const poNum = item.po_number;
    if (!poNum) continue;
    const existing = poGroups.get(poNum);
    if (!existing) {
      poGroups.set(poNum, {
        poNumber: poNum,
        created_at: new Date(item.created_at),
        items: [item]
      });
    } else {
      existing.items.push(item);
      if (new Date(item.created_at) < existing.created_at) {
        existing.created_at = new Date(item.created_at);
      }
    }
  }

  const poList = Array.from(poGroups.values()).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  // posWithHazmat: POs that have at least one suspected-hazmat line item.
  const posWithHazmat = poList
    .filter(po => po.items.some(item => String(item.is_suspected).toLowerCase() === 'yes'))
    .map(po => ({ poNumber: po.poNumber, receivedDate: fmtDate(po.created_at) }));

  // posAllHazmatFree: POs whose every line item is non-suspected.
  const posAllHazmatFree = poList
    .filter(po => po.items.every(item => String(item.is_suspected).toLowerCase() !== 'yes'))
    .map(po => ({ poNumber: po.poNumber, receivedDate: fmtDate(po.created_at) }));

  // posAwaitingDeclaration: POs awaiting declaration (joined to clarification_items at the vessel level showing pending status)
  const awaitingClar = await db.collection('clarification_items').countDocuments({
    clarification_id: { $in: vesselReqIds },
    $or: [
      { mds_status: 'pending' },
      { sdoc_status: 'pending' }
    ]
  });

  const posAwaitingDeclaration = awaitingClar > 0
    ? poList.map(po => ({ poNumber: po.poNumber, receivedDate: fmtDate(po.created_at) }))
    : [];

  // PO Details list
  const purchaseOrders = poList.map(po => {
    po.items.sort((a, b) => (a.row_index ?? 0) - (b.row_index ?? 0));
    const sample = String(po.items[0]?.item_description ?? '').trim();
    const supplier = po.items.map(item => item.vendor_name).filter(Boolean)[0] || 'Unknown Supplier';
    const poDates = po.items.map(item => item.po_sent_date).filter(Boolean);
    const poDate = poDates.length > 0 ? poDates[0] : null;

    return {
      poNumber: po.poNumber,
      supplier,
      poDate: poDate ? fmtDate(poDate) : '—',
      receivedOn: fmtDate(po.created_at),
      totalItems: po.items.length,
      suspectedCount: po.items.filter(item => String(item.is_suspected).toLowerCase() === 'yes').length,
      sampleItem: sample.length > 60 ? sample.slice(0, 60) + '…' : sample,
    };
  });

  // Suspected items
  const suspectedRes = await db.collection('audit_line_items').find({
    vessel_id: vesselId,
    created_at: { $gte: period.start, $lte: period.end },
    is_suspected: { $regex: /^yes$/i }
  }).sort({ vendor_name: 1, po_number: 1, row_index: 1 }).toArray();

  const suspectedItems = suspectedRes.map(r => ({
    supplier: String(r.vendor_name ?? '').trim() || 'Unknown supplier',
    poNumber: String(r.po_number ?? ''),
    poDate: r.po_sent_date ? fmtDate(r.po_sent_date) : '—',
    receivedOn: fmtDate(r.created_at),
    itemDescription: String(r.item_description ?? '').trim(),
    equipment: String(r.equipment_name ?? '').trim(),
    maker: String(r.maker ?? '').trim(),
    partNumber: String(r.part_number ?? '').trim(),
    quantity: String(r.quantity ?? '').trim(),
    unit: String(r.unit ?? '').trim(),
    vendorRemark: String(r.vendor_remark ?? '').trim(),
  }));

  // MD/SDoC tracking stats & byVendor
  const periodItems = await db.collection('clarification_items').find({
    clarification_id: { $in: periodReqIds }
  }).toArray();

  const itemsByReqId = new Map<string, any[]>();
  for (const item of periodItems) {
    const clarId = item.clarification_id;
    if (!itemsByReqId.has(clarId)) {
      itemsByReqId.set(clarId, []);
    }
    itemsByReqId.get(clarId)!.push(item);
  }

  const perReq = periodReqs.map(cr => {
    const items = itemsByReqId.get(cr._id) || [];
    const req_reminders = items.length > 0 ? Math.max(...items.map(item => item.reminder_count || 0)) : 0;
    return {
      id: cr._id,
      status: cr.status,
      recipient_emails: cr.recipient_emails || '',
      supplier_company: cr.supplier_company || '',
      created_at: new Date(cr.created_at),
      req_reminders
    };
  });

  const totalsRow = {
    total_requests: perReq.length,
    distinct_vendors: new Set(perReq.map(pr => pr.recipient_emails)).size,
    submitted_requests: perReq.filter(pr => pr.status === 'submitted').length,
    pending_requests: perReq.filter(pr => pr.status === 'sent' || pr.status === 'queued').length,
    total_reminders: perReq.reduce((sum, pr) => sum + pr.req_reminders, 0),
    total_items: periodItems.length,
    mds_pending: periodItems.filter(item => item.mds_status === 'pending').length,
    mds_received: periodItems.filter(item => item.mds_received_at != null).length,
    sdoc_pending: periodItems.filter(item => item.sdoc_status === 'pending').length,
    sdoc_received: periodItems.filter(item => item.sdoc_received_at != null).length
  };

  const reqsByVendor = new Map<string, typeof perReq>();
  for (const pr of perReq) {
    if (!reqsByVendor.has(pr.recipient_emails)) {
      reqsByVendor.set(pr.recipient_emails, []);
    }
    reqsByVendor.get(pr.recipient_emails)!.push(pr);
  }

  const byVendorList = [];
  for (const [email, prs] of reqsByVendor.entries()) {
    const supplierCompany = prs.map(pr => pr.supplier_company).filter(Boolean)[0] || email;
    const totalRequests = prs.length;
    const submitted = prs.filter(pr => pr.status === 'submitted').length;
    const pending = prs.filter(pr => pr.status === 'sent' || pr.status === 'queued').length;
    const reminders = prs.reduce((sum, pr) => sum + pr.req_reminders, 0);

    const vReqIds = prs.map(pr => pr.id);
    const vItems = periodItems.filter(item => vReqIds.includes(item.clarification_id));
    const mdsRequested = vItems.length;
    const mdsReceived = vItems.filter(item => item.mds_received_at != null).length;
    const sdocsRequested = vItems.length;
    const sdocsReceived = vItems.filter(item => item.sdoc_received_at != null).length;

    const lastSentAt = new Date(Math.max(...prs.map(pr => pr.created_at.getTime())));

    byVendorList.push({
      vendor: supplierCompany.trim() || 'Unknown vendor',
      email: email.trim(),
      totalRequests,
      submitted,
      pending,
      reminders,
      mdsRequested,
      mdsReceived,
      sdocsRequested,
      sdocsReceived,
      lastSentAt: fmtDate(lastSentAt),
    });
  }

  byVendorList.sort((a, b) => b.totalRequests - a.totalRequests);

  const mdSdoc: MdSdocStats = {
    totals: {
      totalRequests:     totalsRow.total_requests,
      distinctVendors:   totalsRow.distinct_vendors,
      submittedRequests: totalsRow.submitted_requests,
      pendingRequests:   totalsRow.pending_requests,
      totalReminders:    totalsRow.total_reminders,
      totalItems:        totalsRow.total_items,
      mdsPending:        totalsRow.mds_pending,
      mdsReceived:       totalsRow.mds_received,
      sdocsPending:      totalsRow.sdoc_pending,
      sdocsReceived:     totalsRow.sdoc_received,
    },
    byVendor: byVendorList,
  };

  const yyyymmdd = `${period.end.getUTCFullYear()}${String(period.end.getUTCMonth() + 1).padStart(2, '0')}${String(period.end.getUTCDate()).padStart(2, '0')}`;
  const docNumber = `EG | ${vessel.imoNumber} | ${yyyymmdd} | ${period.label.replace(/\s+/g, '')}`;

  return {
    vessel,
    period,
    movement,
    totals,
    hazmatOverview,
    materialGroups,
    appendices: { posWithHazmat, posAllHazmatFree, posAwaitingDeclaration },
    purchaseOrders,
    suspectedItems,
    mdSdoc,
    docNumber,
    generatedBy,
    generatedAt: fmtDate(new Date()),
  };
}
