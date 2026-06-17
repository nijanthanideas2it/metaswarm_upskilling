import { createHash } from 'crypto';
import { Role, AccountStatus } from '../../../../src/domain/enums';
import { DuplicateEmailError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import { CreateCustomerUseCase, CreateCustomerInput } from '../../../../src/application/use-cases/customers/create-customer.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import {
  createMockCustomerRepository,
  createMockBcryptService,
  createMockUserInvitationService,
} from '../../../helpers/mocks';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('r'.repeat(32))),
}));

const HASH = '$2b$12$placeholder-hash';

const baseInput: CreateCustomerInput = {
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  callerRole: Role.ADMIN,
};

describe('CreateCustomerUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let bcryptService: ReturnType<typeof createMockBcryptService>;
  let invitationService: ReturnType<typeof createMockUserInvitationService>;
  let useCase: CreateCustomerUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    bcryptService = createMockBcryptService();
    invitationService = createMockUserInvitationService();
    useCase = new CreateCustomerUseCase(customerRepo, bcryptService, invitationService);
    bcryptService.hash.mockResolvedValue(HASH);
    invitationService.sendInvitation.mockResolvedValue(undefined);
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for SUPPORT_AGENT', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_AGENT }))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for CUSTOMER role', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER }))
        .rejects.toThrow(ForbiddenError);
    });

    it('allows ADMIN', async () => {
      customerRepo.findByEmail.mockResolvedValue(null);
      customerRepo.create.mockResolvedValue(createCustomerEntity());
      await expect(useCase.execute({ ...baseInput, callerRole: Role.ADMIN })).resolves.toBeDefined();
    });

    it('allows SUPPORT_MANAGER', async () => {
      customerRepo.findByEmail.mockResolvedValue(null);
      customerRepo.create.mockResolvedValue(createCustomerEntity());
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_MANAGER })).resolves.toBeDefined();
    });
  });

  describe('duplicate email', () => {
    it('throws DuplicateEmailError when email already exists', async () => {
      customerRepo.findByEmail.mockResolvedValue(createCustomerEntity());
      await expect(useCase.execute(baseInput)).rejects.toThrow(DuplicateEmailError);
      expect(customerRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('email normalization', () => {
    it('lowercases and trims email before uniqueness check', async () => {
      customerRepo.findByEmail.mockResolvedValue(null);
      customerRepo.create.mockResolvedValue(createCustomerEntity());

      await useCase.execute({ ...baseInput, email: '  ALICE@EXAMPLE.COM  ' });

      expect(customerRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
    });
  });

  describe('successful creation', () => {
    beforeEach(() => {
      customerRepo.findByEmail.mockResolvedValue(null);
      customerRepo.create.mockResolvedValue(createCustomerEntity());
    });

    it('creates customer with CUSTOMER role and hashed placeholder password', async () => {
      await useCase.execute(baseInput);

      expect(bcryptService.hash).toHaveBeenCalled();
      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.CUSTOMER,
          passwordHash: HASH,
          fullName: 'Alice Smith',
        }),
      );
    });

    it('sends an invitation email after creation', async () => {
      const customer = createCustomerEntity({ userId: 'user-id-1', email: 'alice@example.com' });
      customerRepo.create.mockResolvedValue(customer);

      await useCase.execute(baseInput);

      expect(invitationService.sendInvitation).toHaveBeenCalledWith('user-id-1', 'alice@example.com');
    });

    it('returns the created CustomerEntity', async () => {
      const expected = createCustomerEntity();
      customerRepo.create.mockResolvedValue(expected);

      const result = await useCase.execute(baseInput);
      expect(result).toBe(expected);
    });

    it('passes optional fields to the repository', async () => {
      await useCase.execute({ ...baseInput, phone: '+1-555-0100', jobTitle: 'Engineer', organizationId: 'org-1' });

      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+1-555-0100', jobTitle: 'Engineer', organizationId: 'org-1' }),
      );
    });
  });
});
