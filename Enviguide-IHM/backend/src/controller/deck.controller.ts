import type { Request, Response, NextFunction } from 'express';
import { DeckService } from '../services/deck.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

/** Verify vessel ownership — returns vessel or calls next(err) */
async function verifyVessel(userId: string, vesselId: string, next: NextFunction) {
  const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
  if (!vessel) { next(createError('Vessel not found', 404)); return null; }
  return vessel;
}

/** Check project section is complete before allowing deck operations */
function isProjectComplete(vessel: Record<string, unknown>): { ok: boolean; missing: string[] } {
  const required: { key: string; label: string }[] = [
    { key: 'name', label: 'Vessel Name' },
    { key: 'imoNumber', label: 'IMO Number' },
    { key: 'shipOwner', label: 'Ship Owner' },
    { key: 'vesselType', label: 'Vessel Type' },
    { key: 'flagState', label: 'Flag State' },
    { key: 'grossTonnage', label: 'Gross Tonnage' },
  ];
  const missing: string[] = [];
  for (const f of required) {
    const v = vessel[f.key];
    if (!v || (typeof v === 'string' && v.trim() === '')) missing.push(f.label);
  }
  return { ok: missing.length === 0, missing };
}

/** GET /api/v1/vessels/:vesselId/decks */
export async function listDecks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await verifyVessel(req.user!.userId, vesselId, next);
    if (!vessel) return;

    const decks = await DeckService.getDecksForVessel(vesselId);
    const count = await DeckService.getDeckCount(vesselId);
    res.json({ success: true, data: decks, total: count });
  } catch (err) { next(err); }
}

/** POST /api/v1/vessels/:vesselId/decks */
export async function createDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await verifyVessel(req.user!.userId, vesselId, next);
    if (!vessel) return;

    // Enforce project completion
    const check = isProjectComplete(vessel as Record<string, unknown>);
    if (!check.ok) {
      return next(createError(
        `Please complete the Project section first. Missing: ${check.missing.join(', ')}`,
        400,
      ));
    }

    const { name, gaPlanId, deckAreaId, level, gaPlanUrl, thumbnail } = req.body as {
      name?: string; gaPlanId?: string; deckAreaId?: string;
      level?: number; gaPlanUrl?: string; thumbnail?: string;
    };

    if (!name || name.trim().length === 0) {
      return next(createError('Deck name is required', 400));
    }

    // No duplicate deck names per vessel
    const nameExists = await DeckService.nameExists(vesselId, name.trim());
    if (nameExists) {
      return next(createError(`A deck named "${name.trim()}" already exists for this vessel.`, 409));
    }

    const deck = await DeckService.createDeck({
      vesselId,
      gaPlanId,
      deckAreaId,
      name: name.trim(),
      level,
      gaPlanUrl,
      thumbnail,
    });

    res.status(201).json({ success: true, data: deck });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/decks/:deckId */
export async function getDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const deckId = req.params.deckId as string;
    const vessel = await verifyVessel(req.user!.userId, vesselId, next);
    if (!vessel) return;

    const deck = await DeckService.getDeckById(deckId, vesselId);
    if (!deck) return next(createError('Deck not found', 404));

    res.json({ success: true, data: deck });
  } catch (err) { next(err); }
}

/** PUT /api/v1/vessels/:vesselId/decks/:deckId */
export async function updateDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const deckId = req.params.deckId as string;
    const vessel = await verifyVessel(req.user!.userId, vesselId, next);
    if (!vessel) return;

    const existing = await DeckService.getDeckById(deckId, vesselId);
    if (!existing) return next(createError('Deck not found', 404));

    const { name } = req.body as { name?: string };

    // If name is changing, check for duplicates
    if (name && name.trim() !== existing.name) {
      const nameExists = await DeckService.nameExists(vesselId, name.trim(), deckId);
      if (nameExists) {
        return next(createError(`A deck named "${name.trim()}" already exists for this vessel.`, 409));
      }
    }

    const deck = await DeckService.updateDeck(deckId, req.body as Record<string, unknown>);
    res.json({ success: true, data: deck });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/vessels/:vesselId/decks/:deckId */
export async function deleteDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const deckId = req.params.deckId as string;
    const vessel = await verifyVessel(req.user!.userId, vesselId, next);
    if (!vessel) return;

    const existing = await DeckService.getDeckById(deckId, vesselId);
    if (!existing) return next(createError('Deck not found', 404));

    await DeckService.deleteDeck(deckId);
    res.status(204).send();
  } catch (err) { next(err); }
}
