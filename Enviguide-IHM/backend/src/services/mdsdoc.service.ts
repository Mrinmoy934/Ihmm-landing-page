import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  poId: 'po_id',
  materialId: 'material_id',
  supplierName: 'supplier_name',
  supplierCode: 'supplier_code',
  itemName: 'item_name',
  ihmPart: 'ihm_part',
  hazardType: 'hazard_type',
  status: 'status',
  reminderCount: 'reminder_count',
  lastReminderAt: 'last_reminder_at',
  receivedAt: 'received_at',
  notes: 'notes',
};

const REVERSE: Record<string, string> = {};
for (const [c, s] of Object.entries(FIELD_MAP)) REVERSE[s] = c;
REVERSE['id'] = 'id';
REVERSE['vessel_id'] = 'vesselId';
REVERSE['created_at'] = 'createdAt';
REVERSE['updated_at'] = 'updatedAt';

function toApi(row: any) {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === '_id') {
      out['id'] = v;
    } else {
      out[REVERSE[k] || k] = v;
    }
  }
  return out;
}

function extract(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [c, s] of Object.entries(FIELD_MAP)) {
    if (c in data && data[c] !== undefined) {
      fields[s] = data[c];
    }
  }
  return fields;
}

export const MdSDocService = {
  /** List requests grouped by status (Pending, Received, Reminder, etc.) */
  async listForVessel(vesselId: string, status?: string) {
    const db = getDb();
    const query: any = { vessel_id: vesselId };
    if (status) {
      query.status = status;
    }
    const rows = await db.collection('md_sdoc_requests')
      .find(query)
      .sort({ supplier_name: 1, created_at: -1 })
      .toArray();
    return rows.map(toApi);
  },

  /** Get all requests grouped by supplier (for the Request Pending UI) */
  async getGroupedBySupplier(vesselId: string, status?: string) {
    const db = getDb();
    const match: any = { vessel_id: vesselId };
    if (status) {
      match.status = status;
    }

    const rows = await db.collection('md_sdoc_requests').aggregate([
      { $match: match },
      {
        $group: {
          _id: { supplier_name: '$supplier_name', supplier_code: '$supplier_code' },
          items: {
            $push: {
              id: '$_id',
              itemName: '$item_name',
              ihmPart: '$ihm_part',
              hazardType: '$hazard_type',
              status: '$status',
              reminderCount: '$reminder_count'
            }
          },
          total_items: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          supplier_name: '$_id.supplier_name',
          supplier_code: '$_id.supplier_code',
          items: 1,
          total_items: 1
        }
      },
      { $sort: { supplier_name: 1 } }
    ]).toArray();
    return rows;
  },

  async getById(id: string, vesselId: string) {
    const db = getDb();
    const doc = await db.collection('md_sdoc_requests').findOne({ _id: id, vessel_id: vesselId });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>, vesselId: string) {
    const db = getDb();
    const fields = extract(data);
    fields['vessel_id'] = vesselId;
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('md_sdoc_requests').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('md_sdoc_requests').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('md_sdoc_requests').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('md_sdoc_requests').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async sendReminder(id: string) {
    const db = getDb();
    await db.collection('md_sdoc_requests').updateOne(
      { _id: id },
      {
        $inc: { reminder_count: 1 },
        $set: { last_reminder_at: new Date(), updated_at: new Date() }
      }
    );
    const updated = await db.collection('md_sdoc_requests').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async markReceived(id: string) {
    const db = getDb();
    await db.collection('md_sdoc_requests').updateOne(
      { _id: id },
      {
        $set: { status: 'Received', received_at: new Date(), updated_at: new Date() }
      }
    );
    const updated = await db.collection('md_sdoc_requests').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Auto-generate requests from suspected hazardous materials (category=hazard, no MD yet) */
  async generateFromHazardousMaterials(vesselId: string) {
    const db = getDb();
    const materials = await db.collection('materials').find({ vessel_id: vesselId, category: 'hazard' }).toArray();
    const existingRequests = await db.collection('md_sdoc_requests').find({ vessel_id: vesselId, material_id: { $ne: null } }, { projection: { material_id: 1 } }).toArray();
    const existingMaterialIds = new Set(existingRequests.map((r) => r.material_id));

    const toInsert = [];
    for (const m of materials) {
      if (!existingMaterialIds.has(m._id)) {
        toInsert.push({
          _id: crypto.randomUUID(),
          vessel_id: vesselId,
          material_id: m._id,
          item_name: m.name,
          ihm_part: m.ihm_part,
          hazard_type: m.hazard_type,
          supplier_name: m.manufacturer || 'Unknown Supplier',
          status: 'Pending',
          reminder_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    if (toInsert.length > 0) {
      await db.collection('md_sdoc_requests').insertMany(toInsert);
    }
    return { generated: toInsert.length, requests: toInsert.map(toApi) };
  },
};
