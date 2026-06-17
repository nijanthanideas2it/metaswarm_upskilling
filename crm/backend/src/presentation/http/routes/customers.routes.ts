import { Router } from 'express';
import { Role } from '../../../domain/enums';
import { prisma } from '../../../config/prisma';
import { env } from '../../../config/env';
import { PrismaCustomerRepository } from '../../../infrastructure/repositories/prisma-customer.repository';
import { PrismaAuthTokenRepository } from '../../../infrastructure/repositories/prisma-auth-token.repository';
import { PrismaPasswordResetRepository } from '../../../infrastructure/repositories/prisma-password-reset.repository';
import { BcryptService } from '../../../infrastructure/services/bcrypt.service';
import { JwtService } from '../../../infrastructure/services/jwt.service';
import { NodemailerEmailService } from '../../../infrastructure/services/nodemailer-email.service';
import { StubTicketSummaryService } from '../../../infrastructure/services/stub-ticket-summary.service';
import { AuthUserInvitationService } from '../../../infrastructure/services/auth-user-invitation.service';
import { CreateCustomerUseCase } from '../../../application/use-cases/customers/create-customer.use-case';
import { GetCustomerUseCase } from '../../../application/use-cases/customers/get-customer.use-case';
import { ListCustomersUseCase } from '../../../application/use-cases/customers/list-customers.use-case';
import { SearchCustomersUseCase } from '../../../application/use-cases/customers/search-customers.use-case';
import { UpdateCustomerUseCase } from '../../../application/use-cases/customers/update-customer.use-case';
import { UpdateOwnProfileUseCase } from '../../../application/use-cases/customers/update-own-profile.use-case';
import { DeactivateCustomerUseCase } from '../../../application/use-cases/customers/deactivate-customer.use-case';
import { ReactivateCustomerUseCase } from '../../../application/use-cases/customers/reactivate-customer.use-case';
import { CustomersController } from '../controllers/customers.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import { requireRole } from '../middleware/require-role.middleware';
import { validateRequest } from '../middleware/validate-request.middleware';
import { CreateCustomerSchema } from '../../../application/dto/create-customer.dto';
import { UpdateCustomerSchema } from '../../../application/dto/update-customer.dto';

export function createCustomersRoutes(): Router {
  const customerRepo = new PrismaCustomerRepository(prisma);
  const authTokenRepo = new PrismaAuthTokenRepository(prisma);
  const passwordResetRepo = new PrismaPasswordResetRepository(prisma);

  const bcryptService = new BcryptService();
  const jwtService = new JwtService();
  const emailService = new NodemailerEmailService();
  const ticketSummaryService = new StubTicketSummaryService();
  const invitationService = new AuthUserInvitationService(passwordResetRepo, emailService);

  const createUC = new CreateCustomerUseCase(customerRepo, bcryptService, invitationService);
  const getUC = new GetCustomerUseCase(customerRepo, ticketSummaryService);
  const listUC = new ListCustomersUseCase(customerRepo);
  const searchUC = new SearchCustomersUseCase(customerRepo);
  const updateUC = new UpdateCustomerUseCase(customerRepo);
  const updateOwnUC = new UpdateOwnProfileUseCase(customerRepo);
  const deactivateUC = new DeactivateCustomerUseCase(customerRepo, authTokenRepo);
  const reactivateUC = new ReactivateCustomerUseCase(customerRepo);

  const controller = new CustomersController(
    createUC, getUC, listUC, searchUC, updateUC, updateOwnUC, deactivateUC, reactivateUC,
  );

  void env; // env already validated on startup — referenced here for documentation

  const router = Router();
  const auth = authenticate(jwtService);

  router.post('/', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(CreateCustomerSchema), controller.create);
  router.get('/search', auth, controller.search);
  router.patch('/me', auth, requireRole(Role.CUSTOMER), validateRequest(UpdateCustomerSchema), controller.updateOwn);
  router.get('/', auth, controller.list);
  router.get('/:id', auth, controller.get);
  router.patch('/:id', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(UpdateCustomerSchema), controller.update);
  router.post('/:id/deactivate', auth, requireRole(Role.ADMIN), controller.deactivate);
  router.post('/:id/reactivate', auth, requireRole(Role.ADMIN), controller.reactivate);

  return router;
}
