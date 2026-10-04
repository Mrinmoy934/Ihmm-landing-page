import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/database.js';
import { getVesselQueryByUser } from '../services/vessel.service.js';
import { isUserAdmin } from '../services/access.js';

// Standard 16 IMO Hazmat Table A/B substances tracked
const HAZMAT_DEFINITIONS = [
  { key: "Asbestos", keywords: ["asbestos", "chrysotile", "amosite", "crocidolite"], color: "#2563eb" },
  { key: "Polychlorinated Biphenyls (PCB)", keywords: ["pcb", "polychlorinated biphenyl"], color: "#0891b2" },
  { key: "Ozone Depleting Substance", keywords: ["ods", "ozone", "freon", "halon", "r-22", "r22", "r134a", "refrigerant"], color: "#14b8a6" },
  { key: "Organotin Compounds", keywords: ["organotin", "tbt", "tributyltin"], color: "#22c55e" },
  { key: "Cybutryne", keywords: ["cybutryne", "irgarol"], color: "#84cc16" },
  { key: "Cadmium (and compounds)", keywords: ["cadmium"], color: "#f59e0b" },
  { key: "Chromium (and compounds)", keywords: ["chromium", "hexavalent chromium"], color: "#b91c1c" },
  { key: "Lead (and compounds)", keywords: ["lead", "lead acid", "pb"], color: "#92400e" },
  { key: "Mercury (and compounds)", keywords: ["mercury", "fluorescent", "hg"], color: "#78716c" },
  { key: "Polybrominated Biphenyl (PBB)", keywords: ["pbb", "polybrominated biphenyl"], color: "#c084fc" },
  { key: "Polybrominated Diphenyl Ethers (PBDE)", keywords: ["pbde", "diphenyl ether"], color: "#38bdf8" },
  { key: "Polychloronaphthalenes (Cl ≥ 3)", keywords: ["polychloronaphthalene", "pcn"], color: "#db2777" },
  { key: "Radioactive Material", keywords: ["radioactive", "americium", "smoke detector", "ionisation"], color: "#a3e635" },
  { key: "Certain Shortchain Chlorinated Paraffins", keywords: ["shortchain", "chlorinated paraffin", "sccp"], color: "#16a34a" },
  { key: "Perfluorooctane Sulfonic Acid (PFOS)", keywords: ["pfos", "perfluorooctane"], color: "#fca5a5" },
  { key: "Hexabromocyclododecane (HBCDD)", keywords: ["hbcdd", "hexabromocyclododecane"], color: "#f472b6" },
];

/** Parse quarter string like "Q1-22" or "Q3-24" into date bounds */
function parseQuarterToDates(qStr?: string): { start: Date; end: Date } | null {
  if (!qStr) return null;
  const parts = qStr.split('-');
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  const q = parts[0];
  const yy = parts[1];
  const year = 2000 + parseInt(yy, 10);
  if (isNaN(year)) return null;

  if (q === 'Q1') return { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59) };
  if (q === 'Q2') return { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59) };
  if (q === 'Q3') return { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59) };
  if (q === 'Q4') return { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59) };
  return null;
}

/** Quick check to categorize hazard type into one of 16 keys */
function matchHazardKey(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const item of HAZMAT_DEFINITIONS) {
    if (lower.includes(item.key.toLowerCase())) return item.key;
    for (const kw of item.keywords) {
      if (lower.includes(kw)) return item.key;
    }
  }
  return null;
}

