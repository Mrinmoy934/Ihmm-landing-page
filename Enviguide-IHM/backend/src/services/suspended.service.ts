import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  vesselName: 'vessel_name',
  imoNumber: 'imo_number',
  suspensionDate: 'suspension_date',
  reason: 'reason',
  suspendedBy: 'suspended_by',
};

const REVERSE: Record<string, string> = {};
for (const [c, s] of Object.entries(FIELD_MAP)) REVERSE[s] = c;
REVERSE['id'] = 'id';
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

export const SuspendedService = {
  async list(filters?: { search?: string }) {
    const db = getDb();
    const query: any = {};

    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { vessel_name: regex },
        { imo_number: regex },
        { reason: regex },
        { suspended_by: regex }
      ];
    }

    const rows = await db.collection('suspended_vessels').find(query).sort({ vessel_name: 1 }).toArray();
    return rows.map(toApi);
  },

  async getById(id: string) {
    const db = getDb();
    const doc = await db.collection('suspended_vessels').findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.vesselName) throw new Error('vesselName is required');
    const db = getDb();
    const fields = extract(data);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('suspended_vessels').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('suspended_vessels').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('suspended_vessels').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('suspended_vessels').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('suspended_vessels').deleteOne({ _id: id });
  },
};
