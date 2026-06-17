import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
    } catch {
      // Always show success to prevent user enumeration
    } finally {
      setSubmitted(true);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-gray-900">Sales CRM</h1>
        <h2 className="mt-2 text-center text-sm text-gray-600">Reset your password</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10">
          {submitted ? (
            <div data-testid="success-message" className="text-center space-y-4">
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
                If this email is registered, a reset link has been sent. Check your inbox.
              </div>
              <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6" noValidate>
              <p className="text-sm text-gray-600">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