/** Determine HM Status: HM Red, HM Green, or Non HM */
function normalizeHmStatus(rawStatus?: string, category?: string, isSuspected?: string): string {
  const statusLower = (rawStatus || '').toLowerCase();
  const categoryLower = (category || '').toLowerCase();

  if (statusLower.includes('red') || statusLower.includes('phm') || statusLower.includes('chm') || categoryLower === 'hazard' || isSuspected === 'Yes') {
    return 'HM Red';
  }
  if (statusLower.includes('green') || categoryLower === 'warning' || statusLower.includes('contained')) {
    return 'HM Green';
  }
  return 'Non HM';
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const db = getDb();
    const isAdmin = await isUserAdmin(userId);

    const vesselQuery = await getVesselQueryByUser(userId);
    const vessels = await db.collection('vessels').find(vesselQuery).toArray();
    const vesselIds = vessels.map(v => v._id);

    const poCount = await db.collection('purchase_orders').countDocuments({ vessel_id: { $in: vesselIds } });
    const materialCount = await db.collection('materials').countDocuments({ vessel_id: { $in: vesselIds } });
    const auditLineCount = await db.collection('audit_line_items').countDocuments({ vessel_id: { $in: vesselIds } });
    const pendingMdCount = await db.collection('md_sdoc_requests').countDocuments({ vessel_id: { $in: vesselIds }, status: { $regex: /pending/i } });
    const receivedMdCount = await db.collection('md_sdoc_requests').countDocuments({ vessel_id: { $in: vesselIds }, status: { $regex: /received/i } });
    const userCount = isAdmin ? await db.collection('users').countDocuments({}) : 1;

    res.json({
      success: true,
      data: {
        users: { newRegistrations: userCount, ihmRegistrations: userCount, inactiveUsers: 0, trend: 0 },
        purchaseOrders: {
          totalLineItems: materialCount + auditLineCount,
          pendingMDs: pendingMdCount,
          receivedMDs: receivedMdCount,
          hmRed: materialCount + auditLineCount,
          hmGreen: 0,
          trend: 0
        },
        vessels: { newOnboarded: vessels.length, itemsMovedFromDeck: materialCount, itemsMovedAshore: 0, socExpired: 0 },
      },
    });
  } catch (err) { next(err); }
}

