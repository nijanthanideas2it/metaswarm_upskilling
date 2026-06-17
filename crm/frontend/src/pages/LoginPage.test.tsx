import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue, type AuthState } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/auth';

const defaultState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
};

function renderLoginPage(
  overrides: Partial<AuthContextValue> = {},
  initialPath = '/login',
) {
  const loginMock = vi.fn();
  const ctxValue: AuthContextValue = {
    state: defaultState,
    login: loginMock,
    logout: vi.fn(),
    refreshSession: vi.fn(),
    ...overrides,
  };

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={ctxValue}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return { loginMock };
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password fields and submit button', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders a link to the forgot-password page', () => {
    renderLoginPage();
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
  });

  it('calls login with email and password on submit', async () => {
    const user = userEvent.setup();
    const { loginMock } = renderLoginPage();
    loginMock.mockResolvedValue(undefined);

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'Pass99');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('a@b.com', 'Pass99'));
  });

  it('disables the button and shows loading text while submitting', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const { loginMock } = renderLoginPage();
    loginMock.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'Pass99');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    resolve();
  });

  it('shows INVALID_CREDENTIALS error message', async () => {
    const user = userEvent.setup();
    const { loginMock } = renderLoginPage();
    loginMock.mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'wrong', 401));

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    });
  });

  it('shows ACCOUNT_LOCKED error message', async () => {
    const user = userEvent.setup();
    const { loginMock } = renderLoginPage();
    loginMock.mockRejectedValue(new ApiError('ACCOUNT_LOCKED', 'locked', 403));

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/temporarily locked/i);
    });
  });

  it('shows ACCOUNT_DEACTIVATED error message', async () => {
    const user = userEvent.setup();
    const { loginMock } = renderLoginPage();
    loginMock.mockRejectedValue(new ApiError('ACCOUNT_DEACTIVATED', 'deactivated', 403));

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/deactivated/i);
    });
  });

  it('shows generic error for unknown error codes', async () => {
    const user = userEvent.setup();
    const { loginMock } = renderLoginPage();
    loginMock.mockRejectedValue(new ApiError('UNKNOWN', 'Something went wrong', 500));

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    });
  });
});
