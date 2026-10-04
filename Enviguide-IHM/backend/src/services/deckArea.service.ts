import crypto from 'crypto';
import { getDb } from '../config/database.js';

interface RectCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toApi(row: any) {
  if (!row) return null;
  return {
    id: row._id,
    gaPlanId: row.ga_plan_id,
    name: row.name,
    x: row.x as number,
    y: row.y as number,
    width: row.width as number,
    height: row.height as number,
    thumbnail: row.thumbnail,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Check if two rectangles overlap */
function rectsOverlap(a: RectCoords, b: RectCoords): boolean {
  if (a.x + a.width <= b.x) return false;
  if (b.x + b.width <= a.x) return false;
  if (a.y + a.height <= b.y) return false;
  if (b.y + b.height <= a.y) return false;
  return true;
}

export const DeckAreaService = {
  /** List all deck areas for a GA Plan */
  async getAreasForPlan(gaPlanId: string) {
    const db = getDb();
    const rows = await db.collection('deck_areas').find({ ga_plan_id: gaPlanId }).sort({ sort_order: 1 }).toArray();
    return rows.map(toApi);
  },

  /** Get a single deck area */
  async getAreaById(id: string, gaPlanId: string) {
    const db = getDb();
    const row = await db.collection('deck_areas').findOne({ _id: id, ga_plan_id: gaPlanId });
    return row ? toApi(row) : null;
  },

  /** Check if a name already exists in this GA Plan */
  async nameExists(gaPlanId: string, name: string, excludeId?: string) {
    const db = getDb();
    const query: any = {
      ga_plan_id: gaPlanId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await db.collection('deck_areas').countDocuments(query);
    return count > 0;
  },

  /** Check if new coordinates overlap with any existing area */
  async checkOverlap(gaPlanId: string, coords: RectCoords, excludeId?: string): Promise<string | null> {
    const db = getDb();
    const query: any = { ga_plan_id: gaPlanId };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const rows = await db.collection('deck_areas').find(query, { projection: { name: 1, x: 1, y: 1, width: 1, height: 1 } }).toArray();

    for (const area of rows) {
      if (rectsOverlap(coords, { x: area.x, y: area.y, width: area.width, height: area.height })) {
        return area.name;
      }
    }
    return null;
  },

  /** Create a new deck area */
  async createArea(data: {
    gaPlanId: string; name: string;
    x: number; y: number; width: number; height: number;
    thumbnail?: string;
  }) {
    const db = getDb();
    const cursor = db.collection('deck_areas').find({ ga_plan_id: data.gaPlanId }).sort({ sort_order: -1 }).limit(1);
    const rows = await cursor.toArray();
    const sortOrder = rows[0] ? (rows[0].sort_order as number) + 1 : 0;

    const _id = crypto.randomUUID();
    const fields = {
      _id,
      ga_plan_id: data.gaPlanId,
      name: data.name,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      thumbnail: data.thumbnail || null,
      sort_order: sortOrder,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('deck_areas').insertOne(fields);
    const created = await db.collection('deck_areas').findOne({ _id });
    return toApi(created);
  },

  /** Update a deck area */
  async updateArea(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fieldMap: Record<string, string> = {
      name: 'name', x: 'x', y: 'y', width: 'width',
      height: 'height', thumbnail: 'thumbnail',
    };

    const updateFields: Record<string, any> = {};
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data && data[key] !== undefined) {
        updateFields[col] = data[key];
      }
    }

    if (Object.keys(updateFields).length === 0) return null;

    updateFields['updated_at'] = new Date();
    await db.collection('deck_areas').updateOne(
      { _id: id },
      { $set: updateFields }
    );
    const updated = await db.collection('deck_areas').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Delete a deck area */
  async deleteArea(id: string) {
    const db = getDb();
    await db.collection('deck_areas').deleteOne({ _id: id });
  },

  /** Delete all deck areas for a GA Plan (reset) */
  async deleteAllAreas(gaPlanId: string) {
    const db = getDb();
    const result = await db.collection('deck_areas').deleteMany({ ga_plan_id: gaPlanId });
    return { count: result.deletedCount || 0 };
  },
};
