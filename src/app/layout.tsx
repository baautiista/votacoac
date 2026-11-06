import type { Metadata } from 'next';
import { AppProvider } from '@/components/app-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'VotaCOAC · Tu voz en el Carnaval de Cádiz',
  description: 'Vota a tus agrupaciones favoritas del COAC, consulta los rankings y crea tu quiniela del Carnaval de Cádiz.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json?v=3" />
        <meta name="theme-color" content="#3B84FA" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <AppProvider><div className="flex-grow">{children}</div></AppProvider>
        <Toaster />
      </body>
    </html>
  );
}
