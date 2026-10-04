// -- Contact / CMS Routes ----------------------------------
// POST   /api/v1/contact                 (PUBLIC — form submission)
// GET    /api/v1/contact                 (admin — list)
// GET    /api/v1/contact/:id             (admin)
// PUT    /api/v1/contact/:id             (admin — update status)
// DELETE /api/v1/contact/:id             (admin)
import { Router } from 'express';
import {
  submitMessage, listMessages, getMessage, updateMessage, deleteMessage,
} from '../../controller/contact.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', submitMessage); // public

router.use(authenticate);
router.get('/', listMessages);
router.route('/:id')
  .get(getMessage)
  .put(authorize('admin'), updateMessage)
  .delete(authorize('admin'), deleteMessage);

export default router;
