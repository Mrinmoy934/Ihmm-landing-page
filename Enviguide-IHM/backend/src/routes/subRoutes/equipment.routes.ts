import { Router } from 'express';
import {
  listEquipment, getEquipment, createEquipment, updateEquipment, deleteEquipment,
} from '../../controller/equipment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/').get(listEquipment).post(createEquipment);
router.route('/:id').get(getEquipment).put(updateEquipment).delete(deleteEquipment);

export default router;
