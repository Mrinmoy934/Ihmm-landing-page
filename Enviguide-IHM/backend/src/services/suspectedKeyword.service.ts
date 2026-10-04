import crypto from 'crypto';
import { getDb } from '../config/database.js';

const FIELD_MAP: Record<string, string> = {
  keyword: 'keyword',
  hazardType: 'hazard_type',
  severity: 'severity',
  status: 'status',
  notes: 'notes',
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

export interface KeywordMatch {
  keyword: string;
  hazardType: string | null;
  severity: string;
}

let cache: KeywordMatch[] | null = null;

export const SuspectedKeywordService = {
  invalidateCache() {
    cache = null;
  },

  async list(filters?: { status?: string; hazardType?: string; search?: string }) {
    const db = getDb();
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.hazardType) {
      query.hazard_type = filters.hazardType;
    }
    if (filters?.search) {
      const regex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { keyword: regex },
        { hazard_type: regex }
      ];
    }

    const rows = await db.collection('suspected_keywords').find(query).sort({ keyword: 1 }).toArray();
    return rows.map(toApi);
  },

  async getById(id: string) {
    const db = getDb();
    const doc = await db.collection('suspected_keywords').findOne({ _id: id });
    return doc ? toApi(doc) : null;
  },

  async create(data: Record<string, unknown>) {
    if (!data.keyword) throw new Error('keyword is required');
    const db = getDb();
    const existing = await db.collection('suspected_keywords').findOne({ keyword: data.keyword });
    if (existing) throw new Error('Keyword already registered');

    const fields = extract(data);
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();
    const _id = crypto.randomUUID();

    await db.collection('suspected_keywords').insertOne({
      _id,
      ...fields
    });
    this.invalidateCache();
    const created = await db.collection('suspected_keywords').findOne({ _id });
    return toApi(created);
  },

  async update(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extract(data);
    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('suspected_keywords').updateOne(
      { _id: id },
      { $set: fields }
    );
    this.invalidateCache();
    const updated = await db.collection('suspected_keywords').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  async delete(id: string) {
    const db = getDb();
    await db.collection('suspected_keywords').deleteOne({ _id: id });
    this.invalidateCache();
  },

  async getActiveKeywords(): Promise<KeywordMatch[]> {
    if (cache) return cache;
    const db = getDb();
    const rows = await db.collection('suspected_keywords').find({ status: 'Active' }).toArray();
    cache = rows.map((row: any) => ({
      keyword: (row.keyword as string).toUpperCase(),
      hazardType: (row.hazard_type as string) || null,
      severity: (row.severity as string) || 'Medium',
    }));
    return cache;
  },

  /**
   * Scan a material's text fields against active keywords.
   * Returns the strongest match (Critical > High > Medium > Low).
   */
  async findMatch(fields: Array<string | null | undefined>): Promise<KeywordMatch | null> {
    const keywords = await this.getActiveKeywords();
    if (keywords.length === 0) return null;

    const haystack = fields
      .filter((f): f is string => Boolean(f))
      .join(' ')
      .toUpperCase();
    if (!haystack) return null;

    const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    let best: KeywordMatch | null = null;

    for (const kw of keywords) {
      if (haystack.includes(kw.keyword)) {
        if (!best || (SEVERITY_RANK[kw.severity] || 0) > (SEVERITY_RANK[best.severity] || 0)) {
          best = kw;
        }
      }
    }
    return best;
  },
};
