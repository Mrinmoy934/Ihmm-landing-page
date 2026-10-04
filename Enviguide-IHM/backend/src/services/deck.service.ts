import crypto from 'crypto';
import { getDb } from '../config/database.js';

function toApi(row: any) {
  if (!row) return null;
  return {
    id: row._id,
    vesselId: row.vessel_id,
    gaPlanId: row.ga_plan_id,
    deckAreaId: row.deck_area_id,
    name: row.name,
    level: row.level,
    gaPlanUrl: row.ga_plan_url,
    thumbnail: row.thumbnail,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DeckService = {
  /** List all decks for a vessel — includes mapped material count per deck */
  async getDecksForVessel(vesselId: string) {
    const db = getDb();
    const pipeline = [
      { $match: { vessel_id: vesselId } },
      // Lookup deck area
      {
        $lookup: {
          from: 'deck_areas',
          localField: 'deck_area_id',
          foreignField: '_id',
          as: 'deck_area'
        }
      },
      { $unwind: { path: '$deck_area', preserveNullAndEmptyArrays: true } },
      // Lookup materials count
      {
        $lookup: {
          from: 'materials',
          localField: '_id',
          foreignField: 'deck_id',
          as: 'materials'
        }
      },
      {
        $project: {
          _id: 1,
          vessel_id: 1,
          ga_plan_id: 1,
          deck_area_id: 1,
          name: 1,
          level: 1,
          ga_plan_url: 1,
          thumbnail: 1,
          status: 1,
          created_at: 1,
          updated_at: 1,
          x: '$deck_area.x',
          y: '$deck_area.y',
          width: '$deck_area.width',
          height: '$deck_area.height',
          material_count: { $size: '$materials' }
        }
      },
      { $sort: { level: 1, created_at: 1 } }
    ];

    const rows = await db.collection('decks').aggregate(pipeline).toArray();
    return rows.map((row) => ({
      ...toApi(row),
      mappedItemsCount: row.material_count,
      cropCoordinates: row.deck_area_id
        ? { x: row.x, y: row.y, width: row.width, height: row.height }
        : null,
    }));
  },

  /** Get a single deck */
  async getDeckById(id: string, vesselId: string) {
    const db = getDb();
    const pipeline = [
      { $match: { _id: id, vessel_id: vesselId } },
      // Lookup deck area
      {
        $lookup: {
          from: 'deck_areas',
          localField: 'deck_area_id',
          foreignField: '_id',
          as: 'deck_area'
        }
      },
      { $unwind: { path: '$deck_area', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          vessel_id: 1,
          ga_plan_id: 1,
          deck_area_id: 1,
          name: 1,
          level: 1,
          ga_plan_url: 1,
          thumbnail: 1,
          status: 1,
          created_at: 1,
          updated_at: 1,
          x: '$deck_area.x',
          y: '$deck_area.y',
          width: '$deck_area.width',
          height: '$deck_area.height'
        }
      }
    ];

    const rows = await db.collection('decks').aggregate(pipeline).toArray();
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...toApi(row),
      cropCoordinates: row.deck_area_id
        ? { x: row.x, y: row.y, width: row.width, height: row.height }
        : null,
    };
  },

  /** Create a deck (from a cropped deck area on a GA Plan) */
  async createDeck(data: {
    vesselId: string;
    gaPlanId?: string;
    deckAreaId?: string;
    name: string;
    level?: number;
    gaPlanUrl?: string;
    thumbnail?: string;
  }) {
    const db = getDb();
    let level = data.level;
    if (level === undefined) {
      const cursor = db.collection('decks').find({ vessel_id: data.vesselId }).sort({ level: -1 }).limit(1);
      const rows = await cursor.toArray();
      level = rows[0] ? (rows[0].level as number) + 1 : 0;
    }

    const _id = crypto.randomUUID();
    const fields = {
      _id,
      vessel_id: data.vesselId,
      ga_plan_id: data.gaPlanId || null,
      deck_area_id: data.deckAreaId || null,
      name: data.name,
      level,
      ga_plan_url: data.gaPlanUrl || null,
      thumbnail: data.thumbnail || null,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('decks').insertOne(fields);
    const created = await db.collection('decks').findOne({ _id });
    return toApi(created);
  },

  /** Update a deck */
  async updateDeck(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fieldMap: Record<string, string> = {
      name: 'name',
      level: 'level',
      gaPlanUrl: 'ga_plan_url',
      thumbnail: 'thumbnail',
      status: 'status',
    };

    const updateFields: Record<string, any> = {};
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data && data[key] !== undefined) {
        updateFields[col] = data[key];
      }
    }

    if (Object.keys(updateFields).length === 0) return null;

    updateFields['updated_at'] = new Date();
    await db.collection('decks').updateOne(
      { _id: id },
      { $set: updateFields }
    );
    const updated = await db.collection('decks').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Delete a deck */
  async deleteDeck(id: string) {
    const db = getDb();
    await db.collection('decks').deleteOne({ _id: id });
  },

  /** Check if a deck name already exists for this vessel */
  async nameExists(vesselId: string, name: string, excludeId?: string) {
    const db = getDb();
    const query: any = {
      vessel_id: vesselId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await db.collection('decks').countDocuments(query);
    return count > 0;
  },

  /** Get deck count for a vessel */
  async getDeckCount(vesselId: string) {
    const db = getDb();
    return db.collection('decks').countDocuments({ vessel_id: vesselId });
  },
};
