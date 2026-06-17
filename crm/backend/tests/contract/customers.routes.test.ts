import request from 'supertest';
import express from 'express';
import { CustomersController } from '../../src/presentation/http/controllers/customers.controller';
import { authenticate } from '../../src/presentation/http/middleware/authenticate.middleware';
import { requireRole } from '../../src/presentation/http/middleware/require-role.middleware';
import { validateRequest } from '../../src/presentation/http/middleware/validate-request.middleware';
import { CreateCustomerSchema } from '../../src/application/dto/create-customer.dto';
import { UpdateCustomerSchema } from '../../src/application/dto/update-customer.dto';
import type { CreateCustomerUseCase } from '../../src/application/use-cases/customers/create-customer.use-case';
import type { GetCustomerUseCase } from '../../src/application/use-cases/customers/get-customer.use-case';
import type { ListCustomersUseCase } from '../../src/application/use-cases/customers/list-customers.use-case';
import type { SearchCustomersUseCase } from '../../src/application/use-cases/customers/search-customers.use-case';
import type { UpdateCustomerUseCase } from '../../src/application/use-cases/customers/update-customer.use-case';
import type { UpdateOwnProfileUseCase } from '../../src/application/use-cases/customers/update-own-profile.use-case';
import type { DeactivateCustomerUseCase } from '../../src/application/use-cases/customers/deactivate-customer.use-case';
import type { ReactivateCustomerUseCase } from '../../src/application/use-cases/customers/reactivate-customer.use-case';
import {
  CustomerNotFoundError,
  CustomerSearchQueryTooShortError,
  DuplicateEmailError,
  ForbiddenError,
} from '../../src/domain/errors/domain.error';
import { AccountStatus, Role } from '../../src/domain/enums';
import { createMockJwtService } from '../helpers/mocks';

const ADMIN_USER = { sub: 'admin-id', role: Role.ADMIN };
const MANAGER_USER = { sub: 'manager-id', role: Role.SUPPORT_MANAGER };
const AGENT_USER = { sub: 'agent-id', role: Role.SUPPORT_AGENT };
const CUSTOMER_USER = { sub: 'customer-id', role: Role.CUSTOMER };

const CUSTOMER_FIXTURE = {
  id: 'cust-uuid',
  userId: 'user-uuid',
  fullName: 'Jane Smith',
  email: 'jane@acme.com',
  phone: '+1 555 123 4567',
  jobTitle: 'Operations Lead',
  organizationId: 'org-uuid',
  role: Role.CUSTOMER,
  status: AccountStatus.ACTIVE,
  createdAt: new Date('2026-01-15T09:00:00Z'),
  updatedAt: new Date('2026-06-16T10:00:00Z'),
};

function buildMockUseCases() {
  return {
    createUseCase: { execute: jest.fn() } as unknown as jest.Mocked<CreateCustomerUseCase>,
    getUseCase: { execute: jest.fn() } as unknown as jest.Mocked<GetCustomerUseCase>,
    listUseCase: { execute: jest.fn() } as unknown as jest.Mocked<ListCustomersUseCase>,
    searchUseCase: { execute: jest.fn() } as unknown as jest.Mocked<SearchCustomersUseCase>,
    updateUseCase: { execute: jest.fn() } as unknown as jest.Mocked<UpdateCustomerUseCase>,
    updateOwnUseCase: { execute: jest.fn() } as unknown as jest.Mocked<UpdateOwnProfileUseCase>,
    deactivateUseCase: { execute: jest.fn() } as unknown as jest.Mocked<DeactivateCustomerUseCase>,
    reactivateUseCase: { execute: jest.fn() } as unknown as jest.Mocked<ReactivateCustomerUseCase>,
  };
}

