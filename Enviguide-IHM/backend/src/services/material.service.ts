import crypto from 'crypto';
import { getDb } from '../config/database.js';
import { SuspectedKeywordService } from './suspectedKeyword.service.js';

const SEVERITY_TO_CATEGORY: Record<string, string> = {
  Critical: 'hazard',
  High: 'hazard',
  Medium: 'warning',
  Low: 'warning',
};

/**
 * Mutates `data` in place: if any scanned field matches an active suspected keyword,
 * escalate category and fill hazard_type/hm_status. Explicit user input wins —
 * we only overwrite unset fields.
 */
async function applyKeywordAutoFlag(data: Record<string, unknown>): Promise<void> {
  const match = await SuspectedKeywordService.findMatch([
    data.name as string | undefined,
    data.materialName as string | undefined,
    data.description as string | undefined,
    data.component as string | undefined,
    data.equipment as string | undefined,
  ]);
  if (!match) return;

  if (!data.hazardType) data.hazardType = match.hazardType;
  if (!data.category || data.category === 'warning') {
    data.category = SEVERITY_TO_CATEGORY[match.severity] || 'warning';
  }
  if (!data.hmStatus && SEVERITY_TO_CATEGORY[match.severity] === 'hazard') {
    data.hmStatus = 'PHM'; // Potentially Hazardous Material
  }
}

// Column mapping: camelCase (API) -> snake_case (DB)
const FIELD_MAP: Record<string, string> = {
  name: 'name',
  ihmPart: 'ihm_part',
  category: 'category',
  hazardType: 'hazard_type',
  equipmentClass: 'equipment_class',
  hmStatus: 'hm_status',
  quantity: 'quantity',
  unit: 'unit',
  noOfPieces: 'no_of_pieces',
  totalQuantity: 'total_quantity',
  compartment: 'compartment',
  equipment: 'equipment',
  position: 'position',
  component: 'component',
  materialName: 'material_name',
  shipPO: 'ship_po',
  movementType: 'movement_type',
  manufacturer: 'manufacturer',
  ihmPartNumber: 'ihm_part_number',
  description: 'description',
  remarks: 'remarks',
  avoidUpdation: 'avoid_updation',
  pinX: 'pin_x',
  pinY: 'pin_y',
};

const REVERSE_MAP: Record<string, string> = {};
for (const [camel, snake] of Object.entries(FIELD_MAP)) {
  REVERSE_MAP[snake] = camel;
}
REVERSE_MAP['id'] = 'id';
REVERSE_MAP['vessel_id'] = 'vesselId';
REVERSE_MAP['deck_id'] = 'deckId';
REVERSE_MAP['deck_area_id'] = 'deckAreaId';
REVERSE_MAP['created_at'] = 'createdAt';
REVERSE_MAP['updated_at'] = 'updatedAt';

function toApi(row: any) {
  if (!row) return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === '_id') {
      result['id'] = value;
    } else {
      const camel = REVERSE_MAP[key] || key;
      result[camel] = value;
    }
  }
  // Construct pin object for frontend convenience
  if (result.pinX !== null && result.pinX !== undefined && result.pinY !== null && result.pinY !== undefined) {
    result.pin = { x: Number(result.pinX), y: Number(result.pinY) };
  } else {
    result.pin = null;
  }
  return result;
}

function extractFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(FIELD_MAP)) {
    if (camel in data && data[camel] !== undefined) {
      fields[snake] = data[camel];
    }
  }
  return fields;
}

