import os
import uuid
import random
import csv
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET

# Intentar importar reportlab para generar el PDF
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    PDF_ENABLED = True
except ImportError:
    PDF_ENABLED = False
    print("Reportlab no está instalado. El PDF no se generará. Para generarlo ejecuta: pip install reportlab")

import glob

OUTPUT_DIR = "docsdemo"
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
else:
    for f in glob.glob(os.path.join(OUTPUT_DIR, "*")):
        try:
            os.remove(f)
        except OSError:
            pass

EMISOR_RFC = "DEMO123456XYZ"
EMISOR_NOMBRE = "EMPRESA DEMO SA DE CV"

def random_date(start, end):
    return start + timedelta(
        seconds=random.randint(0, int((end - start).total_seconds())),
    )

start_date = datetime(2026, 5, 1)
end_date = datetime(2026, 5, 30)

movimientos_banco = []
def agregar_movimiento(fecha, concepto, referencia, abono=0.0, cargo=0.0):
    movimientos_banco.append({
        'Fecha': fecha.strftime("%Y-%m-%d"),
        'Concepto': concepto,
        'Referencia': referencia,
        'Cargo': round(cargo, 2) if cargo > 0 else '',
        'Abono': round(abono, 2) if abono > 0 else '',
        'Saldo': 0.0
    })

def generate_xml(index, tipo, amount, fecha, folio_str):
    invoice_uuid = str(uuid.uuid4()).upper()
    
    # Root
    cfdi = ET.Element('cfdi:Comprobante', {
        'xmlns:cfdi': "http://www.sat.gob.mx/cfd/4",
        'Version': "4.0",
        'Serie': "F",
        'Folio': str(index),
        'Fecha': fecha.strftime("%Y-%m-%dT%H:%M:%S"),
        'Total': str(round(amount, 2)),
        'SubTotal': str(round(amount / 1.16, 2)),
        'Moneda': "MXN",
        'TipoDeComprobante': "I",
        'MetodoPago': "PUE" if tipo in ['PUE_EXACTO', 'PUE_CENTAVOS', 'PUE_NO_PAGADA'] else "PPD",
        'FormaPago': "03" if 'PUE' in tipo else "99",
        'LugarExpedicion': "10000"
    })
    
    # Emisor
    ET.SubElement(cfdi, 'cfdi:Emisor', {
        'Rfc': EMISOR_RFC,
        'Nombre': EMISOR_NOMBRE,
        'RegimenFiscal': "601"
    })
    
    # Receptor
    receptor_rfc = f"REC{random.randint(100000, 999999)}ABC"
    ET.SubElement(cfdi, 'cfdi:Receptor', {
        'Rfc': receptor_rfc,
        'Nombre': f"CLIENTE {index} SA DE CV",
        'UsoCFDI': "G03",
        'RegimenFiscalReceptor': "601",
        'DomicilioFiscalReceptor': "20000"
    })
    
    descripciones = [
        "Servicios profesionales de consultoría",
        "Mantenimiento preventivo de servidores",
        "Licenciamiento de software empresarial",
        "Estrategia de marketing digital",
        "Auditoría contable y fiscal",
        "Implementación de ERP en la nube",
        "Soporte técnico de infraestructura",
        "Honorarios legales y corporativos",
        "Capacitación de personal operativo"
    ]
    
    # Conceptos
    conceptos = ET.SubElement(cfdi, 'cfdi:Conceptos')
    concepto = ET.SubElement(conceptos, 'cfdi:Concepto', {
        'ClaveProdServ': "84111506",
        'Cantidad': "1",
        'ClaveUnidad': "E48",
        'Descripcion': random.choice(descripciones),
        'ValorUnitario': str(round(amount / 1.16, 2)),
        'Importe': str(round(amount / 1.16, 2)),
        'ObjetoImp': "02"
    })
    
    # Impuestos
    impuestos = ET.SubElement(cfdi, 'cfdi:Impuestos', {
        'TotalImpuestosTrasladados': str(round(amount - (amount / 1.16), 2))
    })
    traslados = ET.SubElement(impuestos, 'cfdi:Traslados')
    ET.SubElement(traslados, 'cfdi:Traslado', {
        'Base': str(round(amount / 1.16, 2)),
        'Impuesto': "002",
        'TipoFactor': "Tasa",
        'TasaOCuota': "0.160000",
        'Importe': str(round(amount - (amount / 1.16), 2))
    })
    
    # Complemento
    complemento = ET.SubElement(cfdi, 'cfdi:Complemento')
    ET.SubElement(complemento, 'tfd:TimbreFiscalDigital', {
        'xmlns:tfd': "http://www.sat.gob.mx/TimbreFiscalDigital",
        'UUID': invoice_uuid
    })
    
    tree = ET.ElementTree(cfdi)
    ET.indent(tree, space="\t", level=0)
    filename = os.path.join(OUTPUT_DIR, f"{EMISOR_RFC}_F{index}_{invoice_uuid[:8]}.xml")
    tree.write(filename, encoding="utf-8", xml_declaration=True)
    return invoice_uuid, receptor_rfc

