import request from 'supertest';
import express from 'express';
import { OrganizationsController } from '../../src/presentation/http/controllers/organizations.controller';
import { authenticate } from '../../src/presentation/http/middleware/authenticate.middleware';
import { requireRole } from '../../src/presentation/http/middleware/require-role.middleware';
import { validateRequest } from '../../src/presentation/http/middleware/validate-request.middleware';
import { CreateOrganizationSchema } from '../../src/application/dto/create-organization.dto';
import { UpdateOrganizationSchema } from '../../src/application/dto/update-organization.dto';
import type { CreateOrganizationUseCase } from '../../src/application/use-cases/organizations/create-organization.use-case';
import type { GetOrganizationUseCase } from '../../src/application/use-cases/organizations/get-organization.use-case';
import type { ListOrganizationsUseCase } from '../../src/application/use-cases/organizations/list-organizations.use-case';
import type { UpdateOrganizationUseCase } from '../../src/application/use-cases/organizations/update-organization.use-case';
import type { DeleteOrganizationUseCase } from '../../src/application/use-cases/organizations/delete-organization.use-case';
import type { ManageOrganizationMembersUseCase } from '../../src/application/use-cases/organizations/manage-organization-members.use-case';
import type { ListCustomersUseCase } from '../../src/application/use-cases/customers/list-customers.use-case';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  OrganizationHasMembersError,
  OrganizationNotFoundError,
} from '../../src/domain/errors/domain.error';
import { AccountStatus, Role } from '../../src/domain/enums';
import { createMockJwtService } from '../helpers/mocks';
import { z } from 'zod';

const ADMIN_USER = { sub: 'admin-id', role: Role.ADMIN };
const MANAGER_USER = { sub: 'manager-id', role: Role.SUPPORT_MANAGER };
const AGENT_USER = { sub: 'agent-id', role: Role.SUPPORT_AGENT };

const ORG_FIXTURE = {
  id: 'org-uuid',
  name: 'Acme Corp',
  emailDomain: 'acme.com',
  industry: 'Manufacturing',
  primaryContactId: 'cust-uuid',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-06-16T10:00:00Z'),
};

const CUSTOMER_FIXTURE = {
  id: 'cust-uuid',
  userId: 'user-uuid',
  fullName: 'Jane Smith',
  email: 'jane@acme.com',
  phone: null,
  jobTitle: null,
  organizationId: 'org-uuid',
  role: Role.CUSTOMER,
  status: AccountStatus.ACTIVE,
  createdAt: new Date('2026-01-15T09:00:00Z'),
  updatedAt: new Date('2026-06-16T10:00:00Z'),
};

const AddMemberSchema = z.object({ customerId: z.string().uuid() });

function buildMockUseCases() {
  return {
    createUseCase: { execute: jest.fn() } as unknown as jest.Mocked<CreateOrganizationUseCase>,
    getUseCase: { execute: jest.fn() } as unknown as jest.Mocked<GetOrganizationUseCase>,
    listUseCase: { execute: jest.fn() } as unknown as jest.Mocked<ListOrganizationsUseCase>,
    updateUseCase: { execute: jest.fn() } as unknown as jest.Mocked<UpdateOrganizationUseCase>,
    deleteUseCase: { execute: jest.fn() } as unknown as jest.Mocked<DeleteOrganizationUseCase>,
    manageMembersUseCase: { execute: jest.fn() } as unknown as jest.Mocked<ManageOrganizationMembersUseCase>,
    listCustomersUseCase: { execute: jest.fn() } as unknown as jest.Mocked<ListCustomersUseCase>,
  };
}

