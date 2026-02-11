import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { StarkbankModule } from '../starkbank/starkbank.module';

@Module({
  imports: [StarkbankModule],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
