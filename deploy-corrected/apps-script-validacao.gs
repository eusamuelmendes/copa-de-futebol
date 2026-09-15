// apps-script-validacao.gs
//
// Escreve de volta a coluna "ValidacaoErro" da aba Jogos, com a mensagem de
// qual campo falhou em cada linha (ou vazio quando a linha está válida).
// O site já valida e ignora linhas ruins sozinho, sem depender disso — este
// script só existe pra você ENXERGAR o erro dentro da própria planilha.
//
// Como instalar (uma vez só):
//   1. Abra a planilha da Copa → Extensões → Apps Script.
//   2. Apague o conteúdo padrão do Code.gs e cole este arquivo inteiro.
//   3. Implantar → Nova implantação → tipo "App da Web".
//      - Executar como: Eu (sua conta)
//      - Quem pode acessar: Qualquer pessoa
//   4. Autorize as permissões pedidas e copie a URL gerada (termina em /exec).
//   5. Cole essa URL na constante VALIDATION_WEBHOOK_URL no topo de data.js.
//
// Se você nunca fizer esse passo, nada quebra: o site continua funcionando
// normalmente, só a coluna ValidacaoErro não se preenche sozinha.

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var rows = body.rows || []; // [{ jogoId, erro }]

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jogos");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "aba Jogos não encontrada" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var jogoIdCol = header.indexOf("JogoID");
  var erroCol = header.indexOf("ValidacaoErro");

  if (erroCol === -1) {
    erroCol = header.length;
    sheet.getRange(1, erroCol + 1).setValue("ValidacaoErro");
  }

  var byId = {};
  rows.forEach(function (r) { byId[String(r.jogoId)] = r.erro || ""; });

  for (var i = 1; i < data.length; i++) {
    var jogoId = String(data[i][jogoIdCol]);
    if (Object.prototype.hasOwnProperty.call(byId, jogoId)) {
      sheet.getRange(i + 1, erroCol + 1).setValue(byId[jogoId]);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true, updated: rows.length }))
    .setMimeType(ContentService.MimeType.JSON);
}
