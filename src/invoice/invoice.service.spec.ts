import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';

jest.mock('starkbank', () => ({
  invoice: {
    create: jest.fn(),
  },
  Invoice: jest.fn().mockImplementation((args) => args),
  Project: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../utils/cpf-generator', () => ({
  generateCpf: jest.fn().mockReturnValue('12345678901'),
}));

describe('InvoiceService', () => {
  let service: InvoiceService;

  const mockStarkbankService = {
    getUser: jest.fn(),
  };

  const mockUser = new starkbank.Project({
    environment: 'sandbox',
    id: '123',
    privateKey: 'pk',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: StarkbankService, useValue: mockStarkbankService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRandomInvoices', () => {
    it('should create between 8 and 12 invoices', async () => {
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.invoice.create as jest.Mock).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `inv_${i}`,
          amount: 5000,
        })),
      );

      const result = await service.createRandomInvoices();

      const createCall = (starkbank.invoice.create as jest.Mock).mock.calls[0];
      const invoicesArg = createCall[0];
      expect(invoicesArg.length).toBeGreaterThanOrEqual(8);
      expect(invoicesArg.length).toBeLessThanOrEqual(12);
      expect(createCall[1]).toEqual({ user: mockUser });
      expect(result).toBeDefined();
    });

    it('should create invoices with correct structure', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.invoice.create as jest.Mock).mockResolvedValue([
        { id: 'inv_1' },
      ]);

      await service.createRandomInvoices();

      const invoicesArg = (starkbank.invoice.create as jest.Mock).mock
        .calls[0][0];
      expect(invoicesArg[0]).toEqual(
        expect.objectContaining({
          taxId: '12345678901',
          fine: 2.5,
          interest: 1.3,
        }),
      );
      expect(invoicesArg[0].amount).toBeGreaterThanOrEqual(1000);
    });

    it('should throw an error if starkbank user is not initialized', async () => {
      mockStarkbankService.getUser.mockReturnValue(null);

      await expect(service.createRandomInvoices()).rejects.toThrow(
        'Stark Bank user not initialized',
      );
      expect(starkbank.invoice.create).not.toHaveBeenCalled();
    });

    it('should propagate errors from the Stark Bank SDK', async () => {
      const error = new Error('SDK Error');
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (starkbank.invoice.create as jest.Mock).mockRejectedValue(error);

      await expect(service.createRandomInvoices()).rejects.toThrow(error);
    });
  });
});
