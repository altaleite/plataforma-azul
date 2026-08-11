/**
 * PLATAFORMA AZUL — service worker
 * ---------------------------------
 * Guarda as páginas no próprio aparelho para que a equipe consiga usar as
 * ferramentas em fazenda sem sinal.
 *
 * Estratégia:
 *  - Páginas (HTML): tenta a rede primeiro (para pegar atualizações); se a rede
 *    falhar ou demorar, serve a versão guardada.
 *  - Arquivos fixos (auth.js, imagens, ícones): serve o guardado na hora e
 *    atualiza em segundo plano.
 *  - Chamadas ao Apps Script NUNCA são guardadas — autenticação sempre vai à rede.
 *
 * Ao mudar qualquer arquivo do site, suba o número da versão abaixo. Isso faz
 * todo mundo baixar a versão nova na próxima vez que abrir com internet.
 */

const VERSAO = 'v1';
const CACHE = 'plataforma-azul-' + VERSAO;
const BASE = '/plataforma-azul/';

// o essencial do hub, guardado já na instalação
const ESSENCIAL = [
  BASE,
  BASE + 'index.html',
  BASE + 'auth.js',
  BASE + 'manifest.webmanifest',
  BASE + 'fundo-plataforma.jpg',
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
        nomes.filter((n) => n.startsWith('plataforma-azul-') && n !== CACHE)
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
    // rede primeiro, guardado como reserva
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(BASE)))
    );
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
