import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { listOrganizations, type OrganizationListItem } from '../../api/organizations';
import { ApiError } from '../../api/http';
import { Pagination } from '../../components/Pagination';
import { Layout } from '../../components/Layout';
import type { PaginationMeta } from '../../api/customers';

const DEFAULT_META: PaginationMeta = { total: 0, page: 1, pageSize: 20, hasNextPage: false };

export function OrganizationListPage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [orgs, setOrgs] = useState<OrganizationListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = state.accessToken ?? '';
  const canCreate = ['ADMIN', 'SUPPORT_MANAGER'].includes(state.user?.role ?? '');

  const fetchOrgs = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listOrganizations(accessToken, { page, pageSize: 20 });
      setOrgs(result.data);
      setMeta(result.meta);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load organizations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, navigate]);

  useEffect(() => {
    void fetchOrgs();
  }, [fetchOrgs]);

  return (
    <Layout>
      <div className="p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900">Organizations</h2>
          {canCreate && (
            <Link
              to="/organizations/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              New Organization
            </Link>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              No organizations found.
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Email Domain', 'Industry', 'Members', 'Created'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orgs.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/organizations/${o.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {o.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {o.emailDomain ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {o.industry ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {o.memberCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                total={meta.total}
                hasNextPage={meta.hasNextPage}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
