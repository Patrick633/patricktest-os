# Life OS

Um sistema pessoal para organizar a vida: **hábitos, humor, tarefas e metas** num só lugar.
Visual clean, dinâmico e moderno: cards brancos, CTA lima, botão redondo com anel de progresso, arco de humor em laranja e micro-animações.

## Telas

- **Onboarding** (boas-vindas animadas → nome → áreas de foco → humor do dia). Os hábitos iniciais são sugeridos a partir das áreas escolhidas.
- **Hoje**: semana com indicador de progresso, cartão com % do dia, humor, hábitos com sequência 🔥 e tarefas.
- **Hábitos**: criar com emoji e ver o histórico dos últimos 7 dias.
- **Humor**: seletor em arco (arraste ou toque no emoji), nota opcional e gráfico dos últimos 14 dias.
- **Metas**: progresso em passos de 10%.

## Rodar

Não precisa de build. Abra `index.html` no navegador ou sirva a pasta:

```bash
python3 -m http.server 8000
```

Os dados ficam no `localStorage` do navegador (chave `lifeos.v1`). Para recomeçar, limpe os dados do site.

## Estrutura

```
index.html      # shell da página
css/style.css   # tokens de design e componentes
js/app.js       # estado, telas e interações (vanilla JS)
```
