"""Relatórios e consultas: histórico, estatísticas, artilheiros, cartões e pênaltis."""

import sqlite3

from . import partidas as partidas_mod


def historico_partidas(
    conn: sqlite3.Connection,
    time_id: int | None = None,
    fase: str | None = None,
    status: str | None = None,
) -> list[sqlite3.Row]:
    return partidas_mod.listar_partidas(conn, status=status, fase=fase, time_id=time_id)


def proximas_partidas(
    conn: sqlite3.Connection, time_id: int | None = None, limite: int | None = None
) -> list[sqlite3.Row]:
    jogos = partidas_mod.listar_partidas(conn, status="agendada", time_id=time_id)
    return jogos[:limite] if limite else jogos


def estatisticas_time(conn: sqlite3.Connection, time_id: int) -> dict:
    encerradas = [
        p for p in partidas_mod.listar_partidas(conn, status="encerrada", time_id=time_id)
    ]
    vitorias = empates = derrotas = gols_pro = gols_contra = 0
    for p in encerradas:
        em_casa = p["time_casa_id"] == time_id
        gp = p["placar_casa"] if em_casa else p["placar_visitante"]
        gc = p["placar_visitante"] if em_casa else p["placar_casa"]
        gols_pro += gp
        gols_contra += gc
        if gp > gc:
            vitorias += 1
        elif gp < gc:
            derrotas += 1
        else:
            empates += 1

    amarelos = conn.execute(
        """
        SELECT COUNT(*) AS total FROM cartoes
        JOIN jogadores ON jogadores.id = cartoes.jogador_id
        WHERE jogadores.time_id = ? AND cartoes.tipo = 'amarelo'
        """,
        (time_id,),
    ).fetchone()["total"]
    vermelhos = conn.execute(
        """
        SELECT COUNT(*) AS total FROM cartoes
        JOIN jogadores ON jogadores.id = cartoes.jogador_id
        WHERE jogadores.time_id = ? AND cartoes.tipo = 'vermelho'
        """,
        (time_id,),
    ).fetchone()["total"]

    penaltis = conn.execute(
        """
        SELECT resultado, COUNT(*) AS total FROM penaltis
        WHERE time_id = ? GROUP BY resultado
        """,
        (time_id,),
    ).fetchall()
    penaltis_convertidos = next((p["total"] for p in penaltis if p["resultado"] == "convertido"), 0)
    penaltis_perdidos = next((p["total"] for p in penaltis if p["resultado"] == "perdido"), 0)

    return {
        "jogos": len(encerradas),
        "vitorias": vitorias,
        "empates": empates,
        "derrotas": derrotas,
        "gols_pro": gols_pro,
        "gols_contra": gols_contra,
        "saldo_gols": gols_pro - gols_contra,
        "pontos": vitorias * 3 + empates,
        "cartoes_amarelos": amarelos,
        "cartoes_vermelhos": vermelhos,
        "penaltis_marcados": penaltis_convertidos + penaltis_perdidos,
        "penaltis_convertidos": penaltis_convertidos,
        "penaltis_perdidos": penaltis_perdidos,
    }


def artilheiros(conn: sqlite3.Connection, limite: int | None = None) -> list[sqlite3.Row]:
    query = """
        SELECT jogadores.id AS jogador_id, jogadores.nome AS jogador_nome,
               times.nome AS time_nome, COUNT(*) AS gols
        FROM gols
        JOIN jogadores ON jogadores.id = gols.jogador_id
        JOIN times ON times.id = jogadores.time_id
        WHERE gols.autogol = 0
        GROUP BY jogadores.id
        ORDER BY gols DESC, jogadores.nome
    """
    rows = conn.execute(query).fetchall()
    return rows[:limite] if limite else rows


def jogadores_mais_cartoes(conn: sqlite3.Connection, tipo: str | None = None) -> list[sqlite3.Row]:
    query = """
        SELECT jogadores.id AS jogador_id, jogadores.nome AS jogador_nome, times.nome AS time_nome,
               SUM(CASE WHEN cartoes.tipo = 'amarelo' THEN 1 ELSE 0 END) AS amarelos,
               SUM(CASE WHEN cartoes.tipo = 'vermelho' THEN 1 ELSE 0 END) AS vermelhos,
               COUNT(*) AS total
        FROM cartoes
        JOIN jogadores ON jogadores.id = cartoes.jogador_id
        JOIN times ON times.id = jogadores.time_id
    """
    params: list = []
    if tipo:
        query += " WHERE cartoes.tipo = ?"
        params.append(tipo)
    query += " GROUP BY jogadores.id ORDER BY total DESC, vermelhos DESC, jogadores.nome"
    return conn.execute(query, params).fetchall()


def desempenho_penaltis(conn: sqlite3.Connection, jogador_id: int | None = None) -> list[sqlite3.Row]:
    query = """
        SELECT jogadores.id AS jogador_id, jogadores.nome AS jogador_nome, times.nome AS time_nome,
               COUNT(*) AS marcados,
               SUM(CASE WHEN penaltis.resultado = 'convertido' THEN 1 ELSE 0 END) AS convertidos,
               SUM(CASE WHEN penaltis.resultado = 'perdido' THEN 1 ELSE 0 END) AS perdidos
        FROM penaltis
        JOIN jogadores ON jogadores.id = penaltis.jogador_id
        JOIN times ON times.id = jogadores.time_id
    """
    params: list = []
    if jogador_id:
        query += " WHERE penaltis.jogador_id = ?"
        params.append(jogador_id)
    query += " GROUP BY jogadores.id ORDER BY convertidos DESC, jogadores.nome"
    rows = conn.execute(query, params).fetchall()
    resultado = []
    for r in rows:
        d = dict(r)
        d["aproveitamento"] = round(100 * d["convertidos"] / d["marcados"], 1) if d["marcados"] else 0.0
        resultado.append(d)
    return resultado
