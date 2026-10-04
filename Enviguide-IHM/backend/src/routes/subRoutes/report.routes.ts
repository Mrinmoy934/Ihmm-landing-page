// -- Report Routes ---------------------------------------------------------
// Mounted under /vessels/:vesselId/reports
//   GET  /                               -> list historical reports
//   GET  /:type/download                  -> generate + stream PDF
//   GET  /file/:reportId                  -> re-stream archived PDF

import { Router } from 'express';
import {
  listReports, downloadReport, streamReportFile, listQuarterlyTimeline,
} from '../../controller/report.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/',                          listReports);
// Mount the timeline route BEFORE the :type/download route — Express
// routes match in registration order and 'quarterly/timeline' would
// otherwise be swallowed as type='quarterly', subpath='timeline'.
router.get('/quarterly/timeline',        listQuarterlyTimeline);
router.get('/:type/download',            downloadReport);
router.get('/file/:reportId',            streamReportFile);

export default router;
