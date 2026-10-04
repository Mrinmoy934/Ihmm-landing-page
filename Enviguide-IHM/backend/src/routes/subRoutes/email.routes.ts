import { Router } from 'express';
import { sendGeneralEmail } from '../../controller/email.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.post('/', sendGeneralEmail);

export default router;
