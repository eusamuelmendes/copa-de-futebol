// viewmodel.js — traduz os dados normalizados (data.js) + estado de UI para
// exatamente o formato que o template do index.html já espera (mesmas chaves
// que o protótipo fabricava em raw()/renderVals()). Sem React, sem DOM: só
// funções puras (exceto os "action" callbacks, que só disparam callbacks).
(function (global) {
  "use strict";

  var H = global.CopaData.helpers;
  var str = H.str, num = H.num, initials = H.initials, teamGradient = H.teamGradient;
  var combineDateTime = H.combineDateTime, minutesBetween = H.minutesBetween, FALLBACK_HEX = H.fallbackHex;

  var WD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  var MO = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  function pad2(n) { n = Number(n); return (n < 10 ? "0" : "") + n; }
  function parseYMD(s) {
    var m = str(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayLabel(dateStr, now) {
    var d = parseYMD(dateStr);
    if (!d) return "";
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
    var yst = new Date(today); yst.setDate(yst.getDate() - 1);
    var label = pad2(d.getDate()) + " " + MO[d.getMonth()];
    if (sameDay(d, today)) return "HOJE · " + label;
    if (sameDay(d, tmr)) return "AMANHÃ · " + label;
    if (sameDay(d, yst)) return "ONTEM · " + label;
    return WD[d.getDay()] + " · " + label;
  }
  function formatDatePt(dateStr) {
    var d = parseYMD(dateStr);
    return d ? pad2(d.getDate()) + " " + MO[d.getMonth()] : "";
  }
  function cssUrl(u) { return String(u).replace(/["\\]/g, ""); }

  // ---- imagens: escudo do time e foto do jogador ---------------------------
  // A imagem só é usada depois que o navegador confirmou que ela carrega
  // (ui.brokenImages). Havendo imagem, as iniciais saem de cena — escudo nunca
  // fica com letra por cima. Sem imagem, ou se ela falhar, as iniciais
  // coloridas voltam como alternativa.
  function imgOk(url, ui) {
    return !!url && !(ui && ui.brokenImages && ui.brokenImages[url]);
  }
  function teamBadge(team, ui) {
    var t = team || {};
    if (imgOk(t.escudo, ui)) return { g: "center/contain no-repeat url(" + cssUrl(t.escudo) + ")", i: "" };
    return { g: teamGradient(t.corHex || FALLBACK_HEX), i: initials(t.nome || "?") };
  }
  function playerAvatar(player, ui) {
    var p = player || {};
    if (imgOk(p.foto, ui)) return { g: "center/cover no-repeat url(" + cssUrl(p.foto) + ")", i: "" };
    return { g: "rgba(63,169,255,.16)", i: str(p.nome || "?").charAt(0).toUpperCase() };
  }

  // ---- cronômetro -----------------------------------------------------------

  function matchMinute(game, config, now) {
    if (game.status === "Intervalo") return config.duracaoTempoMin;
    if (game.status !== "Ao vivo") return null;
    var d2 = combineDateTime(game.data, game.inicio2T);
    if (d2) {
      var m2 = minutesBetween(d2, now);
      return m2 === null ? null : config.duracaoTempoMin + Math.max(0, m2);
    }
    var d1 = combineDateTime(game.data, game.inicio1T);
    if (d1) {
      var m1 = minutesBetween(d1, now);
      return m1 === null ? null : Math.max(0, m1);
    }
    return null;
  }

  // ---- estilo/rótulo por status -----------------------------------------

  var BUCKET_STYLE = {
    live: {
      centerFg: "#fff", subFg: "#FF6B75", chipFg: "#FF6B75",
      cardBg: "linear-gradient(120deg,rgba(30,107,255,.22),rgba(11,27,60,.85) 55%,rgba(255,46,63,.12))",
      cardBd: "rgba(63,169,255,.42)", cta: "ACOMPANHAR →", ctaFg: "#fff"
    },
    done: {
      centerFg: "rgba(255,255,255,.88)", subFg: "rgba(255,255,255,.4)", chipFg: "rgba(255,255,255,.55)",
      cardBg: "rgba(255,255,255,.045)", cardBd: "rgba(255,255,255,.09)", cta: "SÚMULA →", ctaFg: "rgba(255,255,255,.5)"
    },
    next: {
      centerFg: "rgba(255,255,255,.34)", subFg: "#8FD0FF", chipFg: "#8FD0FF",
      cardBg: "rgba(255,255,255,.045)", cardBd: "rgba(255,255,255,.09)", cta: "LEMBRETE →", ctaFg: "rgba(255,255,255,.5)"
    }
  };
  function classify(status) {
    if (status === "Ao vivo" || status === "Intervalo") return "live";
    if (status === "Encerrado" || status === "WO") return "done";
    return "next"; // Agendado, Adiado ou algo não previsto
  }
  function chipLabel(game, minute, config) {
    switch (game.status) {
      case "Ao vivo": return minute === null ? "AO VIVO" : (minute > config.duracaoTempoMin ? "2º TEMPO" : "1º TEMPO");
      case "Intervalo": return "INTERVALO";
      case "Encerrado": return statusLabel(game);
      case "Adiado": return "ADIADO";
      case "WO": return "W.O.";
      default: return "LOCAL";
    }
  }
  function centerText(game) {
    var hasScore = game.golsCasa !== null && game.golsFora !== null;
    if (game.status === "WO") return hasScore ? (game.golsCasa + " × " + game.golsFora) : "W.O.";
    if (game.status === "Ao vivo" || game.status === "Intervalo" || game.status === "Encerrado") {
      return hasScore ? (game.golsCasa + " × " + game.golsFora) : "VS";
    }
    return "VS";
  }
  // O rótulo do jogo segue o valor da coluna Status da planilha, em vez de um
  // texto próprio ("FINAL"), pra planilha e site nunca divergirem.
  function statusLabel(game) {
    return str(game.status).toUpperCase() || "AGENDADO";
  }
  function scheduleLabel(game) {
    var dia = formatDatePt(game.data);
    var hora = game.hora || "--:--";
    return dia ? (dia + " · " + hora) : hora;
  }
  function centerSubText(game, minute, config) {
    switch (game.status) {
      case "Ao vivo": return minute === null ? "AO VIVO" : (minute + "'");
      case "Intervalo": return config.duracaoTempoMin + "'";
      case "Encerrado": return statusLabel(game);
      case "Adiado": return statusLabel(game);
      case "WO": return "W.O.";
      default: return scheduleLabel(game);
    }
  }

  function matchCard(game, data, ui, actions) {
    var config = data.config;
    var teamA = data.timeById[game.timeCasaId] || { nome: "A definir", corHex: FALLBACK_HEX };
    var teamB = data.timeById[game.timeForaId] || { nome: "A definir", corHex: FALLBACK_HEX };
    var minute = matchMinute(game, config, ui.now);
    var bucket = classify(game.status);
    var style = BUCKET_STYLE[bucket];
    var badgeA = teamBadge(teamA, ui), badgeB = teamBadge(teamB, ui);
    return {
      id: game.id, isLive: bucket === "live",
      ia: badgeA.i, na: teamA.nome, ga: badgeA.g,
      ib: badgeB.i, nb: teamB.nome, gb: badgeB.g,
      center: centerText(game),
      centerSub: centerSubText(game, minute, config),
      centerFg: style.centerFg, subFg: style.subFg, centerAnim: "none",
      chip: chipLabel(game, minute, config), chipFg: style.chipFg,
      meta: "· " + (game.local || "local a definir"),
      cta: style.cta, ctaFg: style.ctaFg,
      cardBg: style.cardBg, cardBd: style.cardBd,
      open: function () { actions.openMatch(game.id); }
    };
  }

  // ---- eventos / estatísticas / elenco do modal de partida -----------------

  function buildEvents(game, data, actions) {
    var rows = [];
    (data.golsPorJogo[game.id] || []).forEach(function (g) {
      var jogador = data.jogadorById[g.jogadorId];
      var time = data.timeById[g.timeId];
      var isOwnGoal = /contra/i.test(g.tipo);
      var note = isOwnGoal ? "Gol contra" : (g.tipo && g.tipo !== "Normal" ? "Gol · " + g.tipo : "Gol");
      var clickable = !!(g.tempoNoVideo && game.gravacaoUrl);
      rows.push({
        minuto: g.minuto, min: g.minuto + "'", icon: "⚽",
        player: jogador ? jogador.nome : (isOwnGoal ? "Contra" : "—"),
        note: note, team: time ? time.nome : "",
        onClick: clickable ? function () { actions.openVideoAt(game.gravacaoUrl, g.tempoNoVideo); } : function () {},
        cursor: clickable ? "pointer" : "default"
      });
    });
    (data.cartoesPorJogo[game.id] || []).forEach(function (c) {
      var jogador = data.jogadorById[c.jogadorId];
      var time = data.timeById[c.timeId];
      rows.push({
        minuto: c.minuto, min: c.minuto + "'", icon: c.cartao === "Vermelho" ? "🟥" : "🟨",
        player: jogador ? jogador.nome : "—",
        note: "Cartão " + (c.cartao || ""), team: time ? time.nome : "",
        onClick: function () {}, cursor: "default"
      });
    });
    (data.substituicoesPorJogo[game.id] || []).forEach(function (s) {
      var sai = data.jogadorById[s.saiId], entra = data.jogadorById[s.entraId];
      var time = data.timeById[s.timeId];
      rows.push({
        minuto: s.minuto, min: s.minuto + "'", icon: "🔄",
        player: (sai ? sai.nome : "?") + " ↔ " + (entra ? entra.nome : "?"),
        note: "Substituição", team: time ? time.nome : "",
        onClick: function () {}, cursor: "default"
      });
    });
    rows.sort(function (a, b) { return b.minuto - a.minuto; });
    return rows;
  }

  function buildStats(game, data) {
    var rows = data.estatisticasPorJogo[game.id] || [];
    var a = rows.filter(function (r) { return r.timeId === game.timeCasaId; })[0];
    var b = rows.filter(function (r) { return r.timeId === game.timeForaId; })[0];
    if (!a && !b) return [];
    function pair(label, va, vb, suffix) {
      va = va === null || va === undefined ? 0 : va;
      vb = vb === null || vb === undefined ? 0 : vb;
      return { label: label, a: va + (suffix || ""), b: vb + (suffix || ""), fa: va || 0.0001, fb: vb || 0.0001 };
    }
    return [
      pair("Posse de bola", a && a.posse, b && b.posse, "%"),
      pair("Finalizações", a && a.finalizacoes, b && b.finalizacoes),
      pair("Chutes no gol", a && a.chutesNoGol, b && b.chutesNoGol),
      pair("Escanteios", a && a.escanteios, b && b.escanteios),
      pair("Faltas", a && a.faltas, b && b.faltas)
    ];
  }

  function buildLineup(game, data, ui) {
    var squadA = data.jogadores.filter(function (j) { return j.timeId === game.timeCasaId; });
    var squadB = data.jogadores.filter(function (j) { return j.timeId === game.timeForaId; });
    if (!squadA.length && !squadB.length) return [];
    var teamA = data.timeById[game.timeCasaId], teamB = data.timeById[game.timeForaId];
    function mapSquad(list, teamName) {
      return list.slice()
        .sort(function (x, y) { return (Number(x.numero) || 99) - (Number(y.numero) || 99); })
        .map(function (j) {
          var av = playerAvatar(j, ui);
          return { n: j.numero || "-", name: j.nome, pos: (j.posicao || "—") + " · " + teamName, fg: av.g, fi: av.i };
        });
    }
    return mapSquad(squadA, teamA ? teamA.nome : "Casa").concat(mapSquad(squadB, teamB ? teamB.nome : "Visitante"));
  }

  function buildDetail(game, data, ui, actions) {
    if (!game) return null;
    var card = matchCard(game, data, ui, actions);
    var config = data.config;
    var minute = matchMinute(game, config, ui.now);
    var statusLong;
    switch (game.status) {
      case "Ao vivo": statusLong = "AO VIVO" + (minute !== null ? " · " + minute + "'" : ""); break;
      case "Intervalo": statusLong = "INTERVALO"; break;
      case "Encerrado": statusLong = statusLabel(game); break;
      case "Adiado": statusLong = "ADIADO"; break;
      case "WO": statusLong = "W.O."; break;
      default: statusLong = (game.hora || "");
    }

    var events = buildEvents(game, data, actions);
    var stats = buildStats(game, data);
    var lineup = buildLineup(game, data, ui);

    var tabDefs = [{ key: "Eventos", label: "Eventos" }];
    if (stats.length) tabDefs.push({ key: "Estatísticas", label: "Estatísticas" });
    if (lineup.length) tabDefs.push({ key: "Escalação", label: "Escalação" });
    var keys = tabDefs.map(function (t) { return t.key; });
    var activeTab = keys.indexOf(ui.tab) !== -1 ? ui.tab : tabDefs[0].key;
    var tabs = tabDefs.map(function (t) {
      var on = t.key === activeTab;
      return {
        label: t.label, pick: function () { actions.setTab(t.key); },
        fg: on ? "#05070F" : "rgba(255,255,255,.6)", bg: on ? "#fff" : "rgba(255,255,255,.06)"
      };
    });

    var out = {};
    for (var k in card) out[k] = card[k];
    out.roundLabel = (game.rodada ? "RODADA " + game.rodada + " · " : "") + (game.fase || "");
    out.statusLong = statusLong;
    out.subFg = card.isLive ? "#FF2E3F" : card.subFg;
    out.meta = [dayLabel(game.data, ui.now), game.hora, game.local].filter(Boolean).join(" · ");
    out.events = events; out.hasEvents = events.length > 0;
    out.stats = stats;
    out.lineup = lineup;
    out.tabs = tabs;
    out.tabEventos = activeTab === "Eventos";
    out.tabStats = activeTab === "Estatísticas";
    out.tabLineup = activeTab === "Escalação";

    var isLiveNow = game.status === "Ao vivo" || game.status === "Intervalo";
    var watchUrl = isLiveNow ? (game.videoAoVivoUrl || game.gravacaoUrl || "") : (game.gravacaoUrl || game.videoAoVivoUrl || "");
    out.hasWatch = !!watchUrl;
    out.watchLabel = isLiveNow ? "ASSISTIR AO VIVO" : "ASSISTIR GRAVAÇÃO";
    out.watchAction = function () { actions.openVideoAt(watchUrl, ""); };

    return out;
  }

  // ---- classificação ------------------------------------------------------

  function buildGroupsList(data) {
    var set = {};
    data.times.forEach(function (t) { if (t.grupo) set[t.grupo] = true; });
    return Object.keys(set).sort();
  }

  // Confronto direto (só entre partidas Encerradas): quem tirou mais pontos
  // no(s) jogo(s) direto(s) entre os dois times. 0 = empatam também nisso.
  function headToHeadDiff(data, teamIdA, teamIdB) {
    var pontosA = 0, pontosB = 0;
    data.jogos.forEach(function (g) {
      if (g.status !== "Encerrado") return;
      var aEmCasa = g.timeCasaId === teamIdA && g.timeForaId === teamIdB;
      var bEmCasa = g.timeCasaId === teamIdB && g.timeForaId === teamIdA;
      if (!aEmCasa && !bEmCasa) return;
      var golsA = aEmCasa ? g.golsCasa : g.golsFora;
      var golsB = aEmCasa ? g.golsFora : g.golsCasa;
      if (golsA === null || golsB === null) return;
      if (golsA > golsB) pontosA += 3;
      else if (golsB > golsA) pontosB += 3;
      else { pontosA += 1; pontosB += 1; }
    });
    return pontosA - pontosB;
  }

  function sortStandingsRows(rows, data) {
    rows.sort(function (a, b) {
      if (b.p !== a.p) return b.p - a.p;
      if (b.sg !== a.sg) return b.sg - a.sg;
      if (b.gp !== a.gp) return b.gp - a.gp;
      return headToHeadDiff(data, b.timeId, a.timeId);
    });
    return rows;
  }

  function standingsRowShape(r, idx, cutoff, data, ui, actions) {
    var team = data.timeById[r.timeId];
    var nome = team ? team.nome : r.time;
    var corHex = team ? team.corHex : FALLBACK_HEX;
    var classified = idx < cutoff;
    var badge = teamBadge(team || { nome: nome, corHex: corHex }, ui);
    var pct = r.j > 0 ? Math.round((r.p / (r.j * 3)) * 100) : 0;
    return {
      pos: String(idx + 1), n: nome,
      g: badge.g, i: badge.i,
      j: r.j, v: r.v, e: r.e, d: r.d, gp: r.gp, gc: r.gc,
      sg: (r.sg > 0 ? "+" : "") + r.sg, pts: r.p,
      apr: pct + "%", aprW: pct + "%",
      zone: classified ? "#3FA9FF" : "rgba(255,255,255,.18)",
      rowBg: !classified ? "transparent" : (idx === 0 ? "rgba(63,169,255,.12)" : "rgba(63,169,255,.06)"),
      posFg: classified ? "#8FD0FF" : "rgba(255,255,255,.5)",
      open: function () { actions.openTeam(r.timeId); }
    };
  }

  function buildStandings(data, groupFilter, ui, actions) {
    var rows = data.classificacao.slice();
    if (groupFilter) {
      var idsInGroup = {};
      data.times.forEach(function (t) { if (t.grupo === groupFilter) idsInGroup[t.id] = true; });
      rows = rows.filter(function (r) { return idsInGroup[r.timeId]; });
    }
    sortStandingsRows(rows, data);
    var cutoff = data.config.timesClassificados;
    return rows.map(function (r, idx) { return standingsRowShape(r, idx, cutoff, data, ui, actions); });
  }

  // Um bloco por grupo (A, B, C...), cada um já ordenado e com sua própria
  // zona de classificação — usado na Tabela em vez de uma lista só com abas.
  function buildGroupBlocks(data, ui, actions) {
    var groupsList = buildGroupsList(data);
    var byGroup = {};
    data.times.forEach(function (t) { if (t.grupo) (byGroup[t.grupo] = byGroup[t.grupo] || []).push(t.id); });
    var cutoffPerGroup = 2; // regra da competição: os 2 primeiros de cada grupo avançam
    return groupsList.map(function (g) {
      var idsInGroup = {};
      (byGroup[g] || []).forEach(function (id) { idsInGroup[id] = true; });
      var rows = data.classificacao.filter(function (r) { return idsInGroup[r.timeId]; });
      sortStandingsRows(rows, data);
      return {
        group: g, label: "GRUPO " + g,
        teams: rows.map(function (r, idx) { return standingsRowShape(r, idx, cutoffPerGroup, data, ui, actions); })
      };
    });
  }

  function buildGroupsTabs(groupsList, activeGroup, actions) {
    return groupsList.map(function (g) {
      var on = g === activeGroup;
      return {
        label: "GRUPO " + g, pick: function () { actions.setGroup(g); },
        fg: on ? "#fff" : "rgba(255,255,255,.6)",
        bg: on ? "linear-gradient(100deg,#1E6BFF,#3FA9FF)" : "rgba(255,255,255,.06)",
        bd: on ? "rgba(143,208,255,.6)" : "rgba(255,255,255,.1)"
      };
    });
  }

  // ---- artilharia -----------------------------------------------------------

  function buildScorers(data, ui) {
    var counts = {};
    Object.keys(data.golsPorJogo).forEach(function (jogoId) {
      data.golsPorJogo[jogoId].forEach(function (g) {
        if (/contra/i.test(g.tipo) || !g.jogadorId) return;
        counts[g.jogadorId] = (counts[g.jogadorId] || 0) + 1;
      });
    });
    var list = Object.keys(counts).map(function (id) {
      var j = data.jogadorById[id];
      var team = j ? data.timeById[j.timeId] : null;
      var av = playerAvatar(j, ui);
      return { name: j ? j.nome : id, team: team ? team.nome : "", goals: counts[id], g: av.g, i: av.i };
    });
    list.sort(function (a, b) { return b.goals - a.goals; });
    var ord = ["1º", "2º", "3º", "4º"];
    return list.slice(0, 4).map(function (s, i) {
      return { pos: ord[i] || (i + 1) + "º", i: s.i, g: s.g, name: s.name, team: s.team, goals: s.goals };
    });
  }

  // ---- notícias -----------------------------------------------------------

  // brokenImages vem do Component (populado testando cada URL com Image()
  // no navegador) — uma foto que falhou ao carregar cai pro mesmo fallback
  // de "sem foto", sem deixar quadro quebrado. A imagem sempre aparece
  // inteira (object-fit:contain) com um fundo desfocado da própria foto
  // atrás — funciona pra qualquer proporção (horizontal/vertical/quadrada)
  // sem cortar o assunto e sem distorcer.
  // Vídeo da notícia: linha da aba Mídia com Tipo "Vídeo" e NoticiaID apontando
  // pra matéria. Aceita link do YouTube ou arquivo de vídeo direto; sem linha
  // correspondente, o card segue usando a foto como antes.
  function videoDaNoticia(data, noticiaId) {
    if (!noticiaId) return null;
    var linha = (data.midia || []).filter(function (m) {
      return str(m.noticiaId) === noticiaId && /v[ií]deo/i.test(str(m.tipo)) && str(m.url);
    })[0];
    if (!linha) return null;
    var yt = youTubeId(linha.url);
    return { kind: yt ? "youtube" : "file", src: yt || linha.url, thumb: linha.thumb || "" };
  }

  function newsCardShape(n, brokenImages, actions, video) {
    var hasImg = !!n.imagem && !(brokenImages && brokenImages[n.imagem]);
    return {
      id: n.id,
      hasVideo: !!video,
      videoKind: video ? video.kind : "",
      videoSrc: video ? video.src : "",
      tag: (n.categoria || "NOTÍCIA").toUpperCase(),
      title: n.titulo, meta: formatDatePt(n.data),
      hasImg: hasImg,
      imgUrl: hasImg ? n.imagem : "",
      g: hasImg ? ("center/cover no-repeat url(" + cssUrl(n.imagem) + ")") : "linear-gradient(125deg,#0C2A63,#1E6BFF)",
      open: function () { actions.openNews(n.id); }
    };
  }
  function buildNews(data, brokenImages, actions) {
    var byDateDesc = function (a, b) { return str(b.data).localeCompare(str(a.data)); };
    var shape = function (n) { return newsCardShape(n, brokenImages, actions, videoDaNoticia(data, n.id)); };
    var all = data.noticias.slice().sort(byDateDesc).map(shape);
    var highlights = data.noticias.filter(function (n) { return n.destaque; })
      .slice().sort(byDateDesc).slice(0, 3).map(shape);
    return { all: all, highlights: highlights };
  }

  function buildNewsDetail(data, newsOpenId, brokenImages) {
    if (!newsOpenId) return null;
    var n = data.noticias.filter(function (x) { return x.id === newsOpenId; })[0];
    if (!n) return null;
    var hasImg = !!n.imagem && !(brokenImages && brokenImages[n.imagem]);
    var video = videoDaNoticia(data, n.id);
    return {
      hasVideo: !!video,
      videoKind: video ? video.kind : "",
      videoSrc: video ? video.src : "",
      tag: (n.categoria || "NOTÍCIA").toUpperCase(),
      title: n.titulo, meta: formatDatePt(n.data),
      hasImg: hasImg,
      imgUrl: hasImg ? n.imagem : "",
      g: hasImg ? ("center/cover no-repeat url(" + cssUrl(n.imagem) + ")") : "linear-gradient(125deg,#0C2A63,#1E6BFF)",
      texto: n.texto || n.resumo || "Texto completo em breve."
    };
  }

  // ---- diagnóstico de validação da aba Jogos -------------------------------

  function buildValidationIssues(data) {
    return (data.jogosValidacao || []).filter(function (r) { return r.erro; });
  }

  // ---- jogos: cartões da Home e da aba Jogos ------------------------------

  function gameGroup(game, data) {
    var casa = data.timeById[game.timeCasaId];
    var fora = data.timeById[game.timeForaId];
    return (casa && casa.grupo) || (fora && fora.grupo) || "";
  }

  function buildAllCards(data, ui, actions) {
    var jogos = data.jogos.slice().sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); });
    return jogos.map(function (g) { return { game: g, card: matchCard(g, data, ui, actions), grupo: gameGroup(g, data) }; });
  }
  function buildHomeSections(cardsWithGame) {
    var live = cardsWithGame.filter(function (x) { return x.card.isLive; }).map(function (x) { return x.card; });
    var next = cardsWithGame.filter(function (x) { return x.game.status === "Agendado"; })
      .slice(0, 2).map(function (x) { return x.card; });
    var done = cardsWithGame.filter(function (x) { return x.game.status === "Encerrado" || x.game.status === "WO"; })
      .slice().reverse().slice(0, 4).map(function (x) { return x.card; });
    var sections = [];
    if (live.length) sections.push({ label: "Ao vivo agora", live: true, items: live });
    if (next.length) sections.push({ label: "Próximos jogos", live: false, items: next });
    if (done.length) sections.push({ label: "Últimos resultados", live: false, items: done });
    return sections;
  }
  function matchesFilter(x, ui) {
    var game = x.game;
    switch (ui.filter) {
      case "Hoje": if (!sameDay(parseYMD(game.data), new Date(ui.now.getFullYear(), ui.now.getMonth(), ui.now.getDate()))) return false; break;
      case "Ao vivo": if (!(game.status === "Ao vivo" || game.status === "Intervalo")) return false; break;
      case "Próximos": if (!(game.status === "Agendado" || game.status === "Adiado")) return false; break;
      case "Encerrados": if (!(game.status === "Encerrado" || game.status === "WO")) return false; break;
      default: break; // "Todos"
    }
    if (ui.filterGrupo && ui.filterGrupo !== "Todos" && x.grupo !== ui.filterGrupo) return false;
    if (ui.filterRodada && ui.filterRodada !== "Todas" && String(game.rodada) !== String(ui.filterRodada)) return false;
    return true;
  }
  function buildJogosGroups(cardsWithGame, ui) {
    var filtered = cardsWithGame.filter(function (x) { return matchesFilter(x, ui); });
    var keyFn;
    if (ui.view === "Rodada") keyFn = function (g) { return g.rodada ? "RODADA " + g.rodada : "SEM RODADA"; };
    else if (ui.view === "Fase") keyFn = function (g) { return (g.fase || "SEM FASE").toUpperCase(); };
    else keyFn = function (g) { return dayLabel(g.data, ui.now) || "SEM DATA"; };
    var order = [], byKey = {};
    filtered.forEach(function (x) {
      var k = keyFn(x.game);
      if (!byKey[k]) { byKey[k] = []; order.push(k); }
      byKey[k].push(x.card);
    });
    return order.map(function (k) {
      return { label: k, count: byKey[k].length + (byKey[k].length > 1 ? " jogos" : " jogo"), items: byKey[k] };
    });
  }
  function chipStyle(on) {
    return {
      fg: on ? "#fff" : "rgba(255,255,255,.6)",
      bg: on ? "linear-gradient(100deg,#1E6BFF,#3FA9FF)" : "rgba(255,255,255,.06)",
      bd: on ? "rgba(143,208,255,.6)" : "rgba(255,255,255,.1)"
    };
  }
  function buildGrupoFilters(data, ui, actions) {
    var groupsList = buildGroupsList(data);
    if (!groupsList.length) return [];
    return ["Todos"].concat(groupsList).map(function (g) {
      var c = chipStyle(g === (ui.filterGrupo || "Todos"));
      return { label: g === "Todos" ? "Todos" : "GRUPO " + g, fg: c.fg, bg: c.bg, bd: c.bd, pick: function () { actions.pickGrupo(g); } };
    });
  }
  function buildRodadaFilters(data, ui, actions) {
    var set = {};
    data.jogos.forEach(function (g) { if (g.rodada) set[g.rodada] = true; });
    var rodadas = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    if (!rodadas.length) return [];
    return ["Todas"].concat(rodadas).map(function (r) {
      var on = String(r) === String(ui.filterRodada || "Todas");
      var st = chipStyle(on);
      return { label: r === "Todas" ? "Todas" : "RODADA " + r, fg: st.fg, bg: st.bg, bd: st.bd, pick: function () { actions.pickRodada(r); } };
    });
  }
  function buildFilters(ui, actions) {
    return ["Todos", "Hoje", "Ao vivo", "Próximos", "Encerrados"].map(function (f) {
      var on = f === ui.filter;
      return {
        label: f, pick: function () { actions.pickFilter(f); },
        fg: on ? "#fff" : "rgba(255,255,255,.6)",
        bg: on ? "linear-gradient(100deg,#1E6BFF,#3FA9FF)" : "rgba(255,255,255,.06)",
        bd: on ? "rgba(143,208,255,.6)" : "rgba(255,255,255,.1)"
      };
    });
  }
  function buildViews(ui, actions) {
    return ["Data", "Rodada", "Fase"].map(function (v) {
      var on = v === ui.view;
      return { label: v, fg: on ? "#05070F" : "rgba(255,255,255,.6)", bg: on ? "#fff" : "transparent", pick: function () { actions.pickView(v); } };
    });
  }

  // ---- rádio ----------------------------------------------------------------

  function activeLiveGame(data) {
    var live = data.jogos.filter(function (g) { return g.status === "Ao vivo" || g.status === "Intervalo"; });
    return live[0] || null;
  }
  function resolveRadioUrl(data) {
    var live = activeLiveGame(data);
    if (live && live.radioUrl) return live.radioUrl;
    return data.config.radioUrlPadrao || "";
  }
  function radioNowLabel(data) {
    var live = activeLiveGame(data);
    if (live) {
      var a = data.timeById[live.timeCasaId], b = data.timeById[live.timeForaId];
      return (a ? a.nome : "Time casa") + " × " + (b ? b.nome : "Time visitante");
    }
    return data.config.nomeCampeonato;
  }

  // ---- vídeo (YouTube) ------------------------------------------------------

  function youTubeId(url) {
    var m = str(url).match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  function timeToSeconds(t) {
    var m = str(t).match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    m = str(t).match(/^(\d{1,3}):(\d{2})$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return 0;
  }
  function youTubeEmbedUrl(url, startSeconds) {
    var id = youTubeId(url);
    if (!id) return null;
    var qs = "autoplay=1&rel=0&modestbranding=1";
    if (startSeconds) qs += "&start=" + Math.floor(startSeconds);
    return "https://www.youtube.com/embed/" + id + "?" + qs;
  }

  // ---- times: listagem por grupo + perfil ------------------------------------

  function buildTeamsGrouped(data, ui, actions) {
    var groupsList = buildGroupsList(data);
    return groupsList.map(function (g) {
      var teams = data.times.filter(function (t) { return t.grupo === g; })
        .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (t) {
          return {
            id: t.id, nome: t.nome, i: teamBadge(t, ui).i, g: teamBadge(t, ui).g,
            open: function () { actions.openTeam(t.id); }
          };
        });
      return { group: g, label: "GRUPO " + g, teams: teams };
    });
  }

  // Histórico na perspectiva do time cujo perfil está aberto: o placar sai
  // sempre como "gols dele × gols do adversário", nunca na ordem
  // mandante/visitante — senão "SAPOLANDIA · 3 × 1" no perfil do RODOLOC lê-se
  // como derrota, quando foi vitória.
  var SELO = {
    V: { texto: "VITÓRIA", fg: "#5BE49B", bg: "rgba(91,228,155,.14)", bd: "rgba(91,228,155,.35)" },
    E: { texto: "EMPATE", fg: "#F2C94C", bg: "rgba(242,201,76,.14)", bd: "rgba(242,201,76,.32)" },
    D: { texto: "DERROTA", fg: "#FF6B75", bg: "rgba(255,107,117,.14)", bd: "rgba(255,107,117,.32)" }
  };

  function buildTeamGames(data, teamId, ui, actions) {
    return data.jogos.filter(function (g) { return g.timeCasaId === teamId || g.timeForaId === teamId; })
      .sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); })
      .map(function (g) {
        var isCasa = g.timeCasaId === teamId;
        var oppId = isCasa ? g.timeForaId : g.timeCasaId;
        var opp = data.timeById[oppId] || { nome: "A definir", corHex: FALLBACK_HEX };
        var card = matchCard(g, data, ui, actions);
        var oppBadge = teamBadge(opp, ui);

        var temPlacar = g.golsCasa !== null && g.golsFora !== null;
        var meus = isCasa ? g.golsCasa : g.golsFora;
        var deles = isCasa ? g.golsFora : g.golsCasa;
        var placar = temPlacar ? (meus + " × " + deles) : "";
        var decidido = temPlacar && (g.status === "Encerrado" || g.status === "WO");
        var selo = decidido ? SELO[meus > deles ? "V" : (meus === deles ? "E" : "D")] : null;

        return {
          oppNome: opp.nome, oppInitials: oppBadge.i, oppG: oppBadge.g,
          // "3 × 1 vs SAPOLANDIA" quando já houve placar; só "vs SAPOLANDIA" antes disso.
          linha: (placar ? placar + " vs " : "vs ") + opp.nome,
          temSelo: !!selo,
          seloTexto: selo ? selo.texto : "",
          seloFg: selo ? selo.fg : "", seloBg: selo ? selo.bg : "", seloBd: selo ? selo.bd : "",
          // Sem resultado decidido, o lugar do selo mostra data/hora (agendado)
          // ou o andamento (ao vivo, intervalo, adiado).
          quando: selo ? "" : (g.status === "Agendado" ? scheduleLabel(g) : card.centerSub),
          open: card.open
        };
      });
  }

  function buildTeamProfile(data, teamId, ui, actions) {
    if (!teamId) return null;
    var team = data.timeById[teamId];
    if (!team) return null;
    var classRow = data.classificacao.filter(function (r) { return r.timeId === teamId; })[0];
    var pct = classRow && classRow.j > 0 ? Math.round((classRow.p / (classRow.j * 3)) * 100) : 0;
    var squad = data.jogadores.filter(function (j) { return j.timeId === teamId; })
      .sort(function (a, b) { return (Number(a.numero) || 99) - (Number(b.numero) || 99); })
      .map(function (j) {
        var av = playerAvatar(j, ui);
        return { n: j.numero || "-", name: j.nome, pos: j.posicao || "—", fg: av.g, fi: av.i };
      });
    return {
      id: team.id, nome: team.nome, grupo: team.grupo ? ("GRUPO " + team.grupo) : "",
      i: teamBadge(team, ui).i, g: teamBadge(team, ui).g,
      v: classRow ? classRow.v : 0, e: classRow ? classRow.e : 0, d: classRow ? classRow.d : 0,
      pts: classRow ? classRow.p : 0, aproveitamento: pct + "%",
      games: buildTeamGames(data, teamId, ui, actions),
      squad: squad, hasSquad: squad.length > 0
    };
  }

  // ---- notificações de gol (só enquanto a página está aberta) --------------

  function buildFollowTeams(data, followedTeams, ui, actions) {
    return data.times.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (t) {
      var on = !!(followedTeams && followedTeams[t.id]);
      return {
        id: t.id, nome: t.nome, i: teamBadge(t, ui).i, g: teamBadge(t, ui).g,
        on: on, onFg: on ? "#fff" : "rgba(255,255,255,.6)",
        onBg: on ? "linear-gradient(100deg,#1E6BFF,#3FA9FF)" : "rgba(255,255,255,.06)",
        onBd: on ? "rgba(143,208,255,.6)" : "rgba(255,255,255,.1)",
        toggle: function () { actions.toggleFollow(t.id); }
      };
    });
  }

  // ---- central de mídia -----------------------------------------------------
  // Combina a aba Mídia (itens cadastrados manualmente) com jogos encerrados
  // que têm GravacaoURL (viram card automaticamente); gols com TempoNoVideo
  // viram capítulos clicáveis dentro do card do jogo.

  function buildMediaItems(data, actions) {
    var items = [];
    data.midia.forEach(function (m) {
      items.push({
        id: "m:" + m.id, title: m.titulo || (m.tipo || "Mídia"),
        tag: (m.categoria || m.tipo || "MÍDIA").toUpperCase(),
        g: m.thumb ? ("center/cover no-repeat url(" + cssUrl(m.thumb) + ")") : "linear-gradient(125deg,#0C2A63,#1E6BFF)",
        chapters: [], hasChapters: false,
        open: function () { actions.openVideoAt(m.url, ""); }
      });
    });
    data.jogos.forEach(function (g) {
      if (g.status !== "Encerrado" || !g.gravacaoUrl) return;
      var teamA = data.timeById[g.timeCasaId], teamB = data.timeById[g.timeForaId];
      var nomeA = teamA ? teamA.nome : "Time casa", nomeB = teamB ? teamB.nome : "Time visitante";
      var chapters = (data.golsPorJogo[g.id] || []).filter(function (x) { return x.tempoNoVideo; }).map(function (x) {
        var jog = data.jogadorById[x.jogadorId];
        return { label: x.minuto + "' " + (jog ? jog.nome : "Gol"), open: function () { actions.openVideoAt(g.gravacaoUrl, x.tempoNoVideo); } };
      });
      items.push({
        id: "j:" + g.id, title: nomeA + " " + (g.golsCasa == null ? "-" : g.golsCasa) + " × " + (g.golsFora == null ? "-" : g.golsFora) + " " + nomeB,
        tag: g.rodada ? ("RODADA " + g.rodada) : "PARTIDA",
        g: teamGradient(teamA ? teamA.corHex : FALLBACK_HEX),
        chapters: chapters, hasChapters: chapters.length > 0,
        open: function () { actions.openVideoAt(g.gravacaoUrl, ""); }
      });
    });
    return items;
  }

  // ---- páginas (Regulamento / Contato) ---------------------------------------

  function buildPaginaBlocks(data, secao) {
    return data.paginas.filter(function (p) { return p.secao === secao; })
      .map(function (p) { return { titulo: p.titulo, conteudo: p.conteudo }; });
  }

  var RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  var RE_PHONE = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;
  function phoneHref(raw) {
    var digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 11) digits = "55" + digits; // DDD+número sem país -> assume BR
    return "tel:+" + digits;
  }
  function buildContatoLinks(data) {
    var blocks = buildPaginaBlocks(data, "Contato");
    var seen = {}, out = [];
    blocks.forEach(function (b) {
      var text = b.conteudo || "";
      (text.match(RE_EMAIL) || []).forEach(function (e) {
        if (seen[e]) return;
        seen[e] = true;
        out.push({ label: e, href: "mailto:" + e });
      });
      (text.match(RE_PHONE) || []).forEach(function (p) {
        var digits = p.replace(/\D/g, "");
        if (digits.length < 10 || seen[p]) return;
        seen[p] = true;
        out.push({ label: p.trim(), href: phoneHref(p) });
      });
    });
    return out;
  }

  // ---- busca de time ----------------------------------------------------------

  function buildSearchResults(data, query, ui, actions) {
    var q = str(query).toLowerCase();
    if (!q) return [];
    return data.times.filter(function (t) { return t.nome.toLowerCase().indexOf(q) !== -1; })
      .slice(0, 12)
      .map(function (t) {
        return {
          id: t.id, nome: t.nome, grupo: t.grupo, i: teamBadge(t, ui).i, g: teamBadge(t, ui).g,
          open: function () { actions.openSearchResult(t.id); }
        };
      });
  }

  // ---- destaques da Home ----------------------------------------------------
  // Tudo derivado de Jogos + Gols, recalculado a cada leitura da planilha.
  // Cada card só existe se tiver dado real por trás: sem gol registrado não
  // há artilheiro, sem jogo encerrado não há ataque/defesa nem goleada. Em
  // caso de empate, todos os empatados aparecem — nunca se escolhe um.

  function jogosEncerrados(data) {
    return data.jogos.filter(function (g) {
      return (g.status === "Encerrado" || g.status === "WO") &&
        g.golsCasa !== null && g.golsFora !== null;
    });
  }

  // Índices dos valores máximos (ou mínimos) — devolve todos os empatados.
  function melhores(list, valorDe, maior) {
    if (!list.length) return [];
    var best = null;
    list.forEach(function (x) {
      var v = valorDe(x);
      if (best === null || (maior ? v > best : v < best)) best = v;
    });
    return list.filter(function (x) { return valorDe(x) === best; });
  }

  function golsPorTime(data) {
    var acc = {};
    jogosEncerrados(data).forEach(function (g) {
      [[g.timeCasaId, g.golsCasa, g.golsFora], [g.timeForaId, g.golsFora, g.golsCasa]]
        .forEach(function (par) {
          var id = par[0];
          if (!id || !data.timeById[id]) return;
          var a = acc[id] || (acc[id] = { id: id, jogos: 0, pro: 0, contra: 0 });
          a.jogos++; a.pro += par[1]; a.contra += par[2];
        });
    });
    return Object.keys(acc).map(function (k) { return acc[k]; });
  }

  function cardArtilheiro(data, ui, actions) {
    var counts = {};
    Object.keys(data.golsPorJogo).forEach(function (jogoId) {
      data.golsPorJogo[jogoId].forEach(function (g) {
        if (/contra/i.test(g.tipo) || !g.jogadorId) return;
        counts[g.jogadorId] = (counts[g.jogadorId] || 0) + 1;
      });
    });
    var lista = Object.keys(counts)
      .filter(function (id) { return counts[id] > 0 && data.jogadorById[id]; })
      .map(function (id) { return { jogador: data.jogadorById[id], gols: counts[id] }; });
    if (!lista.length) return null;
    var top = melhores(lista, function (x) { return x.gols; }, true);
    return {
      id: "artilheiro",
      label: top.length > 1 ? "Artilheiros" : "Artilheiro",
      items: top.map(function (x) {
        var av = playerAvatar(x.jogador, ui);
        var time = data.timeById[x.jogador.timeId];
        return {
          g: av.g, i: av.i, redondo: "99px",
          name: x.jogador.nome,
          sub: time ? time.nome : "",
          value: x.gols + (x.gols === 1 ? " gol" : " gols"),
          open: function () { if (time) actions.openTeam(time.id); }
        };
      })
    };
  }

  function cardAtaque(data, ui, actions) {
    var times = golsPorTime(data).filter(function (t) { return t.pro > 0; });
    if (!times.length) return null;
    var top = melhores(times, function (t) { return t.pro; }, true);
    return {
      id: "ataque", label: "Ataque mais forte",
      items: top.map(function (t) {
        var time = data.timeById[t.id], b = teamBadge(time, ui);
        return {
          g: b.g, i: b.i, redondo: "12px",
          name: time.nome,
          sub: t.jogos + (t.jogos === 1 ? " jogo" : " jogos"),
          value: t.pro + " gols",
          open: function () { actions.openTeam(time.id); }
        };
      })
    };
  }

  function cardDefesa(data, ui, actions) {
    var times = golsPorTime(data);
    if (!times.length) return null;
    var top = melhores(times, function (t) { return t.contra; }, false);
    return {
      id: "defesa", label: "Defesa menos vazada",
      items: top.map(function (t) {
        var time = data.timeById[t.id], b = teamBadge(time, ui);
        return {
          g: b.g, i: b.i, redondo: "12px",
          name: time.nome,
          sub: t.jogos + (t.jogos === 1 ? " jogo" : " jogos"),
          value: t.contra + (t.contra === 1 ? " gol sofrido" : " gols sofridos"),
          open: function () { actions.openTeam(time.id); }
        };
      })
    };
  }

  function cardGoleada(data, ui, actions) {
    var comMargem = jogosEncerrados(data).filter(function (g) {
      return Math.abs(g.golsCasa - g.golsFora) > 0;
    });
    if (!comMargem.length) return null;
    var top = melhores(comMargem, function (g) { return Math.abs(g.golsCasa - g.golsFora); }, true);
    return {
      id: "goleada", label: top.length > 1 ? "Maiores goleadas" : "Maior goleada",
      items: top.map(function (g) {
        var venceuCasa = g.golsCasa > g.golsFora;
        var vencedor = data.timeById[venceuCasa ? g.timeCasaId : g.timeForaId];
        var perdedor = data.timeById[venceuCasa ? g.timeForaId : g.timeCasaId];
        var b = teamBadge(vencedor, ui);
        return {
          g: b.g, i: b.i, redondo: "12px",
          name: (vencedor ? vencedor.nome : "?") + " " + Math.max(g.golsCasa, g.golsFora) +
            " × " + Math.min(g.golsCasa, g.golsFora) + " " + (perdedor ? perdedor.nome : "?"),
          sub: formatDatePt(g.data),
          value: "+" + Math.abs(g.golsCasa - g.golsFora),
          open: function () { actions.openMatch(g.id); }
        };
      })
    };
  }

  function cardLideres(data, ui, actions) {
    var porGrupo = {};
    data.times.forEach(function (t) { if (t.grupo) porGrupo[t.grupo] = true; });
    var grupos = Object.keys(porGrupo).sort();
    var items = [];
    grupos.forEach(function (grupo) {
      var ids = {};
      data.times.forEach(function (t) { if (t.grupo === grupo) ids[t.id] = true; });
      var rows = data.classificacao.filter(function (r) { return ids[r.timeId] && r.j > 0; });
      if (!rows.length) return;
      sortStandingsRows(rows, data);
      var lider = rows[0];
      var time = data.timeById[lider.timeId];
      if (!time) return;
      var b = teamBadge(time, ui);
      items.push({
        g: b.g, i: b.i, redondo: "12px",
        name: time.nome, sub: "GRUPO " + grupo,
        value: lider.p + (lider.p === 1 ? " pt" : " pts"),
        open: function () { actions.openTeam(time.id); }
      });
    });
    if (!items.length) return null;
    return { id: "lideres", label: "Líderes dos grupos", items: items };
  }

  function buildHighlights(data, ui, actions) {
    return [
      cardArtilheiro(data, ui, actions),
      cardAtaque(data, ui, actions),
      cardDefesa(data, ui, actions),
      cardGoleada(data, ui, actions),
      cardLideres(data, ui, actions)
    ].filter(Boolean);
  }

  // ---- cabeçalho (contagens e período, calculados da planilha) --------------

  function buildHeroDateRange(data) {
    var dates = data.jogos.map(function (g) { return parseYMD(g.data); }).filter(Boolean);
    if (!dates.length) return "";
    var min = dates[0], max = dates[0];
    dates.forEach(function (d) { if (d < min) min = d; if (d > max) max = d; });
    var fmt = function (d) { return pad2(d.getDate()) + " " + MO[d.getMonth()]; };
    return fmt(min) + " — " + fmt(max);
  }
  function buildHeroCity(data) {
    var counts = {}, best = "", bestCount = 0;
    data.times.forEach(function (t) { if (t.cidade) counts[t.cidade] = (counts[t.cidade] || 0) + 1; });
    Object.keys(counts).forEach(function (c) { if (counts[c] > bestCount) { best = c; bestCount = counts[c]; } });
    return best;
  }

  // ---- montagem final -------------------------------------------------------

  function buildVals(data, ui, actions) {
    var config = data.config;
    var cardsWithGame = buildAllCards(data, ui, actions);
    var groupsList = buildGroupsList(data);
    var activeGroup = (ui.group && groupsList.indexOf(ui.group) !== -1) ? ui.group : (groupsList[0] || null);
    var standings = buildStandings(data, activeGroup, ui, actions);
    var scorers = buildScorers(data, ui);
    var highlights = buildHighlights(data, ui, actions);
    var newsB = buildNews(data, ui.brokenImages, actions);
    var newsDetail = buildNewsDetail(data, ui.newsOpenId, ui.brokenImages);
    var openGame = ui.openId ? data.jogoById[ui.openId] : null;
    var radioUrl = resolveRadioUrl(data);
    var dateRange = buildHeroDateRange(data);
    var city = buildHeroCity(data);
    var validationIssues = buildValidationIssues(data);
    var teamProfile = buildTeamProfile(data, ui.teamOpenId, ui, actions);
    var mediaItems = buildMediaItems(data, actions);
    var regulamentoBlocks = buildPaginaBlocks(data, "Regulamento");
    var contatoBlocks = buildPaginaBlocks(data, "Contato");
    var contatoLinks = buildContatoLinks(data);

    return {
      champName: config.nomeCampeonato,
      champSubtitle: config.mensagemTopo || "Acompanhe todos os jogos ao vivo",
      heroEyebrow: [dateRange, city ? city.toUpperCase() : ""].filter(Boolean).join(" · "),
      classifyLabel: "Zona de classificação (2 primeiros de cada grupo)",
      group: activeGroup ? ("GRUPO " + activeGroup) : "",
      hasGroups: groupsList.length > 0,
      homeSections: buildHomeSections(cardsWithGame),
      standings: standings, miniStandings: standings.slice(0, 5),
      groupBlocks: buildGroupBlocks(data, ui, actions),
      highlights: highlights, hasHighlights: highlights.length > 0,
      groupsTabs: buildGroupsTabs(groupsList, activeGroup, actions),
      scorers: scorers, hasScorers: scorers.length > 0,
      news: newsB.all, hasNews: newsB.all.length > 0,
      newsHighlights: newsB.highlights, hasNewsHighlights: newsB.highlights.length > 0,
      newsDetail: newsDetail,
      filters: buildFilters(ui, actions), views: buildViews(ui, actions),
      grupoFilters: buildGrupoFilters(data, ui, actions),
      rodadaFilters: buildRodadaFilters(data, ui, actions),
      groups: buildJogosGroups(cardsWithGame, ui),
      totalJogos: data.jogos.length,
      detail: buildDetail(openGame, data, ui, actions),
      radioNow: radioNowLabel(data),
      radioUrl: radioUrl, hasRadio: !!radioUrl,
      staleData: !!global.CopaData.getState().error,
      // Painel de diagnóstico da planilha: é ferramenta de quem administra, não
      // conteúdo pro torcedor. Só aparece com ?debug=1 na URL.
      validationIssues: validationIssues, hasValidationIssues: ui.debug && validationIssues.length > 0,
      validationIssuesCount: validationIssues.length,
      teamsGrouped: buildTeamsGrouped(data, ui, actions), hasTeams: data.times.length > 0,
      teamProfile: teamProfile,
      followTeams: buildFollowTeams(data, ui.followedTeams, ui, actions),
      mediaItems: mediaItems, hasMediaItems: mediaItems.length > 0,
      regulamentoBlocks: regulamentoBlocks, hasRegulamento: regulamentoBlocks.length > 0,
      contatoBlocks: contatoBlocks, hasContato: contatoBlocks.length > 0,
      contatoLinks: contatoLinks, hasContatoLinks: contatoLinks.length > 0,
      searchResults: buildSearchResults(data, ui.searchQuery, ui, actions)
    };
  }

  global.CopaViewModel = {
    buildVals: buildVals,
    dayLabel: dayLabel,
    youTubeEmbedUrl: youTubeEmbedUrl,
    timeToSeconds: timeToSeconds
  };
})(window);
