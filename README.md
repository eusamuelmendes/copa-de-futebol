# copa-de-futebol

Programa para gerenciar dados da Copa de Futebol, e posteriormente, criar um programa final de transmissão desses dados da copa.

Este repositório contém um MVP em Python, com CLI interativa e persistência em SQLite, que serve de base para um futuro app web/mobile de acompanhamento da copa.

## Funcionalidades

- **Times e jogadores**: cadastro de times (com grupo) e jogadores (número, posição).
- **Partidas**: agendamento (data, horário, times, estádio, fase) e listagem/histórico.
- **Resultados**: lançamento de gols (com suporte a autogols) — o placar final é calculado automaticamente a partir dos gols lançados.
- **Cartões**: amarelos e vermelhos, com jogador, minuto e motivo.
- **Pênaltis**: cobranças durante o jogo e disputas por pênaltis em partidas eliminatórias, registrando marcados, convertidos e perdidos por jogador.
- **Classificação**: tabela da fase de grupos (pontos, V/E/D, saldo de gols) com o sistema de pontuação padrão (vitória=3, empate=1, derrota=0).
- **Fases**: suporte a fase de grupos e mata-mata (oitavas, quartas, semifinal, terceiro lugar, final).
- **Relatórios**: histórico de partidas, estatísticas por time, artilheiros, ranking de cartões, desempenho em pênaltis, confronto direto entre times e próximas partidas.
- **Exportação**: relatórios em CSV (sempre disponível) e em PDF (requer `reportlab`).

## Requisitos

- Python 3.10+
- Nenhuma dependência externa é necessária para o funcionamento básico (usa apenas a biblioteca padrão + SQLite).
- Para exportar relatórios em PDF, instale a dependência opcional:

  ```bash
  pip install -r requirements.txt
  ```

## Como executar

```bash
python3 main.py
```

O banco de dados SQLite é criado automaticamente em `data/copa.db` na primeira execução. Os relatórios exportados são salvos na pasta `exports/`.

## Estrutura do projeto

```
copa_futebol/
    database.py       # conexão e schema do SQLite
    validacao.py       # leitura e validação de entrada do usuário
    times.py            # cadastro/consulta de times e jogadores
    partidas.py         # cadastro de partidas e lançamento de gols/cartões/pênaltis
    classificacao.py    # tabela de classificação e confrontos diretos
    relatorios.py        # estatísticas, artilheiros, cartões e pênaltis
    exportacao.py        # exportação em CSV/PDF
    cli.py               # menus interativos (camada de interface)
main.py                  # ponto de entrada
tests/                    # testes automatizados (unittest)
```

## Testes

```bash
python3 -m unittest discover -s tests -v
```
