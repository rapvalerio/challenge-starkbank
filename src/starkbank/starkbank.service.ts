import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as starkbank from 'starkbank';

@Injectable()
export class StarkbankService implements OnModuleInit {
  private readonly logger = new Logger(StarkbankService.name);
  private user: starkbank.Project;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const environment =
      this.configService.get<string>('STARKBANK_ENVIRONMENT') || 'sandbox';
    const id = this.configService.get<string>('STARKBANK_PROJECT_ID');
    const privateKey = this.configService.get<string>(
      'STARKBANK_PRIVATE_KEY_CONTENT',
    );

    if (!id || !privateKey) {
      this.logger.warn(
        'Stark Bank credentials not found. SDK will not be initialized properly.',
      );
      return;
    }

    this.user = new starkbank.Project({
      environment,
      id,
      privateKey,
    });

    this.logger.log(
      `Stark Bank SDK initialized for project ${id} in ${environment} environment.`,
    );
  }

  getUser(): starkbank.Project {
    return this.user;
  }
}