function createTestApp(
  mocks: ReturnType<typeof buildMockUseCases>,
  callerUser: { sub: string; role: Role } = ADMIN_USER,
) {
  const jwtService = createMockJwtService();
  jwtService.verifyAccessToken.mockReturnValue(callerUser);

  const controller = new OrganizationsController(
    mocks.createUseCase,
    mocks.getUseCase,
    mocks.listUseCase,
    mocks.updateUseCase,
    mocks.deleteUseCase,
    mocks.manageMembersUseCase,
    mocks.listCustomersUseCase,
  );

  const app = express();
  app.use(express.json());

  const auth = authenticate(jwtService);

  app.post('/api/v1/organizations', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(CreateOrganizationSchema), controller.create);
  app.get('/api/v1/organizations', auth, controller.list);
  app.get('/api/v1/organizations/:id', auth, controller.get);
  app.patch('/api/v1/organizations/:id', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(UpdateOrganizationSchema), controller.update);
  app.delete('/api/v1/organizations/:id', auth, requireRole(Role.ADMIN), controller.delete);
  app.post('/api/v1/organizations/:id/members', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(AddMemberSchema), controller.addMember);
  app.delete('/api/v1/organizations/:id/members/:customerId', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), controller.removeMember);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ data: null, meta: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });

  return app;
}

// ---------------------------------------------------------------------------
// POST /api/v1/organizations
// ---------------------------------------------------------------------------
describe('POST /api/v1/organizations', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 201 with organization on success', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockResolvedValue(ORG_FIXTURE);

    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corp' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Acme Corp' });
    expect(res.body.error).toBeNull();
  });

  it('returns 409 when organization name already exists', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockRejectedValue(new DuplicateOrganizationNameError());

    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corp' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_ALREADY_EXISTS');
    expect(res.body.data).toBeNull();
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corp' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for missing required name field', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({ industry: 'Tech' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid emailDomain format', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corp', emailDomain: 'user@domain.com' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/v1/organizations').send({ name: 'Acme Corp' });
    expect(res.status).toBe(401);
  });

  it('accepts request with all optional fields', async () => {
    (mocks.createUseCase.execute as jest.Mock).mockResolvedValue(ORG_FIXTURE);

    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Acme Corp',
        emailDomain: 'acme.com',
        industry: 'Manufacturing',
        primaryContactId: '00000000-0000-0000-0000-000000000001',
      });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/organizations
