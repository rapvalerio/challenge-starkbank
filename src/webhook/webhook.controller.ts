import {
  Controller,
  Post,
  Headers,
  Logger,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('digital-signature') signature: string,
  ) {
    this.logger.log('Received Webhook event');

    if (!signature || !req.rawBody) {
      this.logger.error('Missing digital-signature header or body');
      throw new BadRequestException('Missing digital-signature header or body');
    }

    try {
      await this.webhookService.processWebhook({
        payload: req.rawBody.toString(),
        signature: signature,
      });
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid webhook payload or signature');
    }

    return { status: 'ok' };
  }
}
