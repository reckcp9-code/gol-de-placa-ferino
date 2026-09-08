# Gol de Placa — Ferino Futebol Clube

Sistema de votação secreta do Ferino Futebol Clube para a temporada 2026.

## Categorias

- Bola Cheia
- Bola Murcha
- Gol do Jogo
- Defesa do Jogo

## Fluxo

1. O administrador cria/abre uma partida.
2. Gera códigos individuais para os votantes.
3. Cada código pode enviar uma votação completa uma única vez.
4. Enquanto a votação está aberta, o resultado fica secreto.
5. O administrador encerra a votação no apito final.
6. Os vencedores são liberados e entram automaticamente no Ranking 2026.
7. O resultado final pode ser compartilhado no WhatsApp.

## Administração

O painel permite:

- consultar quantos códigos já votaram;
- gerar novos códigos;
- encerrar e reabrir a votação;
- criar uma nova partida sem misturar os votos da anterior;
- cadastrar, ativar e desativar jogadores;
- preservar o ranking anual por categoria.

## Cloudflare Worker + D1

O projeto está preparado para deploy automático no Cloudflare Workers:

- `worker.js`: API e regras da votação;
- `public/index.html`: interface publicada como Static Assets;
- `schema.sql`: estrutura do banco;
- `wrangler.jsonc`: configuração do Worker, Static Assets e binding `DB`;
- `.github/workflows/deploy-cloudflare.yml`: publicação automática a cada push na `main`.

O D1 usa provisionamento automático do Wrangler. No primeiro deploy, o recurso do binding `DB` pode ser criado e vinculado automaticamente. Depois do deploy, o workflow executa `schema.sql` no banco remoto.

### Secrets necessários no GitHub

Em **Settings → Secrets and variables → Actions**, cadastrar:

- `CLOUDFLARE_API_TOKEN` — token da conta Cloudflare com permissão para Workers e D1;
- `CLOUDFLARE_ACCOUNT_ID` — ID da conta Cloudflare;
- `ADMIN_PIN` — PIN privado usado para entrar no painel Admin do Gol de Placa.

Nunca coloque esses valores diretamente nos arquivos do repositório.

Depois que os três secrets existirem, qualquer push na branch `main` dispara o deploy automaticamente. Também é possível executar manualmente o workflow **Deploy Cloudflare Worker** em Actions.
