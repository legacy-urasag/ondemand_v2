import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { IdParamSchema, UpdateStatusSchema } from '../shared/schemas.js';
import { submissionService } from '../services/submissionService.js';

export const adminRouter = Router();

// Enforce authentication across all admin endpoints
adminRouter.use(authenticateToken);

// Dashboard overview stats
adminRouter.get('/stats', (_req, res) => {
  const stats = submissionService.getStats();
  res.json({
    success: true,
    data: stats,
  });
});

// List all customer inquiries
adminRouter.get('/customers', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const inquiries = submissionService.getCustomerInquiries({ status });
  res.json({
    success: true,
    count: inquiries.length,
    data: inquiries,
  });
});

// Get customer inquiry by ID (with IDOR protection)
adminRouter.get('/customers/:id', validateParams(IdParamSchema), (req, res) => {
  const inquiry = submissionService.getCustomerInquiryById(req.params.id);
  if (!inquiry) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'A megadott azonosítójú ügyfél kérelem nem található.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: inquiry,
  });
});

// List all freelancer applications
adminRouter.get('/freelancers', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const applications = submissionService.getFreelancerApplications({ status });
  res.json({
    success: true,
    count: applications.length,
    data: applications,
  });
});

// Get freelancer application by ID
adminRouter.get('/freelancers/:id', validateParams(IdParamSchema), (req, res) => {
  const application = submissionService.getFreelancerApplicationById(req.params.id);
  if (!application) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'A megadott azonosítójú szakember jelentkezés nem található.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: application,
  });
});

// Download/View freelancer license document
adminRouter.get('/freelancers/:id/license', validateParams(IdParamSchema), (req, res) => {
  const application = submissionService.getFreelancerApplicationById(req.params.id);
  if (!application || !application.licenseFileBase64) {
    res.status(404).json({
      success: false,
      error: {
        code: 'LICENSE_NOT_FOUND',
        message: 'A szakemberhez nem tartozik feltöltött engedély dokumentum.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      fileName: application.licenseFileName,
      fileType: application.licenseFileType || 'application/octet-stream',
      fileBase64: application.licenseFileBase64,
    },
  });
});

// Update freelancer application status (Requires operator or admin role)
adminRouter.patch(
  '/freelancers/:id/status',
  requireRole('admin', 'operator'),
  validateParams(IdParamSchema),
  validateBody(UpdateStatusSchema),
  (req, res) => {
    const updated = submissionService.updateFreelancerStatus(
      req.params.id,
      req.body.status as any,
      req.body.note
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'A megadott azonosítójú szakember nem található.',
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'A szakember státusza sikeresen frissítve.',
      data: updated,
    });
  }
);

