import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rol — Gestió de campanyes presencials',
    short_name: 'Rol',
    description: 'Plataforma per a Directors de Joc i jugadors de campanyes de rol presencials.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5efe2',
    theme_color: '#261b16',
    lang: 'ca',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
