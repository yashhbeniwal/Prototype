'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Bell, Search, X, CheckCircle2 } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/animals': 'Animal Management',
  '/dashboard/vaccinations': 'Vaccination Management',
  '/dashboard/health': 'Medical Records',
  '/dashboard/feed': 'Feed Management',
  '/dashboard/customers': 'Customer Management',
  '/dashboard/billing': 'Billing & Payments',
  '/dashboard/reports': 'Reports & Analytics',
  '/dashboard/migration': 'Data Migration',
  '/dashboard/audit': 'Audit Logs',
};

export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] || 'Farm ERP';

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header
      id="topbar"
      className="fixed right-0 z-20 flex items-center justify-between px-6"
      style={{
        top: 0,
        left: 'var(--sidebar-width)',
        height: 'var(--topbar-height)',
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: Page title */}
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search animals, customers..."
            className="input pl-9 text-xs w-56 h-9"
            id="global-search"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover-lift"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
          >
            <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
              style={{ background: 'var(--accent)' }}
            >
              3
            </span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-2xl shadow-xl z-50 overflow-hidden animate-scale-in"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                <button onClick={() => setShowNotifications(false)}>
                  <X size={14} style={{ color: 'var(--text-muted)' }} className="hover:text-red-400 transition-colors" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                {[
                  { id: 1, text: 'Vaccination due for Goat G001', time: '10 mins ago', type: 'warning' },
                  { id: 2, text: 'Payment of ₹15,000 received', time: '1 hour ago', type: 'success' },
                  { id: 3, text: 'Feed stock running low (Maize)', time: '3 hours ago', type: 'danger' },
                ].map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-500/5 transition-colors cursor-pointer">
                    <div className="mt-0.5 flex-shrink-0">
                      {notif.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Bell size={16} className={notif.type === 'warning' ? 'text-amber-500' : 'text-red-500'} />}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{notif.text}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{notif.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
                <button className="w-full text-xs font-medium py-2 rounded-lg transition-colors hover:bg-gray-500/10 text-center" style={{ color: 'var(--accent)' }}>
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          📅 {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
        </div>
      </div>
    </header>
  );
}
