import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as starkbank from 'starkbank';
import { StarkbankService } from '../starkbank/starkbank.service';
import { ConfigService } from '@nestjs/config';

interface RecipientDetails {
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  taxId: string;
  name: string;
  accountType: string;
}

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly starkbankService: StarkbankService,
    private readonly configService: ConfigService,
  ) {}

  async transferRemainingFunds(amount: number, externalId: string) {
    const user = this.starkbankService.getUser();
    if (!user) {
      throw new Error('Stark Bank user not initialized');
    }

    const recipient = this.getRecipientDetails();

    this.logger.log(
      `Initiating transfer of ${amount} to ${recipient.name} with externalId: ${externalId}.`,
    );

    return this.executeTransfer(amount, externalId, recipient, user);
  }

  private getRecipientDetails() {
    const recipient = {
      bankCode: this.configService.get<string>('TRANSFER_BANK_CODE'),
      branchCode: this.configService.get<string>('TRANSFER_BRANCH_CODE'),
      accountNumber: this.configService.get<string>('TRANSFER_ACCOUNT_NUMBER'),
      taxId: this.configService.get<string>('TRANSFER_TAX_ID'),
      name: this.configService.get<string>('TRANSFER_NAME'),
      accountType: this.configService.get<string>('TRANSFER_ACCOUNT_TYPE'),
    };

    const missingFields = Object.entries(recipient)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      throw new InternalServerErrorException(
        `Missing transfer config: ${missingFields.join(', ')}`,
      );
    }

    return recipient as RecipientDetails;
  }

  private async executeTransfer(
    amount: number,
    externalId: string,
    recipient: RecipientDetails,
    user: starkbank.Project | starkbank.Organization,
  ) {
    try {
      const transfer = new starkbank.Transfer({
        amount,
        externalId,
        ...recipient,
      });
      const transfers = await starkbank.transfer.create([transfer], { user });

      for (const transfer of transfers) {
        this.logger.log(
          `Transfer created: ${transfer.id}, status: ${transfer.status}`,
        );
      }

      return transfers;
    } catch (error) {
      this.logger.error('Error creating transfer', error);
      throw error;
    }
  }
}
