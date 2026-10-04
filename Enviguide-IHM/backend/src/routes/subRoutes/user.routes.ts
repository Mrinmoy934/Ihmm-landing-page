// -- User Admin Routes -------------------------------------
// GET    /api/v1/users                  (list, ?status= ?category= ?search=)
// POST   /api/v1/users                  (create — admin)
// GET    /api/v1/users/me               (own profile)
// PUT    /api/v1/users/me               (update own profile)
// POST   /api/v1/users/me/avatar        (upload avatar)
// GET    /api/v1/users/:id
// PUT    /api/v1/users/:id              (update — admin)
// DELETE /api/v1/users/:id              (admin)
// POST   /api/v1/users/:id/role         (assign role)

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  listUsers, getUser, createUser, updateUser, deleteUser,
  assignUserRole, getMyProfile, updateMyProfile, uploadAvatar,
  createUsersBulk,
} from '../../controller/user.controller.js';
import { authenticate, authorize, requirePermission } from '../../middleware/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const upload = multer({
  dest: avatarDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const router = Router();
router.use(authenticate);

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);

router.post('/bulk', authorize('admin', 'superadmin'), requirePermission('security_create'), createUsersBulk);

router.route('/')
  .get(listUsers)
  .post(authorize('admin', 'superadmin'), requirePermission('security_create'), createUser);

router.post('/:id/role', authorize('admin', 'superadmin'), requirePermission('security_update'), assignUserRole);

router.route('/:id')
  .get(getUser)
  .put(authorize('admin', 'superadmin'), requirePermission('security_update'), updateUser)
  .delete(authorize('admin', 'superadmin'), requirePermission('security_delete'), deleteUser);

export default router;
