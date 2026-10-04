import crypto from 'crypto';
import { getDb } from '../config/database.js';
import fs from 'fs/promises';

function toApi(row: any): Record<string, unknown> {
  if (!row) return {};
  return {
    id: row._id,
    vesselId: row.vessel_id,
    name: row.name,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GAPlanService = {
  /** List all GA Plans for a vessel */
  async getPlansForVessel(vesselId: string) {
    const db = getDb();
    const rows = await db.collection('ga_plans').aggregate([
      { $match: { vessel_id: vesselId } },
      {
        $lookup: {
          from: 'deck_areas',
          localField: '_id',
          foreignField: 'ga_plan_id',
          as: 'deck_areas'
        }
      },
      {
        $project: {
          _id: 1,
          vessel_id: 1,
          name: 1,
          file_name: 1,
          file_path: 1,
          file_size: 1,
          mime_type: 1,
          created_at: 1,
          updated_at: 1,
          deck_area_count: { $size: '$deck_areas' }
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();

    return rows.map((row) => ({
      ...toApi(row),
      _count: { deckAreas: row.deck_area_count },
    }));
  },

  /** Get a single GA Plan with all its deck areas */
  async getPlanById(id: string, vesselId: string) {
    const db = getDb();
    const plan = await db.collection('ga_plans').findOne({ _id: id, vessel_id: vesselId });
    if (!plan) return null;

    const areas = await db.collection('deck_areas').find({ ga_plan_id: id }).sort({ sort_order: 1 }).toArray();

    return {
      ...toApi(plan),
      deckAreas: areas.map((r) => ({
        id: r._id, gaPlanId: r.ga_plan_id, name: r.name,
        x: r.x, y: r.y, width: r.width, height: r.height,
        thumbnail: r.thumbnail, sortOrder: r.sort_order,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
    };
  },

  /** Create a GA Plan record */
  async createPlan(data: {
    vesselId: string; name: string; fileName: string;
    filePath: string; fileSize: number; mimeType: string;
  }) {
    const db = getDb();
    const _id = crypto.randomUUID();
    const fields = {
      _id,
      vessel_id: data.vesselId,
      name: data.name,
      file_name: data.fileName,
      file_path: data.filePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('ga_plans').insertOne(fields);
    const created = await db.collection('ga_plans').findOne({ _id });
    return { ...toApi(created), _count: { deckAreas: 0 } };
  },

  /** Update GA Plan name */
  async updatePlan(id: string, name: string) {
    const db = getDb();
    await db.collection('ga_plans').updateOne(
      { _id: id },
      { $set: { name, updated_at: new Date() } }
    );
    const updated = await db.collection('ga_plans').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Delete a GA Plan and its file from disk */
  async deletePlan(id: string) {
    const db = getDb();
    const plan = await db.collection('ga_plans').findOne({ _id: id });
    if (!plan) return null;

    // Delete GA plan and its deck areas
    await db.collection('ga_plans').deleteOne({ _id: id });
    await db.collection('deck_areas').deleteMany({ ga_plan_id: id });

    // Delete file from disk (best-effort)
    try {
      await fs.unlink(plan.file_path);
    } catch {
      // File may already be missing
    }

    return toApi(plan);
  },
};
