"""Camada de persistência: conexão SQLite e criação do schema do banco."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "copa.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    grupo TEXT
);

CREATE TABLE IF NOT EXISTS jogadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    time_id INTEGER NOT NULL,
    numero INTEGER,
    posicao TEXT,
    FOREIGN KEY (time_id) REFERENCES times (id),
    UNIQUE (nome, time_id)
);

CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    time_casa_id INTEGER NOT NULL,
    time_visitante_id INTEGER NOT NULL,
    estadio TEXT NOT NULL,
    fase TEXT NOT NULL DEFAULT 'grupos',
    grupo TEXT,
    placar_casa INTEGER,
    placar_visitante INTEGER,
    penaltis_casa INTEGER,
    penaltis_visitante INTEGER,
    status TEXT NOT NULL DEFAULT 'agendada',
    FOREIGN KEY (time_casa_id) REFERENCES times (id),
    FOREIGN KEY (time_visitante_id) REFERENCES times (id)
);

CREATE TABLE IF NOT EXISTS gols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL,
    jogador_id INTEGER NOT NULL,
    time_beneficiado_id INTEGER NOT NULL,
    minuto INTEGER NOT NULL,
    autogol INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (partida_id) REFERENCES partidas (id),
    FOREIGN KEY (jogador_id) REFERENCES jogadores (id),
    FOREIGN KEY (time_beneficiado_id) REFERENCES times (id)
);

CREATE TABLE IF NOT EXISTS cartoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL,
    jogador_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    minuto INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (partida_id) REFERENCES partidas (id),
    FOREIGN KEY (jogador_id) REFERENCES jogadores (id)
);

CREATE TABLE IF NOT EXISTS penaltis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL,
    jogador_id INTEGER NOT NULL,
    time_id INTEGER NOT NULL,
    minuto INTEGER,
    resultado TEXT NOT NULL,
    contexto TEXT NOT NULL DEFAULT 'jogo',
    FOREIGN KEY (partida_id) REFERENCES partidas (id),
    FOREIGN KEY (jogador_id) REFERENCES jogadores (id),
    FOREIGN KEY (time_id) REFERENCES times (id)
);
"""


def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Abre (e cria, se necessário) a conexão com o banco de dados."""
    path = Path(db_path) if db_path else DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Cria as tabelas do schema caso ainda não existam."""
    conn.executescript(SCHEMA)
    conn.commit()
