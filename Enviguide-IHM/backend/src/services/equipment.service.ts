import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  modelCode: 'model_code',
  manufacturer: 'manufacturer',
  systemType: 'system_type',
  nextServiceDate: 'next_service_date',
  description: 'description',
  status: 'status',
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

export const EquipmentService = {
  async list(filters?: { systemType?: string; manufacturer?: string; search?: string }) {
    const db = getDb();
    const query: any = {};

    if (filters?.systemType) {
      query.system_type = filters.systemType;
    }
    if (filters?.manufacturer) {
      query.manufacturer = filters.manufacturer;
    }
    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { name: regex },
        { model_code: regex },
        { manufacturer: regex }
      ];
    }

    const rows = await db.collection('equipment_master').find(query).sort({ name: 1 }).toArray();
    return rows.map(toApi);
  },

  async getById(id: string) {
    const db = getDb();
    const doc = await db.collection('equipment_master').findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.name) throw new Error('name is required');
    const db = getDb();
    const fields = extract(data);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('equipment_master').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('equipment_master').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('equipment_master').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('equipment_master').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('equipment_master').deleteOne({ _id: id });
  },
};
