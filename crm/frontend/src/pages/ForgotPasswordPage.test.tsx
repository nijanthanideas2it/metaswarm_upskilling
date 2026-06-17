import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>();
  return { ...actual, forgotPassword: vi.fn() };
});

function renderPage() {
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email field and submit button', () => {
    renderPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows success message after submission when email is registered', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined);

    renderPage();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
    expect(authApi.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('shows success message even when API returns error (anti-enumeration)', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new Error('not found'));

    renderPage();
    await user.type(screen.getByLabelText(/email address/i), 'unknown@b.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    vi.mocked(authApi.forgotPassword).mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    renderPage();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    resolve();
  });

  it('renders a link back to sign in', () => {
    renderPage();
    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });
});
