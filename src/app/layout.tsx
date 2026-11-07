import type { Metadata } from 'next';
import { AppProvider } from '@/components/app-provider';
import { Toaster } from '@/components/ui/toaster';
import { MotionProvider } from '@/components/motion';
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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <MotionProvider>
        <AppProvider><div className="flex-grow">{children}</div></AppProvider>
        <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
