import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getCustomer,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
  type CustomerProfile,
  type UpdateCustomerBody,
} from '../../api/customers';
import { listOrganizations, type OrganizationListItem } from '../../api/organizations';
import { ApiError } from '../../api/http';
import { StatusBadge } from '../../components/StatusBadge';
import { Layout } from '../../components/Layout';

type EditFields = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  organizationId: string;
};

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orgs, setOrgs] = useState<OrganizationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    organizationId: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'reactivate' | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const accessToken = state.accessToken ?? '';
  const role = state.user?.role ?? '';
  const isAdmin = role === 'ADMIN';
  const canEdit = ['ADMIN', 'SUPPORT_MANAGER'].includes(role);
  const canEditEmail = isAdmin;

  const loadCustomer = useCallback(async () => {
    if (!accessToken || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [cust, orgResult] = await Promise.all([
        getCustomer(accessToken, id),
        canEdit ? listOrganizations(accessToken) : Promise.resolve({ data: [], meta: { total: 0, page: 1, pageSize: 100, hasNextPage: false } }),
      ]);
      setCustomer(cust);
      setOrgs(orgResult.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true });
      } else if (err instanceof ApiError && err.status === 403) {
        void navigate('/customers', { replace: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load customer.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, canEdit, navigate]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const startEdit = () => {
    if (!customer) return;
    setEditFields({
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone ?? '',
      jobTitle: customer.jobTitle ?? '',
      organizationId: customer.organizationId ?? '',
    });
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!customer) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const body: UpdateCustomerBody = {
        fullName: editFields.fullName || undefined,
        phone: editFields.phone || undefined,
        jobTitle: editFields.jobTitle || undefined,
        organizationId: editFields.organizationId || null,
      };
      if (canEditEmail) body.email = editFields.email || undefined;

      const updated = await updateCustomer(accessToken, customer.id, body);
      setCustomer(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusAction = async () => {
    if (!customer || !confirmAction) return;
    setIsActioning(true);
    try {
      const result =
        confirmAction === 'deactivate'
          ? await deactivateCustomer(accessToken, customer.id)
          : await reactivateCustomer(accessToken, customer.id);
      setCustomer((prev) =>
        prev ? { ...prev, status: result.status as 'ACTIVE' | 'DEACTIVATED' } : prev,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setIsActioning(false);
      setConfirmAction(null);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error && !customer) {
    return (
      <Layout>
        <div className="p-6">
          <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
          <Link to="/customers" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800">
            ← Back to customers
          </Link>
        </div>
      </Layout>
    );
  }

  if (!customer) return null;

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link to="/customers" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
              ← Customers
            </Link>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              {customer.fullName}
              <StatusBadge status={customer.status} />
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{customer.email}</p>
          </div>
          <div className="flex gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={startEdit}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Edit
              </button>
            )}
            {isAdmin && customer.status === 'ACTIVE' && (
              <button
                onClick={() => setConfirmAction('deactivate')}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md bg-white hover:bg-red-50"
              >
                Deactivate
              </button>
            )}
            {isAdmin && customer.status === 'DEACTIVATED' && (
              <button
                onClick={() => setConfirmAction('reactivate')}
                className="px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-md bg-white hover:bg-green-50"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Confirmation banner */}
        {confirmAction && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 flex items-center justify-between">
            <p className="text-sm text-yellow-800">
              {confirmAction === 'deactivate'
                ? 'This customer will no longer be able to log in. Continue?'
                : 'This customer will be able to log in again. Continue?'}
            </p>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => void handleStatusAction()}
                disabled={isActioning}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {isActioning ? 'Working…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Profile
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <Field label="Full name">
                  <input
                    type="text"
                    value={editFields.fullName}
                    onChange={(e) => setEditFields((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
                {canEditEmail && (
                  <Field label="Email">
                    <input
                      type="email"
                      value={editFields.email}
                      onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </Field>
                )}
                <Field label="Phone">
                  <input
                    type="tel"
                    value={editFields.phone}
                    onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Job title">
                  <input
                    type="text"
                    value={editFields.jobTitle}
                    onChange={(e) => setEditFields((f) => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Organization">
                  <select
                    value={editFields.organizationId}
                    onChange={(e) => setEditFields((f) => ({ ...f, organizationId: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </Field>

                {saveError && (
                  <p className="text-sm text-red-600">{saveError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <DetailRow label="Full name" value={customer.fullName} />
                <DetailRow label="Email" value={customer.email} />
                <DetailRow label="Phone" value={customer.phone ?? '—'} />
                <DetailRow label="Job title" value={customer.jobTitle ?? '—'} />
                <DetailRow label="Organization" value={customer.organizationName ?? '—'} />
                <DetailRow label="Role" value={customer.role} />
                <DetailRow
                  label="Member since"
                  value={new Date(customer.createdAt).toLocaleDateString()}
                />
              </dl>
            )}
          </div>

          {/* Sidebar: Ticket summary */}
          <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Ticket Activity
            </h3>
            {customer.ticketSummary ? (
              <dl className="space-y-3">
                <DetailRow
                  label="Total tickets"
                  value={String(customer.ticketSummary.totalTickets)}
                />
                <DetailRow
                  label="Open tickets"
                  value={String(customer.ticketSummary.openTickets)}
                />
                <DetailRow
                  label="Last ticket"
                  value={
                    customer.ticketSummary.lastTicketAt
                      ? new Date(customer.ticketSummary.lastTicketAt).toLocaleDateString()
                      : '—'
                  }
                />
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No ticket data available.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right ml-4">{value}</dd>
    </div>
  );
}
