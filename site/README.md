# Copa SBT Energisa 2026 — site conectado à planilha

Este é o protótipo exportado do Claude Design (`index.html`, `_ds/`, `support.js`)
com os dados fixos substituídos pela leitura ao vivo da planilha do Google Sheets.
Nada do visual (paleta, tipografia, layout, animações) foi alterado — só a fonte
dos dados.

## O que foi adicionado

- **`data.js`** — busca as 12 abas da planilha via endpoint `gviz` do Google
  Sheets, normaliza tudo, guarda o último dado bom em `localStorage`, e faz
  polling adaptativo (30s com jogo ao vivo, 3min fora disso).
- **`viewmodel.js`** — transforma os dados normalizados exatamente no formato
  que o template já esperava (times, jogos, classificação, artilharia,
  notícias, eventos da partida, etc.), incluindo o cronômetro calculado a
  partir de `Inicio1T`/`Inicio2T`.
- Pequenos ajustes de *markup* em `index.html`: título/subtítulo do banner,
  estatísticas do hero, legenda da classificação e algumas seções (Destaques,
  Artilharia) agora dependem dos dados reais e desaparecem sem deixar buraco
  quando estão vazias — exatamente como a aba **Instruções** da planilha pede.
- Player de rádio real (`<audio>`) e modal de vídeo (embed do YouTube) —
  substituindo os botões decorativos do protótipo.
- Os 6 cards da aba **Mais** agora abrem telas de verdade: Times participantes
  (lista por grupo → perfil do time com jogos e aproveitamento), Notificações
  de gol (aviso na tela enquanto a página estiver aberta, por time seguido),
  Central de mídia (gravações + capítulos por gol), Rádio ao vivo, Regulamento
  e Fale com a organização — os três últimos lendo a aba nova **Páginas**.
- Notícia agora tem página de leitura própria (imagem, categoria, título,
  data, texto completo) — abre ao clicar no card, tanto na Home quanto na
  aba Notícias.
- Busca de time (ícone de lupa no cabeçalho) e sino de notificações agora
  funcionam de verdade.

## Aba "Páginas" (Regulamento / Fale com a organização)

Colunas: `PaginaID`, `Seção`, `Ordem`, `Título`, `Conteúdo`. Cada linha vira um
bloco de texto na respectiva tela. Use `Seção` = `Regulamento` ou `Contato`
(exatamente assim, com acento) e `Ordem` para controlar a sequência dos blocos
dentro da seção. Sem linhas para uma seção, a tela mostra um aviso educado em
vez de ficar vazia. Em **Contato**, qualquer telefone ou e-mail que aparecer
no texto do `Conteúdo` vira automaticamente um link clicável (`tel:`/`mailto:`)
abaixo do texto — não precisa formatar nada especial, só escrever o número/
e-mail normalmente.

## Vídeo na notícia (aba Mídia)

Para uma matéria aparecer com vídeo em vez de foto, crie uma linha na aba
**Mídia** com `Tipo` = `Vídeo` e a coluna **`NoticiaID`** apontando para o
`NoticiaID` da matéria. A coluna `NoticiaID` é nova — adicione no fim da aba
Mídia (adicionar coluna no fim é seguro). Em `URL` vale tanto link do YouTube
quanto arquivo de vídeo direto (`.mp4`, `.webm`).

O vídeo toca **mudo e em loop**, com um ícone de som no canto: um toque liga o
áudio, outro desliga. Ele só carrega quando o card entra na tela, e nunca toca
mais de um vídeo ao mesmo tempo. Em conexão limitada (o navegador sinaliza
"economia de dados" ou rede lenta) ele não inicia sozinho — mostra a miniatura
com botão de play. Se o vídeo falhar, o card cai na foto da notícia; sem foto,
no espaço reservado de sempre. Sem linha de vídeo, a matéria segue com a foto,
exatamente como antes.

## Antes de publicar: acesso à planilha

