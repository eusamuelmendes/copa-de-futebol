"""Interface de linha de comando: sistema de menus interativos."""

import sqlite3
from pathlib import Path

from . import classificacao, database, exportacao, partidas, relatorios, times
from .validacao import (
    confirmar,
    escolher_da_lista,
    ler_data,
    ler_horario,
    ler_inteiro,
    ler_opcao,
    ler_texto,
)

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"

FASES_LABEL = {
    "grupos": "Fase de grupos",
    "oitavas": "Oitavas de final",
    "quartas": "Quartas de final",
    "semifinal": "Semifinal",
    "terceiro_lugar": "Disputa de 3º lugar",
    "final": "Final",
}


def _titulo(texto: str) -> None:
    print("\n" + "=" * 50)
    print(texto)
    print("=" * 50)


def _pausar() -> None:
    input("\nPressione ENTER para continuar...")


# --------------------------------------------------------------------------
# Times e jogadores
# --------------------------------------------------------------------------

def _menu_times(conn: sqlite3.Connection) -> None:
    while True:
        _titulo("TIMES E JOGADORES")
        print("[1] Cadastrar time")
        print("[2] Cadastrar jogador")
        print("[3] Listar times")
        print("[4] Listar jogadores de um time")
        print("[0] Voltar")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=4)

        if opcao == 1:
            nome = ler_texto("Nome do time: ")
            if times.buscar_time_por_nome(conn, nome):
                print("  > Já existe um time com esse nome.")
            else:
                grupo = ler_texto("Grupo (ex: A) [opcional]: ", obrigatorio=False)
                time_id = times.cadastrar_time(conn, nome, grupo or None)
                print(f"  > Time '{nome}' cadastrado (id {time_id}).")
        elif opcao == 2:
            _cadastrar_jogador(conn)
        elif opcao == 3:
            _listar_times(conn)
        elif opcao == 4:
            time_escolhido = _selecionar_time(conn)
            if time_escolhido:
                jogadores = times.listar_jogadores(conn, time_escolhido["id"])
                _titulo(f"Jogadores de {time_escolhido['nome']}")
                if not jogadores:
                    print("  Nenhum jogador cadastrado.")
                for j in jogadores:
                    numero = f"#{j['numero']}" if j["numero"] else "#--"
                    posicao = j["posicao"] or "-"
                    print(f"  {numero} {j['nome']} ({posicao})")
        elif opcao == 0:
            return
        _pausar()


def _cadastrar_jogador(conn: sqlite3.Connection) -> None:
    time_escolhido = _selecionar_time(conn)
    if not time_escolhido:
        return
    nome = ler_texto("Nome do jogador: ")
    numero = ler_inteiro("Número da camisa [opcional]: ", minimo=1, maximo=99, obrigatorio=False)
    posicao = ler_texto("Posição [opcional]: ", obrigatorio=False)
    jogador_id = times.cadastrar_jogador(conn, nome, time_escolhido["id"], numero, posicao or None)
    print(f"  > Jogador '{nome}' cadastrado (id {jogador_id}) no time {time_escolhido['nome']}.")


def _listar_times(conn: sqlite3.Connection) -> None:
    lista = times.listar_times(conn)
    _titulo("Times cadastrados")
    if not lista:
        print("  Nenhum time cadastrado.")
    for t in lista:
        grupo = f" (Grupo {t['grupo']})" if t["grupo"] else ""
        print(f"  [{t['id']}] {t['nome']}{grupo}")


def _selecionar_time(conn: sqlite3.Connection, prompt: str = "Selecione o time"):
    lista = times.listar_times(conn)
    if not lista:
        print("  > Nenhum time cadastrado ainda. Cadastre um time primeiro.")
        return None
    return escolher_da_lista(
        lista,
        lambda t: f"{t['nome']}" + (f" (Grupo {t['grupo']})" if t["grupo"] else ""),
        prompt,
    )


def _selecionar_jogador(conn: sqlite3.Connection, time_id: int | None = None, prompt: str = "Selecione o jogador"):
    lista = times.listar_jogadores(conn, time_id)
    if not lista:
        print("  > Nenhum jogador disponível.")
        return None
    return escolher_da_lista(lista, lambda j: f"{j['nome']}", prompt)


# --------------------------------------------------------------------------
# Partidas
# --------------------------------------------------------------------------

