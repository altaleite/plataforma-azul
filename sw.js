/**
 * PLATAFORMA AZUL — service worker
 * ---------------------------------
 * Guarda as páginas no próprio aparelho para que a equipe consiga usar as
 * ferramentas em fazenda sem sinal.
 *
 * Estratégia:
 *  - Páginas (HTML): tenta a rede primeiro (para pegar atualizações); se a rede
 *    falhar ou demorar mais de 4 s, serve a versão guardada.
 *  - Arquivos fixos (auth.js, imagens, ícones): serve o guardado na hora e
 *    atualiza em segundo plano.
 *  - Chamadas ao Apps Script NUNCA são guardadas — autenticação sempre vai à rede.
 *
 * Dois caches:
 *  - 'plataforma-azul-vN'          → arquivos do hub; trocado a cada versão.
 *  - 'plataforma-azul-ferramentas' → cópias baixadas pelo botão "Baixar para uso
 *    offline". NÃO é apagado na troca de versão, para o técnico não perder as
 *    ferramentas quando só o visual do hub muda.
 *
 * Ao mudar qualquer arquivo do site, suba o número da versão abaixo.
 */
const VERSAO = 'v3';
const CACHE = 'plataforma-azul-' + VERSAO;
const CACHE_FERRAMENTAS = 'plataforma-azul-ferramentas';
const BASE = '/plataforma-azul/';
const ESPERA_REDE_MS = 4000;

// o essencial do hub, guardado já na instalação
const ESSENCIAL = [
  BASE,
  BASE + 'index.html',
  BASE + 'auth.js',
  BASE + 'manifest.webmanifest',
  BASE + 'fundo-plataforma-v2.jpg',
  BASE + 'logo-alta-branca.png',
  BASE + 'logo-alta-azul.png',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ESSENCIAL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n.startsWith('plataforma-azul-') &&
                            n !== CACHE && n !== CACHE_FERRAMENTAS)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // autenticação e qualquer coisa fora do domínio: sempre rede, nunca guardado
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  const ehPagina = req.mode === 'navigate' ||
                   (req.headers.get('accept') || '').includes('text/html');

  if (ehPagina) {
    // rede primeiro; se falhar ou passar de 4 s com sinal fraco, usa o guardado
    e.respondWith((async () => {
      const guardado = await caches.match(req, { ignoreSearch: true });

      const rede = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      });

      if (!guardado) {
        // nunca guardado: só resta esperar a rede
        return rede.catch(() => caches.match(BASE));
      }

      const limite = new Promise((ok) => setTimeout(() => ok(guardado), ESPERA_REDE_MS));
      return Promise.race([rede.catch(() => guardado), limite]);
    })());
    return;
  }

  // arquivos fixos: guardado primeiro, atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((guardado) => {
      const rede = fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      }).catch(() => guardado);

      return guardado || rede;
    })
  );
});
