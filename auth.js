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

    // 1) esconde tudo antes de qualquer coisa ser pintada na tela
    var blocker = document.createElement('style');
    blocker.id = 'pa-blocker';
    blocker.textContent = 'html{visibility:hidden !important;}';
    (document.head || document.documentElement).appendChild(blocker);

    // rede de segurança: se o servidor não responder em 8s, manda pro hub
    var timeout = setTimeout(function () {
      location.replace(hubUrl + '?returnTo=' + encodeURIComponent(location.href));
    }, 8000);

    verifySession(function (ok) {
      clearTimeout(timeout);
      if (ok) {
        var el = document.getElementById('pa-blocker');
        if (el) el.parentNode.removeChild(el);
      } else {
        location.replace(hubUrl + '?returnTo=' + encodeURIComponent(location.href));
      }
    });
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
