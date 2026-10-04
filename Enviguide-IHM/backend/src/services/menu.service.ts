import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  title: 'title',
  description: 'description',
  path: 'path',
  icon: 'icon',
  sortOrder: 'sort_order',
  archived: 'archived',
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

export const MenuService = {
  async list(archived = false) {
    const db = getDb();
    const rows = await db.collection('menu_items')
      .find({ archived })
      .sort({ sort_order: 1, title: 1 })
      .toArray();
    return rows.map(toApi);
  },

  async getById(id: string) {
    const db = getDb();
    const doc = await db.collection('menu_items').findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.title || !data.path) throw new Error('title and path are required');
    const db = getDb();
    const fields = extract(data);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('menu_items').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('menu_items').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('menu_items').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('menu_items').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async archive(id: string) {
    const db = getDb();
    await db.collection('menu_items').updateOne(
      { _id: id },
      { $set: { archived: true, updated_at: new Date() } }
    );
    const updated = await db.collection('menu_items').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async restore(id: string) {
    const db = getDb();
    await db.collection('menu_items').updateOne(
      { _id: id },
      { $set: { archived: false, updated_at: new Date() } }
    );
    const updated = await db.collection('menu_items').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('menu_items').deleteOne({ _id: id });
  },
};
