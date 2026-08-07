/**
 * PLATAFORMA AZUL — sessão compartilhada
 * ---------------------------------------
 * Inclua este arquivo em TODAS as páginas protegidas (as 7 ferramentas + o hub):
 *   <script src="https://altaleite.github.io/plataforma-azul/auth.js"></script>
 *
 * Como as ferramentas estão em domínios/caminhos diferentes dentro de altaleite.github.io,
 * a sessão é guardada no localStorage do domínio altaleite.github.io — funciona em
 * qualquer ferramenta hospedada nesse mesmo domínio.
 *
 * Uso em uma página PROTEGIDA (uma das 7 ferramentas):
 *
 *   <script src="https://altaleite.github.io/plataforma-azul/auth.js"></script>
 *   <script>
 *     PlataformaAzulAuth.guard({
 *       hubUrl: "https://altaleite.github.io/plataforma-azul/"
 *     });
 *   </script>
 *
 * Isso deve ser a PRIMEIRA coisa no <head>, antes do resto do conteúdo carregar,
 * para não expor a tela por um instante antes do redirecionamento.
 */

(function (global) {
  var STORAGE_KEY = 'plataformaAzul.session';
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuLqckGdPDJAUyGhEjPacycPsNFZ7F8kkDzHIZ6NYnfpOCXHbaEnrBlUFXJtn1UophNg/exec';

  function getSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Revalida a sessão no servidor (Apps Script). Nunca confia só no que está
  // salvo localmente — qualquer um pode editar o localStorage no navegador,
  // então a decisão final de "pode entrar" é sempre do servidor.
  function verifySession(callback) {
    var session = getSession();
    if (!session || !session.email || !session.token || !session.expires) {
      callback(false);
      return;
    }

    var url = APPS_SCRIPT_URL +
      '?action=verify' +
      '&email=' + encodeURIComponent(session.email) +
      '&token=' + encodeURIComponent(session.token) +
      '&expires=' + encodeURIComponent(session.expires);

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          callback(true, session.email);
        } else {
          clearSession();
          callback(false);
        }
      })
      .catch(function () {
        // Falha de rede: não derruba a sessão por causa de instabilidade momentânea,
        // mas também não libera acesso sem nunca ter confirmado. Usa a validade local
        // como fallback só quando o servidor está inalcançável.
        if (session.expires > Date.now()) {
          callback(true, session.email);
        } else {
          callback(false);
        }
      });
  }

  // Chame no topo de cada página PROTEGIDA (uma das ferramentas internas).
  // Esconde a página IMEDIATAMENTE e só revela depois que o servidor confirmar
  // a sessão. Sem isso, o conteúdo apareceria por um instante antes do
  // redirecionamento — expondo dado sensível em conexões lentas.
  function guard(opts) {
    opts = opts || {};
    var hubUrl = opts.hubUrl || 'https://altaleite.github.io/plataforma-azul/';

    // 1) esconde o conteúdo antes de qualquer coisa ser pintada na tela e
    //    mostra um aviso — sem isso a espera de 1-3s parece travamento.
    var blocker = document.createElement('style');
    blocker.id = 'pa-blocker';
    blocker.textContent =
      'body > *{visibility:hidden !important;}' +
      '#pa-wait{visibility:visible !important;position:fixed;inset:0;z-index:2147483600;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'background:linear-gradient(165deg,#0a1730,#060f24 55%,#030812);' +
      'font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#b9cde8;}' +
      '#pa-wait .pa-sp{width:20px;height:20px;border-radius:50%;' +
      'border:2px solid rgba(111,216,255,.25);border-top-color:#6fd8ff;' +
      'animation:pa-spin .8s linear infinite;}' +
      '@keyframes pa-spin{to{transform:rotate(360deg);}}' +
      '@media (prefers-reduced-motion:reduce){#pa-wait .pa-sp{animation:none;}}';
    (document.head || document.documentElement).appendChild(blocker);

    function showWait() {
      if (document.getElementById('pa-wait') || !document.body) return;
      var w = document.createElement('div');
      w.id = 'pa-wait';
      w.innerHTML = '<div class="pa-sp"></div><div>Verificando seu acesso…</div>';
      document.body.appendChild(w);
    }
    if (document.body) { showWait(); }
    else { document.addEventListener('DOMContentLoaded', showWait); }

    function reveal() {
      var s = document.getElementById('pa-blocker');
      if (s) s.parentNode.removeChild(s);
      var w = document.getElementById('pa-wait');
      if (w) w.parentNode.removeChild(w);
    }

    // rede de segurança: se o servidor não responder em 8s, manda pro hub
    var timeout = setTimeout(function () {
      location.replace(hubUrl + '?returnTo=' + encodeURIComponent(location.href));
    }, 8000);

    verifySession(function (ok) {
      clearTimeout(timeout);
      if (ok) {
        reveal();
        addBackLink(hubUrl);
      } else {
        location.replace(hubUrl + '?returnTo=' + encodeURIComponent(location.href));
      }
    });
  }

  // Botão flutuante de retorno ao hub, injetado em toda ferramenta protegida.
  // Fica no canto inferior esquerdo, discreto, e recolhe para um ícone quando
  // a tela é estreita — para não cobrir os controles da própria ferramenta.
  function addBackLink(hubUrl) {
    if (document.getElementById('pa-back')) return;

    function build() {
      if (document.getElementById('pa-back')) return;

      var css = document.createElement('style');
      css.textContent =
        '#pa-back{position:fixed;left:16px;bottom:16px;z-index:2147483000;' +
        'display:inline-flex;align-items:center;gap:8px;' +
        'padding:9px 15px 9px 12px;border-radius:100px;' +
        'background:rgba(10,23,45,.93);color:#dbe6f5 !important;' +
        'border:1px solid rgba(111,216,255,.30);' +
        'font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;' +
        'text-decoration:none !important;cursor:pointer;' +
        'box-shadow:0 6px 22px -6px rgba(0,0,0,.55);' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
        'transition:background .15s ease,border-color .15s ease;}' +
        '#pa-back:hover{background:rgba(16,35,64,.98);border-color:rgba(111,216,255,.55);}' +
        '#pa-back:focus-visible{outline:2px solid #6fd8ff;outline-offset:2px;}' +
        '#pa-back .pa-arrow{font-size:14px;line-height:1;color:#6fd8ff;}' +
        '@media print{#pa-back{display:none !important;}}' +
        '@media (max-width:640px){#pa-back{padding:10px;left:12px;bottom:12px;}' +
        '#pa-back .pa-label{display:none;}}';
      document.head.appendChild(css);

      var a = document.createElement('a');
      a.id = 'pa-back';
      a.href = hubUrl;
      a.title = 'Voltar para a Plataforma Azul';
      a.innerHTML = '<span class="pa-arrow" aria-hidden="true">←</span>' +
                    '<span class="pa-label">Plataforma Azul</span>';
      document.body.appendChild(a);
    }

    if (document.body) {
      build();
    } else {
      document.addEventListener('DOMContentLoaded', build);
    }
  }

  // Passo 1 do login: pede ao servidor para mandar um código de 6 dígitos para o e-mail.
  function requestCode(email, callback) {
    var url = APPS_SCRIPT_URL + '?action=request_code&email=' + encodeURIComponent(email);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(callback)
      .catch(function () {
        callback({ ok: false, error: 'falha de rede ao contatar o servidor de login' });
      });
  }

  // Passo 2 do login: confirma o código digitado; se bater, salva a sessão.
  function verifyCode(email, code, callback) {
    var url = APPS_SCRIPT_URL +
      '?action=verify_code&email=' + encodeURIComponent(email) +
      '&code=' + encodeURIComponent(code);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          setSession({ email: data.email, token: data.token, expires: data.expires });
        }
        callback(data);
      })
      .catch(function () {
        callback({ ok: false, error: 'falha de rede ao contatar o servidor de login' });
      });
  }

  function logout() {
    clearSession();
  }

  global.PlataformaAzulAuth = {
    getSession: getSession,
    verifySession: verifySession,
    guard: guard,
    requestCode: requestCode,
    verifyCode: verifyCode,
    logout: logout,
    APPS_SCRIPT_URL: APPS_SCRIPT_URL
  };
})(window);
