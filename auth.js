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
  var APPS_SCRIPT_URL = 'COLE_AQUI_A_URL_DO_APPS_SCRIPT_IMPLANTADO';

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

  // Chame no topo de cada página PROTEGIDA (uma das 7 ferramentas).
  // Se não houver sessão válida, redireciona pro hub imediatamente.
  function guard(opts) {
    opts = opts || {};
    var hubUrl = opts.hubUrl || 'https://altaleite.github.io/plataforma-azul/';

    verifySession(function (ok) {
      if (!ok) {
        var returnTo = encodeURIComponent(location.href);
        location.replace(hubUrl + '?returnTo=' + returnTo);
      }
    });
  }

  // Chamado pelo hub depois que o login com Google + checagem na planilha der certo.
  function login(idToken, callback) {
    var url = APPS_SCRIPT_URL + '?action=login&id_token=' + encodeURIComponent(idToken);
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
    login: login,
    logout: logout,
    APPS_SCRIPT_URL: APPS_SCRIPT_URL
  };
})(window);
