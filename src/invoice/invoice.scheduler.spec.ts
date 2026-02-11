import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceSchedulerService } from './invoice.scheduler';
import { InvoiceService } from './invoice.service';

describe('InvoiceSchedulerService', () => {
  let scheduler: InvoiceSchedulerService;

  const mockInvoiceService = {
    createRandomInvoices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceSchedulerService,
        { provide: InvoiceService, useValue: mockInvoiceService },
      ],
    }).compile();

    scheduler = module.get<InvoiceSchedulerService>(InvoiceSchedulerService);
    jest.spyOn((scheduler as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((scheduler as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((scheduler as any).logger, 'debug').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleCron', () => {
    it('should call createRandomInvoices on the invoice service', async () => {
      const mockInvoices = [
        { id: 'inv_1', amount: 5000 },
        { id: 'inv_2', amount: 3000 },
      ];
      mockInvoiceService.createRandomInvoices.mockResolvedValue(mockInvoices);

      await scheduler.handleCron();

      expect(mockInvoiceService.createRandomInvoices).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully without crashing', async () => {
      mockInvoiceService.createRandomInvoices.mockRejectedValue(
        new Error('SDK Error'),
      );

      await expect(scheduler.handleCron()).resolves.toBeUndefined();

      expect(mockInvoiceService.createRandomInvoices).toHaveBeenCalledTimes(1);
    });
  });
});
