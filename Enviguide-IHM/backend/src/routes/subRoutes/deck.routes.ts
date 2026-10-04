// -- Deck Routes (nested under /vessels/:vesselId/decks) ----
// GET    /api/v1/vessels/:vesselId/decks              (list all decks)
// POST   /api/v1/vessels/:vesselId/decks              (create deck from crop)
// GET    /api/v1/vessels/:vesselId/decks/:deckId       (get single deck)
// PUT    /api/v1/vessels/:vesselId/decks/:deckId       (update deck)
// DELETE /api/v1/vessels/:vesselId/decks/:deckId       (delete deck)

import { Router } from 'express';
import {
  listDecks, createDeck, getDeck, updateDeck, deleteDeck,
} from '../../controller/deck.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.route('/')
  .get(listDecks)
  .post(createDeck);

router.route('/:deckId')
  .get(getDeck)
  .put(updateDeck)
  .delete(deleteDeck);

export default router;
