import crypto from 'crypto';
import { getDb } from '../config/database.js';

interface SubFleetRow {
  _id: string;
  name: string;
  parent_fleet_id: string;
  parent_fleet_name: string;
  owner: string;
  manager: string;
  created_at: Date;
  updated_at: Date;
}

export interface SubFleetApi {
  id: string;
  name: string;
  parentFleetId: string;
  parentFleetName: string;
  owner: string;
  manager: string;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: any): SubFleetApi {
  return {
    id: row._id,
    name: row.name,
    parentFleetId: row.parent_fleet_id,
    parentFleetName: row.parent_fleet_name,
    owner: row.owner,
    manager: row.manager,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

export const SubFleetService = {
  async getSubFleets(filters?: { search?: string; limit?: number; offset?: number }) {
    const db = getDb();
    const query: any = {};

    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { name: regex },
        { parent_fleet_name: regex },
        { owner: regex },
        { manager: regex }
      ];
    }

    const limit = filters?.limit ?? 10;
    const offset = filters?.offset ?? 0;

    const cursor = db.collection('sub_fleets')
      .find(query)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    const rows = await cursor.toArray();
    const total = await db.collection('sub_fleets').countDocuments(query);

    return {
      data: rows.map(toApi),
      total
    };
  },

  async getSubFleetById(id: string): Promise<SubFleetApi | null> {
    const db = getDb();
    const row = await db.collection('sub_fleets').findOne({ _id: id });
    return row ? toApi(row) : null;
  },

  async createSubFleet(data: { name: string; parentFleetId: string; parentFleetName: string; owner?: string; manager?: string }): Promise<SubFleetApi> {
    const db = getDb();
    const _id = crypto.randomUUID();
    const newDoc: SubFleetRow = {
      _id,
      name: data.name,
      parent_fleet_id: data.parentFleetId,
      parent_fleet_name: data.parentFleetName,
      owner: data.owner || '-',
      manager: data.manager || '-',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('sub_fleets').insertOne(newDoc);
    return toApi(newDoc);
  },

  async updateSubFleet(id: string, data: { name?: string; parentFleetId?: string; parentFleetName?: string; owner?: string; manager?: string }): Promise<SubFleetApi | null> {
    const db = getDb();
    const updateFields: any = { updated_at: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.parentFleetId !== undefined) updateFields.parent_fleet_id = data.parentFleetId;
    if (data.parentFleetName !== undefined) updateFields.parent_fleet_name = data.parentFleetName;
    if (data.owner !== undefined) updateFields.owner = data.owner || '-';
    if (data.manager !== undefined) updateFields.manager = data.manager || '-';

    await db.collection('sub_fleets').updateOne({ _id: id }, { $set: updateFields });
    return this.getSubFleetById(id);
  },

  async deleteSubFleet(id: string): Promise<boolean> {
    const db = getDb();
    const res = await db.collection('sub_fleets').deleteOne({ _id: id });
    return (res.deletedCount ?? 0) > 0;
  }
};
