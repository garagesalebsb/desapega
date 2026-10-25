# Desapega

PWA para encontrar e divulgar **vendas de garagem, bazares e vendas de mudança** em Brasília, construído a partir do *Plano do Projeto – Site de Vendas de Garagem em Brasília*.

- **Front-end:** HTML + JavaScript puro (sem etapa de build), hospedado no **GitHub Pages**
- **Back-end:** **Supabase** (login, banco Postgres com RLS, armazenamento de fotos)
- **Mapa:** Leaflet + OpenStreetMap (sem chave de API)

## O que já está pronto (primeira versão do plano)

| Funcionalidade | Onde |
|---|---|
| Navegar sem login | Qualquer pessoa vê vendas e itens; login só para anunciar, salvar ou falar com o vendedor |
| Cadastro com verificação | Google ou link por e-mail; WhatsApp obrigatório para anunciar, com verificação por SMS opcional |
| Criar evento | Data, horário, região administrativa, pino arrastável no mapa, referência e tipo (garagem, mudança, bazar coletivo) |
| Cadastrar itens | Foto pelo celular (reduzida antes do envio), título, preço e categoria; formulário "salvar e adicionar outro" |
| Vendido ou reservado | Um toque no item, inclusive durante a venda |
| Vendas do fim de semana | Tela inicial com mapa e lista, filtro por região e tipo; vendas de mudança em destaque |
| Busca e favoritos | Busca por texto e categoria em itens e vendas; salvar vendas |
| Contato e rota | WhatsApp do vendedor (só para logados), rota no Google Maps e no Waze |
| Denúncia | Denunciar anúncio ou vendedor (tabela `reports`) |
| Página pública da venda | Link próprio `…/v/<id>/` com pré-visualização no WhatsApp |
| Várias fotos e edição de item | Até 6 fotos por item (HEIC convertido no aparelho), galeria para o comprador, editar título/preço/categoria/fotos |
| Pix no item | Vendedor cadastra a chave no Perfil; item mostra QR Code e "copia e cola" com o valor (BR Code estático, sem taxas) |
| Excluir conta | No Perfil; apaga fotos, vendas, itens e a conta (LGPD) |
| Convite para instalar | Sugere "Adicionar à tela inicial" após salvar uma venda ou abrir a 2ª venda; tutorial para iPhone |

## Passo a passo

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e rode todo o arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Project Settings > API**, copie a **Project URL** e a chave **anon / publishable** para [`js/config.js`](js/config.js).
4. Em **Authentication > URL Configuration**:
   - **Site URL:** `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`
   - **Redirect URLs:** adicione a mesma URL e, para testes locais, `http://localhost:8000/`
5. Login com Google: em **Authentication > Providers > Google**, ative e informe o Client ID/Secret criados no [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo "Aplicativo da Web", com a *Callback URL* que o Supabase mostra nessa tela).
6. (Opcional) Verificação do telefone por SMS: configure um provedor em **Authentication > Providers > Phone** (Twilio, por exemplo) e, no SQL Editor, rode:
   ```sql
   create or replace function public.require_phone_verification()
   returns boolean language sql immutable as $$ select true $$;
   ```
   A partir daí, só anuncia quem confirmou o celular por SMS — a regra vale no banco, não só na tela.

7. Rode também [`supabase/002_fotos_pix_conta_previa.sql`](supabase/002_fotos_pix_conta_previa.sql) (várias fotos por item, Pix, excluir conta e prévia do link na hora).
8. Rode [`supabase/003_privacidade.sql`](supabase/003_privacidade.sql): limita a 30 por hora os contatos (WhatsApp/Pix) que cada conta pode ver, contra coleta em massa, e só deixa públicos os nomes de quem tem venda publicada.
9. (Opcional) Prévia do link no WhatsApp **na hora**: crie no GitHub um *fine-grained token* com acesso **só a este repositório** e permissão **Actions: Read and write**, e guarde-o no Vault do Supabase pelo SQL Editor:
   ```sql
   select vault.create_secret('COLE_O_TOKEN_AQUI', 'github_deploy_token');
   ```
   A cada venda criada ou alterada, o banco pede ao GitHub para republicar o site (~1 min). Sem o token, a prévia sai pela atualização automática a cada 30 minutos.

