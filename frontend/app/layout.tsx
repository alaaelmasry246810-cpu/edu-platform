import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import StoreHydration from "@/components/StoreHydration";
import SecurityHardening from "@/components/SecurityHardening";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "منصة المناهج الذكية",
  description: "منصة تعليمية ذكية مدعومة بالذكاء الاصطناعي",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مناهج AI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;500;600;700;900&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="مناهج AI" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-arabic bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <I18nProvider>
          <StoreHydration />
          <SecurityHardening />
          <ServiceWorkerRegistrar />
          {children}
          <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
        </I18nProvider>
      </body>
    </html>
  );
}
