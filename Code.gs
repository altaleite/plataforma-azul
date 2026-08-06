/**
 * PLATAFORMA AZUL — backend de autenticação
 * ------------------------------------------
 * O que este script faz:
 *  1) Recebe um e-mail digitado no hub; se estiver na planilha de autorizados,
 *     gera um código de 6 dígitos, guarda por 10 minutos e manda por e-mail
 *     (funciona com qualquer provedor — Gmail, Outlook, etc. — não depende
 *     do domínio ter Google Workspace)
 *  2) Recebe o código digitado de volta; se bater, emite um "token de sessão"
 *     assinado (HMAC) com validade de alguns dias
 *  3) Em cada carregamento de página protegida, o token de sessão é reenviado aqui
 *     para revalidação — se o e-mail tiver sido removido da planilha, o acesso cai na hora
 *
 * CONFIGURAÇÃO NECESSÁRIA (ver DEPLOY.md):
 *  - Definir a propriedade de script SESSION_SECRET (Project Settings > Script properties)
 *  - Definir a propriedade de script SHEET_ID com o ID da planilha de e-mails autorizados
 *  - A planilha deve ter uma aba chamada "emails" com um e-mail por linha, coluna A,
 *    a partir da linha 2 (linha 1 é cabeçalho)
 *  - Na primeira execução, o Apps Script vai pedir autorização para enviar e-mails
 *    (MailApp) — é esperado, aceite a permissão.
 */

var SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // sessão válida por 7 dias
var CODE_TTL_SEC = 600; // código de acesso válido por 10 minutos

function doGet(e) {
  var action = e.parameter.action;
  var result;

  try {
    if (action === 'request_code') {
      result = handleRequestCode(e.parameter.email);
    } else if (action === 'verify_code') {
      result = handleVerifyCode(e.parameter.email, e.parameter.code);
    } else if (action === 'verify') {
      result = handleVerify(e.parameter.email, e.parameter.token, e.parameter.expires);
    } else {
      result = { ok: false, error: 'ação desconhecida' };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  // Content-type text/plain evita preflight CORS; o navegador ainda lê o JSON normalmente.
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequestCode(email) {
  email = (email || '').toLowerCase().trim();
  if (!email) return { ok: false, error: 'e-mail ausente' };

  if (!isAuthorized(email)) {
    return { ok: false, error: 'e-mail não autorizado para a Plataforma Azul' };
  }

  var code = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put('code_' + email, code, CODE_TTL_SEC);

  MailApp.sendEmail({
    to: email,
    subject: 'Seu código de acesso — Plataforma Azul',
    body: 'Seu código de acesso é: ' + code + '\n\nVálido por 10 minutos. Se você não pediu esse código, ignore este e-mail.'
  });

  return { ok: true };
}

function handleVerifyCode(email, code) {
  email = (email || '').toLowerCase().trim();
  code = (code || '').trim();
  if (!email || !code) return { ok: false, error: 'e-mail ou código ausente' };

  var cache = CacheService.getScriptCache();
  var expected = cache.get('code_' + email);
  if (!expected || expected !== code) {
    return { ok: false, error: 'código inválido ou expirado' };
  }
  cache.remove('code_' + email); // uso único

  if (!isAuthorized(email)) {
    return { ok: false, error: 'e-mail não autorizado para a Plataforma Azul' };
  }

  var expires = Date.now() + SESSION_TTL_MS;
  var token = signSession(email, expires);

  return { ok: true, email: email, token: token, expires: expires };
}

function handleVerify(email, token, expires) {
  if (!email || !token || !expires) return { ok: false, error: 'parâmetros ausentes' };

  var expiresNum = Number(expires);
  if (isNaN(expiresNum) || Date.now() > expiresNum) {
    return { ok: false, error: 'sessão expirada' };
  }

  var expected = signSession(email.toLowerCase().trim(), expiresNum);
  if (token !== expected) {
    return { ok: false, error: 'token inválido' };
  }

  // revalida contra a planilha a cada checagem — remover o e-mail da planilha
  // derruba o acesso imediatamente, sem esperar o token expirar
  if (!isAuthorized(email)) {
    return { ok: false, error: 'e-mail não autorizado para a Plataforma Azul' };
  }

  return { ok: true, email: email };
}

function isAuthorized(email) {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('emails');
  var values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();

  var normalized = email.toLowerCase().trim();
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i][0] || '').toLowerCase().trim();
    if (v === normalized) return true;
  }
  return false;
}

function signSession(email, expires) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  var raw = email + '|' + expires;
  var sigBytes = Utilities.computeHmacSha256Signature(raw, secret);
  return sigBytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}
