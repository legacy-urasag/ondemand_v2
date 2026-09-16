import { z } from 'zod';

export const VALID_JOB_TYPES = [
  'Villanyszerelő',
  'Vízvezetékszerelő',
  'Ács',
  'Tetőfedő',
  'Gázszerelő',
  'Fűtésszerelő (vagy gépész)',
  'Festő-mázoló',
  'Lakatos',
  'Asztalos',
] as const;

export const VALID_URGENCY_LEVELS = ['emergency', 'urgent', 'normal', 'within_month'] as const;
export const VALID_EXPERIENCE_LEVELS = ['1-2', '3-5', '6-10', '10+'] as const;
export const VALID_SUBMISSION_STATUS = ['pending', 'contacted', 'approved', 'rejected', 'completed'] as const;

// Transliterate Hungarian accents and create clean SEO slugs
export function slugify(text: string): string {
  const charMap: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ö: 'o', ő: 'o', ú: 'u', ü: 'u', ű: 'u',
    Á: 'a', É: 'e', Í: 'i', Ó: 'o', Ö: 'o', Ő: 'o', Ú: 'u', Ü: 'u', Ű: 'u',
  };
  return text
    .split('')
    .map((c) => charMap[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Phone number regex supporting Hungarian (+36 / 06) and international formats
const PHONE_REGEX = /^(\+?[0-9\s-]{8,20}|06[0-9\s-]{7,18})$/;

// Helper to normalize array or comma-separated string
const stringOrArrayToList = (val: unknown): string[] => {
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

// Customer form validation schema
export const CustomerFormSchema = z.object({
  name: z
    .string({ required_error: 'A név megadása kötelező.' })
    .trim()
    .min(2, 'A névnek legalább 2 karakterből kell állnia.')
    .max(100, 'A név legfeljebb 100 karakter hosszú lehet.'),
  email: z
    .string({ required_error: 'Az email cím megadása kötelező.' })
    .trim()
    .toLowerCase()
    .email('Kérjük, adjon meg egy érvényes email címet.'),
  phone: z
    .string({ required_error: 'A telefonszám megadása kötelező.' })
    .trim()
    .regex(PHONE_REGEX, 'Kérjük, adjon meg egy érvényes telefonszámot (pl. +36 30 123 4567).'),
  location: z
    .string({ required_error: 'A helyszín megadása kötelező.' })
    .trim()
    .min(2, 'A helyszínnek legalább 2 karakterből kell állnia.')
    .max(120, 'A helyszín legfeljebb 120 karakter lehet.'),
  jobTypes: z
    .preprocess(stringOrArrayToList, z.array(z.string()).min(1, 'Válasszon legalább egy munka típust.'))
    .refine(
      (items) => items.every((item) => VALID_JOB_TYPES.includes(item as any)),
      { message: 'Egy vagy több kiválasztott munka típus érvénytelen.' }
    ),
  urgency: z.enum(VALID_URGENCY_LEVELS, {
    errorMap: () => ({ message: 'Válasszon egy érvényes sürgősségi szintet.' }),
  }),
  description: z
    .string()
    .trim()
    .max(1000, 'A leírás legfeljebb 1000 karakter lehet.')
    .optional()
    .default(''),
});

export type CustomerFormData = z.infer<typeof CustomerFormSchema>;

// Freelancer form validation schema
export const FreelancerFormSchema = z.object({
  name: z
    .string({ required_error: 'A név megadása kötelező.' })
    .trim()
    .min(2, 'A névnek legalább 2 karakterből kell állnia.')
    .max(100, 'A név legfeljebb 100 karakter hosszú lehet.'),
  email: z
    .string({ required_error: 'Az email cím megadása kötelező.' })
    .trim()
    .toLowerCase()
    .email('Kérjük, adjon meg egy érvényes email címet.'),
  phone: z
    .string({ required_error: 'A telefonszám megadása kötelező.' })
    .trim()
    .regex(PHONE_REGEX, 'Kérjük, adjon meg egy érvényes telefonszámot (pl. +36 30 123 4567).'),
  trades: z
    .preprocess(stringOrArrayToList, z.array(z.string()).min(1, 'Válasszon legalább egy szakmát.'))
    .refine(
      (items) => items.every((item) => VALID_JOB_TYPES.includes(item as any)),
      { message: 'Egy vagy több kiválasztott szakma érvénytelen.' }
    ),
  experience: z.enum(VALID_EXPERIENCE_LEVELS, {
    errorMap: () => ({ message: 'Válassza ki a szakmai tapasztalatát.' }),
  }),
  areas: z
    .string()
    .trim()
    .max(200, 'A preferált területek legfeljebb 200 karakter hosszúak lehetnek.')
    .optional()
    .default(''),
  licenseFileName: z.string().trim().optional().default('Nincs fájl'),
  licenseFileType: z
    .string()
    .trim()
    .refine(
      (type) =>
        !type ||
        ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream'].includes(type),
      { message: 'Nem támogatott fájlformátum. Csak kép vagy PDF engedélyezett.' }
    )
    .optional()
    .nullable(),
  licenseFileBase64: z
    .string()
    .max(14 * 1024 * 1024, 'A feltöltött fájl mérete nem haladhatja meg a 10MB-ot.')
    .optional()
    .nullable(),
});

export type FreelancerFormData = z.infer<typeof FreelancerFormSchema>;

// Authentication schemas
export const LoginSchema = z.object({
  username: z
    .string({ required_error: 'A felhasználónév megadása kötelező.' })
    .trim()
    .min(3, 'A felhasználónévnek legalább 3 karakterből kell állnia.')
    .max(50, 'A felhasználónév legfeljebb 50 karakter lehet.'),
  password: z
    .string({ required_error: 'A jelszó megadása kötelező.' })
    .min(6, 'A jelszónak legalább 6 karakterből kell állnia.')
    .max(100, 'A jelszó legfeljebb 100 karakter lehet.'),
});

export type LoginCredentials = z.infer<typeof LoginSchema>;

// Admin update status schema
export const UpdateStatusSchema = z.object({
  status: z.enum(VALID_SUBMISSION_STATUS, {
    errorMap: () => ({ message: 'Érvénytelen státusz.' }),
  }),
  note: z.string().trim().max(500).optional(),
});

export type UpdateStatusData = z.infer<typeof UpdateStatusSchema>;

export const AssignCustomerSchema = z.object({
  freelancerId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{6,64}$/, 'Érvénytelen szakember-azonosító.')
    .nullable(),
});

// ID parameter validation schema (prevents path traversal / injection)
export const IdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{6,64}$/, 'Érvénytelen azonosító formátum.'),
});
