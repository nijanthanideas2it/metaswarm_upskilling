import type { NextFunction, Request, Response } from 'express';
import { AccountStatus, Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  CustomerSearchQueryTooShortError,
  DuplicateEmailError,
  ForbiddenError,
} from '../../../domain/errors/domain.error';
import type { CreateCustomerUseCase } from '../../../application/use-cases/customers/create-customer.use-case';
import type { GetCustomerUseCase } from '../../../application/use-cases/customers/get-customer.use-case';
import type { ListCustomersUseCase } from '../../../application/use-cases/customers/list-customers.use-case';
import type { SearchCustomersUseCase } from '../../../application/use-cases/customers/search-customers.use-case';
import type { UpdateCustomerUseCase } from '../../../application/use-cases/customers/update-customer.use-case';
import type { UpdateOwnProfileUseCase } from '../../../application/use-cases/customers/update-own-profile.use-case';
import type { GetOwnProfileUseCase } from '../../../application/use-cases/customers/get-own-profile.use-case';
import type { DeactivateCustomerUseCase } from '../../../application/use-cases/customers/deactivate-customer.use-case';
import type { ReactivateCustomerUseCase } from '../../../application/use-cases/customers/reactivate-customer.use-case';

function mapError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ForbiddenError) {
    res.status(403).json({ data: null, meta: null, error: { code: 'FORBIDDEN', message: err.message, details: null } });
  } else if (err instanceof CustomerNotFoundError) {
    res.status(404).json({ data: null, meta: null, error: { code: 'NOT_FOUND', message: err.message, details: null } });
  } else if (err instanceof DuplicateEmailError) {
    res.status(409).json({ data: null, meta: null, error: { code: 'EMAIL_ALREADY_EXISTS', message: err.message, details: null } });
  } else if (err instanceof CustomerSearchQueryTooShortError) {
    res.status(422).json({ data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: err.message, details: [{ field: 'q', message: err.message }] } });
  } else {
    next(err);
  }
}

export class CustomersController {
  constructor(
    private readonly createUseCase: CreateCustomerUseCase,
    private readonly getUseCase: GetCustomerUseCase,
    private readonly listUseCase: ListCustomersUseCase,
    private readonly searchUseCase: SearchCustomersUseCase,
    private readonly updateUseCase: UpdateCustomerUseCase,
    private readonly updateOwnUseCase: UpdateOwnProfileUseCase,
    private readonly getOwnUseCase: GetOwnProfileUseCase,
    private readonly deactivateUseCase: DeactivateCustomerUseCase,
    private readonly reactivateUseCase: ReactivateCustomerUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customer = await this.createUseCase.execute({
        fullName: req.body.fullName as string,
        email: req.body.email as string,
        phone: req.body.phone as string | undefined,
        jobTitle: req.body.jobTitle as string | undefined,
        organizationId: req.body.organizationId as string | undefined,
        callerRole: req.user!.role as Role,
      });
      res.status(201).json({ data: customer, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const result = await this.listUseCase.execute({
        page: Number(q['page'] ?? 1),
        pageSize: Number(q['pageSize'] ?? 20),
        status: q['filter[status]'] as AccountStatus | undefined,
        organizationId: q['filter[organizationId]'],
        sortBy: (q['sortBy'] ?? 'createdAt') as 'fullName' | 'email' | 'createdAt',
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

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const result = await this.searchUseCase.execute({
        query: q['q'] ?? '',
        page: Number(q['page'] ?? 1),
        pageSize: Number(q['pageSize'] ?? 20),
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
      const { customer, ticketSummary } = await this.getUseCase.execute({
        customerId: req.params['id'] as string,
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({ data: { ...customer, ticketSummary }, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customer = await this.updateUseCase.execute({
        customerId: req.params['id'] as string,
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
        fields: req.body as Record<string, unknown>,
      });
      res.status(200).json({ data: customer, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  getOwn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { customer, ticketSummary } = await this.getOwnUseCase.execute({
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({ data: { ...customer, ticketSummary }, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  updateOwn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customer = await this.updateOwnUseCase.execute({
        callerUserId: req.user!.sub,
        callerRole: req.user!.role as Role,
        fields: req.body as Record<string, unknown>,
      });
      res.status(200).json({ data: customer, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await this.deactivateUseCase.execute({
        customerId: id,
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({ data: { id, status: AccountStatus.DEACTIVATED, updatedAt: new Date().toISOString() }, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await this.reactivateUseCase.execute({
        customerId: id,
        callerRole: req.user!.role as Role,
      });
      res.status(200).json({ data: { id, status: AccountStatus.ACTIVE, updatedAt: new Date().toISOString() }, meta: null, error: null });
    } catch (err) { mapError(err, res, next); }
  };
}
