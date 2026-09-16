import crypto from 'node:crypto';
import type { CustomerFormData, FreelancerFormData } from '../shared/schemas.js';
import { getDb } from '../config/mongodb.js';

export interface CustomerInquiry extends CustomerFormData {
  id: string;
  status: 'pending' | 'contacted' | 'completed';
  assignedFreelancerId?: string;
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

  async createCustomerInquiry(data: CustomerFormData): Promise<CustomerInquiry> {
    const db = await getDb();

    const id = `req_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const record: CustomerInquiry = {
      ...data,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection<CustomerInquiry>('customerInquiries').insertOne(record);

    return record;
  }

  async getCustomerInquiries(filter?: { status?: CustomerInquiry['status'] }): Promise<CustomerInquiry[]> {
    const db = await getDb();

    const query = filter?.status
      ? { status: filter.status }
      : {};

    return db
      .collection<CustomerInquiry>('customerInquiries')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getCustomerInquiryById(id: string): Promise<CustomerInquiry | undefined> {
    const db = await getDb();

    const record = await db
      .collection<CustomerInquiry>('customerInquiries')
      .findOne({ id });

    return record ?? undefined;
  }

  async assignCustomer(
    customerId: string,
    freelancerId: string | null
  ): Promise<CustomerInquiry | undefined> {
    const db = await getDb();
    const customers = db.collection<CustomerInquiry>('customerInquiries');

    const updatedAt = new Date().toISOString();

    const result = await customers.findOneAndUpdate(
      { id: customerId },
      freelancerId
        ? { $set: { assignedFreelancerId: freelancerId, updatedAt } }
        : { $set: { updatedAt }, $unset: { assignedFreelancerId: '' } },
      { returnDocument: 'after' }
    );

    return result ?? undefined;
  }

  async createFreelancerApplication(
    data: FreelancerFormData
  ): Promise<FreelancerApplication> {
    const db = await getDb();

    const id = `fl_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const record: FreelancerApplication = {
      ...data,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db
      .collection<FreelancerApplication>('freelancerApplications')
      .insertOne(record);

    return record;
  }

  async getFreelancerApplications(
    filter?: { status?: FreelancerApplication['status'] }
  ): Promise<FreelancerApplication[]> {
    const db = await getDb();

    const query = filter?.status
      ? { status: filter.status }
      : {};

    return db
      .collection<FreelancerApplication>('freelancerApplications')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getFreelancerApplicationById(
    id: string
  ): Promise<FreelancerApplication | undefined> {
    const db = await getDb();

    const record = await db
      .collection<FreelancerApplication>('freelancerApplications')
      .findOne({ id });

    return record ?? undefined;
  }

  async updateFreelancerStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    note?: string
  ): Promise<FreelancerApplication | undefined> {
    const db = await getDb();

    if (status === 'rejected') {
      const result = await db
        .collection<FreelancerApplication>('freelancerApplications')
        .findOneAndDelete({ id });

      return result ?? undefined;
    }

    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (note !== undefined) {
      update.adminNotes = note;
    }

    const result = await db
      .collection<FreelancerApplication>('freelancerApplications')
      .findOneAndUpdate(
        { id },
        { $set: update },
        { returnDocument: 'after' }
      );

    return result ?? undefined;
  }

  async getStats() {
    const db = await getDb();

    const [
      totalCustomerInquiries,
      pendingCustomerInquiries,
      totalFreelancerApplications,
      pendingFreelancers,
      approvedFreelancers,
    ] = await Promise.all([
      db.collection('customerInquiries').countDocuments(),
      db.collection('customerInquiries').countDocuments({ status: 'pending' }),
      db.collection('freelancerApplications').countDocuments(),
      db.collection('freelancerApplications').countDocuments({ status: 'pending' }),
      db.collection('freelancerApplications').countDocuments({ status: 'approved' }),
    ]);

    return {
      totalCustomerInquiries,
      pendingCustomerInquiries,
      totalFreelancerApplications,
      pendingFreelancers,
      approvedFreelancers,
    };
  }

  async clearAll() {
    const db = await getDb();

    await Promise.all([
      db.collection('customerInquiries').deleteMany({}),
      db.collection('freelancerApplications').deleteMany({}),
    ]);
  }
}

export const submissionService = new SubmissionService();