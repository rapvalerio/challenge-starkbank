import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
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

const mockEventParse = starkbank.event.parse as jest.Mock;
const mockTransferCreate = starkbank.transfer.create as jest.Mock;

describe('Webhook (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: false,
      rawBody: true,
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /webhook - should return 400 if digital-signature header is missing', () => {
    return request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send('{"some":"body"}')
      .expect(400);
  });

  it('POST /webhook - should return 201 for a valid invoice-credited event', async () => {
    const mockEvent = {
      id: 'evt_123',
      subscription: 'invoice',
      log: {
        type: 'credited',
        invoice: { id: 'inv_123', amount: 50000, fee: 350 },
      },
    };

    mockEventParse.mockResolvedValue(mockEvent);
    mockTransferCreate.mockResolvedValue([
      { id: 'tx_1', status: 'processing' },
    ]);

    await request(app.getHttpServer())
      .post('/webhook')
      .set('digital-signature', 'valid-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockEvent))
      .expect(201);
  });

  it('POST /webhook - should return 201 for non-invoice events', async () => {
    const mockEvent = {
      id: 'evt_456',
      subscription: 'transfer',
      log: { type: 'success' },
    };

    mockEventParse.mockResolvedValue(mockEvent);

    await request(app.getHttpServer())
      .post('/webhook')
      .set('digital-signature', 'valid-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockEvent))
      .expect(201);
  });

  it('POST /webhook - should return 201 and handle invalid signature gracefully', async () => {
    mockEventParse.mockRejectedValue(new Error('Invalid signature'));

    await request(app.getHttpServer())
      .post('/webhook')
      .set('digital-signature', 'invalid-signature')
      .set('Content-Type', 'application/json')
      .send('{"data":"test"}')
      .expect(201);
  });

  it('POST /webhook - should return 201 for invoice-created events (non-credited)', async () => {
    const mockEvent = {
      id: 'evt_789',
      subscription: 'invoice',
      log: {
        type: 'created',
        invoice: { id: 'inv_789', amount: 5000 },
      },
    };

    mockEventParse.mockResolvedValue(mockEvent);

    await request(app.getHttpServer())
      .post('/webhook')
      .set('digital-signature', 'valid-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(mockEvent))
      .expect(201);
  });
});