def _menu_partidas(conn: sqlite3.Connection) -> None:
    while True:
        _titulo("PARTIDAS")
        print("[1] Cadastrar (agendar) partida")
        print("[2] Lançar resultado / eventos de uma partida")
        print("[3] Listar todas as partidas")
        print("[0] Voltar")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=3)

        if opcao == 1:
            _cadastrar_partida(conn)
        elif opcao == 2:
            _lancar_eventos(conn)
        elif opcao == 3:
            _listar_partidas_formatado(partidas.listar_partidas(conn))
        elif opcao == 0:
            return
        _pausar()


def _cadastrar_partida(conn: sqlite3.Connection) -> None:
    if len(times.listar_times(conn)) < 2:
        print("  > É preciso cadastrar ao menos 2 times antes de agendar uma partida.")
        return
    print("Time da casa:")
    casa = _selecionar_time(conn, "Time da casa")
    if not casa:
        return
    print("Time visitante:")
    visitante = _selecionar_time(conn, "Time visitante")
    if not visitante:
        return
    if casa["id"] == visitante["id"]:
        print("  > O time da casa e o visitante não podem ser o mesmo.")
        return

    data = ler_data()
    horario = ler_horario()
    estadio = ler_texto("Estádio/Local: ")
    fase = ler_opcao("Fase", partidas.FASES)
    grupo = None
    if fase == "grupos":
        grupo = ler_texto("Grupo (ex: A) [opcional]: ", obrigatorio=False) or None

    try:
        partida_id = partidas.cadastrar_partida(
            conn, data, horario, casa["id"], visitante["id"], estadio, fase, grupo
        )
        print(f"  > Partida agendada (id {partida_id}): {casa['nome']} x {visitante['nome']}.")
    except ValueError as exc:
        print(f"  > Erro: {exc}")


def _listar_partidas_formatado(lista) -> None:
    _titulo("Partidas")
    if not lista:
        print("  Nenhuma partida encontrada.")
        return
    for p in lista:
        fase = FASES_LABEL.get(p["fase"], p["fase"])
        if p["status"] == "encerrada":
            placar = f"{p['placar_casa']} x {p['placar_visitante']}"
            if p["penaltis_casa"] is not None:
                placar += f" (pên. {p['penaltis_casa']} x {p['penaltis_visitante']})"
        else:
            placar = "a definir"
        print(
            f"  [{p['id']}] {p['data']} {p['horario']} - {p['time_casa_nome']} {placar} "
            f"{p['time_visitante_nome']} | {p['estadio']} | {fase} | {p['status']}"
        )


def _selecionar_partida(conn: sqlite3.Connection, status: str | None = None, prompt: str = "Selecione a partida"):
    lista = partidas.listar_partidas(conn, status=status)
    if not lista:
        print("  > Nenhuma partida disponível.")
        return None
    return escolher_da_lista(
        lista,
        lambda p: f"{p['data']} {p['horario']} - {p['time_casa_nome']} x {p['time_visitante_nome']} ({p['status']})",
        prompt,
    )


def _lancar_eventos(conn: sqlite3.Connection) -> None:
    partida = _selecionar_partida(conn, prompt="Selecione a partida para lançar eventos")
    if not partida:
        return

    while True:
        partida = partidas.buscar_partida(conn, partida["id"])
        _titulo(f"{partida['time_casa_nome']} x {partida['time_visitante_nome']} - {partida['data']}")
        print(f"  Status: {partida['status']} | Fase: {FASES_LABEL.get(partida['fase'], partida['fase'])}")
        if partida["status"] == "encerrada":
            print(f"  Placar final: {partida['placar_casa']} x {partida['placar_visitante']}")
        print("\n[1] Registrar gol")
        print("[2] Registrar cartão")
        print("[3] Registrar pênalti (durante o jogo)")
        print("[4] Registrar disputa de pênaltis (mata-mata)")
        print("[5] Ver eventos lançados")
        print("[6] Finalizar partida (calcula placar final)")
        print("[7] Reabrir partida (permite editar eventos novamente)")
        print("[0] Voltar")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=7)

        if opcao == 1:
            _registrar_gol(conn, partida)
        elif opcao == 2:
            _registrar_cartao(conn, partida)
        elif opcao == 3:
            _registrar_penalti(conn, partida, contexto="jogo")
        elif opcao == 4:
            _registrar_disputa_penaltis(conn, partida)
        elif opcao == 5:
            _ver_eventos(conn, partida)
        elif opcao == 6:
            placar_casa, placar_visitante = partidas.finalizar_partida(conn, partida["id"])
            print(f"  > Partida encerrada: {placar_casa} x {placar_visitante}.")
        elif opcao == 7:
            partidas.reabrir_partida(conn, partida["id"])
            print("  > Partida reaberta.")
        elif opcao == 0:
            return
        _pausar()


