import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rol — Gestió de campanyes presencials',
  description:
    'Plataforma web per a Directors de Joc i jugadors per organitzar campanyes de rol presencials.',
  applicationName: 'Rol',
  appleWebApp: {
    capable: true,
    title: 'Rol',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#261b16',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" data-theme="fantasy-classic">
      <body className="rol-parchment-canvas min-h-screen">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
