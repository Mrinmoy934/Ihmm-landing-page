import crypto from 'crypto';
import { getDb, getClient } from '../config/database.js';
import { isUserAdmin } from './access.js';
import { getVesselQueryByUser } from './vessel.service.js';

const FIELD_MAP: Record<string, string> = {
  imoNumber: 'imo_number',
  vesselName: 'vessel_name',
  totalPO: 'total_po',
  totalItems: 'total_items',
  duplicatePO: 'duplicate_po',
  duplicateSupplierCode: 'duplicate_supplier_code',
  duplicateProduct: 'duplicate_product',
  status: 'status',
  reviewAssignedTo: 'review_assigned_to',
  reviewedBy: 'reviewed_by',
  reviewedAt: 'reviewed_at',
};

const REVERSE_MAP: Record<string, string> = {};
for (const [c, s] of Object.entries(FIELD_MAP)) REVERSE_MAP[s] = c;
REVERSE_MAP['id'] = 'id';
REVERSE_MAP['vessel_id'] = 'vesselId';
REVERSE_MAP['last_activity'] = 'lastActivity';
REVERSE_MAP['created_at'] = 'createdAt';
REVERSE_MAP['updated_at'] = 'updatedAt';

function toApi(row: Record<string, unknown> | null) {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === '_id') {
      out['id'] = v;
    } else {
      out[REVERSE_MAP[k] || k] = v;
    }
  }
  return out;
}

function extractFields(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [c, s] of Object.entries(FIELD_MAP)) {
    if (c in data && data[c] !== undefined) {
      fields[s] = data[c];
    }
  }
  return fields;
}

