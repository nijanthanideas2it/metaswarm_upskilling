import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword, ApiError } from '../api/auth';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_RESET_TOKEN: 'This reset link is invalid or has expired. Please request a new one.',
  VALIDATION_ERROR: 'New password must be different from your current password.',
};

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10 text-center space-y-4">
            <p className="text-sm text-red-700">Invalid reset link. The token is missing.</p>
            <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-gray-900">Sales CRM</h1>
        <h2 className="mt-2 text-center text-sm text-gray-600">Set a new password</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10">
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6" noValidate>
            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="At least 8 characters, 1 letter and 1 number"
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 8 characters, must contain at least one letter and one number.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
