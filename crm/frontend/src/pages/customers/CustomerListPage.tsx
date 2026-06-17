import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import {
  listCustomers,
  searchCustomers,
  type CustomerListItem,
  type PaginationMeta,
} from '../../api/customers';
import { ApiError } from '../../api/http';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Layout } from '../../components/Layout';

type StatusFilter = '' | 'ACTIVE' | 'DEACTIVATED';

const DEFAULT_META: PaginationMeta = { total: 0, page: 1, pageSize: 20, hasNextPage: false };

export function CustomerListPage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput, 400);
  const accessToken = state.accessToken ?? '';
  const canCreate = state.user?.role === 'ADMIN' || state.user?.role === 'SUPPORT_MANAGER';
  const isSearching = debouncedSearch.length >= 2;

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = isSearching
        ? await searchCustomers(accessToken, debouncedSearch, page)
        : await listCustomers(accessToken, {
            page,
            pageSize: 20,
            status: statusFilter || undefined,
          });
      setCustomers(result.data);
      setMeta(result.meta);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load customers.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, debouncedSearch, statusFilter, page, isSearching, navigate]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const showHint = searchInput.length > 0 && searchInput.length < 2;

  return (
    <Layout>
      <div className="p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
          {canCreate && (
            <Link
              to="/customers/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              New Customer
            </Link>
          )}
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 max-w-sm">
            <input
              type="search"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showHint && (
              <p className="mt-1 text-xs text-gray-500">Enter at least 2 characters to search.</p>
            )}
          </div>
          {!isSearching && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
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
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              {isSearching
                ? `No customers match "${debouncedSearch}".`
                : 'No customers found.'}
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Email', 'Organization', 'Status', 'Created'].map((h) => (
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
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/customers/${c.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {c.fullName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {c.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {c.organizationName ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString()}
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