O site lê a planilha pelo ID direto (`1dK_PoKQnyEtfVPNbBkd9kx_J-CXYO7nz2tvTwyNbCsM`,
já fixado em `data.js`), sem precisar do fluxo "Publicar na Web" da aba
Instruções (esse fluxo funciona, mas costuma demorar mais para refletir uma
atualização). Para isso, a planilha precisa estar compartilhada como:

> **Compartilhar → Qualquer pessoa com o link → Leitor**

Isso é só leitura — ninguém de fora consegue editar. Se preferir usar
"Publicar na Web" em vez disso, me avise para eu trocar o endpoint em
`data.js` (`gvizUrl`).

## Rodando localmente

Não tem build. Basta servir a pasta como estático:

```bash
npx serve .
# ou
python3 -m http.server 8080
```

Abra `http://localhost:PORTA/index.html`.

## Publicando na Vercel

1. Suba esta pasta para um repositório Git (ou arraste a pasta direto na
   Vercel, sem repositório).
2. Na Vercel: **New Project → Import** → selecione o repo.
3. Framework preset: **Other**. Não precisa de build command nem install
   command — é HTML estático puro.
4. Deploy.

O `manifest.webmanifest` e o `sw.js` já apontam para `index.html` (a Vercel
serve `index.html` como raiz automaticamente).

## Como o app decide o que mostrar

- **Status do jogo** (`Jogos.Status`): `Ao vivo` mostra o indicador pulsante
  e o minuto; `Intervalo` congela em `duracao_tempo_min` (Config); `Encerrado`
  mostra o placar final; `Agendado` mostra data/hora; `Adiado` e `WO` têm
  rótulo próprio.
- **Minuto da partida**: calculado a partir de `Inicio1T`/`Inicio2T` (hora do
  relógio) + `duracao_tempo_min`. Se ambos estiverem vazios, mostra só
  "AO VIVO" sem minuto.
- **Rádio/vídeo**: `RadioURL` do jogo ao vivo toca no player de baixo (com
  `radio_url_padrao` como stream fixo alternativo, se preenchido).
  `VideoAoVivoURL`/`GravacaoURL` abrem o botão "Assistir" no detalhe da
  partida. Gols com `TempoNoVideo` preenchido ficam clicáveis na linha do
  tempo, abrindo a gravação naquele ponto — **só funciona para links do
  YouTube** (outros serviços caem num botão "Assistir ↗" que abre em nova
  aba).
- **Anti-spoiler**: enquanto o rádio ou o vídeo estiver tocando, o placar
  mostrado fica atrasado em `delay_transmissao_seg` segundos (Config) em
  relação ao que já chegou da planilha.
- **Abas opcionais vazias** (Estatísticas, Notícias, Mídia, Substituições,
  Cartões): a seção correspondente simplesmente não aparece — sem erro, sem
  "undefined", sem espaço em branco.
- **Foto da notícia** (`Notícias.Imagem (URL)`): se você colar o link de
  "Compartilhar" do Google Drive (`.../file/d/ID/view...`), o site converte
  sozinho para o formato de imagem direta do Drive — colar o link de
  compartilhar já funciona, não precisa gerar nada manualmente (só a permissão
  do arquivo continua precisando ser "Qualquer pessoa com o link"). Depois
  disso o site testa a URL no navegador antes de exibir: se carregar, a foto
  aparece **inteira** (nunca cortada, nunca distorcida) — funciona pra
  horizontal, vertical ou quadrada, com um fundo desfocado da própria foto
  preenchendo o quadro atrás dela; se falhar (arquivo sem permissão pública,
  removido, etc.), o card cai sozinho pro visual padrão com a legenda "ESPAÇO
  PARA FOTO OFICIAL" — nunca fica um ícone de imagem quebrada. Clicar no card
  (Home ou aba Notícias) abre a matéria completa, com botão de voltar.
- **Se a planilha cair**: o site mostra os últimos dados que carregaram (salvos
  no navegador) com um aviso discreto no topo, nunca uma tela quebrada.

