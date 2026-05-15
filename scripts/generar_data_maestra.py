import os
import uuid
import random
import csv
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET

# Configuración de Empresa Demo
USER_RFC = "DEMO123456XYZ"
USER_NOMBRE = "EMPRESA DEMO SA DE CV"
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

# Datos de Escenario
RFC_EFOS = "AAA010101AAA"
CLIENTES = [("CLI001", "ABARROTES EL PAISA SA"), ("CLI002", "CONSTRUCTORA DEL NORTE"), ("CLI003", "RESTAURANTE EL SABOR")]
PROVEEDORES = [("CFE910101ABC", "CFE"), ("TEL900101XYZ", "TELMEX"), ("AMA120101USA", "AMAZON")]

def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

def generate_xml(emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, monto, fecha, folio, metodo="PUE", tipo="I", uuid_relacionado=None):
    invoice_uuid = str(uuid.uuid4()).upper()
    subtotal = round(monto / 1.16, 2)
    iva = round(monto - subtotal, 2)
    
    cfdi = ET.Element('cfdi:Comprobante', {
        'xmlns:cfdi': "http://www.sat.gob.mx/cfd/4",
        'Version': "4.0", 'Folio': str(folio), 'Fecha': fecha.strftime("%Y-%m-%dT%H:%M:%S"),
        'Total': str(round(monto, 2)), 'SubTotal': str(subtotal), 'Moneda': "MXN",
        'TipoDeComprobante': tipo, 'MetodoPago': metodo, 'LugarExpedicion': "10000"
    })
    
    # AGREGAR RELACION SI EXISTE (Para CRPs)
    if uuid_relacionado:
        relacionados = ET.SubElement(cfdi, 'cfdi:CfdiRelacionados', {'TipoRelacion': "04"})
        ET.SubElement(relacionados, 'cfdi:CfdiRelacionado', {'UUID': uuid_relacionado})

    ET.SubElement(cfdi, 'cfdi:Emisor', {'Rfc': emisor_rfc, 'Nombre': emisor_nombre, 'RegimenFiscal': "601"})
    ET.SubElement(cfdi, 'cfdi:Receptor', {'Rfc': receptor_rfc, 'Nombre': receptor_nombre, 'UsoCFDI': "G03", 'RegimenFiscalReceptor': "601", 'DomicilioFiscalReceptor': "20000"})
    
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
    
    conceptos = ET.SubElement(cfdi, 'cfdi:Conceptos')
    ET.SubElement(conceptos, 'cfdi:Concepto', {
        'ClaveProdServ': "84111506", 'Cantidad': "1", 'ClaveUnidad': "E48", 'Descripcion': random.choice(descripciones),
        'ValorUnitario': str(subtotal), 'Importe': str(subtotal), 'ObjetoImp': "02"
    })
    
    complemento = ET.SubElement(cfdi, 'cfdi:Complemento')
    ET.SubElement(complemento, 'tfd:TimbreFiscalDigital', {'xmlns:tfd': "http://www.sat.gob.mx/TimbreFiscalDigital", 'UUID': invoice_uuid})
    
    tree = ET.ElementTree(cfdi)
    filename = os.path.join(OUTPUT_DIR, f"{emisor_rfc}_{folio}_{invoice_uuid[:8]}.xml")
    tree.write(filename, encoding="utf-8", xml_declaration=True)
    return invoice_uuid

movimientos_banco = []
abril_start = datetime(2026, 4, 1)
mayo_end = datetime(2026, 5, 20)

print("Generando MEGA DATASET con vínculos UUID...")

# 1. MATCHES PERFECTOS (30)
for i in range(30):
    fecha = random_date(abril_start, mayo_end)
    folio = f"V-PERF-{i}"
    monto = round(random.uniform(1000, 5000), 2)
    generate_xml(USER_RFC, USER_NOMBRE, "CLI001", "CLIENTE OK", monto, fecha, folio)
    movimientos_banco.append({'Fecha': fecha, 'Concepto': f"PAGO {folio}", 'Referencia': folio, 'Abono': monto, 'Cargo': 0})

# 2. DIFERENCIA CENTAVOS (3)
for i in range(3):
    fecha = random_date(abril_start, mayo_end)
    folio = f"V-CENT-{i}"
    monto = 1000.50
    generate_xml(USER_RFC, USER_NOMBRE, "CLI002", "CLIENTE CENT", monto, fecha, folio)
    movimientos_banco.append({'Fecha': fecha + timedelta(days=1), 'Concepto': f"PAGO {folio}", 'Referencia': folio, 'Abono': 1000.00, 'Cargo': 0})

# 3. PPD CON CRP OK (5) - Cruce de Mes
for i in range(5):
    fecha_ppd = datetime(2026, 4, 20) + timedelta(days=i)
    folio_ppd = f"V-PPD-OK-{i}"
    uuid_ppd = generate_xml(USER_RFC, USER_NOMBRE, "CLI003", "CLIENTE PPD", 5000.00, fecha_ppd, folio_ppd, metodo="PPD")
    # Pago en Mayo
    fecha_pago = datetime(2026, 5, 5) + timedelta(days=i)
    movimientos_banco.append({'Fecha': fecha_pago, 'Concepto': f"PAGO {folio_ppd}", 'Referencia': folio_ppd, 'Abono': 5000.00, 'Cargo': 0})
    # Generar CRP vinculado
    generate_xml(USER_RFC, USER_NOMBRE, "CLI003", "CLIENTE PPD", 5000.00, fecha_pago, f"CRP-{i}", tipo="P", uuid_relacionado=uuid_ppd)

