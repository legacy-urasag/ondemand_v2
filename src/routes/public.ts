import { env } from '../config/env.js';
import { Router } from 'express';
import { CustomerFormSchema, FreelancerFormSchema, VALID_JOB_TYPES, slugify } from '../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { formSubmissionRateLimiter, publicApiRateLimiter } from '../middleware/rateLimiter.js';
import { submissionService } from '../services/submissionService.js';

export const publicRouter = Router();

function containsPdfSignature(value: string): boolean {
  const dataUrlMatch = value.match(/^data:[^,]*;base64,(.*)$/s);
  const rawBase64 = dataUrlMatch?.[1] || value;
  const normalizedBase64 = rawBase64
    .replace(/\s/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  if (!normalizedBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64)) {
    return false;
  }

  const fileBuffer = Buffer.from(
    normalizedBase64.padEnd(Math.ceil(normalizedBase64.length / 4) * 4, '='),
    'base64'
  );
  return fileBuffer.indexOf(Buffer.from('%PDF-')) >= 0;
}

// Health Check API
publicRouter.get('/health', publicApiRateLimiter, (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Client runtime configuration
publicRouter.get('/config', publicApiRateLimiter, (_req, res) => {
  res.json({
    success: true,
    data: {
      apiUrl: env.APP_URL,
      environment: env.NODE_ENV,
      appName: 'OnDemand',
    },
  });
});

// Available Services & Trades list
publicRouter.get('/services', publicApiRateLimiter, (_req, res) => {
  res.json({
    success: true,
    data: VALID_JOB_TYPES.map((title) => ({
      title,
      slug: slugify(title),
      category: 'Otthoni szolgáltatások',
    })),
  });
});

// Customer service request form submission
publicRouter.post(
  '/forms/customer',
  formSubmissionRateLimiter,
  validateBody(CustomerFormSchema),
  async (req, res) => {
    const inquiry = await submissionService.createCustomerInquiry(req.body);

    res.status(201).json({
      success: true,
      message: 'Sikeres feladat meghirdetés! Szakembereink hamarosan felveszik Önnel a kapcsolatot.',
      data: {
        trackingId: inquiry.id,
        status: inquiry.status,
        createdAt: inquiry.createdAt,
      },
    });
  }
);

// Freelancer / Professional registration form submission
publicRouter.post(
  '/forms/freelancer',
  formSubmissionRateLimiter,
  validateBody(FreelancerFormSchema),
  async (req, res) => {
    const licenseName = req.body.licenseFileName || '';
    const isPdf =
      req.body.licenseFileType === 'application/pdf' || /\.pdf$/i.test(licenseName);
    if (isPdf && req.body.licenseFileBase64 && !containsPdfSignature(req.body.licenseFileBase64)) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_LICENSE_DATA',
          message: 'A feltöltött fájl nem érvényes PDF dokumentum.',
        },
      });
      return;
    }

    const application = await submissionService.createFreelancerApplication(req.body);

    res.status(201).json({
      success: true,
      message: 'Sikeres regisztráció! Csapatunk áttekinti a jelentkezést és hamarosan értesíti Önt.',
      data: {
        applicationId: application.id,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  }
);
