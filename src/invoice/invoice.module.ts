import { Module } from '@nestjs/common';
import { InvoiceSchedulerService } from './invoice.scheduler';
import { InvoiceService } from './invoice.service';
import { StarkbankModule } from '../starkbank/starkbank.module';

@Module({
  imports: [StarkbankModule],
  providers: [InvoiceSchedulerService, InvoiceService],
})
export class InvoiceModule {}
