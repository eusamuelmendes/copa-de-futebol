"""Exportação de relatórios para CSV e PDF."""

import csv
from pathlib import Path
from typing import Sequence


def exportar_csv(caminho: str | Path, cabecalho: Sequence[str], linhas: Sequence[Sequence]) -> Path:
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", newline="", encoding="utf-8") as arquivo:
        writer = csv.writer(arquivo)
        writer.writerow(cabecalho)
        writer.writerows(linhas)
    return caminho


class PDFIndisponivelError(RuntimeError):
    """Lançada quando a biblioteca reportlab não está instalada."""


def exportar_pdf(
    titulo: str, cabecalho: Sequence[str], linhas: Sequence[Sequence], caminho: str | Path
) -> Path:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError as exc:
        raise PDFIndisponivelError(
            "Exportação em PDF requer o pacote 'reportlab'. "
            "Instale com: pip install reportlab (ou utilize a exportação em CSV)."
        ) from exc

    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(str(caminho), pagesize=landscape(A4))
    estilos = getSampleStyleSheet()
    elementos = [Paragraph(titulo, estilos["Title"]), Spacer(1, 12)]

    dados = [list(cabecalho)] + [[str(v) for v in linha] for linha in linhas]
    tabela = Table(dados, repeatRows=1)
    tabela.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1b5e20")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elementos.append(tabela)
    doc.build(elementos)
    return caminho