def _time_da_partida(partida, lado: str) -> dict:
    if lado == "casa":
        return {"id": partida["time_casa_id"], "nome": partida["time_casa_nome"]}
    return {"id": partida["time_visitante_id"], "nome": partida["time_visitante_nome"]}


def _escolher_time_da_partida(partida, prompt: str = "Time"):
    opcoes = [_time_da_partida(partida, "casa"), _time_da_partida(partida, "visitante")]
    return escolher_da_lista(opcoes, lambda t: t["nome"], prompt, permitir_cancelar=False)


def _registrar_gol(conn: sqlite3.Connection, partida) -> None:
    autogol = confirmar("É um autogol?")
    if autogol:
        print("Time do jogador que marcou contra:")
        time_jogador = _escolher_time_da_partida(partida, "Time do autor do autogol")
        time_beneficiado = (
            _time_da_partida(partida, "visitante")
            if time_jogador["id"] == partida["time_casa_id"]
            else _time_da_partida(partida, "casa")
        )
        print(f"  > O gol será contado para: {time_beneficiado['nome']}")
    else:
        time_jogador = _escolher_time_da_partida(partida, "Time que marcou o gol")
        time_beneficiado = time_jogador

    jogador = _selecionar_jogador(conn, time_jogador["id"], "Jogador que marcou")
    if not jogador:
        return
    minuto = ler_inteiro("Minuto: ", minimo=0, maximo=130)
    partidas.registrar_gol(conn, partida["id"], jogador["id"], time_beneficiado["id"], minuto, autogol)
    print("  > Gol registrado.")


def _registrar_cartao(conn: sqlite3.Connection, partida) -> None:
    time_jogador = _escolher_time_da_partida(partida, "Time do jogador")
    jogador = _selecionar_jogador(conn, time_jogador["id"], "Jogador")
    if not jogador:
        return
    tipo = ler_opcao("Tipo de cartão", partidas.TIPOS_CARTAO)
    minuto = ler_inteiro("Minuto: ", minimo=0, maximo=130)
    motivo = ler_texto("Motivo [opcional]: ", obrigatorio=False)
    partidas.registrar_cartao(conn, partida["id"], jogador["id"], tipo, minuto, motivo or None)
    print(f"  > Cartão {tipo} registrado para {jogador['nome']}.")


def _registrar_penalti(conn: sqlite3.Connection, partida, contexto: str) -> None:
    time_jogador = _escolher_time_da_partida(partida, "Time do cobrador")
    jogador = _selecionar_jogador(conn, time_jogador["id"], "Jogador cobrador")
    if not jogador:
        return
    resultado = ler_opcao("Resultado", partidas.RESULTADOS_PENALTI)
    minuto = None
    if contexto == "jogo":
        minuto = ler_inteiro("Minuto: ", minimo=0, maximo=130)
    partidas.registrar_penalti(conn, partida["id"], jogador["id"], time_jogador["id"], resultado, minuto, contexto)
    print(f"  > Pênalti ({resultado}) registrado para {jogador['nome']}.")


def _registrar_disputa_penaltis(conn: sqlite3.Connection, partida) -> None:
    if partida["fase"] == "grupos":
        print("  > Disputa de pênaltis só se aplica a partidas eliminatórias (mata-mata).")
        return
    print("Lance cada cobrança da disputa individualmente. Digite 0 quando terminar.")
    while confirmar("Registrar mais uma cobrança da disputa?"):
        _registrar_penalti(conn, partida, contexto="disputa")

    cobrancas = partidas.listar_penaltis(conn, partida["id"])
    cobrancas_disputa = [c for c in cobrancas if c["contexto"] == "disputa"]
    penaltis_casa = sum(
        1 for c in cobrancas_disputa if c["time_id"] == partida["time_casa_id"] and c["resultado"] == "convertido"
    )
    penaltis_visitante = sum(
        1 for c in cobrancas_disputa if c["time_id"] == partida["time_visitante_id"] and c["resultado"] == "convertido"
    )
    partidas.registrar_disputa_penaltis(conn, partida["id"], penaltis_casa, penaltis_visitante)
    print(f"  > Disputa registrada: {penaltis_casa} x {penaltis_visitante}.")


