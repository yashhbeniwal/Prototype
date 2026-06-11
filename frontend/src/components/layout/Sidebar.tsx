'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard, Dog, Syringe, Stethoscope, Wheat,
  Users, FileText, BarChart3, Mic2, Upload, Settings,
  Shield, ChevronRight, LogOut,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/animals', label: 'Animals', icon: Dog },
  { href: '/dashboard/vaccinations', label: 'Vaccinations', icon: Syringe },
  { href: '/dashboard/health', label: 'Medical Records', icon: Stethoscope },
  { href: '/dashboard/feed', label: 'Feed Management', icon: Wheat },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/billing', label: 'Billing & Payments', icon: FileText },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['SUPERADMIN', 'OWNER', 'ACCOUNTANT'] },
  { href: '/dashboard/migration', label: 'Data Migration', icon: Upload, roles: ['SUPERADMIN', 'OWNER'] },
  { href: '/dashboard/audit', label: 'Audit Logs', icon: Shield, roles: ['SUPERADMIN', 'OWNER'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  const getRoleColor = (role: string) => {
    const map: Record<string, string> = {
      SUPERADMIN: 'bg-red-500/20 text-red-400',
      OWNER: 'bg-purple-500/20 text-purple-400',
      MANAGER: 'bg-blue-500/20 text-blue-400',
      VETERINARIAN: 'bg-emerald-500/20 text-emerald-400',
      ACCOUNTANT: 'bg-orange-500/20 text-orange-400',
      WORKER: 'bg-gray-500/20 text-gray-400',
    };
    return map[role] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <aside
      id="sidebar"
      className="fixed left-0 top-0 h-full flex flex-col z-30"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <img
          src="/pashuvaan-logo.png"
          alt="PashuVaani"
          width={38}
          height={38}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <div>
          <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            <span style={{ color: 'var(--brand-pashu)' }}>Pashu</span><span style={{ color: 'var(--brand-vaani)' }}>Vaani</span>
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {user?.farm?.name || 'Farm ERP'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <Icon size={17} className={isActive ? 'text-purple-400' : ''} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} className="text-purple-400 opacity-50" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-card)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6c47ff, #8b5cf6)' }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
            <span className={`badge text-[10px] mt-0.5 ${getRoleColor(user?.role || '')}`}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          id="logout-btn"
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/5"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>

      </div>
    </aside>
  );
}