export const MaterialService = {
  /** List all materials for a vessel, optionally filtered by deck or deck area */
  async getMaterialsForVessel(vesselId: string, deckId?: string, deckAreaId?: string) {
    const db = getDb();
    const match: any = { vessel_id: vesselId };
    if (deckId) {
      match.deck_id = deckId;
    }
    if (deckAreaId) {
      match.deck_area_id = deckAreaId;
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'decks',
          localField: 'deck_id',
          foreignField: '_id',
          as: 'deck'
        }
      },
      { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
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
          deck_id: 1,
          deck_area_id: 1,
          name: 1,
          ihm_part: 1,
          category: 1,
          hazard_type: 1,
          equipment_class: 1,
          hm_status: 1,
          quantity: 1,
          unit: 1,
          no_of_pieces: 1,
          total_quantity: 1,
          compartment: 1,
          equipment: 1,
          position: 1,
          component: 1,
          material_name: 1,
          ship_po: 1,
          movement_type: 1,
          manufacturer: 1,
          ihm_part_number: 1,
          description: 1,
          remarks: 1,
          avoid_updation: 1,
          pin_x: 1,
          pin_y: 1,
          created_at: 1,
          updated_at: 1,
          deck_name: '$deck.name',
          deck_area_name: '$deck_area.name'
        }
      },
      { $sort: { created_at: -1 } }
    ];

    const rows = await db.collection('materials').aggregate(pipeline).toArray();
    return rows.map((row) => ({
      ...toApi(row),
      deckName: row.deck_name || null,
      deckAreaName: row.deck_area_name || null,
    }));
  },

  /** Get materials grouped by deck for mapping view */
  async getMaterialMapping(vesselId: string) {
    const db = getDb();
    const pipeline: any[] = [
      { $match: { vessel_id: vesselId } },
      {
        $lookup: {
          from: 'decks',
          localField: 'deck_id',
          foreignField: '_id',
          as: 'deck'
        }
      },
      { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
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
          deck_id: 1,
          deck_area_id: 1,
          name: 1,
          ihm_part: 1,
          category: 1,
          hazard_type: 1,
          equipment_class: 1,
          hm_status: 1,
          quantity: 1,
          unit: 1,
          no_of_pieces: 1,
          total_quantity: 1,
          compartment: 1,
          equipment: 1,
          position: 1,
          component: 1,
          material_name: 1,
          ship_po: 1,
          movement_type: 1,
          manufacturer: 1,
          ihm_part_number: 1,
          description: 1,
          remarks: 1,
          avoid_updation: 1,
          pin_x: 1,
          pin_y: 1,
          created_at: 1,
          updated_at: 1,
          deck_name: '$deck.name',
          deck_thumbnail: '$deck_area.thumbnail'
        }
      },
      { $sort: { deck_name: 1, created_at: 1 } }
    ];

    const rows = await db.collection('materials').aggregate(pipeline).toArray();

    const mapping: Record<string, { deckId: string; deckName: string; deckThumbnail: string | null; materials: unknown[] }> = {};
    for (const row of rows) {
      const dId = (row.deck_id as string) || 'unassigned';
      if (!mapping[dId]) {
        mapping[dId] = {
          deckId: dId,
          deckName: (row.deck_name as string) || 'Unassigned',
          deckThumbnail: (row.deck_thumbnail as string) || null,
          materials: [],
        };
      }
      mapping[dId].materials.push(toApi(row));
    }

    return Object.values(mapping);
  },

  /** Get a single material by ID */
  async getMaterialById(id: string, vesselId: string) {
    const db = getDb();
    const pipeline: any[] = [
      { $match: { _id: id, vessel_id: vesselId } },
      {
        $lookup: {
          from: 'decks',
          localField: 'deck_id',
          foreignField: '_id',
          as: 'deck'
        }
      },
      { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
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
          deck_id: 1,
          deck_area_id: 1,
          name: 1,
          ihm_part: 1,
          category: 1,
          hazard_type: 1,
          equipment_class: 1,
          hm_status: 1,
          quantity: 1,
          unit: 1,
          no_of_pieces: 1,
          total_quantity: 1,
          compartment: 1,
          equipment: 1,
          position: 1,
          component: 1,
          material_name: 1,
          ship_po: 1,
          movement_type: 1,
          manufacturer: 1,
          ihm_part_number: 1,
          description: 1,
          remarks: 1,
          avoid_updation: 1,
          pin_x: 1,
          pin_y: 1,
          created_at: 1,
          updated_at: 1,
          deck_name: '$deck.name',
          deck_area_name: '$deck_area.name'
        }
      }
    ];

    const rows = await db.collection('materials').aggregate(pipeline).toArray();
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...toApi(row),
      deckName: row.deck_name || null,
      deckAreaName: row.deck_area_name || null,
    };
  },

  /** Create a material entry */
  async createMaterial(data: Record<string, unknown>, vesselId: string, deckId?: string, deckAreaId?: string) {
    const db = getDb();
    await applyKeywordAutoFlag(data);
    const fields = extractFields(data);
    fields['vessel_id'] = vesselId;
    fields['deck_id'] = deckId || null;
    fields['deck_area_id'] = deckAreaId || null;
    fields['created_at'] = new Date();
    fields['updated_at'] = new Date();

    const _id = crypto.randomUUID();
    await db.collection('materials').insertOne({
      _id,
      ...fields
    });
    const created = await db.collection('materials').findOne({ _id });
    return toApi(created);
  },

  /** Update a material entry */
  async updateMaterial(id: string, data: Record<string, unknown>) {
    const db = getDb();
    await applyKeywordAutoFlag(data);
    const fields = extractFields(data);

    if ('deckId' in data) {
      fields['deck_id'] = data.deckId || null;
    }
    if ('deckAreaId' in data) {
      fields['deck_area_id'] = data.deckAreaId || null;
    }

    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('materials').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('materials').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Delete a material entry */
  async deleteMaterial(id: string) {
    const db = getDb();
    await db.collection('materials').deleteOne({ _id: id });
  },

  /** Transfer a material to a different deck (clears pin — needs re-mapping) */
  async transferMaterial(id: string, newDeckId: string) {
    const db = getDb();
    await db.collection('materials').updateOne(
      { _id: id },
      { $set: { deck_id: newDeckId, pin_x: null, pin_y: null, updated_at: new Date() } }
    );
    const updated = await db.collection('materials').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Complete a re-mapping after transfer: set new pin + update fields */
  async remapMaterial(id: string, data: Record<string, unknown>) {
    const db = getDb();
    const fields = extractFields(data);

    if ('deckId' in data) {
      fields['deck_id'] = data.deckId || null;
    }
    if ('deckAreaId' in data) {
      fields['deck_area_id'] = data.deckAreaId || null;
    }

    if (Object.keys(fields).length === 0) return null;

    fields['updated_at'] = new Date();
    await db.collection('materials').updateOne(
      { _id: id },
      { $set: fields }
    );
    const updated = await db.collection('materials').findOne({ _id: id });
    return updated ? toApi(updated) : null;
  },

  /** Get material count per vessel (for dashboard) */
  async getMaterialCount(vesselId: string) {
    const db = getDb();
    return db.collection('materials').countDocuments({ vessel_id: vesselId });
  },

  /** Get material summary by IHM Part for a vessel */
  async getMaterialSummary(vesselId: string) {
    const db = getDb();
    const rows = await db.collection('materials').aggregate([
      { $match: { vessel_id: vesselId } },
      {
        $group: {
          _id: { ihm_part: '$ihm_part', category: '$category' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          ihm_part: '$_id.ihm_part',
          category: '$_id.category',
          count: 1
        }
      },
      { $sort: { ihm_part: 1, category: 1 } }
    ]).toArray();
    return rows;
  },
};
