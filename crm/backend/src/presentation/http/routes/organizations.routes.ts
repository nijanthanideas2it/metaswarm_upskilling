import { Router } from 'express';
import { Role } from '../../../domain/enums';
import { prisma } from '../../../config/prisma';
import { PrismaCustomerRepository } from '../../../infrastructure/repositories/prisma-customer.repository';
import { PrismaOrganizationRepository } from '../../../infrastructure/repositories/prisma-organization.repository';
import { JwtService } from '../../../infrastructure/services/jwt.service';
import { StubTicketSummaryService } from '../../../infrastructure/services/stub-ticket-summary.service';
import { CreateOrganizationUseCase } from '../../../application/use-cases/organizations/create-organization.use-case';
import { GetOrganizationUseCase } from '../../../application/use-cases/organizations/get-organization.use-case';
import { ListOrganizationsUseCase } from '../../../application/use-cases/organizations/list-organizations.use-case';
import { UpdateOrganizationUseCase } from '../../../application/use-cases/organizations/update-organization.use-case';
import { DeleteOrganizationUseCase } from '../../../application/use-cases/organizations/delete-organization.use-case';
import { ManageOrganizationMembersUseCase } from '../../../application/use-cases/organizations/manage-organization-members.use-case';
import { ListCustomersUseCase } from '../../../application/use-cases/customers/list-customers.use-case';
import { OrganizationsController } from '../controllers/organizations.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import { requireRole } from '../middleware/require-role.middleware';
import { validateRequest } from '../middleware/validate-request.middleware';
import { CreateOrganizationSchema } from '../../../application/dto/create-organization.dto';
import { UpdateOrganizationSchema } from '../../../application/dto/update-organization.dto';
import { z } from 'zod';

const AddMemberSchema = z.object({ customerId: z.string().uuid() });

export function createOrganizationsRoutes(): Router {
  const customerRepo = new PrismaCustomerRepository(prisma);
  const orgRepo = new PrismaOrganizationRepository(prisma);
  const jwtService = new JwtService();
  const ticketSummaryService = new StubTicketSummaryService();

  const createUC = new CreateOrganizationUseCase(orgRepo, customerRepo);
  const getUC = new GetOrganizationUseCase(orgRepo, ticketSummaryService);
  const listUC = new ListOrganizationsUseCase(orgRepo);
  const updateUC = new UpdateOrganizationUseCase(orgRepo, customerRepo);
  const deleteUC = new DeleteOrganizationUseCase(orgRepo);
  const manageMembersUC = new ManageOrganizationMembersUseCase(orgRepo, customerRepo);
  const listCustomersUC = new ListCustomersUseCase(customerRepo);

  const controller = new OrganizationsController(
    createUC, getUC, listUC, updateUC, deleteUC, manageMembersUC, listCustomersUC,
  );

  const router = Router();
  const auth = authenticate(jwtService);

  router.post('/', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(CreateOrganizationSchema), controller.create);
  router.get('/', auth, controller.list);
  router.get('/:id', auth, controller.get);
  router.patch('/:id', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(UpdateOrganizationSchema), controller.update);
  router.delete('/:id', auth, requireRole(Role.ADMIN), controller.delete);
  router.post('/:id/members', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), validateRequest(AddMemberSchema), controller.addMember);
  router.delete('/:id/members/:customerId', auth, requireRole(Role.ADMIN, Role.SUPPORT_MANAGER), controller.removeMember);

  return router;
}
