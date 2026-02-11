import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ConfigModule } from '@nestjs/config';
import { TransferModule } from '../transfer/transfer.module';
import { StarkbankModule } from '../starkbank/starkbank.module';
import { WebhookService } from './webhook.service';
import { SqsConsumerService } from './sqs-consumer.service';

@Module({
  imports: [TransferModule, StarkbankModule, ConfigModule],
  controllers: [WebhookController],
  providers: [WebhookService, SqsConsumerService],
})
export class WebhookModule {}
