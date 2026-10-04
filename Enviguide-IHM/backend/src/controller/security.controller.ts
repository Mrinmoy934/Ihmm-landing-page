// â"€â"€ Security Controller â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
import type { Request, Response, NextFunction } from 'express';

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: [] }); } catch (err) { next(err); }
}
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: { id: req.params['id'] } }); } catch (err) { next(err); }
}
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json({ success: true, data: req.body }); } catch (err) { next(err); }
}
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: req.body }); } catch (err) { next(err); }
}
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { void req.params['id']; res.status(204).send(); } catch (err) { next(err); }
}
export async function getUserRights(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: [] }); } catch (err) { next(err); }
}
export async function updateUserRights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: req.body }); } catch (err) { next(err); }
}
export async function getUserRoleRights(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: [] }); } catch (err) { next(err); }
}
export async function updateUserRoleRights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: req.body }); } catch (err) { next(err); }
}
export async function listUserCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: [] }); } catch (err) { next(err); }
}
export async function createUserCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json({ success: true, data: req.body }); } catch (err) { next(err); }
}
export async function getUserMenu(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: [] }); } catch (err) { next(err); }
}
export async function updateUserMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: req.body }); } catch (err) { next(err); }
}
