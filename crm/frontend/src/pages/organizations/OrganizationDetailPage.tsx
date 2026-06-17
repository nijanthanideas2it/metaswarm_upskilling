import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getOrganization,
  updateOrganization,
  deleteOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  type OrganizationProfile,
  type OrganizationMember,
} from '../../api/organizations';
import { searchCustomers, type CustomerListItem } from '../../api/customers';
import { useDebounce } from '../../hooks/useDebounce';
import { ApiError } from '../../api/http';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Layout } from '../../components/Layout';

type EditFields = {
  name: string;
  emailDomain: string;
  industry: string;
};

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [membersPage, setMembersPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({ name: '', emailDomain: '', industry: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add member UI
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearch, 400);
  const [memberSearchResults, setMemberSearchResults] = useState<CustomerListItem[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const accessToken = state.accessToken ?? '';
  const role = state.user?.role ?? '';
  const canEdit = ['ADMIN', 'SUPPORT_MANAGER'].includes(role);
  const isAdmin = role === 'ADMIN';

  const loadOrg = useCallback(async (page = membersPage) => {
    if (!accessToken || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOrganization(accessToken, id, page);
      setOrg(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true });
      } else if (err instanceof ApiError && err.status === 404) {
        void navigate('/organizations', { replace: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load organization.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, membersPage, navigate]);

  useEffect(() => {
    void loadOrg();
  }, [loadOrg]);

  // Search for customers to add as members
  useEffect(() => {
    if (debouncedMemberSearch.length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setIsSearchingMembers(true);
    searchCustomers(accessToken, debouncedMemberSearch, 1, 10)
      .then((r) => setMemberSearchResults(r.data))
      .catch(() => setMemberSearchResults([]))
      .finally(() => setIsSearchingMembers(false));
  }, [debouncedMemberSearch, accessToken]);

  const startEdit = () => {
    if (!org) return;
    setEditFields({
      name: org.name,
      emailDomain: org.emailDomain ?? '',
      industry: org.industry ?? '',
    });
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!org) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateOrganization(accessToken, org.id, {
        name: editFields.name.trim() || undefined,
        emailDomain: editFields.emailDomain.trim() || null,
        industry: editFields.industry.trim() || null,
      });
      setOrg((prev) => prev ? { ...prev, ...updated } : prev);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_ALREADY_EXISTS') {
        setSaveError('An organization with this name already exists.');
      } else {
        setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!org) return;
    setIsDeleting(true);
    try {
      await deleteOrganization(accessToken, org.id);
      void navigate('/organizations', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ORGANISATION_HAS_MEMBERS') {
        setError('Cannot delete: this organization still has members. Remove all members first.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to delete organization.');
      }
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddMember = async (customer: CustomerListItem) => {
    if (!org) return;
    setAddMemberError(null);
    try {
      await addOrganizationMember(accessToken, org.id, customer.id);
      setMemberSearch('');
      setMemberSearchResults([]);
      await loadOrg(membersPage);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CUSTOMER_IN_ANOTHER_ORG') {
        setAddMemberError(`This customer already belongs to another organization.`);
      } else {
        setAddMemberError(err instanceof ApiError ? err.message : 'Failed to add member.');
      }
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!org) return;
    setRemovingMemberId(member.id);
    try {
      await removeOrganizationMember(accessToken, org.id, member.id);
      await loadOrg(membersPage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleMembersPageChange = async (newPage: number) => {
    setMembersPage(newPage);
    await loadOrg(newPage);
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

  if (error && !org) {
    return (
      <Layout>
        <div className="p-6">
          <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
          <Link to="/organizations" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800">
            ← Back to organizations
          </Link>
        </div>
      </Layout>
    );
  }

  if (!org) return null;

  return (
    <Layout>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link to="/organizations" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
              ← Organizations
            </Link>
            <h2 className="text-xl font-semibold text-gray-900">{org.name}</h2>
            {org.industry && <p className="text-sm text-gray-500 mt-0.5">{org.industry}</p>}
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
            {isAdmin && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md bg-white hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {confirmDelete && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 flex items-center justify-between">
            <p className="text-sm text-yellow-800">
              Delete <strong>{org.name}</strong>? This cannot be undone and is blocked if the organization has members.
            </p>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Profile card */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Organization Details
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <Field label="Name">
                  <input
                    type="text"
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Email domain">
                  <input
                    type="text"
                    value={editFields.emailDomain}
                    onChange={(e) => setEditFields((f) => ({ ...f, emailDomain: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="acme.com"
                  />
                </Field>
                <Field label="Industry">
                  <input
                    type="text"
                    value={editFields.industry}
                    onChange={(e) => setEditFields((f) => ({ ...f, industry: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Manufacturing"
                  />
                </Field>

                {saveError && <p className="text-sm text-red-600">{saveError}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving || !editFields.name.trim()}
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
                <DetailRow label="Name" value={org.name} />
                <DetailRow label="Email domain" value={org.emailDomain ?? '—'} />
                <DetailRow label="Industry" value={org.industry ?? '—'} />
                <DetailRow
                  label="Primary contact"
                  value={org.primaryContact ? `${org.primaryContact.fullName} (${org.primaryContact.email})` : '—'}
                />
                <DetailRow
                  label="Created"
                  value={new Date(org.createdAt).toLocaleDateString()}
                />
              </dl>
            )}
          </div>

          {/* Ticket summary */}
          <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Ticket Activity
            </h3>
            {org.ticketSummary ? (
              <dl className="space-y-3">
                <DetailRow
                  label="Open tickets"
                  value={String(org.ticketSummary.totalOpenTickets)}
                />
                <DetailRow
                  label="Last ticket"
                  value={
                    org.ticketSummary.lastTicketAt
                      ? new Date(org.ticketSummary.lastTicketAt).toLocaleDateString()
                      : '—'
                  }
                />
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No ticket data available.</p>
            )}
          </div>
        </div>

        {/* Members section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Members ({org.membersMeta.total})
            </h3>
          </div>

          {/* Add member search (Admin/Manager only) */}
          {canEdit && (
            <div className="mb-4 relative">
              <input
                type="search"
                placeholder="Search customers to add…"
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setAddMemberError(null); }}
                className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {memberSearch.length > 0 && memberSearch.length < 2 && (
                <p className="mt-1 text-xs text-gray-500">Enter at least 2 characters to search.</p>
              )}
              {addMemberError && (
                <p className="mt-1 text-xs text-red-600">{addMemberError}</p>
              )}
              {memberSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-w-sm bg-white border border-gray-200 rounded-md shadow-lg">
                  {isSearchingMembers ? (
                    <div className="p-3 text-sm text-gray-500">Searching…</div>
                  ) : (
                    memberSearchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void handleAddMember(c)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium">{c.fullName}</span>
                        <span className="text-gray-500 ml-2">{c.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {org.members.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No members yet.</p>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Email', 'Status', ...(canEdit ? [''] : [])].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {org.members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/customers/${m.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {m.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {m.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={m.status} />
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => void handleRemoveMember(m)}
                            disabled={removingMemberId === m.id}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {removingMemberId === m.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={org.membersMeta.page}
                pageSize={org.membersMeta.pageSize}
                total={org.membersMeta.total}
                hasNextPage={org.membersMeta.hasNextPage}
                onPageChange={(p) => void handleMembersPageChange(p)}
              />
            </>
          )}
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