def _ver_eventos(conn: sqlite3.Connection, partida) -> None:
    _titulo("Gols")
    gols = partidas.listar_gols(conn, partida["id"])
    if not gols:
        print("  Nenhum gol registrado.")
    for g in gols:
        marca = " (contra)" if g["autogol"] else ""
        print(f"  {g['minuto']}' {g['jogador_nome']}{marca} -> {g['time_beneficiado_nome']}")

    _titulo("Cartões")
    cartoes = partidas.listar_cartoes(conn, partida["id"])
    if not cartoes:
        print("  Nenhum cartão registrado.")
    for c in cartoes:
        motivo = f" - {c['motivo']}" if c["motivo"] else ""
        print(f"  {c['minuto']}' {c['tipo'].upper()} {c['jogador_nome']} ({c['time_nome']}){motivo}")

    _titulo("Pênaltis")
    penaltis_lista = partidas.listar_penaltis(conn, partida["id"])
    if not penaltis_lista:
        print("  Nenhum pênalti registrado.")
    for p in penaltis_lista:
        print(f"  [{p['contexto']}] {p['jogador_nome']} ({p['time_nome']}) - {p['resultado']}")


# --------------------------------------------------------------------------
# Relatórios
# --------------------------------------------------------------------------

def _menu_relatorios(conn: sqlite3.Connection) -> None:
    while True:
        _titulo("RELATÓRIOS E CONSULTAS")
        print("[1]  Histórico de partidas")
        print("[2]  Estatísticas por time")
        print("[3]  Artilheiros")
        print("[4]  Jogadores com mais cartões")
        print("[5]  Desempenho em pênaltis")
        print("[6]  Classificação (tabela de grupo)")
        print("[7]  Confronto direto entre dois times")
        print("[8]  Próximas partidas")
        print("[0]  Voltar")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=8)

        if opcao == 1:
            _listar_partidas_formatado(relatorios.historico_partidas(conn))
        elif opcao == 2:
            _relatorio_estatisticas_time(conn)
        elif opcao == 3:
            _relatorio_artilheiros(conn)
        elif opcao == 4:
            _relatorio_cartoes(conn)
        elif opcao == 5:
            _relatorio_penaltis(conn)
        elif opcao == 6:
            _relatorio_classificacao(conn)
        elif opcao == 7:
            _relatorio_confronto_direto(conn)
        elif opcao == 8:
            _listar_partidas_formatado(relatorios.proximas_partidas(conn))
        elif opcao == 0:
            return
        _pausar()


def _relatorio_estatisticas_time(conn: sqlite3.Connection) -> None:
    time_escolhido = _selecionar_time(conn)
    if not time_escolhido:
        return
    stats = relatorios.estatisticas_time(conn, time_escolhido["id"])
    _titulo(f"Estatísticas de {time_escolhido['nome']}")
    print(f"  Jogos: {stats['jogos']}  V: {stats['vitorias']}  E: {stats['empates']}  D: {stats['derrotas']}")
    print(f"  Gols pró: {stats['gols_pro']}  Gols contra: {stats['gols_contra']}  Saldo: {stats['saldo_gols']}")
    print(f"  Pontos: {stats['pontos']}")
    print(f"  Cartões amarelos: {stats['cartoes_amarelos']}  Cartões vermelhos: {stats['cartoes_vermelhos']}")
    print(
        f"  Pênaltis marcados: {stats['penaltis_marcados']}  "
        f"Convertidos: {stats['penaltis_convertidos']}  Perdidos: {stats['penaltis_perdidos']}"
    )


def _relatorio_artilheiros(conn: sqlite3.Connection) -> None:
    lista = relatorios.artilheiros(conn)
    _titulo("Artilheiros")
    if not lista:
        print("  Nenhum gol registrado ainda.")
    for i, a in enumerate(lista, start=1):
        print(f"  {i}. {a['jogador_nome']} ({a['time_nome']}) - {a['gols']} gol(s)")


def _relatorio_cartoes(conn: sqlite3.Connection) -> None:
    lista = relatorios.jogadores_mais_cartoes(conn)
    _titulo("Jogadores com mais cartões")
    if not lista:
        print("  Nenhum cartão registrado ainda.")
    for i, c in enumerate(lista, start=1):
        print(f"  {i}. {c['jogador_nome']} ({c['time_nome']}) - {c['amarelos']} amarelo(s), {c['vermelhos']} vermelho(s)")


