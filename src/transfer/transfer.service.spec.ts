import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { StarkbankService } from '../starkbank/starkbank.service';
import * as starkbank from 'starkbank';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

jest.mock('starkbank', () => ({
  transfer: {
    create: jest.fn(),
  },
  Project: jest.fn().mockImplementation(() => ({})),
  Transfer: jest.fn().mockImplementation((args) => args),
}));

describe('TransferService', () => {
  let service: TransferService;

  const mockStarkbankService = {
    getUser: jest.fn(),
  };

  const validConfig: Record<string, string> = {
    TRANSFER_BANK_CODE: '20018183',
    TRANSFER_BRANCH_CODE: '0001',
    TRANSFER_ACCOUNT_NUMBER: '6341320293482496',
    TRANSFER_TAX_ID: '20.018.183/0001-80',
    TRANSFER_NAME: 'Stark Bank S.A.',
    TRANSFER_ACCOUNT_TYPE: 'payment',
  };

  const mockConfigService = {
    get: jest.fn((key: string) => validConfig[key] ?? null),
  };

  const mockUser = new starkbank.Project({
    environment: 'sandbox',
    id: '123',
    privateKey: 'pk',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: StarkbankService, useValue: mockStarkbankService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);

    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transferRemainingFunds', () => {
    it('should create a transfer with the correct parameters', async () => {
      const transferAmount = 950;
      const externalId = 'inv_123';
      const createdTransfer = { id: 'tx_123', status: 'processing' };
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (mockConfigService.get as jest.Mock).mockImplementation(
        (key: string) => validConfig[key] ?? null,
      );
      (starkbank.transfer.create as jest.Mock).mockResolvedValue([
        createdTransfer,
      ]);

      const result = await service.transferRemainingFunds(
        transferAmount,
        externalId,
      );

      expect(starkbank.transfer.create).toHaveBeenCalledWith(
        [
          {
            amount: transferAmount,
            externalId: externalId,
            bankCode: '20018183',
            branchCode: '0001',
            accountNumber: '6341320293482496',
            taxId: '20.018.183/0001-80',
            name: 'Stark Bank S.A.',
            accountType: 'payment',
          },
        ],
        { user: mockUser },
      );
      expect(result).toEqual([createdTransfer]);
    });

    it('should throw an error if starkbank user is not initialized', async () => {
      mockStarkbankService.getUser.mockReturnValue(null);

      await expect(
        service.transferRemainingFunds(100, 'ext_1'),
      ).rejects.toThrow('Stark Bank user not initialized');
      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });

    it('should throw an error if the transfer creation fails', async () => {
      const error = new Error('SDK Error');
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (mockConfigService.get as jest.Mock).mockImplementation(
        (key: string) => validConfig[key] ?? null,
      );
      (starkbank.transfer.create as jest.Mock).mockRejectedValue(error);

      await expect(service.transferRemainingFunds(100, 'ext_1')).rejects.toThrow(
        error,
      );
    });
  });

  describe('getRecipientDetails (via transferRemainingFunds)', () => {
    it('should throw InternalServerErrorException listing all missing fields', async () => {
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (mockConfigService.get as jest.Mock).mockReturnValue(null);

      await expect(
        service.transferRemainingFunds(100, 'ext_1'),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.transferRemainingFunds(100, 'ext_1'),
      ).rejects.toThrow(
        'Missing transfer config: bankCode, branchCode, accountNumber, taxId, name, accountType',
      );
      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException listing only the missing fields', async () => {
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'TRANSFER_BANK_CODE' || key === 'TRANSFER_TAX_ID') {
          return null;
        }
        return validConfig[key] ?? null;
      });

      await expect(
        service.transferRemainingFunds(100, 'ext_1'),
      ).rejects.toThrow('Missing transfer config: bankCode, taxId');
      expect(starkbank.transfer.create).not.toHaveBeenCalled();
    });

    it('should not throw when all config fields are present', async () => {
      const createdTransfer = { id: 'tx_1', status: 'processing' };
      mockStarkbankService.getUser.mockReturnValue(mockUser);
      (mockConfigService.get as jest.Mock).mockImplementation(
        (key: string) => validConfig[key] ?? null,
      );
      (starkbank.transfer.create as jest.Mock).mockResolvedValue([
        createdTransfer,
      ]);

      await expect(
        service.transferRemainingFunds(500, 'ext_1'),
      ).resolves.not.toThrow();
    });
  });
});