# 4. PPD SIN CRP (3) - Alerta Grave
for i in range(3):
    fecha_ppd = datetime(2026, 4, 10) + timedelta(days=i)
    folio_ppd = f"G-PPD-ALERTA-{i}"
    monto = 8000.00
    generate_xml("PROV-X", "PROVEEDOR PPD", USER_RFC, USER_NOMBRE, monto, fecha_ppd, folio_ppd, metodo="PPD")
    movimientos_banco.append({'Fecha': fecha_ppd + timedelta(days=15), 'Concepto': f"PAGO {folio_ppd}", 'Referencia': folio_ppd, 'Abono': 0, 'Cargo': monto})
    # NO generamos CRP

# 6. MATCH GLOBAL (2) - 1 Pago para 2 Facturas
for i in range(2):
    fecha = random_date(abril_start, mayo_end)
    f1, f2 = f"V-GLOB-{i}A", f"V-GLOB-{i}B"
    generate_xml(USER_RFC, USER_NOMBRE, "CLI001", "CLIENTE GLOBAL", 1000.00, fecha, f1)
    generate_xml(USER_RFC, USER_NOMBRE, "CLI001", "CLIENTE GLOBAL", 1000.00, fecha, f2)
    movimientos_banco.append({'Fecha': fecha + timedelta(hours=2), 'Concepto': f"PAGO GLOBAL {f1} {f2}", 'Referencia': f"{f1} {f2}", 'Abono': 2000.00, 'Cargo': 0})

# 7. PAGO PARCIAL (2)
for i in range(2):
    fecha = random_date(abril_start, mayo_end)
    folio = f"V-PARC-{i}"
    generate_xml(USER_RFC, USER_NOMBRE, "CLI002", "CLIENTE PARCIAL", 10000.00, fecha, folio)
    movimientos_banco.append({'Fecha': fecha + timedelta(days=2), 'Concepto': f"ABONO FACTURA {folio}", 'Referencia': folio, 'Abono': 5000.00, 'Cargo': 0})

# 8. PARA CANCELACIÓN (2)
for i in range(2):
    fecha = random_date(abril_start, mayo_end)
    folio = f"V-CANC-{i}"
    generate_xml(USER_RFC, USER_NOMBRE, "CLI003", "CLIENTE CANCEL", 3500.00, fecha, folio)
    movimientos_banco.append({'Fecha': fecha, 'Concepto': f"PAGO {folio}", 'Referencia': folio, 'Abono': 3500.00, 'Cargo': 0})
    # Estas las marcaremos como "Canceladas" en la base de datos después.

# 9. HUÉRFANOS Y MOROSOS
for i in range(2):
    fecha = datetime(2026, 4, 15) + timedelta(days=i)
    folio = f"EFOS-{i}"
    generate_xml(RFC_EFOS, "EMPRESA FANTASMA", USER_RFC, USER_NOMBRE, 25000.00, fecha, folio)
    movimientos_banco.append({'Fecha': fecha + timedelta(hours=5), 'Concepto': "PAGO PROVEEDOR", 'Referencia': folio, 'Abono': 0, 'Cargo': 25000.00})

# 2.4 Pago sin XML (Huérfano Antiguo - Marzo)
# Agregamos 3 depósitos en Marzo que no tienen factura en el sistema
for i in range(3):
    fecha_huerfano = datetime(2026, 3, 5) + timedelta(days=i*5)
    monto = round(random.uniform(5000, 20000), 2)
    movimientos_banco.append({
        'Fecha': fecha_huerfano, 
        'Concepto': f"DEPOSITO POR IDENTIFICAR MZO-{i}", 
        'Referencia': "S/R", 
        'Abono': monto, 
        'Cargo': 0
    })
generate_xml(USER_RFC, USER_NOMBRE, "CLI-001", "CLIENTE MOROSO", 30000.00, datetime(2026, 3, 15), "V-MOROSO", "PUE")

# --- FINALIZAR BANCO ---
movimientos_banco.sort(key=lambda x: x['Fecha'])
saldo = 300000.00
for mov in movimientos_banco:
    saldo = saldo + mov.get('Abono', 0) - mov.get('Cargo', 0)
    mov['Saldo'] = round(saldo, 2)
    mov['Fecha'] = mov['Fecha'].strftime("%Y-%m-%d")

with open(os.path.join(OUTPUT_DIR, "estado_cuenta.csv"), mode='w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo'])
    writer.writeheader()
    for m in movimientos_banco:
        writer.writerow({'Fecha': m['Fecha'], 'Concepto': m['Concepto'], 'Referencia': m['Referencia'], 
                         'Cargo': m['Cargo'] if m['Cargo'] > 0 else '', 'Abono': m['Abono'] if m['Abono'] > 0 else '', 'Saldo': m['Saldo']})

print(f"Dataset MEGA con Vínculos UUID generado exitosamente.")
