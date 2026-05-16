# 📘 Manual Técnico: Motor de Alertas ContAuditAI (v11)

Este documento detalla los criterios, fórmulas y fundamentos legales de las 10 alertas fiscales integradas en el motor de pre-auditoría de **ContAuditAI**.

---

## 🧮 Variables Globales de Cálculo
Para todos los cálculos de conciliación, el motor utiliza las siguientes definiciones:
*   **`v_net` (Monto Neto):** `Total CFDI - ISR Retenido`. El sistema asume que el depósito bancario debe cubrir este monto (incluyendo el IVA).
*   **Umbral de Match Perfecto:** Diferencia absoluta `< $1.00`. Se utiliza para ignorar discrepancias por centavos o redondeos en conciliaciones de alta confianza.
*   **Umbral de Match Parcial:** Monto bancario situado entre el `50%` y el `99%` del monto neto del CFDI.

---

## 🚨 Matriz de Alertas Fiscales

| # | Alerta (Código) | Criterio Técnico (Fórmula SQL) | Severidad | Fundamento Legal | Acción Recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **EFOS_DETECTADO** | `rfc_emisor` encontrado en `contauditai.efos_edos`. | **CRÍTICA** | Art. 69-B CFF | Bloquear pagos y recabar evidencia de materialidad. |
| **02** | **CANCELACION_RETROACTIVA** | `estado_sat = 'Cancelado'` y fecha de cancelación > 24h post-emisión. | **CRÍTICA** | Art. 29-A CFF | Verificar si la factura ya fue pagada o deducida. |
| **03** | **PPD_SIN_CRP** | CFDI `PPD` sin registros en la tabla `cfdi_pagos`. | **MEDIA** | Regla 2.7.1.30 RMF | Solicitar el Complemento de Pago al proveedor. |
| **04** | **DISCREPANCIA_BANCARIA** | Depósito bancario < `v_net` (fuera del margen de $1.00). | **MEDIA** | Art. 27 LISR | Validar retenciones no declaradas o comisiones bancarias. |
| **05** | **VENTANA_72H** | Fecha de emisión CFDI > 72h después del depósito bancario. | **MEDIA** | Art. 29 CFF | Corregir procesos de facturación para cumplir plazos SAT. |
| **06** | **MATERIALIDAD_FALTANTE** | CFDI con `total >= $20,000` sin archivos adjuntos en el vault. | **MEDIA** | Art. 49-Bis CFF | Adjuntar contratos, fotos o entregables del servicio. |
| **07** | **INGRESO_NO_FACTURADO** | Transacción bancaria de tipo 'Ingreso' sin CFDI vinculado. | **MEDIA** | Art. 17 LISR | Emitir el CFDI de ingreso correspondiente para evitar multas. |
| **08** | **CONCILIACION_CRUCE_MES** | El mes de la factura no coincide con el mes del cobro/pago. | **BAJA** | Art. 11 LIVA | Ajustar el cálculo de IVA para el mes del flujo de efectivo. |
| **09** | **FACTURA_VENCIDA** | CFDI sin conciliar con fecha de emisión mayor a 30 días. | **BAJA** | Art. 31 LISR | Iniciar gestión de cobranza o verificar si el pago se perdió. |
| **10** | **HUERFANO_XML** | CFDI reciente (últimos 30 días) sin pago detectado. | **BAJA** | Art. 29 CFF | Monitorear el flujo de efectivo esperado. |

---

## 📈 Algoritmo de Risk Score (0–100)

El Risk Score es un indicador inverso de la salud fiscal del tenant. Se recalcula automáticamente tras cada análisis:

**Fórmula:**
`Score = 100 - (Criticas * 10) - (Medias * 2) - (Bajas * 0.5)`

*   **Puntuación 90-100:** Riesgo Bajo (Salud Fiscal Óptima).
*   **Puntuación 70-89:** Riesgo Medio (Requiere atención preventiva).
*   **Puntuación < 70:** Riesgo Alto (Exposición crítica ante el SAT).

---

## 🔍 Capas de Conciliación Bancaria

El motor de conciliación ejecuta tres pasadas lógicas:

1.  **Nivel 1 (Firma Digital):** Busca el UUID del CFDI dentro del campo `concepto_bancario` o `clave_rastreo` de la transacción. Confianza: **ALTA**.
2.  **Nivel 2 (Sincronía):** Match por `RFC Emisor` + `Monto Neto` + `Fecha` (ventana de 7 días antes a 45 días después). Confianza: **ALTA**.
3.  **Nivel 3 (Analítico):** Detecta pagos parciales (50%-99%). Si el monto coincide parcialmente, vincula la transacción pero dispara la alerta de **Discrepancia Bancaria**. Confianza: **BAJA**.

---
**Documentación Oficial ContAuditAI 2026**  
*Protegiendo la integridad fiscal de tu empresa.*
