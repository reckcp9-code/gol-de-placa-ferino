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
7. O resultado final pode ser preparado para compartilhamento no WhatsApp.

## Administração

O painel permite:

- consultar quantos códigos já votaram;
- gerar novos códigos;
- encerrar e reabrir a votação;
- criar uma nova partida sem misturar os votos da anterior;
- cadastrar, ativar e desativar jogadores;
- preservar o ranking anual por categoria.

O PIN do administrador deve permanecer configurado no ambiente do Worker como `ADMIN_PIN`.