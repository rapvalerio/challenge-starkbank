import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { TransferService } from '../transfer/transfer.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';

jest.mock('starkbank', () => ({
  event: {
    parse: jest.fn(),
  },
  transfer: {
    create: jest.fn(),
  },
  Transfer: jest.fn().mockImplementation((args) => args),
  Project: jest.fn().mockImplementation((args) => args),
}));

describe('WebhookModule Integration', () => {
  let webhookService: WebhookService;
  let transferService: TransferService;
  let starkbankService: StarkbankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              STARKBANK_ENVIRONMENT: 'sandbox',
              STARKBANK_PROJECT_ID: 'test-project-id',
              STARKBANK_PRIVATE_KEY_CONTENT: 'test-private-key',
              TRANSFER_BANK_CODE: '20018183',
              TRANSFER_BRANCH_CODE: '0001',
              TRANSFER_ACCOUNT_NUMBER: '6341320293482496',
              TRANSFER_TAX_ID: '20.018.183/0001-80',
              TRANSFER_NAME: 'Stark Bank S.A.',
              TRANSFER_ACCOUNT_TYPE: 'payment',
            }),
          ],
        }),
      ],
      providers: [WebhookService, TransferService, StarkbankService],
    }).compile();

    webhookService = module.get<WebhookService>(WebhookService);
    transferService = module.get<TransferService>(TransferService);
    starkbankService = module.get<StarkbankService>(StarkbankService);

    jest
      .spyOn((webhookService as any).logger, 'log')
      .mockImplementation(() => {});
    jest
      .spyOn((webhookService as any).logger, 'error')
      .mockImplementation(() => {});
    jest
      .spyOn((webhookService as any).logger, 'warn')
      .mockImplementation(() => {});
    jest
      .spyOn((transferService as any).logger, 'log')
      .mockImplementation(() => {});
    jest
      .spyOn((transferService as any).logger, 'error')
      .mockImplementation(() => {});
    jest
      .spyOn((starkbankService as any).logger, 'log')
      .mockImplementation(() => {});

    starkbankService.onModuleInit();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should wire all providers correctly', () => {
    expect(webhookService).toBeDefined();
    expect(transferService).toBeDefined();
    expect(starkbankService).toBeDefined();
  });

  describe('webhook → transfer → SDK flow', () => {
    it('should parse an invoice-credited event and create a transfer with the correct amount', async () => {
      const mockEvent = {
        id: 'evt_1',
        subscription: 'invoice',
        log: {
          type: 'credited',
          invoice: { id: 'inv_1', amount: 10000, fee: 500 },
        },
      };

      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);
      (starkbank.transfer.create as jest.Mock).mockResolvedValue([
        { id: 'tx_1', status: 'processing' },
      ]);

      await webhookService.processWebhook({
        payload: 'mock-payload',
        signature: 'mock-signature',
      });

      expect(starkbank.event.parse).toHaveBeenCalledTimes(1);
      expect(starkbank.transfer.create).toHaveBeenCalledTimes(1);

      const [transfers, options] = (starkbank.transfer.create as jest.Mock).mock
        .calls[0];
      expect(transfers[0].amount).toBe(9450);
      expect(transfers[0].externalId).toBe('inv_1');
      expect(transfers[0].bankCode).toBe('20018183');
      expect(transfers[0].branchCode).toBe('0001');
      expect(transfers[0].accountNumber).toBe('6341320293482496');
      expect(transfers[0].taxId).toBe('20.018.183/0001-80');
      expect(transfers[0].name).toBe('Stark Bank S.A.');
      expect(transfers[0].accountType).toBe('payment');
      expect(options.user).toBeDefined();
    });

    it('should not create a transfer for non-invoice events', async () => {
      const mockEvent = {
        id: 'evt_2',
        subscription: 'transfer',
        log: { type: 'success' },
      };

      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await webhookService.processWebhook({
        payload: 'mock-payload',
        signature: 'mock-signature',
      });

      expect(starkbank.event.parse).toHaveBeenCalledTimes(1);
      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });

    it('should not create a transfer for invoice events that are not credited', async () => {
      const mockEvent = {
        id: 'evt_3',
        subscription: 'invoice',
        log: { type: 'created' },
      };

      (starkbank.event.parse as jest.Mock).mockResolvedValue(mockEvent);

      await webhookService.processWebhook({
        payload: 'mock-payload',
        signature: 'mock-signature',
      });

      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });

    it('should handle invalid signature gracefully without creating a transfer', async () => {
      (starkbank.event.parse as jest.Mock).mockRejectedValue(
        new Error('Invalid signature'),
      );

      await webhookService.processWebhook({
        payload: 'mock-payload',
        signature: 'bad-signature',
      });

      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });
  });
});