export const AuditService = {
  /** Get all audits (optionally filter by status). Admins see audits
   *  for the whole fleet; non-admin roles get audits for vessels they
   *  themselves onboarded. */
  async getAudits(filters?: { status?: string; userId?: string }) {
    const db = getDb();
    const vesselQuery = filters?.userId ? await getVesselQueryByUser(filters.userId) : {};

    const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
    const vesselIds = vessels.map((v) => v._id);

    const query: any = { vessel_id: { $in: vesselIds } };
    if (filters?.status) {
      query.status = filters.status;
    }

    const rows = await db.collection('audit_summaries').find(query).sort({ created_at: -1 }).toArray();
    return rows.map(toApi);
  },

  /** Get audits with status 'In Progress' or 'Pending' (Pending Audits Registry). */
  async getPendingAudits(userId: string) {
    const db = getDb();
    const vesselQuery = await getVesselQueryByUser(userId);

    const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
    const vesselIds = vessels.map((v) => v._id);

    const rows = await db.collection('audit_summaries').find({
      vessel_id: { $in: vesselIds },
      status: { $in: ['In Progress', 'Pending'] }
    }).sort({ last_activity: -1 }).toArray();

    return rows.map(toApi);
  },

  /** Every audit that's still alive. */
  async getActiveAudits(userId: string) {
    const db = getDb();
    const vesselQuery = await getVesselQueryByUser(userId);

    const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
    const vesselIds = vessels.map((v) => v._id);

    const rows = await db.collection('audit_summaries').find({
      vessel_id: { $in: vesselIds },
      status: { $in: ['In Progress', 'Pending', 'Pending Review', 'Awaiting Clarification', 'submitted'] }
    }).sort({ last_activity: -1 }).toArray();

    return rows.map(toApi);
  },

  /** Get audits with status 'Pending Review' */
  async getPendingReviews(userId: string) {
    const db = getDb();
    const vesselQuery = await getVesselQueryByUser(userId);

    const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
    const vesselIds = vessels.map((v) => v._id);

    const rows = await db.collection('audit_summaries').find({
      vessel_id: { $in: vesselIds },
      status: 'Pending Review'
    }).sort({ last_activity: -1 }).toArray();

    return rows.map(toApi);
  },

  /** Get a specific audit by IMO */
  async getAuditByImo(imoNumber: string, userId: string) {
    const db = getDb();
    const isVesselAdmin = await isUserAdmin(userId);

    const query: any = { imo_number: imoNumber };
    if (!isVesselAdmin) {
      const vesselQuery = await getVesselQueryByUser(userId);
      const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
      query.vessel_id = { $in: vessels.map((v) => v._id) };
    }

    const row = await db.collection('audit_summaries').findOne(query);
    return row ? toApi(row) : null;
  },

  /** Get a single audit by ID */
  async getAuditById(id: string, userId: string) {
    const db = getDb();
    const isVesselAdmin = await isUserAdmin(userId);

    const query: any = { _id: id };
    if (!isVesselAdmin) {
      const vesselQuery = await getVesselQueryByUser(userId);
      const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
      query.vessel_id = { $in: vessels.map((v) => v._id) };
    }

    const row = await db.collection('audit_summaries').findOne(query);
    return row ? toApi(row) : null;
  },

  /** Create an audit summary */
  async createAudit(data: Record<string, unknown>, vesselId: string) {
    const db = getDb();
    const fields = extractFields(data);
    fields['vessel_id'] = vesselId;
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    fields['last_activity'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('audit_summaries').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('audit_summaries').findOne({ _id });
    return toApi(created);
  },

  /** Update audit */
  async updateAudit(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extractFields(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    fields['last_activity'] = new Date();

    await db.collection('audit_summaries').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('audit_summaries').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Send to review */
  async sendToReview(id: string, assignedTo?: string) {
    const db = getDb();
    await db.collection('audit_summaries').updateOne(
      { _id: id },
      {
        $set: {
          status: 'Pending Review',
          review_assigned_to: assignedTo || null,
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );
    const updated = await db.collection('audit_summaries').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Complete review */
  async completeReview(id: string, reviewedBy: string) {
    const db = getDb();
    await db.collection('audit_summaries').updateOne(
      { _id: id },
      {
        $set: {
          status: 'Completed',
          reviewed_by: reviewedBy,
          reviewed_at: new Date(),
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );
    const updated = await db.collection('audit_summaries').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Reject review */
  async rejectReview(id: string, reviewedBy: string) {
    const db = getDb();
    await db.collection('audit_summaries').updateOne(
      { _id: id },
      {
        $set: {
          status: 'In Progress',
          reviewed_by: reviewedBy,
          reviewed_at: new Date(),
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );
    const updated = await db.collection('audit_summaries').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async deleteAudit(id: string) {
    const db = getDb();
    await db.collection('audit_summaries').deleteOne({ _id: id });
  },

  /** Fetch all line items for an audit */
  async getLineItems(auditId: string) {
    const db = getDb();
    const rows = await db.collection('audit_line_items')
      .find({ audit_id: auditId })
      .sort({ row_index: 1 })
      .toArray();

    return rows.map((r) => ({
      rowIndex: r.row_index,
      name: r.name,
      vesselName: r.vessel_name,
      poNumber: r.po_number,
      imoNumber: r.imo_number,
      poSentDate: r.po_sent_date,
      mdRequestedDate: r.md_requested_date,
      itemDescription: r.item_description,
      isSuspected: r.is_suspected,
      impaCode: r.impa_code,
      issaCode: r.issa_code,
      equipmentCode: r.equipment_code,
      equipmentName: r.equipment_name,
      maker: r.maker,
      model: r.model,
      partNumber: r.part_number,
      unit: r.unit,
      quantity: r.quantity,
      vendorRemark: r.vendor_remark,
      vendorEmail: r.vendor_email,
      vendorName: r.vendor_name,
      extraData: r.extra_data,
    }));
  },

  /** Replace all line items for an audit */
  async replaceLineItems(auditId: string, vesselId: string | null, rows: unknown[][]) {
    const client = getClient();
    const session = client.startSession();
    try {
      session.startTransaction();
      const db = getDb();
      await db.collection('audit_line_items').deleteMany({ audit_id: auditId }, { session });

      const CHUNK = 1000;
      for (let offset = 0; offset < rows.length; offset += CHUNK) {
        const batch = rows.slice(offset, offset + CHUNK);
        if (batch.length === 0) continue;

        const docs = batch.map((row, i) => {
          const rowIndex = offset + i;
          const r = Array.isArray(row) ? row : [];
          const extra = r.slice(20);
          return {
            _id: crypto.randomUUID(),
            audit_id: auditId,
            vessel_id: vesselId,
            row_index: rowIndex,
            name: r[0] ?? null,
            vessel_name: r[1] ?? null,
            po_number: r[2] ?? null,
            imo_number: r[3] ?? null,
            po_sent_date: r[4] ?? null,
            md_requested_date: r[5] ?? null,
            item_description: r[6] ?? null,
            is_suspected: r[7] === 'Yes' ? 'Yes' : 'No',
            impa_code: r[8] ?? null,
            issa_code: r[9] ?? null,
            equipment_code: r[10] ?? null,
            equipment_name: r[11] ?? null,
            maker: r[12] ?? null,
            model: r[13] ?? null,
            part_number: r[14] ?? null,
            unit: r[15] ?? null,
            quantity: r[16] ?? null,
            vendor_remark: r[17] ?? null,
            vendor_email: r[18] ?? null,
            vendor_name: r[19] ?? null,
            extra_data: extra,
            created_at: new Date(),
            updated_at: new Date()
          };
        });

        await db.collection('audit_line_items').insertMany(docs, { session });
      }
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  },

  /** Fetch clarifications for an IMO */
  async getClarificationsForImo(imoNumber: string) {
    const db = getDb();
    const clarifications = await db.collection('clarification_requests')
      .find({ imo_number: imoNumber })
      .sort({ created_at: -1 })
      .toArray();

    if (clarifications.length === 0) return [];

    const ids = clarifications.map((c) => c._id);
    const items = await db.collection('clarification_items')
      .find({ clarification_id: { $in: ids } })
      .sort({ item_index: 1 })
      .toArray();

    const byClar: Record<string, any[]> = {};
    for (const row of items) {
      const key = String(row.clarification_id);
      if (!byClar[key]) byClar[key] = [];
      byClar[key].push({
        clarification_id: row.clarification_id,
        item_index: row.item_index,
        mds_status: row.mds_status,
        mds_file_path: row.mds_file_path,
        mds_file_name: row.mds_file_name,
        mds_received_at: row.mds_received_at,
        sdoc_status: row.sdoc_status,
        sdoc_file_path: row.sdoc_file_path,
        sdoc_file_name: row.sdoc_file_name,
        sdoc_received_at: row.sdoc_received_at,
        reminder_count: row.reminder_count,
        hm_status: row.hm_status,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        notes: row.notes,
        updated_at: row.updated_at,
      });
    }

    return clarifications.map((c) => ({
      id: c._id,
      vessel_id: c.vessel_id,
      imo_number: c.imo_number,
      vessel_name: c.vessel_name,
      recipient_emails: c.recipient_emails,
      cc_emails: c.cc_emails,
      subject: c.subject,
      body: c.body,
      suspected_items: c.suspected_items,
      status: c.status,
      error_message: c.error_message,
      sent_by: c.sent_by,
      created_at: c.created_at,
      items: byClar[String(c._id)] ?? [],
    }));
  },

  /** Aggregate rows for the MD SDoC Audit Pending page */
  async getMdsPendingOverview(userId: string) {
    const db = getDb();
    const vesselQuery = await getVesselQueryByUser(userId);
    const vessels = await db.collection('vessels').find(vesselQuery, { projection: { _id: 1 } }).toArray();
    const vesselIds = vessels.map((v) => v._id);

    const audits = await db.collection('audit_summaries').find({ vessel_id: { $in: vesselIds } }).toArray();
    const auditVesselIds = audits.map((a) => a.vessel_id);

    const requests = await db.collection('clarification_requests').find({ vessel_id: { $in: auditVesselIds } }).toArray();
    const reqIds = requests.map((r) => r._id);

    const items = await db.collection('clarification_items').find({ clarification_id: { $in: reqIds } }).toArray();

    const itemsByReqId = new Map<string, any[]>();
    for (const item of items) {
      const cid = item.clarification_id;
      if (!itemsByReqId.has(cid)) itemsByReqId.set(cid, []);
      itemsByReqId.get(cid)!.push(item);
    }

    const reqsByVessel = new Map<string, any[]>();
    for (const req of requests) {
      const vid = req.vessel_id;
      if (!reqsByVessel.has(vid)) reqsByVessel.set(vid, []);
      reqsByVessel.get(vid)!.push(req);
    }

    const results = [];
    for (const a of audits) {
      const crs = reqsByVessel.get(a.vessel_id) || [];
      const crIds = crs.map((cr) => cr._id);
      const cis = items.filter((item) => crIds.includes(item.clarification_id));

      if (cis.length === 0) continue;

      let pending_md = 0;
      let received_md = 0;
      let pending_sdoc = 0;
      let received_sdoc = 0;
      let pending_mds = 0;
      let received_mds = 0;
      let any_submitted = false;
      const receivedDates: Date[] = [];
      const submittedDates: Date[] = [];

      for (const cr of crs) {
        if (cr.submitted_at) {
          any_submitted = true;
          submittedDates.push(new Date(cr.submitted_at));
        }
      }

      for (const ci of cis) {
        if (ci.mds_status === 'pending') pending_md++;
        if (ci.mds_status === 'received') received_md++;
        if (ci.sdoc_status === 'pending') pending_sdoc++;
        if (ci.sdoc_status === 'received') received_sdoc++;

        if (ci.mds_status === 'pending' || ci.sdoc_status === 'pending') pending_mds++;
        if (ci.mds_status === 'received' && ci.sdoc_status === 'received') received_mds++;

        if (ci.mds_received_at) receivedDates.push(new Date(ci.mds_received_at));
        if (ci.sdoc_received_at) receivedDates.push(new Date(ci.sdoc_received_at));
      }

      const last_received_at = receivedDates.length > 0 ? new Date(Math.max(...receivedDates.map((d) => d.getTime()))) : null;
      const last_submitted_at = submittedDates.length > 0 ? new Date(Math.max(...submittedDates.map((d) => d.getTime()))) : null;

      const sortDates = cis.map((ci) => ci.mds_received_at ? new Date(ci.mds_received_at).getTime() : 0);
      const sortReqDates = crs.map((cr) => new Date(cr.created_at).getTime());
      const maxSortVal = Math.max(...sortDates, ...sortReqDates, 0);

      results.push({
        imo_number: a.imo_number,
        vessel_name: a.vessel_name,
        total_po: a.total_po,
        audit_id: a._id,
        pending_md,
        received_md,
        pending_sdoc,
        received_sdoc,
        pending_mds,
        received_mds,
        total_clarification_items: cis.length,
        clarification_count: crs.length,
        any_submitted,
        last_received_at,
        last_submitted_at,
        sortVal: maxSortVal,
      });
    }

    results.sort((a, b) => b.sortVal - a.sortVal);
    return results.map(({ sortVal, ...rest }) => rest);
  },

  /** Line items for a vessel's active audit, annotated with clarification state. */
  async getVesselPoItems(vesselId: string, userId: string) {
    const db = getDb();
    if (!(await isUserAdmin(userId))) {
      const baseQuery = await getVesselQueryByUser(userId);
      const ownership = await db.collection('vessels').findOne({ ...baseQuery, _id: vesselId }, { projection: { _id: 1 } });
      if (!ownership) {
        return { items: [] as Array<Record<string, unknown>>, auditId: null };
      }
    } else {
      const exists = await db.collection('vessels').findOne({ _id: vesselId }, { projection: { _id: 1 } });
      if (!exists) {
        return { items: [] as Array<Record<string, unknown>>, auditId: null };
      }
    }

    const audit = await db.collection('audit_summaries').findOne(
      {
        vessel_id: vesselId,
        status: { $in: ['In Progress', 'Pending', 'Pending Review', 'Awaiting Clarification', 'submitted'] }
      },
      { sort: { created_at: -1 } }
    );
    const auditId = audit ? String(audit._id) : null;

    const itemsRows = auditId
      ? await db.collection('audit_line_items').find({ audit_id: auditId }).sort({ row_index: 1 }).toArray()
      : [];

    const clarRes = await db.collection('clarification_requests')
      .find({ vessel_id: vesselId })
      .sort({ created_at: 1 })
      .toArray();

    const requestIds = clarRes.map((cr) => cr._id);
    const items = await db.collection('clarification_items')
      .find({ clarification_id: { $in: requestIds } })
      .toArray();

    const itemsByReqId = new Map<string, any[]>();
    for (const item of items) {
      const cid = item.clarification_id;
      if (!itemsByReqId.has(cid)) itemsByReqId.set(cid, []);
      itemsByReqId.get(cid)!.push(item);
    }

    const stateByPO = new Map<string, any>();
    for (const cr of clarRes) {
      const cis = itemsByReqId.get(cr._id) || [];
      for (const ci of cis) {
        if (ci.item_index == null) continue;
        const suspected = Array.isArray(cr.suspected_items) ? cr.suspected_items as unknown[][] : [];
        const r = suspected[ci.item_index];
        if (!Array.isArray(r)) continue;
        const poNumber = String(r[2] ?? '').trim();
        if (!poNumber) continue;
        stateByPO.set(poNumber, {
          clarificationId: cr._id,
          itemIndex: ci.item_index,
          mdStatus: ci.mds_status ?? 'pending',
          mdFileName: ci.mds_file_name,
          mdFilePath: ci.mds_file_path,
          mdReceivedAt: ci.mds_received_at,
          sdocStatus: ci.sdoc_status ?? 'pending',
          sdocFileName: ci.sdoc_file_name,
          sdocFilePath: ci.sdoc_file_path,
          sdocReceivedAt: ci.sdoc_received_at,
          reminderCount: ci.reminder_count ?? 0,
          submittedAt: cr.submitted_at,
          hmStatus: ci.hm_status,
          reviewedAt: ci.reviewed_at,
          reviewedBy: ci.reviewed_by,
          updatedAt: ci.updated_at || cr.created_at,
        });
      }
    }

    const combinedStatus = (md: string, sdoc: string): string => (
      md === 'received' && sdoc === 'received' ? 'received' : 'pending'
    );

    const apiItems = itemsRows.map((row) => {
      const po = String(row.po_number ?? '').trim();
      const state = stateByPO.get(po);
      return {
        id: String(row._id),
        row_index: row.row_index,
        name: row.name,
        vessel_name: row.vessel_name,
        po_number: row.po_number,
        imo_number: row.imo_number,
        po_sent_date: row.po_sent_date,
        md_requested_date: row.md_requested_date,
        item_description: row.item_description,
        is_suspected: row.is_suspected,
        impa_code: row.impa_code,
        issa_code: row.issa_code,
        equipment_code: row.equipment_code,
        equipment_name: row.equipment_name,
        maker: row.maker,
        model: row.model,
        part_number: row.part_number,
        unit: row.unit,
        quantity: row.quantity,
        vendor_remark: row.vendor_remark,
        vendor_email: row.vendor_email,
        vendor_name: row.vendor_name,
        clarification_id: state?.clarificationId ?? null,
        clarification_item_index: state?.itemIndex ?? null,
        md_status: state?.mdStatus ?? 'none',
        md_file_name: state?.mdFileName ?? null,
        md_file_path: state?.mdFilePath ?? null,
        md_received_at: state?.mdReceivedAt ?? null,
        sdoc_status: state?.sdocStatus ?? 'none',
        sdoc_file_name: state?.sdocFileName ?? null,
        sdoc_file_path: state?.sdocFilePath ?? null,
        sdoc_received_at: state?.sdocReceivedAt ?? null,
        mds_status: state ? combinedStatus(state.mdStatus, state.sdocStatus) : 'none',
        mds_file_name: state?.mdFileName ?? null,
        mds_file_path: state?.mdFilePath ?? null,
        mds_received_at: state?.mdReceivedAt ?? null,
        reminder_count: state?.reminderCount ?? 0,
        submitted_at: state?.submittedAt ?? null,
        hm_status: state?.hmStatus ?? null,
        reviewed_at: state?.reviewedAt ?? null,
        reviewed_by: state?.reviewedBy ?? null,
        updated_at: state?.updatedAt ?? null,
      };
    });

    const existingPOs = new Set(apiItems.map((i) => String(i.po_number ?? '').trim()).filter(Boolean));
    const standardHeaderCols = [
      'name', 'vessel_name', 'po_number', 'imo_number',
      'po_sent_date', 'md_requested_date', 'item_description', 'is_suspected',
      'impa_code', 'issa_code', 'equipment_code', 'equipment_name',
      'maker', 'model', 'part_number', 'unit', 'quantity',
      'vendor_remark', 'vendor_email', 'vendor_name',
    ];
    const orphanMap = new Map<string, Record<string, unknown>>();
    for (const cr of clarRes) {
      const cis = itemsByReqId.get(cr._id) || [];
      for (const ci of cis) {
        if (ci.item_index == null) continue;
        const suspected = Array.isArray(cr.suspected_items) ? cr.suspected_items as unknown[][] : [];
        const r = suspected[ci.item_index];
        if (!Array.isArray(r)) continue;
        const po = String(r[2] ?? '').trim();
        if (!po || existingPOs.has(po) || orphanMap.has(po)) continue;

        const mdSt = ci.mds_status ?? 'pending';
        const sdocSt = ci.sdoc_status ?? 'pending';
        const synth: Record<string, unknown> = {
          row_index: -1,
          extra_data: {},
          clarification_id: cr._id,
          clarification_item_index: ci.item_index,
          md_status: mdSt,
          md_file_name: ci.mds_file_name,
          md_file_path: ci.mds_file_path,
          md_received_at: ci.mds_received_at,
          sdoc_status: sdocSt,
          sdoc_file_name: ci.sdoc_file_name,
          sdoc_file_path: ci.sdoc_file_path,
          sdoc_received_at: ci.sdoc_received_at,
          mds_status: mdSt === 'received' && sdocSt === 'received' ? 'received' : 'pending',
          mds_file_name: ci.mds_file_name,
          mds_file_path: ci.mds_file_path,
          mds_received_at: ci.mds_received_at,
          reminder_count: ci.reminder_count ?? 0,
          submitted_at: cr.submitted_at,
          hm_status: ci.hm_status ?? null,
          reviewed_at: ci.reviewed_at ?? null,
          reviewed_by: ci.reviewed_by ?? null,
        };
        standardHeaderCols.forEach((col, idx) => {
          synth[col] = col === 'is_suspected' ? 'Yes' : (r[idx] ?? null);
        });
        orphanMap.set(po, synth);
      }
    }

    return { items: [...apiItems, ...orphanMap.values()], auditId };
  },

  /** Fetch a single clarification_item row. */
  async getClarificationItem(clarificationId: string, itemIndex: number) {
    const db = getDb();
    const item = await db.collection('clarification_items').findOne({ clarification_id: clarificationId, item_index: itemIndex });
    if (!item) return undefined;

    const request = await db.collection('clarification_requests').findOne({ _id: clarificationId });
    return {
      ...item,
      imo_number: request?.imo_number,
      vessel_id: request?.vessel_id,
    };
  },

  /** Fetch a clarification + the item, joined, for a reminder re-send. */
  async getClarificationForReminder(clarificationId: string, itemIndex: number) {
    const db = getDb();
    const item = await db.collection('clarification_items').findOne({ clarification_id: clarificationId, item_index: itemIndex });
    if (!item) return undefined;

    const request = await db.collection('clarification_requests').findOne({ _id: clarificationId });
    if (!request) return undefined;

    return {
      id: request._id,
      imo_number: request.imo_number,
      vessel_id: request.vessel_id,
      vessel_name: request.vessel_name,
      recipient_emails: request.recipient_emails,
      cc_emails: request.cc_emails,
      subject: request.subject,
      public_token: request.public_token,
      public_token_expires_at: request.public_token_expires_at,
    };
  },

  /** Bulk variant — looks up the clarification by id alone, no item join. */
  async getClarificationById(clarificationId: string) {
    const db = getDb();
    const request = await db.collection('clarification_requests').findOne({ _id: clarificationId });
    if (!request) return undefined;
    return {
      id: request._id,
      imo_number: request.imo_number,
      vessel_id: request.vessel_id,
      vessel_name: request.vessel_name,
      recipient_emails: request.recipient_emails,
      cc_emails: request.cc_emails,
      subject: request.subject,
      public_token: request.public_token,
      public_token_expires_at: request.public_token_expires_at,
    };
  },

  /** After a reminder email has been sent, bump the item's reminder_count and extend the clarification's public link expiry. */
  async incrementReminderAndExtendToken(
    clarificationId: string,
    itemIndex: number,
    newExpiresAt: Date,
  ) {
    const db = getDb();
    await db.collection('clarification_items').updateOne(
      { clarification_id: clarificationId, item_index: itemIndex },
      { $inc: { reminder_count: 1 }, $set: { updated_at: new Date() } }
    );
    await db.collection('clarification_requests').updateOne(
      { _id: clarificationId },
      { $set: { public_token_expires_at: newExpiresAt } }
    );
    return db.collection('clarification_items').findOne({ clarification_id: clarificationId, item_index: itemIndex });
  },

  /** Bulk variant: bump reminder_count on a SET of items in one clarification. */
  async incrementRemindersAndExtendToken(
    clarificationId: string,
    itemIndices: number[],
    newExpiresAt: Date,
  ) {
    if (itemIndices.length === 0) return [];
    const db = getDb();
    await db.collection('clarification_items').updateMany(
      { clarification_id: clarificationId, item_index: { $in: itemIndices } },
      { $inc: { reminder_count: 1 }, $set: { updated_at: new Date() } }
    );
    await db.collection('clarification_requests').updateOne(
      { _id: clarificationId },
      { $set: { public_token_expires_at: newExpiresAt } }
    );
    return db.collection('clarification_items').find({ clarification_id: clarificationId, item_index: { $in: itemIndices } }).toArray();
  },

  /** Attach an uploaded supplier document to a clarification item. */
  async setClarificationItemDocument(
    clarificationId: string,
    itemIndex: number,
    kind: 'md' | 'sdoc',
    filePath: string,
    fileName: string,
  ) {
    const db = getDb();
    const cols = kind === 'sdoc'
      ? { status: 'sdoc_status', path: 'sdoc_file_path', name: 'sdoc_file_name', at: 'sdoc_received_at' }
      : { status: 'mds_status',  path: 'mds_file_path',  name: 'mds_file_name',  at: 'mds_received_at' };

    await db.collection('clarification_items').updateOne(
      { clarification_id: clarificationId, item_index: itemIndex },
      {
        $set: {
          [cols.status]: 'received',
          [cols.path]: filePath,
          [cols.name]: fileName,
          [cols.at]: new Date(),
          updated_at: new Date()
        }
      }
    );
    return db.collection('clarification_items').findOne({ clarification_id: clarificationId, item_index: itemIndex });
  },

  /** Mark a clarification item as reviewed by the admin. */
  async markClarificationItemReviewed(
    clarificationId: string,
    itemIndex: number,
    reviewedBy: string,
  ) {
    const db = getDb();
    await db.collection('clarification_items').updateOne(
      { clarification_id: clarificationId, item_index: itemIndex },
      {
        $set: {
          reviewed_at: new Date(),
          reviewed_by: reviewedBy,
          updated_at: new Date()
        }
      }
    );
    return db.collection('clarification_items').findOne(
      { clarification_id: clarificationId, item_index: itemIndex },
      { projection: { item_index: 1, reviewed_at: 1, reviewed_by: 1 } }
    );
  },

  /** Clear the uploaded document for a kind (MD or SDoC). */
  async clearClarificationItemDocument(
    clarificationId: string,
    itemIndex: number,
    kind: 'md' | 'sdoc',
  ): Promise<string | null> {
    const db = getDb();
    const cols = kind === 'sdoc'
      ? { status: 'sdoc_status', path: 'sdoc_file_path', name: 'sdoc_file_name', at: 'sdoc_received_at' }
      : { status: 'mds_status',  path: 'mds_file_path',  name: 'mds_file_name',  at: 'mds_received_at' };

    const existing = await db.collection('clarification_items').findOne({ clarification_id: clarificationId, item_index: itemIndex });
    const filePath = existing?.[cols.path] ?? null;

    await db.collection('clarification_items').updateOne(
      { clarification_id: clarificationId, item_index: itemIndex },
      {
        $set: {
          [cols.status]: 'pending',
          [cols.path]: null,
          [cols.name]: null,
          [cols.at]: null,
          updated_at: new Date()
        }
      }
    );
    return filePath;
  },
};
