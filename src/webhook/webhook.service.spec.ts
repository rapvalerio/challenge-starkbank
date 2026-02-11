import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { TransferService } from '../transfer/transfer.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';
import { ProcessWebhookDto } from './dto/webhook-event.dto';

jest.mock('starkbank', () => ({
  event: {
    parse: jest.fn(),
  },
  Project: jest.fn(),
}));

describe('WebhookService', () => {
  let service: WebhookService;
  let transferService: TransferService;
  let starkbankService: StarkbankService;

  const mockTransferService = {
    transferRemainingFunds: jest.fn(),
  };

  const mockStarkbankService = {
    getUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: TransferService, useValue: mockTransferService },
        { provide: StarkbankService, useValue: mockStarkbankService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    const mockUser = new starkbank.Project({
      environment: 'sandbox',
      id: '123',
      privateKey: 'pk',
    });

    const dto: ProcessWebhookDto = {
      payload: 'mock-payload',
      signature: 'mock-signature',
    };

    it('should process an invoice-credited event and call the transfer service with the correct amount (amount - fee - buffer)', async () => {
      const mockEvent = {
        id: '1',
        subscription: 'invoice',
        log: {
          type: 'credited',
          invoice: { id: 'inv_1', amount: 1000, fee: 50 },
        },
      };

      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await service.processWebhook(dto);

      expect(starkbank.event.parse).toHaveBeenCalledWith({
        content: dto.payload,
        signature: dto.signature,
        user: mockUser,
      });
      expect(mockTransferService.transferRemainingFunds).toHaveBeenCalledWith(
        900,
        'inv_1',
      );
    });

    it('should log an error and not call transfer service if signature is invalid', async () => {
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.event.parse as jest.Mock).mockRejectedValue(
        new Error('Invalid signature'),
      );

      await service.processWebhook(dto);

      expect(mockTransferService.transferRemainingFunds).not.toHaveBeenCalled();
    });

    it('should ignore events that are not "invoice-credited"', async () => {
      const mockEvent = {
        id: '2',
        subscription: 'transfer',
        log: {
          type: 'success',
        },
      };

      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await service.processWebhook(dto);

      expect(mockTransferService.transferRemainingFunds).not.toHaveBeenCalled();
    });

    it('should not call transfer service if invoice amount is missing', async () => {
      const mockEvent = {
        id: '3',
        subscription: 'invoice',
        log: {
          type: 'credited',
          invoice: { fee: 50 },
        },
      };

      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await service.processWebhook(dto);

      expect(mockTransferService.transferRemainingFunds).not.toHaveBeenCalled();
    });

    it('should call transfer service even if invoice fee is missing (using only buffer)', async () => {
      const mockEvent = {
        id: '4',
        subscription: 'invoice',
        log: {
          type: 'credited',
          invoice: { id: 'inv_4', amount: 1000, fee: undefined },
        },
      };

      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await service.processWebhook(dto);

      expect(mockTransferService.transferRemainingFunds).toHaveBeenCalledWith(
        950,
        'inv_4',
      );
    });

    it('should not process webhook if starkbank user is not initialized', async () => {
      mockStarkbankService.getUser.mockReturnValue(null);

      await service.processWebhook(dto);

      expect(starkbank.event.parse).not.toHaveBeenCalled();
      expect(mockTransferService.transferRemainingFunds).not.toHaveBeenCalled();
    });
  });
});
