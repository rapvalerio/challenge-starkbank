import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StarkbankService } from './starkbank.service';
import * as starkbank from 'starkbank';

jest.mock('starkbank', () => ({
  Project: jest.fn().mockImplementation((args) => args),
}));

describe('StarkbankService', () => {
  let service: StarkbankService;
  let configService: ConfigService;

  const createService = async (envVars: Record<string, string | undefined>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StarkbankService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => envVars[key] ?? undefined),
          },
        },
      ],
    }).compile();

    service = module.get<StarkbankService>(StarkbankService);
    configService = module.get<ConfigService>(ConfigService);

    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

    return service;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    await createService({});
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize the SDK with valid credentials', async () => {
      await createService({
        STARKBANK_ENVIRONMENT: 'sandbox',
        STARKBANK_PROJECT_ID: 'project-123',
        STARKBANK_PRIVATE_KEY_CONTENT: 'private-key-content',
      });

      service.onModuleInit();

      expect(starkbank.Project).toHaveBeenCalledWith({
        environment: 'sandbox',
        id: 'project-123',
        privateKey: 'private-key-content',
      });
      expect(service.getUser()).toBeDefined();
    });

    it('should default to sandbox environment when STARKBANK_ENVIRONMENT is not set', async () => {
      await createService({
        STARKBANK_PROJECT_ID: 'project-123',
        STARKBANK_PRIVATE_KEY_CONTENT: 'private-key-content',
      });

      service.onModuleInit();

      expect(starkbank.Project).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'sandbox' }),
      );
    });

    it('should not initialize SDK if project ID is missing', async () => {
      await createService({
        STARKBANK_PRIVATE_KEY_CONTENT: 'private-key-content',
      });

      service.onModuleInit();

      expect(starkbank.Project).not.toHaveBeenCalled();
      expect(service.getUser()).toBeUndefined();
    });

    it('should not initialize SDK if private key is missing', async () => {
      await createService({
        STARKBANK_PROJECT_ID: 'project-123',
      });

      service.onModuleInit();

      expect(starkbank.Project).not.toHaveBeenCalled();
      expect(service.getUser()).toBeUndefined();
    });
  });

  describe('getUser', () => {
    it('should return undefined before initialization', async () => {
      await createService({});
      expect(service.getUser()).toBeUndefined();
    });

    it('should return the project after successful initialization', async () => {
      await createService({
        STARKBANK_PROJECT_ID: 'project-123',
        STARKBANK_PRIVATE_KEY_CONTENT: 'pk',
      });

      service.onModuleInit();

      const user = service.getUser();
      expect(user).toBeDefined();
      expect(user).toEqual(expect.objectContaining({ id: 'project-123' }));
    });
  });
});