## Validação da aba Jogos

O site valida cada linha da aba **Jogos** ao ler a planilha: horário (`HH:MM`),
data (`AAAA-MM-DD`), status (um de `Agendado, Ao vivo, Intervalo, Encerrado,
Adiado, WO`), `TimeCasaID`/`TimeForaID` (precisam existir na aba Times) e
placar (número inteiro ou vazio). Uma linha que falhar em qualquer desses
pontos é ignorada por completo — não aparece em lugar nenhum do site e não
entra em nenhum totalizador (times/grupos/partidas, filtros, etc.) — em vez de
travar a página ou mostrar "undefined".

Sem precisar de nada externo, o próprio site já mostra um painel vermelho no
topo (em qualquer aba) sempre que existir pelo menos um jogo inválido,
listando o `JogoID` e a mensagem exata (ex.: "BAD01 — Hora inválida (use
HH:MM): 19h30"). Isso funciona sempre, sem depender de nenhuma credencial.

Se além disso você quiser que o erro apareça **dentro da própria planilha**
(numa coluna "ValidacaoErro" na aba Jogos), isso exige escrever de volta no
Google Sheets — e isso sim precisa de uma credencial que eu não tenho aqui
(o site só lê a planilha via link público, não tem permissão de escrita). O
arquivo `apps-script-validacao.gs` (na raiz deste pacote) resolve isso: é um
Google Apps Script que, uma vez instalado por você na sua conta, escreve essa
coluna automaticamente. Passo a passo no topo do arquivo (Extensões → Apps
Script → colar → Implantar como App da Web → colar a URL gerada na constante
`VALIDATION_WEBHOOK_URL` em `data.js`). Esse passo é opcional — o painel no
site já cobre o essencial mesmo sem ele.

## Limitações conhecidas (avise se quiser que eu ajuste)

- **Escudo dos times** (`Times.Escudo (URL)`): se preenchido, vira o fundo do
  emblema — mas as iniciais do time continuam desenhadas por cima (herança do
  protótipo, que não tinha um `<img>` dedicado). Nenhum time de exemplo tem
  escudo hoje, então não é visível ainda; se for usar escudos de verdade, me
  avise para eu adicionar a tag de imagem própria.
- **Escalação**: a planilha não tem conceito de "titular" por partida — a aba
  Escalação do detalhe do jogo mostra o elenco completo de cada time
  (agrupado por posição), não uma formação tática.
- **Rádio**: o player usa uma tag `<audio>` comum. Isso funciona para streams
  de áudio direto (`.mp3`, `.aac`, `.m3u8`); links de página (como uma URL de
  compartilhamento do Zeno.fm) podem não tocar diretamente — se for o caso,
  me diga qual serviço de streaming vai usar que eu ajusto para o embed
  correto.
- As duas páginas de "vitrine" do export (`Copa SBT Energisa 2026 -
  Jogos.dc.html` e `standalone-src.dc.html`, que mostram o app dentro de uma
  moldura de iPhone) não foram incluídas aqui — são material de apresentação
  do protótipo, não fazem parte do site final.

## Testado

Simulei a planilha inteira (times, jogos ao vivo/agendados/encerrados/WO,
gols, cartões, classificação) e naveguei pelo site inteiro num navegador
real (Chromium via Playwright) antes de entregar: Home, Jogos, Tabela,
abrir detalhe de partida, abrir vídeo pelo clique num gol, e o cenário de
"planilha fora do ar" (mostra o último dado salvo + aviso, sem tela
quebrada). Não testei contra a planilha real de dentro deste ambiente
(a rede daqui bloqueia acesso a docs.google.com), então vale você testar
uma vez com os dados reais antes de divulgar o link — mas a lógica de
leitura/parse foi validada linha a linha, inclusive a peculiaridade do
Google Sheets de mandar células de data/hora num formato que não é JSON
válido.
