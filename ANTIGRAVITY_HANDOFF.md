# HANDOFF PARA O ANTIGRAVITY — Frontend (lote 1: Perfil do Estúdio)

Você é um engenheiro frontend sênior trabalhando no **SessãoInk** (SaaS para estúdios de
tatuagem). Outro agente (Claude) está trabalhando **em paralelo no BACKEND**. Para evitar
conflitos de git, siga ESTRITAMENTE as regras de fronteira abaixo.

## REGRAS DE FRONTEIRA (obrigatórias)
1. **Só edite arquivos dentro de `frontend/`.** NÃO toque em `backend/`, `docs/`, migrações,
   `*.md` de planejamento, nem em `openapi.json`. Esses são do outro agente.
2. Antes de começar e antes de cada `git push`: `git pull --rebase origin main`.
3. Faça commits pequenos e focados. Mensagem em PT-BR, prefixo `feat(frontend):` /
   `fix(frontend):`. Termine a mensagem com:
   `Co-Authored-By: Antigravity <noreply@google.com>`
4. **Sempre rode antes de commitar:** `cd frontend && npm run -s tsc && npm run -s build`
   (ou os scripts equivalentes do projeto — confira `frontend/package.json`). Só comite com
   tsc=0 e build OK.
5. Não defina `NEXT_PUBLIC_API_URL` em lugar nenhum (a ausência dela habilita o modo proxy).

## ARQUITETURA QUE VOCÊ PRECISA RESPEITAR
- Next.js 15 App Router na Vercel; backend FastAPI no Fly.
- **Proxy same-origin:** o browser fala com `/api/v1/...` (mesmo domínio); o arquivo
  `frontend/src/app/api/v1/[...path]/route.ts` encaminha pro backend. **Nunca** chame o
  domínio do backend direto do browser.
- **CSP `img-src 'self'`:** TODA imagem renderizada no browser tem que vir de URL relativa
  same-origin (`/api/v1/...`). Nunca use a URL absoluta do backend em `<img src>`.
- Estado servidor com **React Query (TanStack)**; ícones **lucide-react**.
- Cliente HTTP: use o helper existente em `frontend/src/lib/` (procure por `api` —
  ex.: `api.get/post/patch/delete`). Reaproveite o padrão dos componentes existentes.
- **Design tokens (cores) já usados no projeto** (mantenha consistência):
  fundo `#050B12`, card `#0B171C`, borda `#243337`, texto `#F0EADD`, secundário `#87938F`,
  primária/teal `#2F9285` (hover `#3AA99A`), accent laranja `#C36B3F`, verde `#54B88D`.

---

## TAREFA DESTE LOTE: Perfil do Estúdio (backend já PRONTO e no ar)

Cada estúdio precisa personalizar sua identidade no portal do cliente: **logo**, **foto/avatar**
e o **link personalizado (slug)** que termina com o nome do estúdio
(`https://sessao-ink.vercel.app/<slug>`).

### Contratos de API já disponíveis (passam pelo proxy `/api/v1/...`)
> Todos exigem sessão (cookie httpOnly). Branding/slug exigem papel **ADMIN**.

**Perfil**
- `GET /api/v1/estudio/` → `{ id, nome, slug, bio, cidade, uf, telefone, instagram, email_notificacao, has_logo, has_foto }`
- `PATCH /api/v1/estudio/` (ADMIN) — body parcial: `{ nome?, bio?, cidade?, uf?, telefone?, instagram?, email_notificacao? }` → EstudioResponse

**Slug (link do portal)**
- `GET /api/v1/estudio/slug/sugestao?base=<texto>` → `{ slug, disponivel, motivo? }`
  (use para validar em tempo real enquanto o usuário digita; `base` pode ser o nome do estúdio)
- `PATCH /api/v1/estudio/slug` (ADMIN) — body `{ slug }` → EstudioResponse.
  Erros: `422` (formato/reservado, `detail` tem a mensagem), `409` (já em uso).
  Regras do slug: 3–50 chars, `a-z 0-9` e hífens, sem acento/espaço; alguns nomes são reservados.
  **Avise o usuário que links antigos param de funcionar após trocar.**

**Branding (logo e foto)**
- `POST /api/v1/estudio/logo` (ADMIN, multipart `arquivo`) → EstudioResponse
- `POST /api/v1/estudio/foto` (ADMIN, multipart `arquivo`) → EstudioResponse
- `DELETE /api/v1/estudio/logo` (ADMIN) → EstudioResponse
- `DELETE /api/v1/estudio/foto` (ADMIN) → EstudioResponse
- Exibir a imagem atual no dashboard: `GET /api/v1/estudio/logo` e `/api/v1/estudio/foto`
  (retornam a imagem; use direto como `src`, ex.: `<img src="/api/v1/estudio/logo?t=<cacheBust>">`).
- Formatos aceitos: JPEG/PNG/WEBP, até 15MB (o backend valida e re-encoda).

### O que implementar

**1) `frontend/src/app/(dashboard)/configuracoes/page.tsx`** (já existe — incremente)
- Seção **Identidade visual**:
  - Upload de **Logo** e de **Foto/avatar** (input file + preview + botão remover).
    Mostre a imagem atual quando `has_logo`/`has_foto`. Após upload, invalide o cache
    (`queryClient.invalidateQueries`) e faça cache-bust no `src` (ex.: `?t=Date.now()`).
    Estados de loading/erro por ação. Aceite só image/jpeg,png,webp; valide tamanho no front.
  - Restrinja as ações de ADMIN (esconda/disable para não-admin; o `tipo` vem de `/api/v1/auth/me`).
- Seção **Link do portal**:
  - Campo para editar o slug, com **preview ao vivo** do link final
    `sessao-ink.vercel.app/<slug>`, botão "copiar link", e validação em tempo real via
    `slug/sugestao` (debounce ~400ms; mostre verde "disponível" / vermelho com o motivo).
  - Botão "Salvar link" chama `PATCH /estudio/slug`; trate 409/422 mostrando `detail`.
  - **Modal de confirmação** alertando que os links antigos deixarão de funcionar.
- Seção **Dados do estúdio** (se ainda não houver): formulário para nome, bio, cidade, uf,
  telefone, instagram, email_notificacao via `PATCH /estudio/`.

**2) Portal público — `frontend/src/app/[slug]/page.tsx`** (server component, já existe)
- Hoje o hero mostra a inicial do nome num quadrado. Se `has_foto`, renderize a **foto** do
  estúdio: `<img src={`/api/v1/public/${slug}/foto`} ...>` (relativo/same-origin).
- Se `has_logo`, exiba a **logo** (ex.: no topo do hero ou no rodapé "powered by" — escolha o
  posicionamento mais elegante). Fallback para a inicial quando não houver foto.
- Mantenha o layout/estética atuais e os tokens de cor.

### Critérios de aceite
- Admin sobe/troca/remove logo e foto; aparecem no dashboard e no portal público.
- Slug editável com validação em tempo real, preview do link e confirmação; 409/422 tratados.
- Imagens sempre same-origin (passam no CSP). `tsc` e `build` limpos. Commits só em `frontend/`.

### Próximos lotes (NÃO faça agora — virão com o backend pronto)
Portfólio (arquivados/restaurar/exclusão permanente), Financeiro (redesign tabs/filtros/gráficos),
Dashboard executivo. O outro agente avisa quando os contratos estiverem no ar.
