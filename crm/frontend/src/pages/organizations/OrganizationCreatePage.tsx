import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createOrganization } from '../../api/organizations';
import { ApiError } from '../../api/http';
import { Layout } from '../../components/Layout';

export function OrganizationCreatePage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [industry, setIndustry] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = state.accessToken ?? '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const org = await createOrganization(accessToken, {
        name: name.trim(),
        emailDomain: emailDomain.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      void navigate(`/organizations/${org.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'NAME_ALREADY_EXISTS') {
          setError('An organization with this name already exists.');
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
          <Link to="/organizations" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← Organizations
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">New Organization</h2>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-5">
            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Organization name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label htmlFor="emailDomain" className="block text-sm font-medium text-gray-700 mb-1">
                Email domain
              </label>
              <input
                id="emailDomain"
                type="text"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="acme.com"
              />
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Manufacturing"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating…' : 'Create organization'}
              </button>
              <Link
                to="/organizations"
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
