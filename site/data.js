// data.js — camada de dados da Copa SBT Energisa 2026.
// Busca as abas da planilha publicada, deriva tudo que o template precisa,
// mantém cache local e faz polling adaptativo. Não depende do dc-runtime.
(function (global) {
  "use strict";

  var SHEET_ID = "1dK_PoKQnyEtfVPNbBkd9kx_J-CXYO7nz2tvTwyNbCsM";
  var SHEET_NAMES = [
    "Config", "Times", "Jogadores", "Jogos", "Gols",
    "Cartões", "Substituições", "Estatísticas", "Notícias", "Mídia", "Classificação", "Páginas"
  ];
  // URL do Google Apps Script (Web App) que escreve de volta a coluna
  // "ValidacaoErro" na aba Jogos. Vazio por padrão: a validação continua
  // funcionando (linhas inválidas somem do site) mesmo sem isso configurado —
  // só a escrita de volta na planilha fica desligada. Veja
  // apps-script-validacao.gs para o código a colar em Extensões > Apps Script.
  var VALIDATION_WEBHOOK_URL = "";
  var LS_KEY = "cse2026:last-good-data:v1";
  var POLL_LIVE_MS = 30000;
  var POLL_IDLE_MS = 180000;
  var CLOCK_TICK_MS = 15000;
  var SNAPSHOT_WINDOW_MS = 6 * 60 * 1000; // guarda 6min de histórico p/ o delay anti-spoiler

  function pad2(n) {
    n = Number(n);
    return (n < 10 ? "0" : "") + n;
  }

  // ---- gviz: busca + parsing -------------------------------------------------

  function gvizUrl(sheetName) {
    var base = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq";
    var qs = "tqx=" + encodeURIComponent("out:json") +
      "&sheet=" + encodeURIComponent(sheetName) +
      "&headers=1" +
      "&_=" + Date.now();
    return base + "?" + qs;
  }

  // Células de data/hora do gviz vêm como o literal JS `Date(y,m,d[,h,mi,s])`,
  // que não é JSON válido. Convertemos para string antes do JSON.parse.
  // Base 1899-12-30 é como o Sheets marca um valor "só hora" (sem data real).
  function sanitizeGvizDates(text) {
    return text.replace(
      /Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/g,
      function (_, y, mo, d, h, mi, s) {
        y = Number(y); mo = Number(mo); d = Number(d);
        var isTimeOnly = y === 1899 && mo === 11 && d === 30;
        if (isTimeOnly && h !== undefined) {
          return '"' + pad2(h) + ":" + pad2(mi) + ":" + pad2(s) + '"';
        }
        var mm = pad2(mo + 1), dd = pad2(d);
        if (h === undefined) return '"' + y + "-" + mm + "-" + dd + '"';
        return '"' + y + "-" + mm + "-" + dd + " " + pad2(h) + ":" + pad2(mi) + '"';
      }
    );
  }

  function parseGvizResponse(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("resposta inesperada do Google Sheets");
    }
    var safe = sanitizeGvizDates(text.slice(start, end + 1));
    var json = JSON.parse(safe);
    if (json.status === "error") {
      var detail = (json.errors && json.errors[0] && json.errors[0].detailed_message) || "erro desconhecido";
      throw new Error(detail);
    }
    // O gviz devolve uma coluna para TODA a largura da grade, não só para as
    // colunas preenchidas: as vazias do fim vêm sem label, sobrando só o id
    // (a LETRA da coluna). Usar essa letra como chave colide com cabeçalhos de
    // uma letra só — numa aba com "P" (16ª letra) e "V" (22ª), a coluna vazia P
    // apagava os pontos e a V apagava as vitórias, silenciosamente. Por isso o
    // nome do cabeçalho sempre ganha da letra, e nada sobrescreve uma chave já
    // ocupada.
    var meta = (json.table.cols || []).map(function (c, i) {
      return { label: str(c.label), id: str(c.id) || ("col" + i) };
    });
    var byLabel = {};
    meta.forEach(function (c) { if (c.label) byLabel[c.label] = true; });
    var used = {};
    var cols = meta.map(function (c) {
      var key = c.label || (byLabel[c.id] ? "" : c.id);
      if (!key || used[key]) return "";
      used[key] = true;
      return key;
    });
    var rows = (json.table.rows || []).map(function (r) {
      var obj = {};
      (r.c || []).forEach(function (cell, i) {
        var key = cols[i];
        if (!key) return;
        if (!cell) { obj[key] = null; return; }
        obj[key] = cell.v === undefined ? null : cell.v;
      });
      return obj;
    });
    return rows;
  }

  function fetchSheet(name) {
    return fetch(gvizUrl(name), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " lendo a aba " + name);
      return res.text();
    }).then(parseGvizResponse);
  }

  function fetchAllSheets() {
    return Promise.all(SHEET_NAMES.map(fetchSheet)).then(function (results) {
      var out = {};
      SHEET_NAMES.forEach(function (name, i) { out[name] = results[i]; });
      return out;
    });
  }

  // ---- helpers de valor -------------------------------------------------

  function str(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  // Hora/Inicio1T/Inicio2T só usam HH:MM — o valor pode chegar como
  // "19:30" (texto puro) ou "19:30:00" (célula formatada como hora, agora
  // que sanitizeGvizDates preserva os segundos); em ambos os casos usamos
  // só a parte HH:MM.
  function hhmm(v) {
    var s = str(v);
    var m = s.match(/^(\d{1,2}:\d{2})/);
    return m ? m[1] : s;
  }
  function num(v, fallback) {
    if (v === null || v === undefined || v === "") return fallback === undefined ? 0 : fallback;
    var n = Number(v);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  }
  function bool(v) {
    var s = str(v).toLowerCase();
    return s === "sim" || s === "true" || s === "1" || s === "yes" || s === "x";
  }
  function initials(name) {
    // separa por espaço E por barra ("PARCERIA/CONFIANÇA" -> PC, não P/C)
    var parts = str(name).split(/[\s/]+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function hexToRgb(hex) {
    hex = str(hex).replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
  function shade(hex, amt) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(c * amt))); };
    return "rgb(" + f(rgb.r) + "," + f(rgb.g) + "," + f(rgb.b) + ")";
  }
  // Um link de "compartilhar" do Google Drive (.../file/d/ID/view ou
  // ...?id=ID) não é uma URL de imagem direta — abre uma página do Drive, não
  // os bytes da foto — então falharia sempre como background-image. Convertida
  // pro endpoint de thumbnail do Drive, funciona direto.
  function normalizeDriveImageUrl(url) {
    var s = str(url);
    if (!s || !/drive\.google\.com/.test(s)) return s;
    var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1000" : s;
  }

  var FALLBACK_HEX = "#3FA9FF";
  function teamGradient(hex) {
    var base = /^#[0-9a-fA-F]{3,6}$/.test(str(hex)) ? str(hex) : FALLBACK_HEX;
    return "linear-gradient(140deg," + base + "," + shade(base, 0.42) + ")";
  }

  // ---- validação da aba Jogos ------------------------------------------------
  // Linha que falhar aqui é descartada por completo (não aparece no site, não
  // entra em nenhum totalizador) e some do console; o erro exato é reportado
  // de volta pra planilha via reportValidationErrors(), pra quem edita a
  // planilha ver na hora sem precisar abrir o site pra descobrir o que quebrou.
  var STATUS_VALIDOS = ["Agendado", "Ao vivo", "Intervalo", "Encerrado", "Adiado", "WO"];
  var RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  var RE_HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;

  function isValidCalendarDate(s) {
    if (!RE_DATA.test(s)) return false;
    var y = Number(s.slice(0, 4)), mo = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    if (mo < 1 || mo > 12) return false;
    var dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  }
  function isIntOrEmpty(v) {
    var s = str(v);
    return s === "" || /^-?\d+$/.test(s);
  }

  // Retorna null se a linha for válida, ou uma string com o campo que falhou.
  function validateJogoRow(r, timeById) {
    var timeCasaId = str(r["TimeCasaID"]);
    var timeForaId = str(r["TimeForaID"]);
    var data = str(r["Data"]);
    var hora = hhmm(r["Hora"]);
    var status = str(r["Status"]);

    if (!timeCasaId) return "TimeCasaID vazio";
    if (!timeById[timeCasaId]) return "TimeCasaID não encontrado: " + timeCasaId;
    if (!timeForaId) return "TimeForaID vazio";
    if (!timeById[timeForaId]) return "TimeForaID não encontrado: " + timeForaId;
    if (!data) return "Data vazia";
    if (!isValidCalendarDate(data)) return "Data inválida (use AAAA-MM-DD): " + data;
    if (!hora) return "Hora vazia";
    if (!RE_HORA.test(hora)) return "Hora inválida (use HH:MM): " + hora;
    if (status && STATUS_VALIDOS.indexOf(status) === -1) return "Status inválido: " + status;
    if (!isIntOrEmpty(r["GolsCasa"])) return "Placar de casa inválido: " + str(r["GolsCasa"]);
    if (!isIntOrEmpty(r["GolsFora"])) return "Placar visitante inválido: " + str(r["GolsFora"]);
    return null;
  }

  // Fire-and-forget: manda pro Apps Script o estado de validação de cada
  // linha (erro "" quando ficou válida) pra ele escrever/limpar a coluna
  // ValidacaoErro. Nunca bloqueia nem quebra o carregamento do site.
  function reportValidationErrors(rows) {
    if (!VALIDATION_WEBHOOK_URL || !rows || !rows.length) return;
    try {
      fetch(VALIDATION_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ rows: rows })
      }).catch(function () { /* best-effort, ignora falha de rede */ });
    } catch (e) { /* ambiente sem fetch/CORS liberado: ignora */ }
  }

  // ---- parse de config ----------------------------------------------------

  function parseConfig(rows) {
    var byKey = {};
    rows.forEach(function (r) {
      var k = str(r["Chave"]);
      if (k) byKey[k] = r["Valor"];
    });
    return {
      nomeCampeonato: str(byKey["nome_campeonato"]) || "Copa",
      temporada: str(byKey["temporada"]),
      pontosVitoria: num(byKey["pontos_vitoria"], 3),
      pontosEmpate: num(byKey["pontos_empate"], 1),
      pontosDerrota: num(byKey["pontos_derrota"], 0),
      timesClassificados: num(byKey["times_classificados"], 4),
      duracaoTempoMin: num(byKey["duracao_tempo_min"], 45),
      delayTransmissaoSeg: num(byKey["delay_transmissao_seg"], 30),
      radioUrlPadrao: str(byKey["radio_url_padrao"]),
      mensagemTopo: str(byKey["mensagem_topo"])
    };
  }

  // ---- data/hora ------------------------------------------------------------

  // "HH:MM" (ou já sanitizado assim vindo do gviz) + uma data-base "AAAA-MM-DD"
  // -> Date local. Retorna null se qualquer parte estiver vazia/inválida.
  function combineDateTime(dateStr, timeStr) {
    var d = str(dateStr), t = str(timeStr);
    if (!d || !t) return null; // hora ausente = fase ainda não começou, não é meia-noite
    var dm = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dm) return null;
    var tm = t.match(/^(\d{1,2}):(\d{2})/);
    if (!tm) return null;
    return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0);
  }

  function minutesBetween(from, to) {
    if (!from || !to) return null;
    return Math.floor((to.getTime() - from.getTime()) / 60000);
  }

  // ---- normalização das abas ------------------------------------------------

  function normalize(raw) {
    var config = parseConfig(raw["Config"] || []);

    var times = (raw["Times"] || [])
      .filter(function (r) { return str(r["TimeID"]) && str(r["Nome"]); })
      .map(function (r) {
        return {
          id: str(r["TimeID"]),
          nome: str(r["Nome"]),
          cidade: str(r["Cidade"]),
          setor: str(r["Setor"]),
          grupo: str(r["Grupo"]),
          corHex: /^#[0-9a-fA-F]{3,6}$/.test(str(r["CorHex"])) ? str(r["CorHex"]) : FALLBACK_HEX,
          escudo: normalizeDriveImageUrl(str(r["Escudo (URL)"]) || str(r["Escudo"]))
        };
      });
    var timeById = {};
    times.forEach(function (t) { timeById[t.id] = t; });

    var jogadores = (raw["Jogadores"] || [])
      .filter(function (r) { return str(r["JogadorID"]) && str(r["Nome"]); })
      .map(function (r) {
        return {
          id: str(r["JogadorID"]),
          nome: str(r["Nome"]),
          timeId: str(r["TimeID"]),
          numero: str(r["Número"]),
          posicao: str(r["Posição"]),
          foto: normalizeDriveImageUrl(str(r["Foto (URL)"]) || str(r["Foto"]))
        };
      });
    var jogadorById = {};
    jogadores.forEach(function (j) { jogadorById[j.id] = j; });

    var jogosValidacao = [];
    var jogos = (raw["Jogos"] || [])
      .filter(function (r) { return str(r["JogoID"]); })
      .map(function (r) {
        // Cada linha é validada/montada isolada: uma linha ruim (ou um erro
        // inesperado ao processá-la) nunca derruba as outras nem a página —
        // ela só é excluída e registrada em jogosValidacao.
        var jogoId = str(r["JogoID"]);
        var erro = null;
        try {
          erro = validateJogoRow(r, timeById);
        } catch (e) {
          erro = "Erro inesperado ao validar esta linha";
        }
        jogosValidacao.push({ jogoId: jogoId, erro: erro || "" });
        if (erro) return null; // linha inválida: some do site, não conta em nada
        try {
          return {
            id: jogoId,
            rodada: str(r["Rodada"]),
            fase: str(r["Fase"]),
            data: str(r["Data"]),
            hora: hhmm(r["Hora"]),
            local: str(r["Local"]),
            timeCasaId: str(r["TimeCasaID"]),
            timeForaId: str(r["TimeForaID"]),
            golsCasa: r["GolsCasa"] === null || r["GolsCasa"] === "" ? null : num(r["GolsCasa"], null),
            golsFora: r["GolsFora"] === null || r["GolsFora"] === "" ? null : num(r["GolsFora"], null),
            status: str(r["Status"]) || "Agendado",
            inicio1T: hhmm(r["Inicio1T"]),
            inicio2T: hhmm(r["Inicio2T"]),
            radioUrl: str(r["RadioURL"]),
            videoAoVivoUrl: str(r["VideoAoVivoURL"]),
            gravacaoUrl: str(r["GravacaoURL"])
          };
        } catch (e) {
          jogosValidacao[jogosValidacao.length - 1].erro = "Erro inesperado ao montar esta linha";
          return null;
        }
      })
      .filter(Boolean);
    var jogoById = {};
    jogos.forEach(function (g) { jogoById[g.id] = g; });

    function byJogoId(list, key) {
      var out = {};
      (list || []).forEach(function (r) {
        var id = str(r[key]);
        if (!id) return;
        (out[id] = out[id] || []).push(r);
      });
      return out;
    }

    var gols = (raw["Gols"] || []).filter(function (r) { return str(r["JogoID"]) && str(r["JogadorID"]); }).map(function (r) {
      return {
        jogoId: str(r["JogoID"]),
        minuto: num(r["Minuto"], 0),
        jogadorId: str(r["JogadorID"]),
        timeId: str(r["TimeID"]),
        tipo: str(r["Tipo"]),
        tempoNoVideo: str(r["TempoNoVideo"])
      };
    });
    var golsPorJogo = byJogoId(gols, "jogoId");

    var cartoes = (raw["Cartões"] || []).filter(function (r) { return str(r["JogoID"]) && str(r["JogadorID"]); }).map(function (r) {
      return {
        jogoId: str(r["JogoID"]),
        minuto: num(r["Minuto"], 0),
        jogadorId: str(r["JogadorID"]),
        timeId: str(r["TimeID"]),
        cartao: str(r["Cartão"])
      };
    });
    var cartoesPorJogo = byJogoId(cartoes, "jogoId");

    var substituicoes = (raw["Substituições"] || []).filter(function (r) { return str(r["JogoID"]) && str(r["SaiJogadorID"]); }).map(function (r) {
      return {
        jogoId: str(r["JogoID"]),
        minuto: num(r["Minuto"], 0),
        timeId: str(r["TimeID"]),
        saiId: str(r["SaiJogadorID"]),
        entraId: str(r["EntraJogadorID"])
      };
    });
    var substituicoesPorJogo = byJogoId(substituicoes, "jogoId");

    var estatisticas = (raw["Estatísticas"] || []).filter(function (r) { return str(r["JogoID"]) && str(r["TimeID"]); }).map(function (r) {
      return {
        jogoId: str(r["JogoID"]),
        timeId: str(r["TimeID"]),
        posse: num(r["PosseBola%"], null),
        finalizacoes: num(r["Finalizações"], null),
        chutesNoGol: num(r["ChutesNoGol"], null),
        escanteios: num(r["Escanteios"], null),
        faltas: num(r["Faltas"], null)
      };
    });
    var estatisticasPorJogo = byJogoId(estatisticas, "jogoId");

    var noticias = (raw["Notícias"] || []).filter(function (r) { return str(r["NoticiaID"]) && str(r["Título"]); }).map(function (r) {
      return {
        id: str(r["NoticiaID"]),
        data: str(r["Data"]),
        categoria: str(r["Categoria"]),
        titulo: str(r["Título"]),
        resumo: str(r["Resumo"]),
        texto: str(r["Texto"]),
        imagem: normalizeDriveImageUrl(str(r["Imagem (URL)"]) || str(r["Imagem"])),
        destaque: bool(r["Destaque"])
      };
    });

    var midia = (raw["Mídia"] || []).filter(function (r) { return str(r["MidiaID"]) && str(r["URL"]); }).map(function (r) {
      return {
        id: str(r["MidiaID"]),
        data: str(r["Data"]),
        tipo: str(r["Tipo"]),
        categoria: str(r["Categoria"]),
        titulo: str(r["Título"]),
        url: str(r["URL"]),
        thumb: normalizeDriveImageUrl(str(r["Thumb (URL)"]) || str(r["Thumb"])),
        jogoId: str(r["JogoID"]),
        noticiaId: str(r["NoticiaID"])
      };
    });

    var classificacao = (raw["Classificação"] || []).filter(function (r) { return str(r["TimeID"]); }).map(function (r) {
      return {
        timeId: str(r["TimeID"]),
        time: str(r["Time"]),
        p: num(r["P"], 0),
        j: num(r["J"], 0),
        v: num(r["V"], 0),
        e: num(r["E"], 0),
        d: num(r["D"], 0),
        gp: num(r["GP"], 0),
        gc: num(r["GC"], 0),
        sg: num(r["SG"], 0)
      };
    });

    var paginas = (raw["Páginas"] || []).filter(function (r) { return str(r["PaginaID"]) && str(r["Seção"]); }).map(function (r) {
      return {
        id: str(r["PaginaID"]),
        secao: str(r["Seção"]),
        ordem: num(r["Ordem"], 0),
        titulo: str(r["Título"]),
        conteudo: str(r["Conteúdo"])
      };
    }).sort(function (a, b) { return a.ordem - b.ordem; });

    return {
      config: config, times: times, timeById: timeById,
      jogadores: jogadores, jogadorById: jogadorById,
      jogos: jogos, jogoById: jogoById, jogosValidacao: jogosValidacao,
      golsPorJogo: golsPorJogo, cartoesPorJogo: cartoesPorJogo,
      substituicoesPorJogo: substituicoesPorJogo, estatisticasPorJogo: estatisticasPorJogo,
      noticias: noticias, midia: midia, classificacao: classificacao, paginas: paginas,
      fetchedAt: Date.now()
    };
  }

  // ---- exposição pública ------------------------------------------------

  var state = {
    data: null,        // último snapshot normalizado com sucesso
    error: null,        // Error da última tentativa, se falhou
    loadedOnce: false,
    fromCache: false
  };
  var listeners = new Set();
  var snapshots = []; // [{t:number, data:object}] para o buffer anti-spoiler
  var pollTimer = null;
  var clockTimer = null;
  var started = false;

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error("[copa-data] listener falhou:", e); }
    });
  }

  function saveToLocalStorage(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: Date.now(), data: data }));
    } catch (e) { /* quota cheia / privado: ignora, cache é best-effort */ }
  }
  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.data ? parsed.data : null;
    } catch (e) { return null; }
  }

  function pushSnapshot(data) {
    var now = Date.now();
    snapshots.push({ t: now, data: data });
    var cutoff = now - SNAPSHOT_WINDOW_MS;
    while (snapshots.length > 1 && snapshots[0].t < cutoff) snapshots.shift();
  }

  // Modo anti-spoiler: enquanto houver player tocando, usa o snapshot de
  // `delayMs` atrás em vez do mais recente.
  function snapshotDelayed(delayMs) {
    if (!snapshots.length) return null;
    var target = Date.now() - delayMs;
    var chosen = snapshots[0];
    for (var i = 0; i < snapshots.length; i++) {
      if (snapshots[i].t <= target) chosen = snapshots[i];
      else break;
    }
    return chosen.data;
  }

  function anyGameLive(data) {
    if (!data) return false;
    return data.jogos.some(function (g) {
      return g.status === "Ao vivo" || g.status === "Intervalo";
    });
  }

  function scheduleNextPoll() {
    clearTimeout(pollTimer);
    var delay = anyGameLive(state.data) ? POLL_LIVE_MS : POLL_IDLE_MS;
    pollTimer = setTimeout(tick, delay);
  }

  function tick() {
    fetchAllSheets().then(function (raw) {
      var data = normalize(raw);
      state.data = data;
      state.error = null;
      state.loadedOnce = true;
      state.fromCache = false;
      pushSnapshot(data);
      saveToLocalStorage(data);
      notify();
      reportValidationErrors(data.jogosValidacao);
    }).catch(function (err) {
      console.error("[copa-data] falha ao atualizar:", err);
      state.error = err;
      // Mantém state.data (último bom) intacto — a UI nunca fica sem dado.
      notify();
    }).then(scheduleNextPoll);
  }

  function start() {
    if (started) return;
    started = true;
    var cached = loadFromLocalStorage();
    if (cached) {
      state.data = cached;
      state.fromCache = true;
      state.loadedOnce = true;
      pushSnapshot(cached);
    }
    tick();
    clockTimer = setInterval(notify, CLOCK_TICK_MS);
  }

  function emptyData() {
    return {
      config: {
        nomeCampeonato: "Carregando…", temporada: "", pontosVitoria: 3, pontosEmpate: 1, pontosDerrota: 0,
        timesClassificados: 4, duracaoTempoMin: 45, delayTransmissaoSeg: 30, radioUrlPadrao: "", mensagemTopo: ""
      },
      times: [], timeById: {}, jogadores: [], jogadorById: {},
      jogos: [], jogoById: {}, jogosValidacao: [], golsPorJogo: {}, cartoesPorJogo: {},
      substituicoesPorJogo: {}, estatisticasPorJogo: {}, noticias: [], midia: [], classificacao: [], paginas: [],
      fetchedAt: 0
    };
  }

  global.CopaData = {
    start: start,
    emptyData: emptyData,
    subscribe: function (fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    },
    getState: function () { return state; },
    // Retorna os dados a exibir agora, já respeitando o delay anti-spoiler
    // quando `playing` é true.
    getDisplayData: function (playing) {
      if (!playing) return state.data;
      var delayed = snapshotDelayed((state.data ? state.data.config.delayTransmissaoSeg : 30) * 1000);
      return delayed || state.data;
    },
    helpers: {
      str: str, num: num, bool: bool, initials: initials,
      teamGradient: teamGradient, combineDateTime: combineDateTime,
      minutesBetween: minutesBetween, fallbackHex: FALLBACK_HEX,
      validateJogoRow: validateJogoRow
    },
    _internal: { parseGvizResponse: parseGvizResponse, sanitizeGvizDates: sanitizeGvizDates, normalize: normalize, gvizUrl: gvizUrl }
  };
})(window);
