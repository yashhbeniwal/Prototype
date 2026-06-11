'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import VoiceAssistant from '@/components/VoiceAssistant';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🐐</div>
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: 'var(--sidebar-width)' }}>
        <Topbar />
        <main className="flex-1 p-6 overflow-auto flex flex-col" style={{ marginTop: 'var(--topbar-height)' }}>
          <div className="max-w-[1600px] mx-auto w-full animate-fade-in flex-1">
            {children}
          </div>
          
          {/* Full Footer */}
          <footer className="mt-8 pt-6 pb-2 border-t w-full text-center flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} <span style={{ color: 'var(--brand-pashu)', fontWeight: 600 }}>Pashu</span><span style={{ color: 'var(--brand-vaani)', fontWeight: 600 }}>Vaani</span>. All rights reserved.
            </p>
          </footer>
        </main>
      </div>

      {/* Floating Voice Assistant — only for owners */}
      {(user.role === 'OWNER' || user.role === 'SUPERADMIN') && <VoiceAssistant />}
    </div>
  );
}
