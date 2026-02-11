import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { InvoiceSchedulerService } from './invoice.scheduler';
import { InvoiceService } from './invoice.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';

jest.mock('starkbank', () => ({
  invoice: {
    create: jest.fn(),
  },
  Invoice: jest.fn().mockImplementation((args) => args),
  Project: jest.fn().mockImplementation((args) => args),
}));

describe('InvoiceModule Integration', () => {
  let scheduler: InvoiceSchedulerService;
  let invoiceService: InvoiceService;
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
            }),
          ],
        }),
      ],
      providers: [InvoiceSchedulerService, InvoiceService, StarkbankService],
    }).compile();

    scheduler = module.get<InvoiceSchedulerService>(InvoiceSchedulerService);
    invoiceService = module.get<InvoiceService>(InvoiceService);
    starkbankService = module.get<StarkbankService>(StarkbankService);

    jest.spyOn((scheduler as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((scheduler as any).logger, 'debug').mockImplementation(() => {});
    jest.spyOn((scheduler as any).logger, 'error').mockImplementation(() => {});
    jest
      .spyOn((invoiceService as any).logger, 'log')
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
    expect(scheduler).toBeDefined();
    expect(invoiceService).toBeDefined();
    expect(starkbankService).toBeDefined();
  });

  it('should have StarkbankService initialized with a valid user', () => {
    expect(starkbankService.getUser()).toBeDefined();
  });

  describe('scheduler → service → SDK flow', () => {
    it('should call starkbank.invoice.create when the scheduler fires', async () => {
      const mockCreated = [
        { id: 'inv_1', amount: 5000 },
        { id: 'inv_2', amount: 3000 },
      ];
      (starkbank.invoice.create as jest.Mock).mockResolvedValue(mockCreated);

      await scheduler.handleCron();

      expect(starkbank.invoice.create).toHaveBeenCalledTimes(1);

      const [invoices, options] = (starkbank.invoice.create as jest.Mock).mock
        .calls[0];
      expect(invoices.length).toBeGreaterThanOrEqual(8);
      expect(invoices.length).toBeLessThanOrEqual(12);
      expect(options.user).toBeDefined();
    });

    it('should create invoices with valid CPFs and amounts', async () => {
      (starkbank.invoice.create as jest.Mock).mockResolvedValue([]);

      await scheduler.handleCron();

      const [invoices] = (starkbank.invoice.create as jest.Mock).mock.calls[0];
      for (const inv of invoices) {
        expect(inv.taxId).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
        expect(inv.amount).toBeGreaterThanOrEqual(1000);
        expect(inv.amount).toBeLessThanOrEqual(11000);
        expect(inv.fine).toBe(2.5);
        expect(inv.interest).toBe(1.3);
      }
    });

    it('should handle SDK errors gracefully without crashing', async () => {
      (starkbank.invoice.create as jest.Mock).mockRejectedValue(
        new Error('SDK Error'),
      );

      await expect(scheduler.handleCron()).resolves.toBeUndefined();
    });
  });
});
