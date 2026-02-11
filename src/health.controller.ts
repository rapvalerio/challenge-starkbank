import { Controller, Get } from '@nestjs/common';
import { StarkbankService } from './starkbank/starkbank.service';

@Controller('health')
export class HealthController {
  constructor(private readonly starkbankService: StarkbankService) {}

  @Get()
  check() {
    const sdkInitialized = !!this.starkbankService.getUser();

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      sdk: sdkInitialized ? 'connected' : 'not initialized',
      timestamp: new Date().toISOString(),
    };
  }
}
