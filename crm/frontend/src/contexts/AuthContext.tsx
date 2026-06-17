import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth';
import {
  clearTokens,
  decodeJwtPayload,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../lib/token';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { user: AuthUser; accessToken: string } }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_SUCCESS'; payload: { accessToken: string } }
  | { type: 'RESTORE_SESSION'; payload: { accessToken: string; user: AuthUser } }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return { user: null, accessToken: null, isAuthenticated: false, isLoading: false };
    case 'REFRESH_SUCCESS':
      return { ...state, accessToken: action.payload.accessToken };
    case 'RESTORE_SESSION':
      return {
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
};

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (accessToken && refreshToken) {
      const payload = decodeJwtPayload(accessToken);
      if (payload) {
        dispatch({
          type: 'RESTORE_SESSION',
          payload: {
            accessToken,
            user: { id: payload.sub, email: '', role: payload.role },
          },
        });
      } else {
        clearTokens();
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loginFn = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await authApi.login(email, password);
    setTokens(result.accessToken, result.refreshToken);
    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: { user: result.user, accessToken: result.accessToken },
    });
  }, []);

  const logoutFn = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    const accessToken = state.accessToken;
    clearTokens();
    dispatch({ type: 'LOGOUT' });
    if (refreshToken && accessToken) {
      try {
        await authApi.logout(refreshToken, accessToken);
      } catch {
        // Tokens already cleared locally; server-side revocation is best-effort
      }
    }
  }, [state.accessToken]);

  const refreshSession = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      dispatch({ type: 'LOGOUT' });
      return;
    }
    try {
      const result = await authApi.refresh(refreshToken);
      setTokens(result.accessToken, result.refreshToken);
      dispatch({ type: 'REFRESH_SUCCESS', payload: { accessToken: result.accessToken } });
    } catch {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login: loginFn, logout: logoutFn, refreshSession }),
    [state, loginFn, logoutFn, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
