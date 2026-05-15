import os
import csv
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

OUTPUT_DIR = "docsdemo"
EMISOR_RFC = "DEMO123456XYZ"
EMISOR_NOMBRE = "EMPRESA DEMO SA DE CV"

csv_filename = os.path.join(OUTPUT_DIR, "estado_cuenta.csv")
pdf_filename = os.path.join(OUTPUT_DIR, "estado_cuenta.pdf")

movimientos = []
if not os.path.exists(csv_filename):
    print(f"Error: No se encontró el archivo {csv_filename}")
    exit(1)

with open(csv_filename, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        movimientos.append(row)

doc = SimpleDocTemplate(pdf_filename, pagesize=letter)
elements = []

styles = getSampleStyleSheet()
elements.append(Paragraph("Estado de Cuenta Bancario - Mayo/Junio 2026", styles['Title']))
elements.append(Spacer(1, 12))
elements.append(Paragraph(f"Empresa: {EMISOR_NOMBRE} | RFC: {EMISOR_RFC}", styles['Normal']))
elements.append(Spacer(1, 12))

data = [['Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo']]
for mov in movimientos:
    # Formatear montos para que se vean como moneda si no lo están
    cargo = mov['Cargo']
    abono = mov['Abono']
    saldo = mov['Saldo']
    
    data.append([
        mov['Fecha'],
        mov['Concepto'][:28],
        mov['Referencia'],
        f"${cargo}" if cargo else "",
        f"${abono}" if abono else "",
        f"${saldo}"
    ])

# Ajuste de anchos de columna para que quepa todo bien
t = Table(data, colWidths=[65, 165, 60, 60, 60, 80], repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f3460")),
    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,0), 10),
    ('BOTTOMPADDING', (0,0), (-1,0), 12),
    ('BACKGROUND', (0,1), (-1,-1), colors.white),
    ('GRID', (0,0), (-1,-1), 1, colors.black),
    ('FONTSIZE', (0,1), (-1,-1), 8),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))

elements.append(t)
doc.build(elements)
print(f"PDF actualizado exitosamente en: {pdf_filename}")
