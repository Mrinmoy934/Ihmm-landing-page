// -- Purchase Order Controller -----------------------------
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PurchaseOrderService } from '../services/purchaseOrder.service.js';
import { VesselService } from '../services/vessel.service.js';
import { AuditService } from '../services/audit.service.js';
import { getDb } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_STATUS = ['responsive', 'non-responsive', 'pending'];

/** GET /api/v1/purchase-orders */
export async function listPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = {
      vesselId: req.query.vesselId as string | undefined,
      status: req.query.status as string | undefined,
      supplierName: req.query.supplier as string | undefined,
    };
    const pos = await PurchaseOrderService.listForUser(req.user!.userId, filters);
    res.json({ success: true, data: pos, total: pos.length });
  } catch (err) { next(err); }
}

/** POST /api/v1/purchase-orders */
export async function createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const vesselId = body.vesselId as string;

    if (!vesselId) return next(createError('vesselId is required', 400));

    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    if (!body.poNumber || !body.supplierName) {
      return next(createError('poNumber and supplierName are required', 400));
    }
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }

    delete body.vesselId;
    const po = await PurchaseOrderService.create(body, vesselId);
    res.status(201).json({ success: true, data: po });
  } catch (err) { next(err); }
}

/** GET /api/v1/purchase-orders/:id */
export async function getPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const po = await PurchaseOrderService.getById(req.params.id as string, req.user!.userId);
    if (!po) return next(createError('Purchase order not found', 404));
    res.json({ success: true, data: po });
  } catch (err) { next(err); }
}

/** PUT /api/v1/purchase-orders/:id */
export async function updatePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await PurchaseOrderService.getById(req.params.id as string, req.user!.userId);
    if (!existing) return next(createError('Purchase order not found', 404));

    const body = req.body as Record<string, unknown>;
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }

    const po = await PurchaseOrderService.update(req.params.id as string, body);
    res.json({ success: true, data: po });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/purchase-orders/:id */
export async function deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await PurchaseOrderService.getById(req.params.id as string, req.user!.userId);
    if (!existing) return next(createError('Purchase order not found', 404));
    await PurchaseOrderService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

/** POST /api/v1/purchase-orders/upload — Upload PO file + create record + audit summary */
export async function uploadPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(createError('File required', 400));

    const body = req.body as Record<string, string>;
    const vesselId = body.vesselId;
    if (!vesselId) return next(createError('vesselId is required', 400));

    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    if (!body.poNumber || !body.supplierName) {
      return next(createError('poNumber and supplierName form fields are required', 400));
    }

    const v = vessel as Record<string, unknown>;
    const totalItems = parseInt(body.totalItems || '0', 10);

    // 1. Create PO record
    const po = await PurchaseOrderService.create({
      poNumber: body.poNumber,
      supplierName: body.supplierName,
      supplierCode: body.supplierCode,
      status: 'pending',
      totalItems,
      totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : null,
      currency: body.currency || 'USD',
      poDate: body.poDate,
      description: body.description,
      fileName: req.file.originalname,
      filePath: `/uploads/po/${req.file.filename}`,
    }, vesselId);

    // 2. Create / increment audit summary for this vessel
    await AuditService.createAudit({
      imoNumber: v.imoNumber,
      vesselName: v.name,
      totalPO: 1,
      totalItems,
      duplicatePO: 0,
      duplicateSupplierCode: 0,
      duplicateProduct: 0,
      status: 'In Progress',
    }, vesselId);

    res.status(201).json({ success: true, data: po, message: 'PO uploaded and audit created' });
  } catch (err) { next(err); }
}

/** GET /api/v1/purchase-orders/by-supplier/:vesselId — Group POs by supplier */
export async function getPurchaseOrdersBySupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const grouped = await PurchaseOrderService.getBySupplierForVessel(vesselId);
    res.json({ success: true, data: grouped });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/purchase-orders/upload-bulk — bulk PO upload from Excel/PDF/CSV.
 */
