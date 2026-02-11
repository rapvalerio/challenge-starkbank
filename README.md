# Stark Bank Backend Challenge

Integration app built with **NestJS** and **TypeScript** that automates invoice issuance and processes payment webhooks using the [Stark Bank API](https://starkbank.com/docs/api).

## Architecture

This project uses a serverless architecture to receive webhooks from Stark Bank:

1. **API Gateway**: Receives the POST request from Stark Bank.
2. **SQS**: Buffers the webhook events, ensuring resilience.
3. **NestJS Consumer**: A service within the application polls the SQS queue and processes events.

### Environment Variables

The application requires several environment variables for core functionality and AWS integration. See `.env.example` for the full list.

#### AWS Configuration (Required for Webhooks)

```env
AWS_REGION=us-east-1
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/starkbank-webhooks
```

#### AWS Credentials (Optional if using IAM Roles)

```env
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

## What it does

1. **Issues 8–12 invoices every 3 hours** to random people with valid CPFs
2. **Receives webhook callbacks** when invoices are paid (credited)
3. **Transfers the credited amount** (minus fees) to Stark Bank S.A.

```mermaid
sequenceDiagram
    participant Cron as ⏰ Cron (every 3h)
    participant App as NestJS App
    participant SB as Stark Bank API

    Cron->>App: Trigger scheduler
    App->>SB: Create 8-12 invoices
    SB-->>App: Invoices created

    Note over SB: Some invoices get paid...

    SB->>App: POST /webhook (invoice credited)
    App->>App: Validate signature & parse event
    App->>App: Calculate amount - fee - buffer
    App->>SB: Create transfer with externalId (idempotency)
    SB-->>App: Transfer created
```

## Business Logic & Reliability

Beyond the basic requirements, this implementation includes features to ensure financial consistency:

- **Transfer Idempotency**: Uses the `invoice.id` as the `externalId` when creating a transfer. This prevents duplicate transfers if a webhook is delivered more than once (e.g., due to network retries).
- **Financial Buffer**: Calculates the transfer amount by subtracting a small buffer (50 cents) from the credited amount. This ensures the account has enough balance to cover the **Transfer Fee** itself, preventing "Insufficient Funds" errors.
- **24-Hour Lifecycle**: The invoice scheduler automatically stops after 24 hours of operation, strictly adhering to the challenge requirements.
- **Resilient Parsing**: Implements robust error handling around webhook parsing to ensure the service remains stable even with malformed payloads.

## Tech Stack

| Technology                                                             | Purpose                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| [NestJS](https://nestjs.com/)                                          | Framework with dependency injection and modular architecture |
| [TypeScript](https://www.typescriptlang.org/)                          | Type safety and better developer experience                  |
| [Stark Bank SDK](https://github.com/starkbank/sdk-node)                | Official SDK for API integration                             |
| [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) | Cron-based invoice scheduling                                |
| [Jest](https://jestjs.io/)                                             | Unit, integration, and e2e testing                           |

## Project Structure

```
src/
├── starkbank/                        # SDK initialization module
│   ├── starkbank.module.ts
│   ├── starkbank.service.ts          # Configures Project credentials
│   └── starkbank.service.spec.ts
├── invoice/                          # Invoice issuance module
│   ├── invoice.module.ts
│   ├── invoice.service.ts            # Creates random invoices
│   ├── invoice.service.spec.ts
│   ├── invoice.scheduler.ts          # Cron job (every 3 hours)
│   ├── invoice.scheduler.spec.ts
│   └── invoice.integration.spec.ts
├── webhook/                          # Webhook processing module
│   ├── webhook.module.ts
│   ├── webhook.controller.ts         # POST /webhook endpoint
│   ├── webhook.service.ts            # Event parsing and routing
│   ├── webhook.service.spec.ts
│   ├── webhook.integration.spec.ts
│   └── dto/
│       └── webhook-event.dto.ts
├── transfer/                         # Transfer module
│   ├── transfer.module.ts
│   ├── transfer.service.ts           # Creates transfers to Stark Bank S.A.
│   └── transfer.service.spec.ts
├── utils/
│   ├── cpf-generator.ts              # Generates valid CPFs
│   └── cpf-generator.spec.ts
├── health.controller.ts              # GET /health endpoint
├── app.module.ts
└── main.ts
test/
├── webhook.e2e-spec.ts               # End-to-end HTTP tests
├── jest-e2e.json
└── jest-integration.json
```

## Quick Start with Docker

```bash
cp .env.example .env
# Edit .env with your credentials
docker-compose up
```

## API Endpoints

| Method | Route      | Description                                              |
| ------ | ---------- | -------------------------------------------------------- |
| `GET`  | `/health`  | Health check — returns app status, uptime, and SDK state |
| `POST` | `/webhook` | Receives Stark Bank webhook callbacks                    |

## Getting Started

### Prerequisites

- Node.js 18+
- A Stark Bank Sandbox project with a private key

### Installation

```bash
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
STARKBANK_PROJECT_ID=your_project_id
STARKBANK_PRIVATE_KEY_CONTENT="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
STARKBANK_ENVIRONMENT=sandbox
```

The transfer recipient is pre-configured in `.env.example` as required by the challenge.

### Running

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Webhook Setup

For the app to receive payment events, register a webhook endpoint in Stark Bank pointing to your server's `/webhook` route.

For local development, you can use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
# Then register https://your-id.ngrok.io/webhook in Stark Bank
```

## Testing

The project has **47 tests** across three layers:

```bash
# Unit tests (32 tests)
npm test

# Integration tests (10 tests)
npm run test:integration

# End-to-end tests (5 tests)
npm run test:e2e
```

| Layer           | Scope                              | External SDK |
| --------------- | ---------------------------------- | ------------ |
| **Unit**        | Single class/function in isolation | Mocked       |
| **Integration** | Full module with real DI wiring    | Mocked       |
| **E2E**         | HTTP request → response lifecycle  | Mocked       |

## Cloud Deployment

The application is deployed on **AWS App Runner**:

- **URL**: https://tv9cfwrn32.us-east-1.awsapprunner.com
- **Webhook endpoint**: https://tv9cfwrn32.us-east-1.awsapprunner.com/webhook

## Architecture Decisions

- **Modular architecture**: Each domain (invoice, webhook, transfer) is a self-contained NestJS module with its own service, making the codebase easy to navigate and extend.

- **StarkbankService as a singleton**: Centralizes SDK initialization and credential management. All modules depend on it through dependency injection rather than importing the SDK directly.

- **Transfer recipient via environment variables**: The transfer destination is configurable through `.env` instead of hardcoded values, making the code reusable and secure.

- **Webhook signature validation**: Every incoming webhook is validated using `starkbank.event.parse()` to verify the digital signature, preventing tampered or forged requests.

- **Graceful error handling**: Invalid signatures and SDK errors are caught and logged without crashing the application, ensuring the webhook endpoint stays available.

## License

MIT