print("Generando 100 XMLs y registros de banco...")

# 1. 60 PUE (Match Exacto)
for i in range(1, 61):
    monto = round(random.uniform(1000, 50000), 2)
    fecha = random_date(start_date, end_date)
    generate_xml(i, 'PUE_EXACTO', monto, fecha, f"F{i}")
    agregar_movimiento(fecha, f"PAGO FACTURA F{i}", f"REF{i}", abono=monto)

# 2. 10 PUE (Diferencia de Centavos)
for i in range(61, 71):
    monto = round(random.uniform(1000, 20000), 2)
    fecha = random_date(start_date, end_date)
    generate_xml(i, 'PUE_CENTAVOS', monto, fecha, f"F{i}")
    diferencia = round(random.uniform(-0.99, 0.99), 2)
    monto_banco = round(monto + diferencia, 2)
    agregar_movimiento(fecha, f"PAGO FACTURA F{i}", f"REF{i}", abono=monto_banco)

# 3. 10 PUE / PPD (No pagadas)
for i in range(71, 81):
    monto = round(random.uniform(5000, 30000), 2)
    fecha = random_date(start_date, end_date)
    generate_xml(i, 'PUE_NO_PAGADA', monto, fecha, f"F{i}")
    # No se agrega movimiento al banco

# 4. 20 PPD (Pagos Diferidos) -> Generan depósito pero requieren REP
for i in range(81, 101):
    monto = round(random.uniform(15000, 80000), 2)
    fecha = random_date(start_date, end_date)
    generate_xml(i, 'PPD', monto, fecha, f"F{i}")
    fecha_pago = fecha + timedelta(days=random.randint(1, 5))
    agregar_movimiento(fecha_pago, f"TRANSFERENCIA SPEI", f"REF{i}", abono=monto)

# 5. 5 Movimientos Bancarios Huérfanos
for i in range(101, 106):
    fecha = random_date(start_date, end_date)
    if i % 2 == 0:
        agregar_movimiento(fecha, "COMISION POR MANEJO DE CUENTA", f"REF{i}", cargo=250.00)
    else:
        agregar_movimiento(fecha, "TRASPASO ENTRE CUENTAS PROPIAS", f"REF{i}", abono=15000.00)

# Sort banco por fecha
movimientos_banco.sort(key=lambda x: x['Fecha'])

# Recalcular saldos cronológicamente
saldo_actual = 500000.00
for mov in movimientos_banco:
    abono = mov['Abono'] if mov['Abono'] != '' else 0.0
    cargo = mov['Cargo'] if mov['Cargo'] != '' else 0.0
    saldo_actual = saldo_actual + abono - cargo
    mov['Saldo'] = round(saldo_actual, 2)

# Exportar CSV
csv_filename = os.path.join(OUTPUT_DIR, "estado_cuenta.csv")
with open(csv_filename, mode='w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo'])
    writer.writeheader()
    writer.writerows(movimientos_banco)
print(f"CSV generado en: {csv_filename}")

# Generar PDF si está habilitado
if PDF_ENABLED:
    pdf_filename = os.path.join(OUTPUT_DIR, "estado_cuenta.pdf")
    doc = SimpleDocTemplate(pdf_filename, pagesize=letter)
    elements = []
    
    styles = getSampleStyleSheet()
    elements.append(Paragraph("Estado de Cuenta Bancario - Mayo 2026", styles['Title']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"Empresa: {EMISOR_NOMBRE} | RFC: {EMISOR_RFC}", styles['Normal']))
    elements.append(Spacer(1, 12))
    
    data = [['Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo']]
    for mov in movimientos_banco:
        data.append([
            mov['Fecha'],
            mov['Concepto'][:25],
            mov['Referencia'],
            f"${mov['Cargo']}" if mov['Cargo'] else "",
            f"${mov['Abono']}" if mov['Abono'] else "",
            f"${mov['Saldo']}"
        ])
        
    t = Table(data, colWidths=[70, 160, 60, 60, 60, 80])
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
    ]))
    
    elements.append(t)
    doc.build(elements)
    print(f"PDF generado en: {pdf_filename}")

print("¡Generación completada exitosamente!")
