import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  documentType: 'document_type',
  category: 'category',
  status: 'status',
  fileName: 'file_name',
  filePath: 'file_path',
  fileSize: 'file_size',
  mimeType: 'mime_type',
  uploadedBy: 'uploaded_by',
  description: 'description',
  storageKey: 'storage_key',
};

const REVERSE_MAP: Record<string, string> = {};
for (const [c, s] of Object.entries(FIELD_MAP)) REVERSE_MAP[s] = c;
REVERSE_MAP['id'] = 'id';
REVERSE_MAP['vessel_id'] = 'vesselId';
REVERSE_MAP['created_at'] = 'createdAt';
REVERSE_MAP['updated_at'] = 'updatedAt';

function toApi(row: any) {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === '_id') {
      out['id'] = v;
    } else {
      out[REVERSE_MAP[k] || k] = v;
    }
  }
  return out;
}

function extractFields(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [c, s] of Object.entries(FIELD_MAP)) {
    if (c in data && data[c] !== undefined) {
      fields[s] = data[c];
    }
  }
  return fields;
}

export const DocumentService = {
  async getDocumentsForVessel(vesselId: string, filters?: { documentType?: string; status?: string; search?: string }) {
    const db = getDb();
    const query: any = { vessel_id: vesselId };

    if (filters?.documentType) {
      query.document_type = filters.documentType;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { name: regex },
        { file_name: regex }
      ];
    }

    const rows = await db.collection('documents').find(query).sort({ created_at: -1 }).toArray();
    return rows.map(toApi);
  },

  async getDocumentById(id: string, vesselId: string) {
    const db = getDb();
    const doc = await db.collection('documents').findOne({ _id: id, vessel_id: vesselId });
    return doc ? toApi(doc) : null;
  },

  async createDocument(data: Record<string, unknown>, vesselId: string) {
    const db = getDb();
    const fields = extractFields(data);
    fields['vessel_id'] = vesselId;
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('documents').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('documents').findOne({ _id });
    return toApi(created);
  },

  async updateDocument(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extractFields(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('documents').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('documents').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async deleteDocument(id: string) {
    const db = getDb();
    await db.collection('documents').deleteOne({ _id: id });
  },

  async getDocumentCount(vesselId: string) {
    const db = getDb();
    return db.collection('documents').countDocuments({ vessel_id: vesselId });
  },
};
