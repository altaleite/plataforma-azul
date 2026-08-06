# Plataforma Azul — guia de implantação

Siga nesta ordem. Cada etapa depende da anterior.

---

## 1. Criar a planilha de e-mails autorizados

1. Crie uma planilha nova no Google Sheets (ex: "Plataforma Azul — Acesso").
2. Renomeie a primeira aba para `emails` (minúsculo, sem acento).
3. Na célula A1, escreva `email` (cabeçalho). A partir de A2, um e-mail por linha — os e-mails da equipe técnica autorizada.
4. Copie o **ID da planilha**: é o trecho da URL entre `/d/` e `/edit`.
   Ex: `docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjK...`**`/edit` → o ID é `1AbCdEfGhIjK...`
5. Guarde esse ID — vai usar no passo 3.

Para adicionar ou remover alguém depois, é só editar essa planilha. Some no máximo 1 minuto até a mudança valer (a checagem é feita a cada acesso).

---

## 2. Criar o Client ID do Google (para o botão de login)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) com a conta Google que vai administrar isso.
2. Crie um projeto novo (ex: "Plataforma Azul").
3. Menu lateral → **APIs e serviços** → **Tela de consentimento OAuth**.
   - Tipo de usuário: **Externo** (ou Interno, se vocês tiverem Google Workspace).
   - Preencha nome do app ("Plataforma Azul"), e-mail de suporte, e salve.
4. Menu lateral → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione: `https://altaleite.github.io`
   - Salve.
5. Copie o **Client ID** gerado (termina em `.apps.googleusercontent.com`).
6. Abra `index.html` deste pacote e substitua `COLE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com` (aparece uma vez, no `data-client_id`) pelo Client ID copiado.

---

## 3. Publicar o Apps Script (backend de login)

1. Acesse [script.google.com](https://script.google.com/) e crie um projeto novo.
2. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo do arquivo `apps-script/Code.gs` deste pacote.
3. Menu **Configurações do projeto** (ícone de engrenagem) → em **Propriedades do script**, adicione duas propriedades:
   - `SHEET_ID` → o ID da planilha copiado no passo 1.
   - `SESSION_SECRET` → qualquer texto longo e aleatório só seu (ex: gere uma senha forte de 32+ caracteres — isso NÃO é uma senha que ninguém digita, é só a "chave" que o servidor usa para assinar os tokens de sessão).
4. Clique em **Implantar** → **Nova implantação**.
   - Tipo: **App da Web**.
   - Executar como: **Eu** (sua conta).
   - Quem pode acessar: **Qualquer pessoa**.
5. Autorize as permissões pedidas (vai pedir acesso à planilha e à internet — é esperado).
6. Copie a **URL do app da Web** gerada (termina em `/exec`).
7. Abra `auth.js` deste pacote e substitua `COLE_AQUI_A_URL_DO_APPS_SCRIPT_IMPLANTADO` (aparece uma vez, na constante `APPS_SCRIPT_URL`) pela URL copiada.

> Sempre que você editar `Code.gs` depois, precisa criar uma **nova implantação** (ou gerenciar implantações → editar) para a mudança valer — o Apps Script não atualiza a URL publicada sozinho.

---

## 4. Publicar o hub no GitHub Pages

1. Crie o repositório `plataforma-azul` na conta/organização `altaleite` no GitHub.
2. Suba os arquivos `index.html` e `auth.js` deste pacote para a raiz do repositório (não precisa subir `Code.gs` nem `DEPLOY.md` — esses ficam só como referência sua).
3. Nas configurações do repositório → **Pages**, confirme que está publicando a partir da branch `main`, pasta raiz.
4. Acesse `https://altaleite.github.io/plataforma-azul/` e teste o login com um e-mail que está na planilha.

---

## 5. Proteger as 7 ferramentas existentes

Em **cada uma** das 7 ferramentas (Análise genética, Endogamia, Monetização, Análise reprodutiva, Evolução de rebanho, Ideagri, Excel/DCU):

1. Abra o arquivo HTML da ferramenta.
2. Logo depois da tag `<head>` (antes de qualquer outro script), adicione:

   ```html
   <script src="https://altaleite.github.io/plataforma-azul/auth.js"></script>
   <script>
     PlataformaAzulAuth.guard({ hubUrl: "https://altaleite.github.io/plataforma-azul/" });
   </script>
   ```

3. Publique a ferramenta normalmente (GitHub Pages).
4. Teste: abra a URL da ferramenta **direto**, sem passar pelo hub, numa aba anônima. Ela deve te jogar pro login do hub. Depois de logar, deve te trazer de volta pra ferramenta automaticamente.

Depois de cada ferramenta estar protegida e publicada, volte no `index.html` do hub e preencha a URL real dela em `TOOL_URLS` (no final do arquivo), no lugar de `COLOQUE-O-CAMINHO-AQUI`.

---

## Checklist final

- [ ] Planilha de e-mails criada e ID copiado
- [ ] Client ID do Google criado e colado no `index.html`
- [ ] Apps Script implantado, `SHEET_ID` e `SESSION_SECRET` configurados
- [ ] URL do Apps Script colada no `auth.js`
- [ ] Hub publicado em `altaleite.github.io/plataforma-azul`
- [ ] Login testado com e-mail autorizado e um não autorizado (deve barrar o segundo)
- [ ] Cada uma das 7 ferramentas com o snippet de `auth-guard` adicionado
- [ ] Cada ferramenta testada em aba anônima, direto pela URL (sem passar pelo hub)
- [ ] `TOOL_URLS` no `index.html` preenchido com as URLs reais
