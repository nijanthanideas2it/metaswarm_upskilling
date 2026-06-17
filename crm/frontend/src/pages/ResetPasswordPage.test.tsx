import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from './ResetPasswordPage';
import * as authApi from '../api/auth';
import { ApiError } from '../api/auth';

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>();
  return { ...actual, resetPassword: vi.fn() };
});

function renderPage(search = '?token=valid-token') {
  render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when token is missing from URL', () => {
    it('shows invalid link message', () => {
      renderPage('');
      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    });

    it('shows a link to request a new reset', () => {
      renderPage('');
      expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
    });
  });

  describe('when token is present', () => {
    it('renders new password field and submit button', () => {
      renderPage();
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('calls resetPassword with token and new password on submit', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.resetPassword).mockResolvedValue(undefined);

      renderPage();
      await user.type(screen.getByLabelText(/new password/i), 'NewSecure99');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith('valid-token', 'NewSecure99');
      });
    });

    it('shows error for invalid or expired token', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.resetPassword).mockRejectedValue(
        new ApiError('INVALID_RESET_TOKEN', 'Expired.', 400),
      );

      renderPage();
      await user.type(screen.getByLabelText(/new password/i), 'NewSecure99');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i);
      });
    });

    it('shows same-password error for VALIDATION_ERROR code', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.resetPassword).mockRejectedValue(
        new ApiError('VALIDATION_ERROR', 'Same password.', 422),
      );

      renderPage();
      await user.type(screen.getByLabelText(/new password/i), 'OldPass99');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/different from your current password/i);
      });
    });

    it('shows generic error for unexpected failures', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.resetPassword).mockRejectedValue(new Error('network'));

      renderPage();
      await user.type(screen.getByLabelText(/new password/i), 'NewSecure99');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/unexpected error/i);
      });
    });

    it('disables button while submitting', async () => {
      const user = userEvent.setup();
      let resolve!: () => void;
      vi.mocked(authApi.resetPassword).mockReturnValue(new Promise<void>((r) => { resolve = r; }));

      renderPage();
      await user.type(screen.getByLabelText(/new password/i), 'NewSecure99');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      resolve();
    });
  });
});
