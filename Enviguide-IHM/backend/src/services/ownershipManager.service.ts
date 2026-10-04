import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  managerName: 'manager_name',
  responsiblePerson: 'responsible_person',
  email: 'email',
  vesselsManaged: 'vessels_managed',
  officeLocation: 'office_location',
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

export const OwnershipManagerService = {
  async list(filters?: { search?: string }) {
    const db = getDb();
    const query: any = {};

    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { manager_name: regex },
        { responsible_person: regex },
        { email: regex },
        { office_location: regex }
      ];
    }

    const rows = await db.collection('ownership_managers').find(query).sort({ manager_name: 1 }).toArray();
    return rows.map(toApi);
  },

  async getById(id: string) {
    const db = getDb();
    const doc = await db.collection('ownership_managers').findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.managerName) throw new Error('managerName is required');
    const db = getDb();
    const fields = extract(data);
    fields['vessels_managed'] = Number(data.vesselsManaged || 0);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('ownership_managers').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('ownership_managers').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if ('vesselsManaged' in data) {
      fields['vessels_managed'] = Number(data.vesselsManaged || 0);
    }
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('ownership_managers').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('ownership_managers').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('ownership_managers').deleteOne({ _id: id });
  },
};