function createTestApp(
  mocks: ReturnType<typeof buildMockUseCases>,
  callerUser: { sub: string; role: Role } = ADMIN_USER,
) {
  const jwtService = createMockJwtService();
  jwtService.verifyAccessToken.mockReturnValue(callerUser);

  const controller = new CustomersController(
    mocks.createUseCase,
    mocks.getUseCase,
    mocks.listUseCase,
    mocks.searchUseCase,
    mocks.updateUseCase,
    mocks.updateOwnUseCase,
    mocks.deactivateUseCase,
    mocks.reactivateUseCase,
  );

  const app = express();
  app.use(express.json());

  const auth = authenticate(jwtService);

  app.post('/api/v1/customers', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(CreateCustomerSchema), controller.create);
  app.get('/api/v1/customers/search', auth, controller.search);
  app.patch('/api/v1/customers/me', auth, requireRole(Role.CUSTOMER), validateRequest(UpdateCustomerSchema), controller.updateOwn);
  app.get('/api/v1/customers', auth, controller.list);
  app.get('/api/v1/customers/:id', auth, controller.get);
  app.patch('/api/v1/customers/:id', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(UpdateCustomerSchema), controller.update);
  app.post('/api/v1/customers/:id/deactivate', auth, requireRole(Role.ADMIN), controller.deactivate);
  app.post('/api/v1/customers/:id/reactivate', auth, requireRole(Role.ADMIN), controller.reactivate);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ data: null, meta: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });

  return app;
}

