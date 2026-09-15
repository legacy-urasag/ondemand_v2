import crypto from 'node:crypto';
import type { CustomerFormData, FreelancerFormData } from '../shared/schemas.js';

export interface CustomerInquiry extends CustomerFormData {
  id: string;
  status: 'pending' | 'contacted' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerApplication extends FreelancerFormData {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
}

export class SubmissionService {
  private customerInquiries = new Map<string, CustomerInquiry>();
  private freelancerApplications = new Map<string, FreelancerApplication>();

  createCustomerInquiry(data: CustomerFormData): CustomerInquiry {
    const id = `req_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const record: CustomerInquiry = {
      ...data,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.customerInquiries.set(id, record);
    return record;
  }

  getCustomerInquiries(filter?: { status?: string }): CustomerInquiry[] {
    const list = Array.from(this.customerInquiries.values());
    if (filter?.status) {
      return list.filter((i) => i.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCustomerInquiryById(id: string): CustomerInquiry | undefined {
    return this.customerInquiries.get(id);
  }

  createFreelancerApplication(data: FreelancerFormData): FreelancerApplication {
    const id = `fl_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const record: FreelancerApplication = {
      ...data,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.freelancerApplications.set(id, record);
    return record;
  }

  getFreelancerApplications(filter?: { status?: string }): FreelancerApplication[] {
    const list = Array.from(this.freelancerApplications.values());
    if (filter?.status) {
      return list.filter((a) => a.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getFreelancerApplicationById(id: string): FreelancerApplication | undefined {
    return this.freelancerApplications.get(id);
  }

  updateFreelancerStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    note?: string
  ): FreelancerApplication | undefined {
    const record = this.freelancerApplications.get(id);
    if (!record) return undefined;

    record.status = status;
    record.updatedAt = new Date().toISOString();
    if (note !== undefined) {
      record.adminNotes = note;
    }

    this.freelancerApplications.set(id, record);
    return record;
  }

  getStats() {
    const customers = Array.from(this.customerInquiries.values());
    const freelancers = Array.from(this.freelancerApplications.values());

    return {
      totalCustomerInquiries: customers.length,
      pendingCustomerInquiries: customers.filter((c) => c.status === 'pending').length,
      totalFreelancerApplications: freelancers.length,
      pendingFreelancers: freelancers.filter((f) => f.status === 'pending').length,
      approvedFreelancers: freelancers.filter((f) => f.status === 'approved').length,
    };
  }

  // Clear for test environment resets
  clearAll() {
    this.customerInquiries.clear();
    this.freelancerApplications.clear();
  }
}

export const submissionService = new SubmissionService();