export async function uploadPurchaseOrderBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(createError('File required', 400));

    const body = req.body as Record<string, string>;
    const vesselId = body.vesselId;
    if (!vesselId) return next(createError('vesselId is required', 400));

    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    let stats: Record<string, number> = {};
    let lineItems: unknown[][] = [];
    try {
      if (body.stats) stats = JSON.parse(body.stats);
      if (body.lineItems) lineItems = JSON.parse(body.lineItems);
    } catch {
      return next(createError('stats and lineItems must be valid JSON', 400));
    }

    if (!Array.isArray(lineItems)) {
      return next(createError('lineItems must be an array of row arrays', 400));
    }

    const v = vessel as Record<string, unknown>;
    const filePath = `/uploads/po/${req.file.filename}`;

    const db = getDb();

    // 1. Upsert the audit summary. Any active audit for this vessel is replaced.
    const existingActive = await db.collection('audit_summaries')
      .find({
        vessel_id: vesselId,
        status: { $in: ['In Progress', 'Pending', 'Pending Review', 'Awaiting Clarification'] }
      })
      .sort({ created_at: -1 })
      .toArray();

    let auditId: string;
    if (existingActive.length > 0) {
      const all = existingActive;
      auditId = String(all[0]._id);
      if (all.length > 1) {
        const extraIds = all.slice(1).map((r) => r._id);
        await db.collection('audit_summaries').deleteMany({ _id: { $in: extraIds } });
      }
      await db.collection('audit_summaries').updateOne(
        { _id: auditId },
        {
          $set: {
            total_po: Number(stats.totalPO ?? 0),
            total_items: Number(stats.totalItems ?? lineItems.length),
            duplicate_po: Number(stats.duplicatePO ?? 0),
            duplicate_supplier_code: Number(stats.duplicateSupplierCode ?? 0),
            duplicate_product: Number(stats.duplicateProduct ?? 0),
            uploaded_file_path: filePath,
            uploaded_file_name: req.file.originalname,
            status: 'In Progress',
            review_assigned_to: null,
            reviewed_by: null,
            reviewed_at: null,
            last_activity: new Date(),
            updated_at: new Date()
          }
        }
      );
      // Wipe the previous line items
      await db.collection('audit_line_items').deleteMany({ audit_id: auditId });
    } else {
      const audit = await AuditService.createAudit({
        imoNumber: v.imoNumber,
        vesselName: v.name,
        totalPO: Number(stats.totalPO ?? 0),
        totalItems: Number(stats.totalItems ?? lineItems.length),
        duplicatePO: Number(stats.duplicatePO ?? 0),
        duplicateSupplierCode: Number(stats.duplicateSupplierCode ?? 0),
        duplicateProduct: Number(stats.duplicateProduct ?? 0),
        status: 'In Progress',
      }, vesselId);

      auditId = String((audit as Record<string, unknown>).id);
      await db.collection('audit_summaries').updateOne(
        { _id: auditId },
        {
          $set: {
            uploaded_file_path: filePath,
            uploaded_file_name: req.file.originalname
          }
        }
      );
    }

    // 2. Bulk-insert line items in chunks
    const CHUNK = 1000;
    let inserted = 0;
    for (let offset = 0; offset < lineItems.length; offset += CHUNK) {
      const batch = lineItems.slice(offset, offset + CHUNK);
      if (batch.length === 0) continue;

      const docs = batch.map((row, i) => {
        const rowIndex = offset + i;
        const r = Array.isArray(row) ? row : [];
        const extra = r.slice(20);
        return {
          _id: crypto.randomUUID(),
          audit_id: auditId,
          vessel_id: vesselId,
          row_index: rowIndex,
          name: r[0] ?? null,
          vessel_name: r[1] ?? null,
          po_number: r[2] ?? null,
          imo_number: r[3] ?? null,
          po_sent_date: r[4] ?? null,
          md_requested_date: r[5] ?? null,
          item_description: r[6] ?? null,
          is_suspected: r[7] === 'Yes' ? 'Yes' : 'No',
          impa_code: r[8] ?? null,
          issa_code: r[9] ?? null,
          equipment_code: r[10] ?? null,
          equipment_name: r[11] ?? null,
          maker: r[12] ?? null,
          model: r[13] ?? null,
          part_number: r[14] ?? null,
          unit: r[15] ?? null,
          quantity: r[16] ?? null,
          vendor_remark: r[17] ?? null,
          vendor_email: r[18] ?? null,
          vendor_name: r[19] ?? null,
          extra_data: extra,
          created_at: new Date(),
          updated_at: new Date()
        };
      });

      await db.collection('audit_line_items').insertMany(docs);
      inserted += docs.length;
    }

    res.status(201).json({
      success: true,
      data: {
        auditId,
        imoNumber: v.imoNumber,
        vesselName: v.name,
        filePath,
        fileName: req.file.originalname,
        linesInserted: inserted,
      },
      message: 'Purchase order uploaded and audit created',
    });
  } catch (err) { next(err); }
}