export async function getDashboardOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const db = getDb();

    // 1. Fetch user role details
    const userDoc = await db.collection('users').findOne({ _id: userId });
    const category = (userDoc?.category || '').toLowerCase();
    const roleName = (userDoc?.role_name || '').toLowerCase();

    let userRole = 'admin';
    if (category === 'vessel' || roleName === 'vessel') userRole = 'vessel';
    else if (category.includes('owner') || roleName.includes('owner')) userRole = 'ship_owner';
    else if (category.includes('manager') || roleName.includes('manager')) userRole = 'ship_manager';

    // 2. Fetch scoped vessels
    const vesselQuery = await getVesselQueryByUser(userId);
    const allScopedVessels = await db.collection('vessels').find(vesselQuery).sort({ name: 1 }).toArray();

    // 3. Extract unique dropdown options from scoped vessels
    const shipOwners = Array.from(new Set(allScopedVessels.map(v => v.ship_owner || v.registered_owner).filter(Boolean)));
    const shipManagers = Array.from(new Set(allScopedVessels.map(v => v.ship_manager).filter(Boolean)));
    const flagStates = Array.from(new Set(allScopedVessels.map(v => v.flag_state).filter(Boolean)));

    // 4. Apply query parameter filters
    const filterShipOwner = req.query.shipOwner as string;
    const filterShipManager = req.query.shipManager as string;
    const filterVessel = req.query.vessel as string;
    const filterFlagState = req.query.flagState as string;
    const filterSupplier = req.query.supplier as string;
    const startQuarter = req.query.startQuarter as string;
    const endQuarter = req.query.endQuarter as string;

    const startDateObj = parseQuarterToDates(startQuarter)?.start;
    const endDateObj = parseQuarterToDates(endQuarter)?.end;

    function isDocInDateRange(docDate?: any): boolean {
      if (!startDateObj || !endDateObj) return true;
      if (!docDate) return true;
      const d = new Date(docDate);
      if (isNaN(d.getTime())) return true;
      return d >= startDateObj && d <= endDateObj;
    }

    let filteredVessels = allScopedVessels;
    if (filterShipOwner && filterShipOwner !== 'Ship Owner' && filterShipOwner !== 'All') {
      filteredVessels = filteredVessels.filter(v => 
        (v.ship_owner && v.ship_owner.toLowerCase().includes(filterShipOwner.toLowerCase())) ||
        (v.registered_owner && v.registered_owner.toLowerCase().includes(filterShipOwner.toLowerCase()))
      );
    }
    if (filterShipManager && filterShipManager !== 'Ship Manager' && filterShipManager !== 'All') {
      filteredVessels = filteredVessels.filter(v => v.ship_manager && v.ship_manager.toLowerCase().includes(filterShipManager.toLowerCase()));
    }
    if (filterVessel && filterVessel !== 'Vessel' && filterVessel !== 'All') {
      filteredVessels = filteredVessels.filter(v => v._id === filterVessel || v.name === filterVessel);
    }
    if (filterFlagState && filterFlagState !== 'Flag State' && filterFlagState !== 'All') {
      filteredVessels = filteredVessels.filter(v => v.flag_state && v.flag_state.toLowerCase().includes(filterFlagState.toLowerCase()));
    }

    const filteredVesselIds = filteredVessels.map(v => v._id);

    // 5. Query Materials, Audit Lines, POs, and MD Requests for filtered vessels
    const rawMaterials = await db.collection('materials').find({ vessel_id: { $in: filteredVesselIds } }).toArray();
    const rawAuditLines = await db.collection('audit_line_items').find({ vessel_id: { $in: filteredVesselIds } }).toArray();
    const rawPOs = await db.collection('purchase_orders').find({ vessel_id: { $in: filteredVesselIds } }).toArray();
    const rawMdRequests = await db.collection('md_sdoc_requests').find({ vessel_id: { $in: filteredVesselIds } }).toArray();

    // Apply Timeline Date Filtering
    let materials = rawMaterials.filter(m => isDocInDateRange(m.created_at || m.updated_at));
    let auditLines = rawAuditLines.filter(a => isDocInDateRange(a.created_at || a.po_sent_date));
    let purchaseOrders = rawPOs.filter(p => isDocInDateRange(p.created_at || p.po_date));
    let mdRequests = rawMdRequests.filter(r => isDocInDateRange(r.created_at || r.received_at));

    // Extract suppliers from DB records
    const suppliers = Array.from(new Set([
      ...purchaseOrders.map(p => p.supplier_name),
      ...materials.map(m => m.manufacturer),
      ...auditLines.map(a => a.vendor_name)
    ].filter(Boolean)));

    // Filter by supplier if requested
    if (filterSupplier && filterSupplier !== 'Supplier' && filterSupplier !== 'All') {
      const supLower = filterSupplier.toLowerCase();
      materials = materials.filter(m => (m.manufacturer || '').toLowerCase().includes(supLower));
      auditLines = auditLines.filter(a => (a.vendor_name || '').toLowerCase().includes(supLower));
      purchaseOrders = purchaseOrders.filter(p => (p.supplier_name || '').toLowerCase().includes(supLower));
    }

    // 6. Compute 16 Hazmat Material Breakdown Counts (strictly from DB)
    const materialCountsMap: Record<string, { count: number; redCount: number; shipIds: Set<string> }> = {};
    for (const def of HAZMAT_DEFINITIONS) {
      materialCountsMap[def.key] = { count: 0, redCount: 0, shipIds: new Set() };
    }

    let hmRedTotal = 0;
    let hmGreenTotal = 0;
    let nonHmTotal = 0;

    for (const m of materials) {
      const text = `${m.hazard_type || ''} ${m.name || ''} ${m.material_name || ''} ${m.description || ''} ${m.equipment || ''}`;
      const matchedKey = matchHazardKey(text) || (m.hazard_type && HAZMAT_DEFINITIONS.find(d => d.key === m.hazard_type)?.key);
      const status = normalizeHmStatus(m.hm_status, m.category);

      if (status === 'HM Red') hmRedTotal++;
      else if (status === 'HM Green') hmGreenTotal++;
      else nonHmTotal++;

      if (matchedKey && materialCountsMap[matchedKey]) {
        const item = materialCountsMap[matchedKey];
        if (item) {
          item.count++;
          if (m.vessel_id) item.shipIds.add(m.vessel_id);
          if (status === 'HM Red') item.redCount++;
        }
      }
    }

    for (const a of auditLines) {
      const text = `${a.item_description || ''} ${a.name || ''} ${a.equipment_name || ''} ${a.maker || ''}`;
      const matchedKey = matchHazardKey(text);
      const status = normalizeHmStatus('', '', a.is_suspected);

      if (status === 'HM Red') hmRedTotal++;
      else if (status === 'HM Green') hmGreenTotal++;
      else nonHmTotal++;

      if (matchedKey && materialCountsMap[matchedKey]) {
        const item = materialCountsMap[matchedKey];
        if (item) {
          item.count++;
          if (a.vessel_id) item.shipIds.add(a.vessel_id);
          if (status === 'HM Red') item.redCount++;
        }
      }
    }

    const hazmatBreakdown = HAZMAT_DEFINITIONS.map(def => {
      const entry = materialCountsMap[def.key] || { count: 0, redCount: 0, shipIds: new Set() };
      return {
        key: def.key,
        color: def.color,
        count: entry.count,
        shipsCount: entry.shipIds.size,
        redCount: entry.redCount,
      };
    });

    // 7. MD & SDoC Statistics (strictly from DB)
    const mdReceived = mdRequests.filter(r => (r.status || '').toLowerCase().includes('received') || r.received_at).length;
    const mdPending = mdRequests.filter(r => (r.status || '').toLowerCase().includes('pending') || (r.status || '').toLowerCase().includes('requested')).length;
    const sdocReceived = mdRequests.filter(r => r.sdoc_status === 'received' || r.sdoc_file_path).length;
    const sdocPending = mdRequests.filter(r => r.sdoc_status === 'pending').length;

    // 8. Supplier Responsiveness Statistics (strictly from DB)
    const responsiveSuppliers = Array.from(new Set(mdRequests.filter(r => (r.status || '').toLowerCase().includes('received')).map(r => r.supplier_name))).length;
    const pendingSuppliers = Array.from(new Set(mdRequests.filter(r => (r.status || '').toLowerCase().includes('pending')).map(r => r.supplier_name))).length;
    const totalSupplierNames = suppliers.length;
    const nonResponsiveSuppliers = Math.max(0, totalSupplierNames - responsiveSuppliers - pendingSuppliers);

    // 9. PO Tracking Metrics (strictly from DB)
    const poTracked = purchaseOrders.filter(p => p.status === 'tracked' || p.status === 'completed' || p.status === 'responsive').length;
    const totalPOsCount = purchaseOrders.length;

    const itemTracked = materials.length + auditLines.length;
    const itemPurchasedTotal = purchaseOrders.reduce((acc, p) => acc + (p.total_items || 0), 0);

    const poMetrics = [
      { label: "PO Tracked vs PO Received", a: poTracked, b: Math.max(totalPOsCount, poTracked), color: "#0d9488" },
      { label: "Item Tracked vs Item Purchased", a: itemTracked, b: Math.max(itemPurchasedTotal, itemTracked), color: "#0891b2" },
      { label: "MDs Pending vs Received", a: mdPending, b: Math.max(mdReceived + mdPending, mdPending), color: "#f59e0b" },
    ];

    const mdDonut = [
      { name: "MDs Received", value: mdReceived, color: "#0d9488" },
      { name: "MDs Pending", value: mdPending, color: "#f59e0b" },
      { name: "SDoCs Received", value: sdocReceived, color: "#0891b2" },
      { name: "SDoCs Pending", value: sdocPending, color: "#cbd5e1" },
    ];

    const supplierDonut = [
      { name: "Responsive", value: responsiveSuppliers, color: "#0d9488" },
      { name: "Non-Responsive", value: nonResponsiveSuppliers, color: "#f59e0b" },
      { name: "Pending", value: pendingSuppliers, color: "#cbd5e1" },
    ];

    // 10. Recent Activity
    const recentAudits = await db.collection('audit_summaries')
      .find({ vessel_id: { $in: filteredVesselIds } })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    const recentActivity = recentAudits.map(a => ({
      id: a._id,
      title: 'Audit Initialized',
      vesselName: a.vessel_name,
      description: `${a.total_po || 0} POs for ${a.vessel_name} sent to registry`,
      createDate: a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : 'Recently',
      status: a.status || 'In Progress'
    }));

    res.json({
      success: true,
      data: {
        userRole,
        vessels: filteredVessels.map(v => ({
          id: v._id,
          name: v.name,
          imoNumber: v.imo_number,
          flagState: v.flag_state || 'N/A',
          shipOwner: v.ship_owner || v.registered_owner || 'N/A',
          shipManager: v.ship_manager || 'N/A',
          vesselClass: v.vessel_class || 'N/A',
          keelLaidDate: v.keel_laid_date || 'N/A',
          complianceStatus: v.compliance_status || 'compliant',
        })),
        options: {
          shipOwners,
          shipManagers,
          flagStates,
          suppliers,
          vessels: allScopedVessels.map(v => ({ id: v._id, name: v.name })),
        },
        kpi: {
          totalVessels: filteredVessels.length,
          totalPOs: totalPOsCount,
          totalTrackedItems: itemTracked,
          hmRedCount: hmRedTotal,
          hmGreenCount: hmGreenTotal,
          nonHmCount: nonHmTotal,
          mdReceived,
          mdPending,
          sdocReceived,
          sdocPending,
        },
        hazmatBreakdown,
        poMetrics,
        mdDonut,
        supplierDonut,
        recentActivity,
      }
    });
  } catch (err) { next(err); }
}

