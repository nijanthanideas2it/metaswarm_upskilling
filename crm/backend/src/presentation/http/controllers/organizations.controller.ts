import type { NextFunction, Request, Response } from 'express';
import { Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  ForbiddenError,
  OrganizationHasMembersError,
  OrganizationNotFoundError,
} from '../../../domain/errors/domain.error';
import type { CreateOrganizationUseCase } from '../../../application/use-cases/organizations/create-organization.use-case';
import type { GetOrganizationUseCase } from '../../../application/use-cases/organizations/get-organization.use-case';
import type { ListOrganizationsUseCase } from '../../../application/use-cases/organizations/list-organizations.use-case';
import type { UpdateOrganizationUseCase } from '../../../application/use-cases/organizations/update-organization.use-case';
import type { DeleteOrganizationUseCase } from '../../../application/use-cases/organizations/delete-organization.use-case';
import type { ManageOrganizationMembersUseCase } from '../../../application/use-cases/organizations/manage-organization-members.use-case';
import type { ListCustomersUseCase } from '../../../application/use-cases/customers/list-customers.use-case';

function mapError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ForbiddenError) {
    res.status(403).json({ data: null, meta: null, error: { code: 'FORBIDDEN', message: err.message, details: null } });
  } else if (err instanceof OrganizationNotFoundError) {
    res.status(404).json({ data: null, meta: null, error: { code: 'NOT_FOUND', message: err.message, details: null } });
  } else if (err instanceof CustomerNotFoundError) {
    res.status(404).json({ data: null, meta: null, error: { code: 'NOT_FOUND', message: err.message, details: null } });
  } else if (err instanceof DuplicateOrganizationNameError) {
    res.status(409).json({ data: null, meta: null, error: { code: 'NAME_ALREADY_EXISTS', message: err.message, details: null } });
  } else if (err instanceof OrganizationHasMembersError) {
    res.status(409).json({ data: null, meta: null, error: { code: 'ORGANISATION_HAS_MEMBERS', message: err.message, details: null } });
  } else {
    next(err);
  }
}

export class OrganizationsController {
  constructor(
    private readonly createUseCase: CreateOrganizationUseCase,
    private readonly getUseCase: GetOrganizationUseCase,
    private readonly listUseCase: ListOrganizationsUseCase,
    private readonly updateUseCase: UpdateOrganizationUseCase,
    private readonly deleteUseCase: DeleteOrganizationUseCase,
    private readonly manageMembersUseCase: ManageOrganizationMembersUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await this.createUseCase.execute({
        name: req.body.name as string,
        emailDomain: req.body.emailDomain as string | undefined,
        industry: req.body.industry as string | undefined,
        primaryContactId: req.body.primaryContactId as string | undefined,
        callerRole: req.user!.role as Role,
      });
      res.status(201).json({ data: org, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const result = await this.listUseCase.execute({
        page: Number(q['page'] ?? 1),
        pageSize: Number(q['pageSize'] ?? 20),
        sortBy: (q['sortBy'] ?? 'name') as 'name' | 'createdAt',
        sortOrder: q['sortOrder'] === 'desc' ? 'desc' : 'asc',
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({
        data: result.items,
        meta: { total: result.total, page: result.page, pageSize: result.pageSize, hasNextPage: result.total > result.page * result.pageSize },
        error: null,
      });
    } catch (err) { mapError(err, res, next); }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const membersPage = Number(q['membersPage'] ?? 1);
      const membersPageSize = Number(q['membersPageSize'] ?? 20);

      const { organization, ticketSummary } = await this.getUseCase.execute({
        organizationId: req.params['id'] as string,
        callerRole: req.user!.role as Role,
      });

      const membersResult = await this.listCustomersUseCase.execute({
        page: membersPage,
        pageSize: membersPageSize,
        organizationId: organization.id,
        callerRole: req.user!.role as Role,
      });

      res.status(200).json({
        data: {
          ...organization,
          ticketSummary,
          members: membersResult.items,
          membersMeta: {
            total: membersResult.total,
            page: membersResult.page,
            pageSize: membersResult.pageSize,
            hasNextPage: membersResult.total > membersResult.page * membersResult.pageSize,
          },
        },
        meta: null,
        error: null,
      });
    } catch (err) { mapError(err, res, next); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await this.updateUseCase.execute({
        organizationId: req.params['id'] as string,
        callerRole: req.user!.role as Role,
        fields: req.body as Record<string, unknown>,
      });
      res.status(200).json({ data: org, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({
        organizationId: req.params['id'] as string,
        callerRole: req.user!.role as Role,
      });
      res.status(204).send();
    } catch (err) { mapError(err, res, next); }
  };

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.manageMembersUseCase.execute({
        organizationId: req.params['id'] as string,
        customerId: req.body.customerId as string,
        action: 'add',
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({
        data: { customerId: req.body.customerId, organizationId: req.params['id'] as string, message: 'Customer successfully added to organisation.' },
        meta: null,
        error: null,
      });
    } catch (err) { mapError(err, res, next); }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.manageMembersUseCase.execute({
        organizationId: req.params['id'] as string,
        customerId: req.params['customerId'] as string,
        action: 'remove',
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
      });
      res.status(204).send();
    } catch (err) { mapError(err, res, next); }
  };
}
