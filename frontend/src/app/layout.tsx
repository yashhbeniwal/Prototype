import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GlobalDismiss } from '@/components/GlobalDismiss';

export const metadata: Metadata = {
  title: 'PashuVaani Prototype',
  description: 'PashuVaani – Cloud-based Farm Management ERP platform by PashuVaani. Manage animals, vaccinations, feed, billing, and get AI-powered voice insights.',
  keywords: ['PashuVaani', 'farm management', 'ERP', 'livestock', 'animal management', 'vaccination tracking'],
  authors: [{ name: 'PashuVaani' }],
  robots: 'noindex,nofollow', // Internal app
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body>
        <AuthProvider>
          {children}
          <ThemeToggle />
          <GlobalDismiss />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
