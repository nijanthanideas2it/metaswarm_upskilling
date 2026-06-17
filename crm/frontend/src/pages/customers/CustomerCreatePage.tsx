import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createCustomer } from '../../api/customers';
import { listOrganizations, type OrganizationListItem } from '../../api/organizations';
import { ApiError } from '../../api/http';
import { Layout } from '../../components/Layout';

export function CustomerCreatePage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  const [orgs, setOrgs] = useState<OrganizationListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = state.accessToken ?? '';
  const role = state.user?.role ?? '';

  // Redirect non-authorized roles
  useEffect(() => {
    if (role && role !== 'ADMIN' && role !== 'SUPPORT_MANAGER') {
      void navigate('/customers', { replace: true });
    }
  }, [role, navigate]);

  // Load organizations for dropdown
  useEffect(() => {
    if (!accessToken) return;
    listOrganizations(accessToken)
      .then((r) => setOrgs(r.data))
      .catch(() => {/* org dropdown is optional; silently ignore */});
  }, [accessToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const customer = await createCustomer(accessToken, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        organizationId: organizationId || undefined,
      });
      void navigate(`/customers/${customer.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          setError('A customer with this email address already exists.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-xl">
        <div className="mb-6">
          <Link to="/customers" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← Customers
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">New Customer</h2>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-5">
            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="+1 555 123 4567"
              />
            </div>

            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Job title
              </label>
              <input
                id="jobTitle"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Operations Lead"
              />
            </div>

            <div>
              <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-1">
                Organization
              </label>
              <select
                id="organizationId"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim() || !email.trim()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating…' : 'Create customer'}
              </button>
              <Link
                to="/customers"
                className="px-5 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
