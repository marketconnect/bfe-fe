import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

import { Inter, Montserrat } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600","700"], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: "File Service",
  description: "Access your files securely",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${montserrat.variable} font-inter`}>
        <AuthProvider>
          <main className="min-h-screen flex flex-col items-center justify-center">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
