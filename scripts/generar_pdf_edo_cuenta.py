"""
Genera el PDF del estado de cuenta bancario (estado_cuenta.csv)
usando ReportLab con formato profesional.
"""
import csv
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ── Rutas ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH   = os.path.join(BASE_DIR, "docsdemo", "estado_cuenta.csv")
PDF_PATH   = os.path.join(BASE_DIR, "docsdemo", "estado_cuenta.pdf")

# ── Paleta de colores ──────────────────────────────────────────────────────
AZUL_OSCURO  = colors.HexColor("#1E3A5F")
AZUL_MEDIO   = colors.HexColor("#2563EB")
AZUL_CLARO   = colors.HexColor("#EFF6FF")
VERDE        = colors.HexColor("#16A34A")
ROJO         = colors.HexColor("#DC2626")
GRIS_HEADER  = colors.HexColor("#F1F5F9")
GRIS_BORDE   = colors.HexColor("#CBD5E1")
BLANCO       = colors.white
NEGRO        = colors.HexColor("#111827")

def fmt_mxn(val_str):
    """Formatea un número como moneda MXN."""
    if not val_str or val_str.strip() == "":
        return ""
    try:
        num = float(val_str)
        return f"${num:,.2f}"
    except ValueError:
        return val_str

def load_csv(path):
    rows = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if any(v.strip() for v in row.values()):
                rows.append(row)
    return rows

