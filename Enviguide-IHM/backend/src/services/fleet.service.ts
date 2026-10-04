import crypto from 'crypto';
import { getDb } from '../config/database.js';

interface FleetRow {
  _id: string;
  name: string;
  owner: string;
  manager: string;
  created_at: Date;
  updated_at: Date;
}

export interface FleetApi {
  id: string;
  name: string;
  owner: string;
  manager: string;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: any): FleetApi {
  return {
    id: row._id,
    name: row.name,
    owner: row.owner,
    manager: row.manager,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

export const FleetService = {
  async getFleets(filters?: { search?: string; limit?: number; offset?: number }) {
    const db = getDb();
    const query: any = {};

    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { name: regex },
        { owner: regex },
        { manager: regex }
      ];
    }

    const limit = filters?.limit ?? 10;
    const offset = filters?.offset ?? 0;

    const cursor = db.collection('fleets')
      .find(query)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    const rows = await cursor.toArray();
    const total = await db.collection('fleets').countDocuments(query);

    return {
      data: rows.map(toApi),
      total
    };
  },

  async getFleetById(id: string): Promise<FleetApi | null> {
    const db = getDb();
    const row = await db.collection('fleets').findOne({ _id: id });
    return row ? toApi(row) : null;
  },

  async createFleet(data: { name: string; owner?: string; manager?: string }): Promise<FleetApi> {
    const db = getDb();
    const _id = crypto.randomUUID();
    const newDoc: FleetRow = {
      _id,
      name: data.name,
      owner: data.owner || '-',
      manager: data.manager || '-',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('fleets').insertOne(newDoc);
    return toApi(newDoc);
  },

  async updateFleet(id: string, data: { name?: string; owner?: string; manager?: string }): Promise<FleetApi | null> {
    const db = getDb();
    const updateFields: any = { updated_at: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.owner !== undefined) updateFields.owner = data.owner || '-';
    if (data.manager !== undefined) updateFields.manager = data.manager || '-';

    await db.collection('fleets').updateOne({ _id: id }, { $set: updateFields });
    return this.getFleetById(id);
  },

  async deleteFleet(id: string): Promise<boolean> {
    const db = getDb();
    const res = await db.collection('fleets').deleteOne({ _id: id });
    return (res.deletedCount ?? 0) > 0;
  }
};
