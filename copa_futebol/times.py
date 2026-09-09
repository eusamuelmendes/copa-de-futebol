"""Cadastro e consulta de times e jogadores."""

import sqlite3


def cadastrar_time(conn: sqlite3.Connection, nome: str, grupo: str | None = None) -> int:
    cursor = conn.execute(
        "INSERT INTO times (nome, grupo) VALUES (?, ?)",
        (nome, grupo or None),
    )
    conn.commit()
    return cursor.lastrowid


def listar_times(conn: sqlite3.Connection, grupo: str | None = None) -> list[sqlite3.Row]:
    if grupo:
        return conn.execute(
            "SELECT * FROM times WHERE grupo = ? ORDER BY nome", (grupo,)
        ).fetchall()
    return conn.execute("SELECT * FROM times ORDER BY nome").fetchall()


def buscar_time_por_id(conn: sqlite3.Connection, time_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM times WHERE id = ?", (time_id,)).fetchone()


def buscar_time_por_nome(conn: sqlite3.Connection, nome: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM times WHERE nome = ? COLLATE NOCASE", (nome,)
    ).fetchone()


def listar_grupos(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT grupo FROM times WHERE grupo IS NOT NULL ORDER BY grupo"
    ).fetchall()
    return [r["grupo"] for r in rows]


def cadastrar_jogador(
    conn: sqlite3.Connection,
    nome: str,
    time_id: int,
    numero: int | None = None,
    posicao: str | None = None,
) -> int:
    cursor = conn.execute(
        "INSERT INTO jogadores (nome, time_id, numero, posicao) VALUES (?, ?, ?, ?)",
        (nome, time_id, numero, posicao or None),
    )
    conn.commit()
    return cursor.lastrowid


def listar_jogadores(conn: sqlite3.Connection, time_id: int | None = None) -> list[sqlite3.Row]:
    if time_id:
        return conn.execute(
            "SELECT * FROM jogadores WHERE time_id = ? ORDER BY nome", (time_id,)
        ).fetchall()
    return conn.execute(
        """
        SELECT jogadores.*, times.nome AS time_nome
        FROM jogadores
        JOIN times ON times.id = jogadores.time_id
        ORDER BY times.nome, jogadores.nome
        """
    ).fetchall()


def buscar_jogador_por_id(conn: sqlite3.Connection, jogador_id: int) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT jogadores.*, times.nome AS time_nome
        FROM jogadores
        JOIN times ON times.id = jogadores.time_id
        WHERE jogadores.id = ?
        """,
        (jogador_id,),
    ).fetchone()
