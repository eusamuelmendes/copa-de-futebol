"""Cadastro de partidas e lançamento de eventos: gols, cartões e pênaltis."""

import sqlite3

FASES = ["grupos", "oitavas", "quartas", "semifinal", "terceiro_lugar", "final"]
TIPOS_CARTAO = ["amarelo", "vermelho"]
RESULTADOS_PENALTI = ["convertido", "perdido"]
CONTEXTOS_PENALTI = ["jogo", "disputa"]


def cadastrar_partida(
    conn: sqlite3.Connection,
    data: str,
    horario: str,
    time_casa_id: int,
    time_visitante_id: int,
    estadio: str,
    fase: str = "grupos",
    grupo: str | None = None,
) -> int:
    if time_casa_id == time_visitante_id:
        raise ValueError("O time da casa e o visitante não podem ser o mesmo.")
    cursor = conn.execute(
        """
        INSERT INTO partidas (data, horario, time_casa_id, time_visitante_id, estadio, fase, grupo, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'agendada')
        """,
        (data, horario, time_casa_id, time_visitante_id, estadio, fase, grupo),
    )
    conn.commit()
    return cursor.lastrowid


_PARTIDA_SELECT = """
    SELECT partidas.*,
           casa.nome AS time_casa_nome,
           visitante.nome AS time_visitante_nome
    FROM partidas
    JOIN times AS casa ON casa.id = partidas.time_casa_id
    JOIN times AS visitante ON visitante.id = partidas.time_visitante_id
"""


def listar_partidas(
    conn: sqlite3.Connection,
    status: str | None = None,
    fase: str | None = None,
    grupo: str | None = None,
    time_id: int | None = None,
) -> list[sqlite3.Row]:
    condicoes = []
    params: list = []
    if status:
        condicoes.append("partidas.status = ?")
        params.append(status)
    if fase:
        condicoes.append("partidas.fase = ?")
        params.append(fase)
    if grupo:
        condicoes.append("partidas.grupo = ?")
        params.append(grupo)
    if time_id:
        condicoes.append("(partidas.time_casa_id = ? OR partidas.time_visitante_id = ?)")
        params.extend([time_id, time_id])
    query = _PARTIDA_SELECT
    if condicoes:
        query += " WHERE " + " AND ".join(condicoes)
    query += " ORDER BY partidas.data, partidas.horario"
    return conn.execute(query, params).fetchall()


def buscar_partida(conn: sqlite3.Connection, partida_id: int) -> sqlite3.Row | None:
    return conn.execute(
        _PARTIDA_SELECT + " WHERE partidas.id = ?", (partida_id,)
    ).fetchone()


def registrar_gol(
    conn: sqlite3.Connection,
    partida_id: int,
    jogador_id: int,
    time_beneficiado_id: int,
    minuto: int,
    autogol: bool = False,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO gols (partida_id, jogador_id, time_beneficiado_id, minuto, autogol)
        VALUES (?, ?, ?, ?, ?)
        """,
        (partida_id, jogador_id, time_beneficiado_id, minuto, int(autogol)),
    )
    conn.commit()
    return cursor.lastrowid


def listar_gols(conn: sqlite3.Connection, partida_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT gols.*, jogadores.nome AS jogador_nome, times.nome AS time_beneficiado_nome
        FROM gols
        JOIN jogadores ON jogadores.id = gols.jogador_id
        JOIN times ON times.id = gols.time_beneficiado_id
        WHERE gols.partida_id = ?
        ORDER BY gols.minuto
        """,
        (partida_id,),
    ).fetchall()


def registrar_cartao(
    conn: sqlite3.Connection,
    partida_id: int,
    jogador_id: int,
    tipo: str,
    minuto: int,
    motivo: str | None = None,
) -> int:
    if tipo not in TIPOS_CARTAO:
        raise ValueError(f"Tipo de cartão inválido: {tipo}")
    cursor = conn.execute(
        """
        INSERT INTO cartoes (partida_id, jogador_id, tipo, minuto, motivo)
        VALUES (?, ?, ?, ?, ?)
        """,
        (partida_id, jogador_id, tipo, minuto, motivo or None),
    )
    conn.commit()
    return cursor.lastrowid


