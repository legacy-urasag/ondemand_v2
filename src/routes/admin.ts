import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { AssignCustomerSchema, IdParamSchema, UpdateStatusSchema } from '../shared/schemas.js';
import { submissionService } from '../services/submissionService.js';

export const adminRouter = Router();

// Enforce authentication across all admin endpoints
adminRouter.use(authenticateToken);

// Dashboard overview stats
adminRouter.get('/stats', async (_req, res) => {
  const stats = await submissionService.getStats();

  res.json({
    success: true,
    data: stats,
  });
});

// List all customer inquiries
adminRouter.get('/customers', async (req, res) => {
  const status =
    typeof req.query.status === 'string' ? req.query.status : undefined;

  const inquiries = await submissionService.getCustomerInquiries(
    status ? { status: status as any } : undefined
  );

  res.json({
    success: true,
    count: inquiries.length,
    data: inquiries,
  });
});

// Get customer inquiry by ID
adminRouter.get(
  '/customers/:id',
  validateParams(IdParamSchema),
  async (req, res) => {
    const inquiry = await submissionService.getCustomerInquiryById(
      req.params.id
    );

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
  }
);

// Assign or unassign a customer inquiry to an approved freelancer
adminRouter.patch(
  '/customers/:id/assignment',
  requireRole('admin', 'operator'),
  validateParams(IdParamSchema),
  validateBody(AssignCustomerSchema),
  async (req, res) => {
    const customer = await submissionService.getCustomerInquiryById(req.params.id);

    if (!customer) {
      res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Az ügyfél kérelme nem található.' },
      });
      return;
    }

    const freelancerId = req.body.freelancerId as string | null;
    if (freelancerId) {
      const freelancer = await submissionService.getFreelancerApplicationById(freelancerId);
      if (!freelancer || freelancer.status !== 'approved') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_FREELANCER', message: 'Csak jóváhagyott szakemberhez rendelhet ügyfelet.' },
        });
        return;
      }
    }

    const updated = await submissionService.assignCustomer(req.params.id, freelancerId);
    res.json({ success: true, message: 'Az ügyfél hozzárendelése frissítve.', data: updated });
  }
);

// List all freelancer applications
adminRouter.get('/freelancers', async (req, res) => {
  const status =
    typeof req.query.status === 'string' ? req.query.status : undefined;

  const applications = await submissionService.getFreelancerApplications(
    status ? { status: status as any } : undefined
  );

  res.json({
    success: true,
    count: applications.length,
    data: applications,
  });
});

// Get freelancer application by ID
adminRouter.get(
  '/freelancers/:id',
  validateParams(IdParamSchema),
  async (req, res) => {
    const application =
      await submissionService.getFreelancerApplicationById(req.params.id);

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
  }
);

// Download/View freelancer license document
adminRouter.get(
  '/freelancers/:id/license',
  validateParams(IdParamSchema),
  async (req, res) => {
    const application =
      await submissionService.getFreelancerApplicationById(req.params.id);

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
        fileType:
          application.licenseFileType || 'application/octet-stream',
        fileBase64: application.licenseFileBase64,
      },
    });
  }
);

// Download the original freelancer license document
adminRouter.get(
  '/freelancers/:id/license/download',
  validateParams(IdParamSchema),
  async (req, res) => {
    const application = await submissionService.getFreelancerApplicationById(req.params.id);

    if (!application || !application.licenseFileBase64) {
      res.status(404).json({
        success: false,
        error: { code: 'LICENSE_NOT_FOUND', message: 'Nem található letölthető engedély.' },
      });
      return;
    }

    const dataUrlMatch = application.licenseFileBase64.match(/^data:[^,]*;base64,(.*)$/s);
    const rawBase64 = dataUrlMatch?.[1] || application.licenseFileBase64;
    const base64 = rawBase64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(paddedBase64)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_LICENSE_DATA', message: 'Az engedély fájladata sérült.' },
      });
      return;
    }

    const fileBuffer = Buffer.from(paddedBase64, 'base64');
    const supportedFileTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/octet-stream',
    ]);
    const fileType = supportedFileTypes.has(application.licenseFileType || '')
      ? application.licenseFileType!
      : 'application/octet-stream';
    if (fileType === 'application/pdf' && !fileBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_LICENSE_DATA', message: 'A tárolt PDF fájladata sérült.' },
      });
      return;
    }
    let fileName = (application.licenseFileName || 'license')
      .replace(/[\r\n"\\]/g, '')
      .trim() || 'license';
    if (fileType === 'application/pdf' && !/\.pdf$/i.test(fileName)) {
      fileName += '.pdf';
    }
    const asciiFileName = fileName.replace(/[^\x20-\x7E]/g, '_');

    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.end(fileBuffer);
  }
);

// Update freelancer application status
adminRouter.patch(
  '/freelancers/:id/status',
  requireRole('admin', 'operator'),
  validateParams(IdParamSchema),
  validateBody(UpdateStatusSchema),
  async (req, res) => {
    const updated = await submissionService.updateFreelancerStatus(
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