def _relatorio_penaltis(conn: sqlite3.Connection) -> None:
    lista = relatorios.desempenho_penaltis(conn)
    _titulo("Desempenho em pênaltis")
    if not lista:
        print("  Nenhum pênalti registrado ainda.")
    for p in lista:
        print(
            f"  {p['jogador_nome']} ({p['time_nome']}) - "
            f"{p['convertidos']}/{p['marcados']} convertidos ({p['aproveitamento']}%)"
        )


def _relatorio_classificacao(conn: sqlite3.Connection) -> None:
    grupos_disponiveis = times.listar_grupos(conn)
    grupo = None
    if grupos_disponiveis:
        print("Grupos disponíveis: " + ", ".join(grupos_disponiveis))
        grupo = ler_texto("Filtrar por grupo [ENTER para ver todos]: ", obrigatorio=False) or None
    tabela = classificacao.calcular_classificacao(conn, grupo)
    _titulo("Classificação" + (f" - Grupo {grupo}" if grupo else ""))
    if not tabela:
        print("  Nenhum time/partida encontrado.")
        return
    print(f"  {'Pos':<4}{'Time':<20}{'Pts':<5}{'J':<4}{'V':<4}{'E':<4}{'D':<4}{'GP':<5}{'GC':<5}{'SG':<5}")
    for i, linha in enumerate(tabela, start=1):
        print(
            f"  {i:<4}{linha['nome']:<20}{linha['pontos']:<5}{linha['jogos']:<4}{linha['vitorias']:<4}"
            f"{linha['empates']:<4}{linha['derrotas']:<4}{linha['gols_pro']:<5}{linha['gols_contra']:<5}{linha['saldo_gols']:<5}"
        )


def _relatorio_confronto_direto(conn: sqlite3.Connection) -> None:
    print("Primeiro time:")
    time1 = _selecionar_time(conn, "Primeiro time")
    if not time1:
        return
    print("Segundo time:")
    time2 = _selecionar_time(conn, "Segundo time")
    if not time2:
        return
    if time1["id"] == time2["id"]:
        print("  > Escolha dois times diferentes.")
        return
    jogos = classificacao.confrontos_diretos(conn, time1["id"], time2["id"])
    _titulo(f"Confrontos: {time1['nome']} x {time2['nome']}")
    _listar_partidas_formatado(jogos)


# --------------------------------------------------------------------------
# Exportação
# --------------------------------------------------------------------------

def _menu_exportacao(conn: sqlite3.Connection) -> None:
    while True:
        _titulo("EXPORTAR RELATÓRIOS")
        print("[1] Exportar partidas (CSV)")
        print("[2] Exportar artilheiros (CSV)")
        print("[3] Exportar classificação (CSV)")
        print("[4] Exportar cartões (CSV)")
        print("[5] Exportar desempenho em pênaltis (CSV)")
        print("[6] Exportar classificação (PDF)")
        print("[7] Exportar artilheiros (PDF)")
        print("[0] Voltar")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=7)

        if opcao == 1:
            _exportar_partidas_csv(conn)
        elif opcao == 2:
            _exportar_artilheiros_csv(conn)
        elif opcao == 3:
            _exportar_classificacao_csv(conn)
        elif opcao == 4:
            _exportar_cartoes_csv(conn)
        elif opcao == 5:
            _exportar_penaltis_csv(conn)
        elif opcao == 6:
            _exportar_classificacao_pdf(conn)
        elif opcao == 7:
            _exportar_artilheiros_pdf(conn)
        elif opcao == 0:
            return
        _pausar()


def _exportar_partidas_csv(conn: sqlite3.Connection) -> None:
    lista = partidas.listar_partidas(conn)
    cabecalho = ["id", "data", "horario", "casa", "visitante", "placar_casa", "placar_visitante", "estadio", "fase", "grupo", "status"]
    linhas = [
        [p["id"], p["data"], p["horario"], p["time_casa_nome"], p["time_visitante_nome"],
         p["placar_casa"], p["placar_visitante"], p["estadio"], p["fase"], p["grupo"], p["status"]]
        for p in lista
    ]
    caminho = exportacao.exportar_csv(EXPORT_DIR / "partidas.csv", cabecalho, linhas)
    print(f"  > Exportado para {caminho}")


def _exportar_artilheiros_csv(conn: sqlite3.Connection) -> None:
    lista = relatorios.artilheiros(conn)
    cabecalho = ["jogador", "time", "gols"]
    linhas = [[a["jogador_nome"], a["time_nome"], a["gols"]] for a in lista]
    caminho = exportacao.exportar_csv(EXPORT_DIR / "artilheiros.csv", cabecalho, linhas)
    print(f"  > Exportado para {caminho}")


