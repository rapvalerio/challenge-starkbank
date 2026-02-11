import { Injectable, Logger } from '@nestjs/common';
import * as starkbank from 'starkbank';
import { StarkbankService } from '../starkbank/starkbank.service';
import { generateCpf } from '../utils/cpf-generator';

export interface ListInvoicesParams {
  limit?: number;
  after?: string;
  before?: string;
  status?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly starkbankService: StarkbankService) {}

  async listInvoices(params: ListInvoicesParams = {}) {
    this.logger.log('Listing invoices with params:', params);

    const user = this.starkbankService.getUser();
    if (!user) {
      throw new Error('Stark Bank user not initialized');
    }

    try {
      const invoices: starkbank.Invoice[] = [];
      const queryParams: any = {
        user,
      };

      if (params.limit) queryParams.limit = params.limit;
      if (params.after) queryParams.after = params.after;
      if (params.before) queryParams.before = params.before;
      if (params.status) queryParams.status = params.status;

      const generator = await starkbank.invoice.query(queryParams);

      for await (const invoice of generator) {
        invoices.push(invoice);
      }

      this.logger.log(`Retrieved ${invoices.length} invoices`);
      return invoices;
    } catch (error) {
      this.logger.error('Error listing invoices', error);
      throw error;
    }
  }

  async createRandomInvoices(): Promise<starkbank.Invoice[]> {
    const user = this.starkbankService.getUser();
    if (!user) {
      throw new Error('Stark Bank user not initialized');
    }

    const invoiceCount = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
    this.logger.log(`Generating ${invoiceCount} invoices.`);

    const invoices: starkbank.Invoice[] = [];

    for (let i = 0; i < invoiceCount; i++) {
      const amount = Math.floor(Math.random() * 10000) + 1000;
      invoices.push(
        new starkbank.Invoice({
          amount: amount,
          name: `Customer ${i} - ${Date.now()}`,
          taxId: generateCpf(),
          fine: 2.5,
          interest: 1.3,
        }),
      );
    }

    const createdInvoices = await starkbank.invoice.create(invoices, { user });
    this.logger.log(`Successfully created ${createdInvoices.length} invoices.`);
    return createdInvoices;
  }
}