export async function getDashboardInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const db = getDb();

    // Fetch user-scoped vessels
    const vesselQuery = await getVesselQueryByUser(userId);
    const vessels = await db.collection('vessels').find(vesselQuery).toArray();
    const vesselMap = new Map(vessels.map(v => [v._id, v]));
    const vesselIds = vessels.map(v => v._id);

    // Filters & Pagination
    const filterVesselId = req.query.vesselId as string;
    const filterHmStatus = req.query.hmStatus as string;
    const filterHazardType = req.query.hazardType as string;
    const startQuarter = req.query.startQuarter as string;
    const endQuarter = req.query.endQuarter as string;
    const search = (req.query.search as string || '').toLowerCase().trim();

    const startDateObj = parseQuarterToDates(startQuarter)?.start;
    const endDateObj = parseQuarterToDates(endQuarter)?.end;

    function isDocInDateRange(docDate?: any): boolean {
      if (!startDateObj || !endDateObj) return true;
      if (!docDate) return true;
      const d = new Date(docDate);
      if (isNaN(d.getTime())) return true;
      return d >= startDateObj && d <= endDateObj;
    }

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '20', 10)));

    let targetVesselIds = vesselIds;
    if (filterVesselId && filterVesselId !== 'All') {
      targetVesselIds = vesselIds.filter(id => id === filterVesselId);
    }

    // Query materials & audit line items from DB
    const materials = await db.collection('materials').find({ vessel_id: { $in: targetVesselIds } }).toArray();
    const auditLines = await db.collection('audit_line_items').find({ vessel_id: { $in: targetVesselIds } }).toArray();

    const rawRows: any[] = [];

    // Map `materials`
    for (const m of materials) {
      if (!isDocInDateRange(m.created_at || m.updated_at)) continue;

      const v = vesselMap.get(m.vessel_id) || {};
      const status = normalizeHmStatus(m.hm_status, m.category);
      const hazardKey = m.hazard_type || matchHazardKey(`${m.name || ''} ${m.description || ''}`) || 'General Equipment';

      rawRows.push({
        id: m._id,
        ship: v.name || 'Vessel Entry',
        flag: v.flag_state || 'N/A',
        vclass: v.vessel_class || 'N/A',
        supplier: m.manufacturer || m.supplier || 'N/A',
        desc: m.description || m.name || m.material_name || 'Equipment component',
        hm: hazardKey,
        qty: m.quantity ? `${m.quantity} ${m.unit || ''}`.trim() : '1 Unit',
        part: m.ihm_part ? `Part ${m.ihm_part}` : 'Part I — contained in ship structure or equipment',
        cat: m.category ? `I-${m.category}` : 'I-2 Equipment and machinery',
        status: status,
        po: m.ship_po || '—',
        vs: v.imo_number ? `IMO${v.imo_number}` : 'VS002070',
        created: m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : 'N/A',
        updated: m.updated_at ? new Date(m.updated_at).toLocaleDateString('en-GB') : 'N/A',
        md: true,
        sdoc: status !== 'HM Red',
        deck: m.compartment || 'Main Deck',
        equip: m.equipment || m.name || 'Ship Machinery',
        position: m.position || 'Engine Room',
        component: m.component || m.material_name || 'Component',
        material: hazardKey,
        remarks: m.remarks || 'Recorded in vessel IHM inventory log.',
      });
    }

    // Map `audit_line_items`
    for (const a of auditLines) {
      if (!isDocInDateRange(a.created_at || a.po_sent_date)) continue;

      const v = vesselMap.get(a.vessel_id) || {};
      const status = normalizeHmStatus('', '', a.is_suspected);
      const hazardKey = matchHazardKey(a.item_description || '') || 'Suspected Material';

      rawRows.push({
        id: a._id,
        ship: a.vessel_name || v.name || 'Audit Vessel',
        flag: v.flag_state || 'N/A',
        vclass: v.vessel_class || 'N/A',
        supplier: a.vendor_name || 'Supplier Entry',
        desc: a.item_description || a.name || 'Line item audit entry',
        hm: hazardKey,
        qty: a.quantity ? `${a.quantity} ${a.unit || ''}`.trim() : '1 pc',
        part: 'Part I — contained in ship structure or equipment',
        cat: 'I-2 Equipment and machinery',
        status: status,
        po: a.po_number || '—',
        vs: a.imo_number ? `IMO${a.imo_number}` : 'VS001100',
        created: a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : 'N/A',
        updated: a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : 'N/A',
        md: a.is_suspected !== 'Yes',
        sdoc: a.is_suspected !== 'Yes',
        deck: 'Engine Room Deck',
        equip: a.equipment_name || 'Auxiliary Engine',
        position: 'Engine Store',
        component: a.part_number || 'Spare Part',
        material: hazardKey,
        remarks: a.vendor_remark || 'Audit line item record.',
      });
    }

    // Apply Filters
    let filtered = rawRows;
    if (filterHmStatus && filterHmStatus !== 'All' && filterHmStatus !== 'HM Status') {
      filtered = filtered.filter(row => row.status.toLowerCase() === filterHmStatus.toLowerCase());
    }

    if (filterHazardType && filterHazardType !== 'All' && filterHazardType !== 'Material') {
      filtered = filtered.filter(row => row.hm.toLowerCase().includes(filterHazardType.toLowerCase()));
    }

    if (search) {
      filtered = filtered.filter(row => 
        row.ship.toLowerCase().includes(search) ||
        row.desc.toLowerCase().includes(search) ||
        row.hm.toLowerCase().includes(search) ||
        row.supplier.toLowerCase().includes(search) ||
        row.po.toLowerCase().includes(search) ||
        row.equip.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        }
      }
    });
  } catch (err) { next(err); }
}

export async function getSocAlerts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const expiringVessels = await db.collection('vessels').find({
      soc_expiry_date: { $exists: true, $ne: null }
    }).limit(10).toArray();

    res.json({
      success: true,
      data: expiringVessels.map(v => ({
        id: v._id,
        vesselName: v.name,
        imoNumber: v.imo_number,
        socExpiryDate: v.soc_expiry_date,
        complianceStatus: v.compliance_status || 'warning'
      }))
    });
  } catch (err) { next(err); }
}