def _exportar_classificacao_csv(conn: sqlite3.Connection) -> None:
    tabela = classificacao.calcular_classificacao(conn)
    cabecalho = ["time", "grupo", "pontos", "jogos", "vitorias", "empates", "derrotas", "gols_pro", "gols_contra", "saldo_gols"]
    linhas = [
        [l["nome"], l["grupo"], l["pontos"], l["jogos"], l["vitorias"], l["empates"],
         l["derrotas"], l["gols_pro"], l["gols_contra"], l["saldo_gols"]]
        for l in tabela
    ]
    caminho = exportacao.exportar_csv(EXPORT_DIR / "classificacao.csv", cabecalho, linhas)
    print(f"  > Exportado para {caminho}")


def _exportar_cartoes_csv(conn: sqlite3.Connection) -> None:
    lista = relatorios.jogadores_mais_cartoes(conn)
    cabecalho = ["jogador", "time", "amarelos", "vermelhos", "total"]
    linhas = [[c["jogador_nome"], c["time_nome"], c["amarelos"], c["vermelhos"], c["total"]] for c in lista]
    caminho = exportacao.exportar_csv(EXPORT_DIR / "cartoes.csv", cabecalho, linhas)
    print(f"  > Exportado para {caminho}")


def _exportar_penaltis_csv(conn: sqlite3.Connection) -> None:
    lista = relatorios.desempenho_penaltis(conn)
    cabecalho = ["jogador", "time", "marcados", "convertidos", "perdidos", "aproveitamento_%"]
    linhas = [[p["jogador_nome"], p["time_nome"], p["marcados"], p["convertidos"], p["perdidos"], p["aproveitamento"]] for p in lista]
    caminho = exportacao.exportar_csv(EXPORT_DIR / "penaltis.csv", cabecalho, linhas)
    print(f"  > Exportado para {caminho}")


def _exportar_classificacao_pdf(conn: sqlite3.Connection) -> None:
    tabela = classificacao.calcular_classificacao(conn)
    cabecalho = ["Time", "Grupo", "Pts", "J", "V", "E", "D", "GP", "GC", "SG"]
    linhas = [
        [l["nome"], l["grupo"] or "-", l["pontos"], l["jogos"], l["vitorias"], l["empates"],
         l["derrotas"], l["gols_pro"], l["gols_contra"], l["saldo_gols"]]
        for l in tabela
    ]
    try:
        caminho = exportacao.exportar_pdf("Classificação", cabecalho, linhas, EXPORT_DIR / "classificacao.pdf")
        print(f"  > Exportado para {caminho}")
    except exportacao.PDFIndisponivelError as exc:
        print(f"  > {exc}")


def _exportar_artilheiros_pdf(conn: sqlite3.Connection) -> None:
    lista = relatorios.artilheiros(conn)
    cabecalho = ["Jogador", "Time", "Gols"]
    linhas = [[a["jogador_nome"], a["time_nome"], a["gols"]] for a in lista]
    try:
        caminho = exportacao.exportar_pdf("Artilheiros", cabecalho, linhas, EXPORT_DIR / "artilheiros.pdf")
        print(f"  > Exportado para {caminho}")
    except exportacao.PDFIndisponivelError as exc:
        print(f"  > {exc}")


# --------------------------------------------------------------------------
# Menu principal
# --------------------------------------------------------------------------

def menu_principal(conn: sqlite3.Connection) -> None:
    while True:
        _titulo("COPA DE FUTEBOL - MENU PRINCIPAL")
        print("[1] Times e jogadores")
        print("[2] Partidas")
        print("[3] Relatórios e consultas")
        print("[4] Exportar relatórios")
        print("[0] Sair")
        opcao = ler_inteiro("Escolha: ", minimo=0, maximo=4)

        if opcao == 1:
            _menu_times(conn)
        elif opcao == 2:
            _menu_partidas(conn)
        elif opcao == 3:
            _menu_relatorios(conn)
        elif opcao == 4:
            _menu_exportacao(conn)
        elif opcao == 0:
            print("Até a próxima!")
            return


def main() -> None:
    conn = database.get_connection()
    try:
        menu_principal(conn)
    except (KeyboardInterrupt, EOFError):
        print("\nSaindo...")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
