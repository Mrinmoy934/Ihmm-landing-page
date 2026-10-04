import crypto from 'crypto';
import { getCollection } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  description: 'description',
  status: 'status',
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

export const UserCategoryService = {
  async list(filters?: { archived?: boolean; search?: string }) {
    const coll = getCollection('user_categories');
    const pipeline: any[] = [];

    const match: any = {};
    if (filters?.archived !== undefined) {
      match.archived = filters.archived;
    }
    if (filters?.search) {
      match.name = { $regex: filters.search, $options: 'i' };
    }
    pipeline.push({ $match: match });

    // Lookup to count users per category name
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'name',
        foreignField: 'category',
        as: 'matched_users'
      }
    });

    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        status: 1,
        archived: 1,
        created_at: 1,
        updated_at: 1,
        userCount: { $size: '$matched_users' }
      }
    });

    pipeline.push({ $sort: { name: 1 } });

    const rows = await coll.aggregate(pipeline).toArray();
    return rows.map((row) => ({
      ...toApi(row),
      userCount: row.userCount,
    }));
  },

  async getById(id: string) {
    const coll = getCollection('user_categories');
    const doc = await coll.findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.name) throw new Error('name is required');
    const coll = getCollection('user_categories');
    const existing = await coll.findOne({ name: data.name });
    if (existing) throw new Error('Category name already exists');

    const fields = extract(data);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await coll.insertOne({
      _id,
      ...fields
    });
    const created = await coll.findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const coll = getCollection('user_categories');
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await coll.updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await coll.findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const coll = getCollection('user_categories');
    await coll.deleteOne({ _id: id });
  },

  async setArchived(id: string, archived: boolean) {
    const coll = getCollection('user_categories');
    await coll.updateOne(
      { _id: id },
      { $set: { archived, updated_at: new Date() } }
    );
    const updated = await coll.findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },
};