def build_pdf():
    rows = load_csv(CSV_PATH)

    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=landscape(letter),
        leftMargin=1.5*cm,
        rightMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm,
    )

    styles = getSampleStyleSheet()

    # Estilos personalizados
    title_style = ParagraphStyle(
        "titulo",
        parent=styles["Normal"],
        fontSize=18,
        fontName="Helvetica-Bold",
        textColor=AZUL_OSCURO,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "subtitulo",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor=colors.HexColor("#475569"),
        spaceAfter=2,
    )
    meta_style = ParagraphStyle(
        "meta",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#64748B"),
    )
    footer_style = ParagraphStyle(
        "footer",
        parent=styles["Normal"],
        fontSize=7.5,
        fontName="Helvetica",
        textColor=colors.HexColor("#94A3B8"),
        alignment=TA_CENTER,
    )

    elements = []

    # ── ENCABEZADO ─────────────────────────────────────────────────────────
    fecha_gen = datetime.now().strftime("%d/%m/%Y  %H:%M hrs")
    periodo   = f"{rows[0]['Fecha']}  →  {rows[-1]['Fecha']}" if rows else "N/A"
    saldo_ini = fmt_mxn(rows[0].get('Saldo', '')) if rows else "N/A"
    saldo_fin = fmt_mxn(rows[-1].get('Saldo', '')) if rows else "N/A"
    total_mov = len(rows)
    total_abonos = sum(float(r['Abono']) for r in rows if r.get('Abono','').strip())
    total_cargos = sum(float(r['Cargo']) for r in rows if r.get('Cargo','').strip())

    # Header table: logo/título + resumen
    header_data = [
        [
            Paragraph("DEMO123456XYZ", ParagraphStyle("rfc", parent=styles["Normal"], fontSize=9, fontName="Helvetica", textColor=colors.HexColor("#64748B"))),
            Paragraph("Generado:", ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, fontName="Helvetica", textColor=colors.HexColor("#64748B"), alignment=TA_RIGHT)),
        ],
        [
            Paragraph("Estado de Cuenta Bancario", title_style),
            Paragraph(fecha_gen, ParagraphStyle("val", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=AZUL_OSCURO, alignment=TA_RIGHT)),
        ],
        [
            Paragraph(f"Período: {periodo}", subtitle_style),
            Paragraph(f"Total de movimientos: {total_mov}", ParagraphStyle("val2", parent=styles["Normal"], fontSize=8, fontName="Helvetica", textColor=colors.HexColor("#475569"), alignment=TA_RIGHT)),
        ],
    ]
    header_table = Table(header_data, colWidths=["65%", "35%"])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("TOPPADDING", (0,0), (-1,-1), 3),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=2, color=AZUL_MEDIO, spaceAfter=8))

    # ── TARJETAS RESUMEN ───────────────────────────────────────────────────
    resumen_data = [[
        Paragraph(f"<b>Saldo Inicial</b><br/><font size='14' color='#1E3A5F'>{saldo_ini}</font>", styles["Normal"]),
        Paragraph(f"<b>Total Abonos</b><br/><font size='14' color='#16A34A'>{fmt_mxn(str(total_abonos))}</font>", styles["Normal"]),
        Paragraph(f"<b>Total Cargos</b><br/><font size='14' color='#DC2626'>{fmt_mxn(str(total_cargos))}</font>", styles["Normal"]),
        Paragraph(f"<b>Saldo Final</b><br/><font size='14' color='#1E3A5F'>{saldo_fin}</font>", styles["Normal"]),
    ]]
    resumen_table = Table(resumen_data, colWidths=["25%","25%","25%","25%"])
    resumen_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), AZUL_CLARO),
        ("BOX", (0,0), (-1,-1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0,0), (-1,-1), 0.5, GRIS_BORDE),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("ROUNDEDCORNERS", [4,4,4,4]),
    ]))
    elements.append(resumen_table)
    elements.append(Spacer(1, 10))

    # ── TABLA DE MOVIMIENTOS ───────────────────────────────────────────────
    col_headers = ["#", "Fecha", "Concepto", "Referencia", "Cargo", "Abono", "Saldo"]
    table_data  = [col_headers]

    for i, row in enumerate(rows, 1):
        cargo  = fmt_mxn(row.get("Cargo", ""))
        abono  = fmt_mxn(row.get("Abono", ""))
        saldo  = fmt_mxn(row.get("Saldo", ""))
        concepto   = row.get("Concepto", "")
        referencia = row.get("Referencia", "")

        # Recortar referencia larga
        if len(referencia) > 28:
            referencia = referencia[:26] + "…"
        if len(concepto) > 40:
            concepto = concepto[:38] + "…"

        table_data.append([
            str(i),
            row.get("Fecha", ""),
            concepto,
            referencia,
            cargo,
            abono,
            saldo,
        ])

    col_w = [0.5*cm, 2.4*cm, 6.5*cm, 5.8*cm, 2.6*cm, 2.6*cm, 3.0*cm]
    mov_table = Table(table_data, colWidths=col_w, repeatRows=1)

    # Estilo base
    ts = TableStyle([
        # Encabezado
        ("BACKGROUND",    (0,0), (-1,0), AZUL_OSCURO),
        ("TEXTCOLOR",     (0,0), (-1,0), BLANCO),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 8),
        ("ALIGN",         (0,0), (-1,0), "CENTER"),
        ("TOPPADDING",    (0,0), (-1,0), 6),
        ("BOTTOMPADDING", (0,0), (-1,0), 6),
        # Datos
        ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,1), (-1,-1), 7.5),
        ("TOPPADDING",    (0,1), (-1,-1), 4),
        ("BOTTOMPADDING", (0,1), (-1,-1), 4),
        # Alineación columnas numéricas
        ("ALIGN",         (0,0), (0,-1), "CENTER"),  # #
        ("ALIGN",         (1,0), (1,-1), "CENTER"),  # Fecha
        ("ALIGN",         (4,0), (-1,-1), "RIGHT"),  # Cargo/Abono/Saldo
        # Rejilla
        ("GRID",          (0,0), (-1,-1), 0.4, GRIS_BORDE),
        # Filas alternas
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [BLANCO, GRIS_HEADER]),
    ])

    # Colorear cargos en rojo, abonos en verde
    for i, row in enumerate(rows, 1):
        if row.get("Cargo", "").strip():
            ts.add("TEXTCOLOR", (4, i), (4, i), ROJO)
            ts.add("FONTNAME",  (4, i), (4, i), "Helvetica-Bold")
        if row.get("Abono", "").strip():
            ts.add("TEXTCOLOR", (5, i), (5, i), VERDE)
            ts.add("FONTNAME",  (5, i), (5, i), "Helvetica-Bold")

    mov_table.setStyle(ts)
    elements.append(mov_table)

    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRIS_BORDE))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Este documento es generado automáticamente por ContAuditAI. Solo para fines de demostración.",
        footer_style
    ))

    doc.build(elements)
    print(f"PDF generado: {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
