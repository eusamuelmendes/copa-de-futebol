"""Classificação da fase de grupos e histórico de confrontos diretos."""

import sqlite3

PONTOS_VITORIA = 3
PONTOS_EMPATE = 1
PONTOS_DERROTA = 0


def calcular_classificacao(conn: sqlite3.Connection, grupo: str | None = None) -> list[dict]:
    """Calcula a tabela de classificação considerando apenas partidas da fase de grupos já encerradas."""
    query = """
        SELECT partidas.*, casa.nome AS time_casa_nome, visitante.nome AS time_visitante_nome
        FROM partidas
        JOIN times AS casa ON casa.id = partidas.time_casa_id
        JOIN times AS visitante ON visitante.id = partidas.time_visitante_id
        WHERE partidas.fase = 'grupos' AND partidas.status = 'encerrada'
    """
    params: list = []
    if grupo:
        query += " AND partidas.grupo = ?"
        params.append(grupo)
    partidas = conn.execute(query, params).fetchall()

    times = {t["id"]: t for t in conn.execute(
        "SELECT * FROM times" + (" WHERE grupo = ?" if grupo else ""),
        [grupo] if grupo else [],
    ).fetchall()}

    tabela: dict[int, dict] = {
        time_id: {
            "time_id": time_id,
            "nome": time["nome"],
            "grupo": time["grupo"],
            "jogos": 0,
            "vitorias": 0,
            "empates": 0,
            "derrotas": 0,
            "gols_pro": 0,
            "gols_contra": 0,
            "saldo_gols": 0,
            "pontos": 0,
        }
        for time_id, time in times.items()
    }

    for p in partidas:
        casa_id, visitante_id = p["time_casa_id"], p["time_visitante_id"]
        gp_casa, gp_visitante = p["placar_casa"], p["placar_visitante"]
        for time_id in (casa_id, visitante_id):
            if time_id not in tabela:
                tabela[time_id] = {
                    "time_id": time_id,
                    "nome": p["time_casa_nome"] if time_id == casa_id else p["time_visitante_nome"],
                    "grupo": p["grupo"],
                    "jogos": 0,
                    "vitorias": 0,
                    "empates": 0,
                    "derrotas": 0,
                    "gols_pro": 0,
                    "gols_contra": 0,
                    "saldo_gols": 0,
                    "pontos": 0,
                }

        tabela[casa_id]["jogos"] += 1
        tabela[visitante_id]["jogos"] += 1
        tabela[casa_id]["gols_pro"] += gp_casa
        tabela[casa_id]["gols_contra"] += gp_visitante
        tabela[visitante_id]["gols_pro"] += gp_visitante
        tabela[visitante_id]["gols_contra"] += gp_casa

        if gp_casa > gp_visitante:
            tabela[casa_id]["vitorias"] += 1
            tabela[casa_id]["pontos"] += PONTOS_VITORIA
            tabela[visitante_id]["derrotas"] += 1
            tabela[visitante_id]["pontos"] += PONTOS_DERROTA
        elif gp_casa < gp_visitante:
            tabela[visitante_id]["vitorias"] += 1
            tabela[visitante_id]["pontos"] += PONTOS_VITORIA
            tabela[casa_id]["derrotas"] += 1
            tabela[casa_id]["pontos"] += PONTOS_DERROTA
        else:
            tabela[casa_id]["empates"] += 1
            tabela[visitante_id]["empates"] += 1
            tabela[casa_id]["pontos"] += PONTOS_EMPATE
            tabela[visitante_id]["pontos"] += PONTOS_EMPATE

    for linha in tabela.values():
        linha["saldo_gols"] = linha["gols_pro"] - linha["gols_contra"]

    return sorted(
        tabela.values(),
        key=lambda l: (-l["pontos"], -l["saldo_gols"], -l["gols_pro"], l["nome"]),
    )


def confrontos_diretos(conn: sqlite3.Connection, time1_id: int, time2_id: int) -> list[sqlite3.Row]:
    """Retorna todas as partidas (encerradas ou agendadas) entre dois times."""
    return conn.execute(
        """
        SELECT partidas.*, casa.nome AS time_casa_nome, visitante.nome AS time_visitante_nome
        FROM partidas
        JOIN times AS casa ON casa.id = partidas.time_casa_id
        JOIN times AS visitante ON visitante.id = partidas.time_visitante_id
        WHERE (partidas.time_casa_id = ? AND partidas.time_visitante_id = ?)
           OR (partidas.time_casa_id = ? AND partidas.time_visitante_id = ?)
        ORDER BY partidas.data, partidas.horario
        """,
        (time1_id, time2_id, time2_id, time1_id),
    ).fetchall()
