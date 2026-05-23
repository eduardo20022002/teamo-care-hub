// TEAmo — Service Worker
// Estratégia: cache-first para assets estáticos, network-first para API/dados

const CACHE_NAME = "teamo-v1";

// Assets estáticos que podem ser cacheados com segurança
const STATIC_EXTENSIONS = [
  ".js", ".css", ".woff", ".woff2", ".ttf", ".png", ".jpg", ".svg", ".ico"
];

// Página offline mostrada quando não há conexão e a rota não está em cache
const OFFLINE_FALLBACK = "/offline.html";

// ─── Install: pré-cacheia apenas o essencial ────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ─── Activate: limpa caches antigos ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: decide estratégia por tipo de recurso ───────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora: extensões não-HTTP, outros domínios que não sejam fontes/assets
  if (!url.protocol.startsWith("http")) return;

  // ServerFns e API → sempre vai à rede (dados em tempo real)
  if (url.pathname.startsWith("/_server") || url.pathname.startsWith("/api/")) {
    return; // comportamento padrão (rede)
  }

  // Supabase → sempre rede
  if (url.hostname.includes("supabase.co")) return;

  const isStaticAsset = STATIC_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext)
  );

  if (isStaticAsset) {
    // Cache-first: assets estáticos (JS, CSS, fontes, imagens)
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return new Response("Asset indisponível offline.", { status: 503 });
        }
      })
    );
  }
  // Navegação (HTML) → rede, fallback para cache, depois offline
  else if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? new Response(
          `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
           <meta name="viewport" content="width=device-width,initial-scale=1">
           <title>TEAmo — Sem conexão</title>
           <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;
           justify-content:center;min-height:100vh;margin:0;background:#F4F5FA;color:#212529}
           .card{text-align:center;padding:2rem;background:#fff;border-radius:20px;
           box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:320px}
           .emoji{font-size:3rem;margin-bottom:1rem}
           h1{font-size:1.25rem;margin:0 0 .5rem}
           p{font-size:.875rem;color:#6B7280;margin:0 0 1.5rem}
           button{background:linear-gradient(135deg,#4F46E5,#EC4899);color:#fff;
           border:none;border-radius:12px;padding:.875rem 2rem;font-size:.875rem;
           font-weight:600;cursor:pointer;width:100%}</style></head>
           <body><div class="card"><div class="emoji">📡</div>
           <h1>Sem conexão</h1>
           <p>O TEAmo precisa de internet para funcionar. Verifique sua conexão e tente novamente.</p>
           <button onclick="location.reload()">Tentar novamente</button>
           </div></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })
    );
  }
});