10. Rode [`supabase/004_lembretes.sql`](supabase/004_lembretes.sql): lembretes por notificação das vendas salvas (véspera às 19h, dia às 7h). O envio é feito pelo workflow **Lembretes das vendas salvas**, que usa os segredos `VAPID_PRIVATE_KEY` e `REMINDERS_SECRET` do repositório (no banco fica só o hash da senha). A chave pública correspondente está em `js/config.js` (`VAPID_PUBLIC_KEY`). No iPhone, os lembretes só funcionam com o app instalado na tela de início (iOS 16.4 ou mais novo).
11. Rode [`supabase/005_central_de_notificacoes.sql`](supabase/005_central_de_notificacoes.sql): central de notificações do app (sininho no topo). O próprio banco cria os avisos: lembretes, venda salva que mudou de data, horário ou endereço, venda cancelada e, para o vendedor, quantas pessoas salvaram a venda (sem dizer quem).
12. (Opcional) Descrição automática das fotos com IA: rode [`supabase/006_descricao_e_ia.sql`](supabase/006_descricao_e_ia.sql) e cadastre dois segredos no GitHub (**Settings > Secrets and variables > Actions**): `GEMINI_API_KEY` (crie em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) e `SUPABASE_ACCESS_TOKEN` (Supabase > Account > Access Tokens). O workflow **Publicar funções do Supabase** publica a função `descrever-item` e guarda a chave nela; o site nunca vê a chave. Cada conta pode analisar até 60 fotos por hora e 300 por dia. Para trocar o modelo, defina o segredo `GEMINI_MODEL` na função (padrão `gemini-3.5-flash-lite`).
13. Rode [`supabase/007_chat.sql`](supabase/007_chat.sql): chat entre comprador e vendedor, uma conversa por item, com mensagens em tempo real (Supabase Realtime). O WhatsApp vira opcional: só aparece se o vendedor liberar no perfil, e não é mais exigido para anunciar.
14. Rode [`supabase/008_push_do_chat.sql`](supabase/008_push_do_chat.sql): notificação no celular quando chega mensagem no chat. A função `enviar-push` usa os mesmos segredos dos lembretes (`VAPID_PRIVATE_KEY` e `REMINDERS_SECRET`), que o workflow **Publicar funções do Supabase** grava nela.
15. Rode [`supabase/009_corrige_edicao_venda.sql`](supabase/009_corrige_edicao_venda.sql) (correção do aviso de venda alterada) e [`supabase/010_chat_escala.sql`](supabase/010_chat_escala.sql): cada pessoa recebe as mensagens num canal particular e a notificação no celular sai do próprio banco (extensão `pg_net`).
16. Rode [`supabase/011_limpeza_de_fotos.sql`](supabase/011_limpeza_de_fotos.sql): todo dia, às 6h, o workflow **Limpeza das fotos** apaga do Storage as fotos das vendas que terminaram há mais de 30 dias e os envios abandonados (a venda continua no histórico, sem as fotos). Para conferir antes, rode o workflow manualmente com "Só contar, sem apagar".
17. Rode [`supabase/012_rascunho.sql`](supabase/012_rascunho.sql): venda nova (ou duplicada) começa como rascunho, visível só para quem criou. Antes de publicar, o app mostra todos os preços para revisão, destacando os sugeridos pela IA. As vendas que já existiam continuam publicadas.

### 2. GitHub Pages

```bash
git init -b main
git add .
git commit -m "Primeira versão do Desapego Brasília"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

No GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica o site a cada push e, a cada 30 minutos, regenera as páginas de pré-visualização das vendas.

### 3. Testar localmente

Qualquer servidor estático serve, por exemplo:

```bash
npx serve -l 8000 .        # ou: python -m http.server 8000
```

Abra `http://localhost:8000/`.

## Como funciona o link de compartilhamento

O GitHub Pages só serve arquivos estáticos, então o WhatsApp não consegue ler os dados de uma venda criada há pouco. A solução:

1. O botão **Compartilhar** gera `https://…/v/<id-da-venda>/`.
2. O workflow consulta o Supabase e cria `v/<id>/index.html` com título, data, região e foto (tags Open Graph), que redireciona para a venda no app.
3. Enquanto a página ainda não foi gerada (até ~30 min), o link cai no `404.html`, que leva direto para a venda — o link nunca quebra, só a prévia demora um pouco.

Para prévias imediatas, dispare o workflow manualmente (**Actions > Publicar no GitHub Pages > Run workflow**).

## Moderação

- Denúncias ficam em `public.reports` (veja pelo **Table Editor** do Supabase).
- Para tirar uma venda do ar sem apagá-la: `update sales set hidden = true where id = '…';`

## Estrutura

```
index.html              casca do app (PWA)
404.html                redireciona links /v/<id>/ ainda sem prévia
manifest.webmanifest    instalação na tela inicial
sw.js                   cache offline do app
css/style.css           visual (claro e escuro)
js/config.js            URL e chave do Supabase
js/app.js               telas, rotas e chamadas ao Supabase
js/data.js              regiões administrativas, categorias, tipos
js/install.js           convite para instalar
js/reminders.js         inscrição do aparelho nos lembretes
icons/                  ícones e imagem padrão de compartilhamento
supabase/schema.sql     tabelas, gatilhos, RLS e bucket de fotos
scripts/build-site.mjs  monta o site e as páginas de prévia
scripts/send-reminders.mjs  envia os lembretes (workflow lembretes.yml)
```

## Próximas fases (do plano)

- **Fase 2:** avaliações, alertas por interesse, reserva com prazo
- **Fase 3:** chat próprio, ofertas, Pix com QR Code, painel com estatísticas, eventos com vários vendedores
- **Fase 4:** destaque pago, planos para organizadores e brechós, outras cidades
