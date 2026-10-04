import { Router } from 'express';
import {
  listKeywords, getKeyword, createKeyword,
  updateKeyword, deleteKeyword, matchKeyword,
} from '../../controller/suspectedKeyword.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.post('/match', matchKeyword);

router.route('/').get(listKeywords).post(createKeyword);
router.route('/:id').get(getKeyword).put(updateKeyword).delete(deleteKeyword);

export default router;