// ---------------------------------------------------------------------------
describe('GET /api/v1/organizations', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, AGENT_USER);
  });

  it('returns 200 with paginated list', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({
      items: [ORG_FIXTURE],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, pageSize: 20, hasNextPage: false });
    expect(res.body.error).toBeNull();
  });

  it('returns 200 with hasNextPage true when more items exist', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({
      items: Array(20).fill(ORG_FIXTURE),
      total: 50,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.meta.hasNextPage).toBe(true);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/organizations');
    expect(res.status).toBe(401);
  });

  it('passes sort query params to use case', async () => {
    (mocks.listUseCase.execute as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await request(app)
      .get('/api/v1/organizations?sortBy=createdAt&sortOrder=desc')
      .set('Authorization', 'Bearer token');

    expect(mocks.listUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }));
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/organizations/:id
// ---------------------------------------------------------------------------
describe('GET /api/v1/organizations/:id', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, AGENT_USER);
  });

  it('returns 200 with full organization profile including members and ticketSummary', async () => {
    const ticketSummary = { totalOpenTickets: 5, lastTicketAt: '2026-06-14T14:00:00Z' };
    (mocks.getUseCase.execute as jest.Mock).mockResolvedValue({ organization: ORG_FIXTURE, ticketSummary });
    (mocks.listCustomersUseCase.execute as jest.Mock).mockResolvedValue({
      items: [CUSTOMER_FIXTURE],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app)
      .get('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Acme Corp', ticketSummary });
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.membersMeta).toMatchObject({ total: 1, hasNextPage: false });
    expect(res.body.error).toBeNull();
  });

  it('returns 404 when organization not found', async () => {
    (mocks.getUseCase.execute as jest.Mock).mockRejectedValue(new OrganizationNotFoundError());

    const res = await request(app)
      .get('/api/v1/organizations/unknown-id')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/organizations/org-uuid');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/organizations/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/organizations/:id', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 200 with updated organization', async () => {
    const updated = { ...ORG_FIXTURE, name: 'Acme Corporation' };
    (mocks.updateUseCase.execute as jest.Mock).mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corporation' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Acme Corporation');
    expect(res.body.error).toBeNull();
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .patch('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corporation' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when updated name already exists', async () => {
    (mocks.updateUseCase.execute as jest.Mock).mockRejectedValue(new DuplicateOrganizationNameError());

    const res = await request(app)
      .patch('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Existing Corp' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_ALREADY_EXISTS');
  });

  it('returns 404 when organization not found', async () => {
    (mocks.updateUseCase.execute as jest.Mock).mockRejectedValue(new OrganizationNotFoundError());

    const res = await request(app)
      .patch('/api/v1/organizations/unknown')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Acme Corporation' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).patch('/api/v1/organizations/org-uuid').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/organizations/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/organizations/:id', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 204 on successful delete', async () => {
    (mocks.deleteUseCase.execute as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns 409 when organization has members', async () => {
    (mocks.deleteUseCase.execute as jest.Mock).mockRejectedValue(new OrganizationHasMembersError());

    const res = await request(app)
      .delete('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORGANISATION_HAS_MEMBERS');
  });

  it('returns 403 when caller is Support Manager', async () => {
    const managerApp = createTestApp(mocks, MANAGER_USER);

    const res = await request(managerApp)
      .delete('/api/v1/organizations/org-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });

  it('returns 404 when organization not found', async () => {
    (mocks.deleteUseCase.execute as jest.Mock).mockRejectedValue(new OrganizationNotFoundError());

    const res = await request(app)
      .delete('/api/v1/organizations/unknown')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).delete('/api/v1/organizations/org-uuid');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/organizations/:id/members
// ---------------------------------------------------------------------------
describe('POST /api/v1/organizations/:id/members', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 200 with success message on add', async () => {
    (mocks.manageMembersUseCase.execute as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/organizations/org-uuid/members')
      .set('Authorization', 'Bearer token')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      organizationId: 'org-uuid',
      customerId: '00000000-0000-0000-0000-000000000001',
    });
    expect(res.body.error).toBeNull();
  });

  it('returns 404 when customer not found', async () => {
    (mocks.manageMembersUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .post('/api/v1/organizations/org-uuid/members')
      .set('Authorization', 'Bearer token')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when organization not found', async () => {
    (mocks.manageMembersUseCase.execute as jest.Mock).mockRejectedValue(new OrganizationNotFoundError());

    const res = await request(app)
      .post('/api/v1/organizations/unknown/members')
      .set('Authorization', 'Bearer token')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 when customerId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-uuid/members')
      .set('Authorization', 'Bearer token')
      .send({ customerId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .post('/api/v1/organizations/org-uuid/members')
      .set('Authorization', 'Bearer token')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(403);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/org-uuid/members')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/organizations/:id/members/:customerId
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/organizations/:id/members/:customerId', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks, ADMIN_USER);
  });

  it('returns 204 on successful member removal', async () => {
    (mocks.manageMembersUseCase.execute as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/organizations/org-uuid/members/cust-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns 404 when customer not in organization', async () => {
    (mocks.manageMembersUseCase.execute as jest.Mock).mockRejectedValue(new CustomerNotFoundError());

    const res = await request(app)
      .delete('/api/v1/organizations/org-uuid/members/unknown-cust')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when caller is Support Agent', async () => {
    const agentApp = createTestApp(mocks, AGENT_USER);

    const res = await request(agentApp)
      .delete('/api/v1/organizations/org-uuid/members/cust-uuid')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).delete('/api/v1/organizations/org-uuid/members/cust-uuid');
    expect(res.status).toBe(401);
  });
});