def listar_cartoes(conn: sqlite3.Connection, partida_id: int | None = None) -> list[sqlite3.Row]:
    query = """
        SELECT cartoes.*, jogadores.nome AS jogador_nome, times.nome AS time_nome
        FROM cartoes
        JOIN jogadores ON jogadores.id = cartoes.jogador_id
        JOIN times ON times.id = jogadores.time_id
    """
    params: list = []
    if partida_id:
        query += " WHERE cartoes.partida_id = ?"
        params.append(partida_id)
    query += " ORDER BY cartoes.minuto"
    return conn.execute(query, params).fetchall()


def registrar_penalti(
    conn: sqlite3.Connection,
    partida_id: int,
    jogador_id: int,
    time_id: int,
    resultado: str,
    minuto: int | None = None,
    contexto: str = "jogo",
) -> int:
    if resultado not in RESULTADOS_PENALTI:
        raise ValueError(f"Resultado de pênalti inválido: {resultado}")
    if contexto not in CONTEXTOS_PENALTI:
        raise ValueError(f"Contexto de pênalti inválido: {contexto}")
    cursor = conn.execute(
        """
        INSERT INTO penaltis (partida_id, jogador_id, time_id, minuto, resultado, contexto)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (partida_id, jogador_id, time_id, minuto, resultado, contexto),
    )
    conn.commit()
    return cursor.lastrowid


def listar_penaltis(conn: sqlite3.Connection, partida_id: int | None = None) -> list[sqlite3.Row]:
    query = """
        SELECT penaltis.*, jogadores.nome AS jogador_nome, times.nome AS time_nome
        FROM penaltis
        JOIN jogadores ON jogadores.id = penaltis.jogador_id
        JOIN times ON times.id = penaltis.time_id
    """
    params: list = []
    if partida_id:
        query += " WHERE penaltis.partida_id = ?"
        params.append(partida_id)
    query += " ORDER BY penaltis.id"
    return conn.execute(query, params).fetchall()


def registrar_disputa_penaltis(
    conn: sqlite3.Connection, partida_id: int, penaltis_casa: int, penaltis_visitante: int
) -> None:
    conn.execute(
        "UPDATE partidas SET penaltis_casa = ?, penaltis_visitante = ? WHERE id = ?",
        (penaltis_casa, penaltis_visitante, partida_id),
    )
    conn.commit()


def finalizar_partida(conn: sqlite3.Connection, partida_id: int) -> tuple[int, int]:
    """Calcula o placar a partir dos gols lançados e marca a partida como encerrada."""
    placar_casa = conn.execute(
        """
        SELECT COUNT(*) AS total FROM gols
        JOIN partidas ON partidas.id = gols.partida_id
        WHERE gols.partida_id = ? AND gols.time_beneficiado_id = partidas.time_casa_id
        """,
        (partida_id,),
    ).fetchone()["total"]
    placar_visitante = conn.execute(
        """
        SELECT COUNT(*) AS total FROM gols
        JOIN partidas ON partidas.id = gols.partida_id
        WHERE gols.partida_id = ? AND gols.time_beneficiado_id = partidas.time_visitante_id
        """,
        (partida_id,),
    ).fetchone()["total"]
    conn.execute(
        "UPDATE partidas SET placar_casa = ?, placar_visitante = ?, status = 'encerrada' WHERE id = ?",
        (placar_casa, placar_visitante, partida_id),
    )
    conn.commit()
    return placar_casa, placar_visitante


def reabrir_partida(conn: sqlite3.Connection, partida_id: int) -> None:
    conn.execute("UPDATE partidas SET status = 'agendada' WHERE id = ?", (partida_id,))
    conn.commit()
