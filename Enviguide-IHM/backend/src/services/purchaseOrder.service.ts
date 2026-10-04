import crypto from 'crypto';
import { getDb } from '../config/database.js';
import { isUserAdmin } from './access.js';
import { getVesselQueryByUser } from './vessel.service.js';

function prefixQueryKeys(query: any, prefix: string): any {
  if (!query) return {};
  if (query.$or) {
    return {
      $or: query.$or.map((cond: any) => prefixQueryKeys(cond, prefix))
    };
  }
  const result: any = {};
  for (const [k, v] of Object.entries(query)) {
    if (k.startsWith('$')) {
      result[k] = v;
    } else {
      result[`${prefix}${k}`] = v;
    }
  }
  return result;
}

const PO_FIELD_MAP: Record<string, string> = {
  poNumber: 'po_number',
  supplierName: 'supplier_name',
  supplierCode: 'supplier_code',
  status: 'status',
  totalItems: 'total_items',
  totalAmount: 'total_amount',
  currency: 'currency',
  poDate: 'po_date',
  description: 'description',
  fileName: 'file_name',
  filePath: 'file_path',
};

const REVERSE: Record<string, string> = {};
for (const [c, s] of Object.entries(PO_FIELD_MAP)) REVERSE[s] = c;
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
  for (const [c, s] of Object.entries(PO_FIELD_MAP)) {
    if (c in data && data[c] !== undefined) {
      fields[s] = data[c];
    }
  }
  return fields;
}

export const PurchaseOrderService = {
  async listForUser(userId: string, filters?: { vesselId?: string; status?: string; supplierName?: string }) {
    const db = getDb();
    const admin = await isUserAdmin(userId);

    const pipeline: any[] = [];

    // Lookup vessel to get vessel_name and filter by created_by_id if not admin
    pipeline.push({
      $lookup: {
        from: 'vessels',
        localField: 'vessel_id',
        foreignField: '_id',
        as: 'vessel'
      }
    });
    pipeline.push({ $unwind: '$vessel' });

    let match: any = {};
    if (!admin) {
      const vesselQuery = await getVesselQueryByUser(userId);
      match = { ...match, ...prefixQueryKeys(vesselQuery, 'vessel.') };
    }
    if (filters?.vesselId) {
      match['vessel_id'] = filters.vesselId;
    }
    if (filters?.status) {
      match['status'] = filters.status;
    }
    if (filters?.supplierName) {
      match['supplier_name'] = { $regex: filters.supplierName, $options: 'i' };
    }
    pipeline.push({ $match: match });

    pipeline.push({
      $project: {
        _id: 1,
        po_number: 1,
        supplier_name: 1,
        supplier_code: 1,
        status: 1,
        total_items: 1,
        total_amount: 1,
        currency: 1,
        po_date: 1,
        description: 1,
        file_name: 1,
        file_path: 1,
        vessel_id: 1,
        created_at: 1,
        updated_at: 1,
        vessel_name: '$vessel.name'
      }
    });

    pipeline.push({ $sort: { created_at: -1 } });

    const rows = await db.collection('purchase_orders').aggregate(pipeline).toArray();
    return rows.map((row) => ({ ...toApi(row), vesselName: row.vessel_name }));
  },

  async getById(id: string, userId: string) {
    const db = getDb();
    const admin = await isUserAdmin(userId);

    if (admin) {
      const doc = await db.collection('purchase_orders').findOne({ _id: id });
      return doc ? toApi(doc) : null;
    }

    const vesselQuery = await getVesselQueryByUser(userId);
    const pipeline: any[] = [
      { $match: { _id: id } },
      {
        $lookup: {
          from: 'vessels',
          localField: 'vessel_id',
          foreignField: '_id',
          as: 'vessel'
        }
      },
      { $unwind: '$vessel' },
      { $match: prefixQueryKeys(vesselQuery, 'vessel.') }
    ];
    const rows = await db.collection('purchase_orders').aggregate(pipeline).toArray();
    return rows[0] ? toApi(rows[0]) : null;
  },

  async create(data: Record<string, unknown>, vesselId: string) {
    const db = getDb();
    const fields = extract(data);
    fields['vessel_id'] = vesselId;
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('purchase_orders').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('purchase_orders').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('purchase_orders').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('purchase_orders').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('purchase_orders').deleteOne({ _id: id });
  },

  /** Group POs by supplier — for the supplier-mapped view */
  async getBySupplierForVessel(vesselId: string) {
    const db = getDb();
    const rows = await db.collection('purchase_orders').aggregate([
      { $match: { vessel_id: vesselId } },
      {
        $group: {
          _id: { supplier_name: '$supplier_name', supplier_code: '$supplier_code' },
          po_count: { $sum: 1 },
          total_items: { $sum: '$total_items' },
          pos: {
            $push: {
              id: '$_id',
              poNumber: '$po_number',
              status: '$status'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          supplier_name: '$_id.supplier_name',
          supplier_code: '$_id.supplier_code',
          po_count: 1,
          total_items: 1,
          pos: 1
        }
      },
      { $sort: { supplier_name: 1 } }
    ]).toArray();
    return rows;
  },
};
