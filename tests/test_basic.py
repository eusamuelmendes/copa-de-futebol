"""Testes básicos do fluxo principal: cadastro, resultados e relatórios."""

import unittest

from copa_futebol import classificacao, database, partidas, relatorios, times


class TestFluxoCompleto(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = database.get_connection(":memory:")

    def tearDown(self) -> None:
        self.conn.close()

    def _preparar_partida_grupos(self):
        time_a = times.cadastrar_time(self.conn, "Time A", grupo="A")
        time_b = times.cadastrar_time(self.conn, "Time B", grupo="A")
        jogador_a = times.cadastrar_jogador(self.conn, "Jogador A1", time_a, numero=9)
        jogador_b = times.cadastrar_jogador(self.conn, "Jogador B1", time_b, numero=10)
        partida_id = partidas.cadastrar_partida(
            self.conn, "2026-06-15", "16:00", time_a, time_b, "Maracanã", fase="grupos", grupo="A"
        )
        return time_a, time_b, jogador_a, jogador_b, partida_id

    def test_cadastro_time_e_jogador(self):
        time_id = times.cadastrar_time(self.conn, "Brasil", grupo="A")
        jogador_id = times.cadastrar_jogador(self.conn, "Neymar", time_id, numero=10, posicao="Atacante")
        jogador = times.buscar_jogador_por_id(self.conn, jogador_id)
        self.assertEqual(jogador["nome"], "Neymar")
        self.assertEqual(jogador["time_nome"], "Brasil")

    def test_partida_nao_permite_mesmo_time(self):
        time_id = times.cadastrar_time(self.conn, "Brasil")
        with self.assertRaises(ValueError):
            partidas.cadastrar_partida(self.conn, "2026-06-15", "16:00", time_id, time_id, "Estádio")

    def test_gols_e_finalizacao_de_partida(self):
        time_a, time_b, jogador_a, jogador_b, partida_id = self._preparar_partida_grupos()

        partidas.registrar_gol(self.conn, partida_id, jogador_a, time_a, minuto=10)
        partidas.registrar_gol(self.conn, partida_id, jogador_a, time_a, minuto=45)
        # autogol do jogador do time B: o gol conta para o time A
        partidas.registrar_gol(self.conn, partida_id, jogador_b, time_a, minuto=60, autogol=True)
        partidas.registrar_gol(self.conn, partida_id, jogador_b, time_b, minuto=70)

        placar_casa, placar_visitante = partidas.finalizar_partida(self.conn, partida_id)
        self.assertEqual((placar_casa, placar_visitante), (3, 1))

        artilheiros = relatorios.artilheiros(self.conn)
        gols_por_jogador = {a["jogador_nome"]: a["gols"] for a in artilheiros}
        self.assertEqual(gols_por_jogador["Jogador A1"], 2)
        # o autogol não deve ser contado no total de gols de Jogador B1, só o gol normal
        self.assertEqual(gols_por_jogador["Jogador B1"], 1)

    def test_cartoes_e_penaltis(self):
        time_a, time_b, jogador_a, jogador_b, partida_id = self._preparar_partida_grupos()

        partidas.registrar_cartao(self.conn, partida_id, jogador_a, "amarelo", 20, "falta dura")
        partidas.registrar_cartao(self.conn, partida_id, jogador_a, "amarelo", 55, "reincidência")
        partidas.registrar_penalti(self.conn, partida_id, jogador_b, time_b, "convertido", minuto=30)
        partidas.registrar_penalti(self.conn, partida_id, jogador_a, time_a, "perdido", minuto=80)

        cartoes = relatorios.jogadores_mais_cartoes(self.conn)
        self.assertEqual(cartoes[0]["jogador_nome"], "Jogador A1")
        self.assertEqual(cartoes[0]["amarelos"], 2)

        penaltis_stats = relatorios.desempenho_penaltis(self.conn)
        stats_por_nome = {p["jogador_nome"]: p for p in penaltis_stats}
        self.assertEqual(stats_por_nome["Jogador B1"]["convertidos"], 1)
        self.assertEqual(stats_por_nome["Jogador A1"]["perdidos"], 1)

    def test_classificacao_pontuacao(self):
        time_a, time_b, jogador_a, jogador_b, partida_id = self._preparar_partida_grupos()
        partidas.registrar_gol(self.conn, partida_id, jogador_a, time_a, minuto=10)
        partidas.registrar_gol(self.conn, partida_id, jogador_a, time_a, minuto=20)
        partidas.finalizar_partida(self.conn, partida_id)

        tabela = classificacao.calcular_classificacao(self.conn, grupo="A")
        self.assertEqual(tabela[0]["nome"], "Time A")
        self.assertEqual(tabela[0]["pontos"], 3)
        self.assertEqual(tabela[1]["pontos"], 0)

    def test_proximas_partidas_e_confrontos_diretos(self):
        time_a, time_b, jogador_a, jogador_b, partida_id = self._preparar_partida_grupos()
        proximas = relatorios.proximas_partidas(self.conn)
        self.assertEqual(len(proximas), 1)

        confrontos = classificacao.confrontos_diretos(self.conn, time_a, time_b)
        self.assertEqual(len(confrontos), 1)


if __name__ == "__main__":
    unittest.main()
