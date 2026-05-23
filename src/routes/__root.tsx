import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/useAuth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TEAmo — Cuidado coordenado para crianças com TEA" },
      {
        name: "description",
        content:
          "TEAmo ajuda pais e responsáveis a organizar o cuidado de crianças com TEA, consolidando informações e facilitando a comunicação com a rede de profissionais.",
      },
      { name: "theme-color", content: "#4F46E5" },
      // PWA — iOS
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TEAmo" },
      // PWA — Android/geral
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "TEAmo" },
      { property: "og:title", content: "TEAmo — Cuidado coordenado para crianças com TEA" },
      {
        property: "og:description",
        content: "Coordenação do cuidado de crianças com TEA, em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "TEAmo — Cuidado coordenado para crianças com TEA" },
      { name: "description", content: "TEAmo: coordena o cuidado de crianças com TEA, centralizando informações e facilitando a comunicação." },
      { property: "og:description", content: "TEAmo: coordena o cuidado de crianças com TEA, centralizando informações e facilitando a comunicação." },
      { name: "twitter:description", content: "TEAmo: coordena o cuidado de crianças com TEA, centralizando informações e facilitando a comunicação." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cbd048f-ea05-4ddf-8fe4-fa8bce5a745f/id-preview-51ea9551--4bec486c-0ca1-4165-a508-8e125c6aa34b.lovable.app-1777756986530.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cbd048f-ea05-4ddf-8fe4-fa8bce5a745f/id-preview-51ea9551--4bec486c-0ca1-4165-a508-8e125c6aa34b.lovable.app-1777756986530.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      // PWA
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    // Registra o service worker para funcionalidades PWA (cache, offline)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falha silenciosa — app funciona normalmente sem SW
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