// ---------------------------------------------------------------------------
// POST /api/v1/customers
// ---------------------------------------------------------------------------
describe('POST /api/v1/customers', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 201 with customer on success', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockResolvedValue(CUSTOMER_FIXTURE);

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane Smith', email: 'jane@acme.com' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ fullName: 'Jane Smith', email: 'jane@acme.com' });
    expect(res.body.error).toBeNull();
  });

  it('returns 409 when email already exists', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockRejectedValue(new DuplicateEmailError());

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane Smith', email: 'jane@acme.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(res.body.data).toBeNull();
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);
    (mocks.createUseCase.execute as jest.Mock).mockRejectedValue(new ForbiddenError());

    const res = await request(agentApp)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane Smith', email: 'jane@acme.com' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({ phone: '+1 555 000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane', email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .send({ fullName: 'Jane', email: 'jane@acme.com' });

    expect(res.status).toBe(401);
  });

  it('accepts request with all optional fields', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockResolvedValue(CUSTOMER_FIXTURE);

    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', 'Bearer token')
      .send({
        fullName: 'Jane Smith',
        email: 'jane@acme.com',
        phone: '+1 555 123 4567',
        jobTitle: 'Operations Lead',
        organizationId: '00000000-0000-0000-0000-000000000001',
      });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/customers
// ---------------------------------------------------------------------------
describe('GET /api/v1/customers', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, AGENT_USER);
  });

  it('returns 200 with paginated list', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({
      items: [CUSTOMER_FIXTURE],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, pageSize: 20, hasNextPage: false });
    expect(res.body.error).toBeNull();
  });

  it('returns 200 with hasNextPage true when more items exist', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({
      items: Array(20).fill(CUSTOMER_FIXTURE),
      total: 50,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.meta.hasNextPage).toBe(true);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  it('passes sort query params to use case', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await request(app)
      .get('/api/v1/customers?sortBy=fullName&sortOrder=desc')
      .set('Authorization', 'Bearer token');

    expect(mocks.listUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'fullName',
      sortOrder: 'desc',
    }));
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/customers/search
// ---------------------------------------------------------------------------
describe('GET /api/v1/customers/search', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, AGENT_USER);
  });

  it('returns 200 with matching results', async () => {
    (mocks.searchUseCase.execute as jest.Mock).mockResolvedValue({
      items: [CUSTOMER_FIXTURE],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/customers/search?q=Jane')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, hasNextPage: false });
    expect(res.body.error).toBeNull();
  });

  it('returns 200 with empty results when no match', async () => {
    (mocks.searchUseCase.execute as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const res = await request(app)
      .get('/api/v1/customers/search?q=NoMatch')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 422 when query is too short', async () => {
    (mocks.searchUseCase.execute as jest.Mock).mockRejectedValue(new CustomerSearchQueryTooShortError());

    const res = await request(app)
      .get('/api/v1/customers/search?q=J')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('q');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/customers/search?q=Jane');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/customers/:id
// ---------------------------------------------------------------------------
describe('GET /api/v1/customers/:id', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, AGENT_USER);
  });

  it('returns 200 with full customer profile including ticketSummary', async () => {
    const ticketSummary = { totalTickets: 14, openTickets: 2, lastTicketAt: '2026-06-10T08:30:00Z' };
    (mocks.getUseCase.execute as jest.Mock).mockResolvedValue({ customer: CUSTOMER_FIXTURE, ticketSummary });

    const res = await request(app)
      .get('/api/v1/customers/cust-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fullName: 'Jane Smith', email: 'jane@acme.com' });
    expect(res.body.data.ticketSummary).toMatchObject(ticketSummary);
    expect(res.body.error).toBeNull();
  });

  it('returns 404 when customer not found', async () => {
    (mocks.getUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .get('/api/v1/customers/unknown-id')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when customer tries to access another customer profile', async () => {
    (mocks.getUseCase.execute as jest.Mock).mockRejectedValue(new ForbiddenError());
    const customerApp = createTestApp(mocks, CUSTOMER_USER);

    const res = await request(customerApp)
      .get('/api/v1/customers/other-id')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/customers/cust-uuid');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/customers/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/customers/:id', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 200 with updated customer', async () => {
    const updated = { ...CUSTOMER_FIXTURE, fullName: 'Jane A. Smith' };
    (mocks.updateUseCase.execute as jest.Mock).mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/v1/customers/cust-uuid')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane A. Smith' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Jane A. Smith');
    expect(res.body.error).toBeNull();
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .patch('/api/v1/customers/cust-uuid')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane A. Smith' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when use case throws ForbiddenError (field-level RBAC)', async () => {
    (mocks.updateUseCase.execute as jest.Mock).mockRejectedValue(new ForbiddenError());

    const managerApp = createTestApp(mocks, MANAGER_USER);
    const res = await request(managerApp)
      .patch('/api/v1/customers/cust-uuid')
      .set('Authorization', 'Bearer token')
      .send({ email: 'newemail@acme.com' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when customer not found', async () => {
    (mocks.updateUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .patch('/api/v1/customers/unknown')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane A. Smith' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).patch('/api/v1/customers/cust-uuid').send({ fullName: 'Jane' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/customers/me
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/customers/me', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, CUSTOMER_USER);
  });

  it('returns 200 with updated profile for customer updating own profile', async () => {
    const updated = { ...CUSTOMER_FIXTURE, fullName: 'Jane Updated' };
    (mocks.updateOwnUseCase.execute as jest.Mock).mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/v1/customers/me')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Jane Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Jane Updated');
    expect(res.body.error).toBeNull();
  });

  it('returns 403 when called by Support Agent (not Customer role)', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .patch('/api/v1/customers/me')
      .set('Authorization', 'Bearer token')
      .send({ fullName: 'Agent Attempt' });

    expect(res.status).toBe(403);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).patch('/api/v1/customers/me').send({ fullName: 'Jane' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/customers/:id/deactivate
// ---------------------------------------------------------------------------
describe('POST /api/v1/customers/:id/deactivate', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 200 with deactivated status on success', async () => {
    (mocks.deactivateUseCase.execute as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/customers/cust-uuid/deactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'cust-uuid', status: AccountStatus.DEACTIVATED });
    expect(res.body.error).toBeNull();
  });

  it('returns 403 when caller is Support Manager', async () => {
    const managerApp = createTestApp(mocks, MANAGER_USER);

    const res = await request(managerApp)
      .post('/api/v1/customers/cust-uuid/deactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });

  it('returns 404 when customer not found', async () => {
    (mocks.deactivateUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .post('/api/v1/customers/unknown/deactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/v1/customers/cust-uuid/deactivate');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/customers/:id/reactivate
// ---------------------------------------------------------------------------
describe('POST /api/v1/customers/:id/reactivate', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 200 with active status on success', async () => {
    (mocks.reactivateUseCase.execute as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/customers/cust-uuid/reactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'cust-uuid', status: AccountStatus.ACTIVE });
    expect(res.body.error).toBeNull();
  });

  it('returns 403 when caller is Support Manager', async () => {
    const managerApp = createTestApp(mocks, MANAGER_USER);

    const res = await request(managerApp)
      .post('/api/v1/customers/cust-uuid/reactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });

  it('returns 404 when customer not found', async () => {
    (mocks.reactivateUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .post('/api/v1/customers/unknown/reactivate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/v1/customers/cust-uuid/reactivate');
    expect(res.status).toBe(401);
  });
});
