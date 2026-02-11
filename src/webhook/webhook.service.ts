import { Injectable, Logger } from '@nestjs/common';
import { TransferService } from '../transfer/transfer.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';
import { ProcessWebhookDto } from './dto/webhook-event.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly transferService: TransferService,
    private readonly starkbankService: StarkbankService,
  ) {}

  async processWebhook(dto: ProcessWebhookDto): Promise<void> {
    const event = await this.parseEvent(dto);
    if (!event) return;

    await this.handleEvent(event);
  }

  private async parseEvent(
    dto: ProcessWebhookDto,
  ): Promise<starkbank.Event | null> {
    const user = this.starkbankService.getUser();
    if (!user) {
      this.logger.error('Stark Bank user not initialized');
      return null;
    }

    try {
      return await starkbank.event.parse({
        content: dto.payload,
        signature: dto.signature,
        user: user,
      });
    } catch (e) {
      this.logger.error(
        'Error parsing webhook event: Signature verification failed',
        e,
      );
      return null;
    }
  }

  private async handleEvent(event: starkbank.Event): Promise<void> {
    this.logger.log(
      `Event parsed: ${event.id} - ${event.subscription} - ${event.log?.type}`,
    );

    if (
      event.subscription === 'invoice' &&
      event.log &&
      event.log.type === 'credited'
    ) {
      this.logger.log('Invoice Credited event detected.');
      await this.handleInvoiceCredited(event.log as starkbank.invoice.Log);
    }
  }

  private async handleInvoiceCredited(
    log: starkbank.invoice.Log,
  ): Promise<void> {
    const invoice = log.invoice;

    if (invoice && invoice.amount) {
      const invoiceFee = invoice.fee || 0;
      const transferBuffer = 50;
      const transferAmount = invoice.amount - invoiceFee - transferBuffer;

      if (transferAmount <= 0) {
        this.logger.warn(
          `Transfer amount for invoice ${invoice.id} is too low after fees (${transferAmount}). Skipping transfer.`,
        );
        return;
      }

      this.logger.log(
        `Invoice ${invoice.id} credited. Original Amount: ${invoice.amount}, Fee: ${invoiceFee}. Transferring ${transferAmount} (with ${transferBuffer} buffer for transfer fee).`,
      );

      await this.transferService.transferRemainingFunds(
        transferAmount,
        invoice.id,
      );
    } else {
      this.logger.warn('Invoice data missing in event log.');
    }
  }
}
