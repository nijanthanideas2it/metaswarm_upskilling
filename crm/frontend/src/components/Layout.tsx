import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/customers', label: 'Customers', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
  { to: '/organizations', label: 'Organizations', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT'] },
  { to: '/profile', label: 'My Profile', roles: ['CUSTOMER'] },
];

export function Layout({ children }: LayoutProps) {
  const { state, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = state.user?.email || state.user?.id || '';
  const roleLabel = state.user?.role?.replace(/_/g, ' ').toLowerCase() ?? '';
  const userRole = state.user?.role ?? '';

  const visibleNav = NAV_ITEMS.filter(
    ({ roles }) => !roles || roles.includes(userRole),
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-base font-bold text-gray-900">Sales CRM</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {visibleNav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                location.pathname.startsWith(to)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 truncate">{displayName}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{roleLabel}</p>
          <button
            onClick={() => { void handleLogout(); }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
