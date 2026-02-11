import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer } from 'sqs-consumer';
import { SQSClient } from '@aws-sdk/client-sqs';
import { WebhookService } from './webhook.service';

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
  ) {}

  onModuleInit() {
    const queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');
    const region = this.configService.get<string>('AWS_REGION');

    if (!queueUrl) {
      this.logger.warn(
        'AWS_SQS_QUEUE_URL not defined. SQS Consumer will not start.',
      );
      return;
    }

    this.logger.log(`Starting SQS Consumer for queue: ${queueUrl}`);

    this.consumer = Consumer.create({
      queueUrl,
      region,
      sqs: new SQSClient({
        region,
      }),
      handleMessage: async (message) => {
        try {
          this.logger.log(`Received message from SQS: ${message.MessageId}`);

          const payload = message.Body;
          const signature =
            message.MessageAttributes?.['digital-signature']?.StringValue;

          if (!payload) {
            this.logger.error('Message body is empty');
            return message;
          }

          if (!signature) {
            this.logger.error(
              'Missing digital-signature attribute in SQS message',
            );
            return message;
          }

          await this.webhookService.processWebhook({
            payload,
            signature,
          });

          this.logger.log('Message processed successfully');
          return message;
        } catch (error) {
          this.logger.error(
            `Error processing message: ${error.message}`,
            error.stack,
          );
          throw error;
        }
      },
      messageAttributeNames: ['digital-signature'],
    });

    this.consumer.on('error', (err) => {
      this.logger.error(`SQS Consumer Error: ${err.message}`, err);
    });

    this.consumer.on('processing_error', (err) => {
      this.logger.error(`SQS Processing Error: ${err.message}`, err);
    });

    this.consumer.start();
  }

  onModuleDestroy() {
    if (this.consumer) {
      this.consumer.stop();
    }
  }
}
