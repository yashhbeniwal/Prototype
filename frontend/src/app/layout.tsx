import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Goat Farm ERP | Farm Management Platform',
  description: 'Production-ready cloud-based Goat Farm Management ERP SaaS platform. Manage animals, vaccinations, feed, billing, and get AI-powered voice insights.',
  keywords: ['goat farm', 'farm management', 'ERP', 'livestock', 'animal management', 'vaccination tracking'],
  authors: [{ name: 'Farm ERP Team' }],
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
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          {children}
          <ThemeToggle />
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
