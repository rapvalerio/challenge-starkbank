import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);
  private startTime: number | null = null;

  constructor(private readonly invoiceService: InvoiceService) {}

  @Cron('0 0 */3 * * *')
  async handleCron() {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    const elapsedMs = Date.now() - this.startTime;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    if (elapsedMs > twentyFourHoursMs) {
      this.logger.log(
        '24 hours have passed since the first run. Stopping Invoice Scheduler.',
      );
      return;
    }

    this.logger.log('Running Invoice Scheduler...');

    try {
      const createdInvoices = await this.invoiceService.createRandomInvoices();
      for (const inv of createdInvoices) {
        this.logger.debug(`Invoice ID: ${inv.id}, Amount: ${inv.amount}`);
      }
    } catch (error) {
      this.logger.error('Error in invoice scheduler', error);
    }
  }
}
