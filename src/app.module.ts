import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { StarkbankModule } from './starkbank/starkbank.module';
import { InvoiceModule } from './invoice/invoice.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    StarkbankModule,
    InvoiceModule,
    WebhookModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
