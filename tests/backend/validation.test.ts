import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CustomerFormSchema,
  FreelancerFormSchema,
  LoginSchema,
  UpdateStatusSchema,
  IdParamSchema,
} from '../../src/shared/schemas.js';

describe('Validation: CustomerFormSchema', () => {
  const validCustomer = {
    name: 'Kovács Anna',
    email: 'kovacs.anna@example.com',
    phone: '+36 30 123 4567',
    location: 'Budapest, XI. kerület',
    jobTypes: ['Villanyszerelő'],
    urgency: 'urgent',
    description: 'Nincs áram a konyhában, kismegszakító leoldott.',
  };

  it('validates a correct customer inquiry', () => {
    const parsed = CustomerFormSchema.safeParse(validCustomer);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, 'Kovács Anna');
      assert.equal(parsed.data.email, 'kovacs.anna@example.com');
      assert.deepEqual(parsed.data.jobTypes, ['Villanyszerelő']);
    }
  });

  it('normalizes email to lowercase and trims spaces', () => {
    const parsed = CustomerFormSchema.safeParse({
      ...validCustomer,
      email: '  KOVaCS.Anna@EXAMPLE.COM  ',
      name: '  Kovács Anna  ',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.email, 'kovacs.anna@example.com');
      assert.equal(parsed.data.name, 'Kovács Anna');
    }
  });

  it('accepts comma-separated string for jobTypes and normalizes to array', () => {
    const parsed = CustomerFormSchema.safeParse({
      ...validCustomer,
      jobTypes: 'Villanyszerelő, Vízvezetékszerelő',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data.jobTypes, ['Villanyszerelő', 'Vízvezetékszerelő']);
    }
  });

  it('rejects invalid email formats', () => {
    const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain'];
    for (const email of invalidEmails) {
      const parsed = CustomerFormSchema.safeParse({ ...validCustomer, email });
      assert.equal(parsed.success, false, `Expected ${email} to fail validation`);
    }
  });

  it('rejects invalid phone numbers', () => {
    const invalidPhones = ['123', 'abc', '++36', ''];
    for (const phone of invalidPhones) {
      const parsed = CustomerFormSchema.safeParse({ ...validCustomer, phone });
      assert.equal(parsed.success, false, `Expected phone '${phone}' to fail`);
    }
  });

  it('rejects unrecognized job types', () => {
    const parsed = CustomerFormSchema.safeParse({
      ...validCustomer,
      jobTypes: ['Űrhajószereló'],
    });
    assert.equal(parsed.success, false);
  });

  it('rejects invalid urgency levels', () => {
    const parsed = CustomerFormSchema.safeParse({
      ...validCustomer,
      urgency: 'yesterday',
    });
    assert.equal(parsed.success, false);
  });

  it('accepts the within-month urgency level', () => {
    const parsed = CustomerFormSchema.safeParse({
      ...validCustomer,
      urgency: 'within_month',
    });
    assert.equal(parsed.success, true);
  });

  it('rejects empty name and name shorter than 2 characters', () => {
    const parsed1 = CustomerFormSchema.safeParse({ ...validCustomer, name: '' });
    const parsed2 = CustomerFormSchema.safeParse({ ...validCustomer, name: 'A' });
    assert.equal(parsed1.success, false);
    assert.equal(parsed2.success, false);
  });
});

describe('Validation: FreelancerFormSchema', () => {
  const validFreelancer = {
    name: 'Szabó Péter',
    email: 'szabo.peter@mester.hu',
    phone: '+36 20 987 6543',
    trades: ['Villanyszerelő', 'Asztalos'],
    experience: '6-10',
    areas: 'V., VI., VII. kerület',
    licenseFileName: 'engedely.pdf',
    licenseFileType: 'application/pdf',
    licenseFileBase64: 'JVBERi0xLjQK...',
  };

  it('validates a complete freelancer application', () => {
    const parsed = FreelancerFormSchema.safeParse(validFreelancer);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, 'Szabó Péter');
      assert.equal(parsed.data.experience, '6-10');
    }
  });

  it('allows application without file upload', () => {
    const parsed = FreelancerFormSchema.safeParse({
      ...validFreelancer,
      licenseFileName: undefined,
      licenseFileType: undefined,
      licenseFileBase64: undefined,
    });
    assert.equal(parsed.success, true);
  });

  it('rejects disallowed file mime types', () => {
    const parsed = FreelancerFormSchema.safeParse({
      ...validFreelancer,
      licenseFileType: 'application/x-msdownload', // .exe
    });
    assert.equal(parsed.success, false);
  });

  it('rejects invalid experience values', () => {
    const parsed = FreelancerFormSchema.safeParse({
      ...validFreelancer,
      experience: '50 év',
    });
    assert.equal(parsed.success, false);
  });
});

describe('Validation: LoginSchema, UpdateStatusSchema & IdParamSchema', () => {
  it('validates login credentials properly', () => {
    const valid = LoginSchema.safeParse({ username: 'admin', password: 'Password123!' });
    assert.equal(valid.success, true);

    const tooShort = LoginSchema.safeParse({ username: 'a', password: '123' });
    assert.equal(tooShort.success, false);
  });

  it('validates status updates strictly', () => {
    const valid = UpdateStatusSchema.safeParse({ status: 'approved', note: 'All licenses verified.' });
    assert.equal(valid.success, true);

    const invalid = UpdateStatusSchema.safeParse({ status: 'unknown_status' });
    assert.equal(invalid.success, false);
  });

  it('sanitizes and validates ID parameters to prevent path traversal', () => {
    const valid = IdParamSchema.safeParse({ id: 'req_12345678' });
    assert.equal(valid.success, true);

    const pathTraversal = IdParamSchema.safeParse({ id: '../../etc/passwd' });
    assert.equal(pathTraversal.success, false);

    const sqlInjection = IdParamSchema.safeParse({ id: "' OR '1'='1" });
    assert.equal(sqlInjection.success, false);
  });
});

