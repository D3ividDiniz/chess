# Peleleca Chess Studio

Aplicação web em português para importar jogos públicos do Chess.com, revisar PGNs, analisar lances com Stockfish no navegador, jogar contra o engine e guardar tudo localmente.

## Rodar localmente

Requer Node.js 20 ou superior e pnpm (ou npm).

```bash
pnpm install
pnpm start
```

Abra `http://localhost:3000`. O servidor copia os arquivos locais de chess.js e Stockfish para `public/vendor` ao iniciar. O endpoint `/health` é usado pelo Render.

## Recursos

- Histórico mensal e arquivos recentes por usuário público do Chess.com, via proxy com `User-Agent` no servidor.
- Importação de PGN e análise por lance em profundidades 10, 14 ou 18.
- Avaliação de posição, categorias de lance e precisão aproximada por lado.
- Tabuleiro com navegação de lances, setas, barra de avaliação e atalhos de teclado.
- Partidas contra Stockfish, seleção de lado, nível, relógio, desistência, empate, takeback e sons sintetizados.
- Biblioteca offline em `localStorage`, com exportação e importação de backup JSON.

## Publicar no Render

O Blueprint está em `render.yaml`. Conecte este repositório ao Render e aplique o Blueprint. O serviço Node escuta a porta fornecida pelo Render e publica os headers de isolamento necessários para WebAssembly.

## Dados e privacidade

As partidas importadas e análises são salvas apenas no armazenamento local do navegador. Elas não são enviadas para um banco de dados Peleleca. Limpar os dados do navegador também apaga o arquivo local; exporte um backup JSON para preservar sua biblioteca.

## Créditos e licenças

Este projeto usa [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause) para regras e PGN e [Stockfish](https://github.com/nmrugg/stockfish.js) (GPLv3) para análise e jogo. Os arquivos do engine e a licença GPL são disponibilizados localmente em `public/vendor/stockfish` após iniciar o servidor. Peleleca é um projeto independente e não é afiliado ao Chess.com.

Chess.com Published Data API é fornecida por Chess.com e sujeita aos termos e limites de serviço deles. Análises são avaliações de engine e não aconselhamento competitivo oficial.
