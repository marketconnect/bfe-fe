import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { Inter, Montserrat } from "next/font/google";
import { i18n, type Locale } from "@/i18n-config";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "../globals.css";
const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600","700"], variable: '--font-montserrat' });

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

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
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { lang: Locale };
}>) {
  return (
    <html lang={params.lang} className="h-full">
      <body className={`${inter.variable} ${montserrat.variable} font-inter h-full`}>
        <AuthProvider>
          <main className="h-full w-full">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
