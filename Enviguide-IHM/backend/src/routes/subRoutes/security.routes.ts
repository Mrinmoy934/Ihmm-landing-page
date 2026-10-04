// -- Security Routes --------------------------------------
// Users, rights, roles, categories, menus

import { Router } from 'express';
import {
  listUsers, getUser, createUser, updateUser, deleteUser,
  getUserRights, updateUserRights,
  getUserRoleRights, updateUserRoleRights,
  listUserCategories, createUserCategory,
  getUserMenu, updateUserMenu,
} from '../../controller/security.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

// Users (admin only for write)
router.get('/users',         listUsers);
router.post('/users',        authorize('superadmin'), createUser);
router.get('/users/:id',     getUser);
router.put('/users/:id',     authorize('admin', 'manager'), updateUser);
router.delete('/users/:id',  authorize('admin'), deleteUser);

// User Rights
router.get('/user-rights',        getUserRights);
router.put('/user-rights',        authorize('admin'), updateUserRights);

// User Role Rights
router.get('/user-role-rights',   getUserRoleRights);
router.put('/user-role-rights',   authorize('admin'), updateUserRoleRights);

// User Categories
router.get('/user-categories',    listUserCategories);
router.post('/user-categories',   authorize('admin'), createUserCategory);

// User Menu
router.get('/user-menu',          getUserMenu);
router.put('/user-menu',          authorize('admin'), updateUserMenu);

export default router;
