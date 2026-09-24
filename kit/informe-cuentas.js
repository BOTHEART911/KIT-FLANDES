/* ============================================================
   KIT-FLANDES · PIEZA 23 · INFORME DE CUENTAS DE UN CONTRATO
   Entrega 6.3 (SUPERVISION). Hecha para usarse igual en CONTABILIDAD y
   TESORERÍA (fases 7 y 8): el CORE entrega las cuentas de UN contrato
   con FC63_informeCuentas_ y cada app registra su ruta con su permiso.

   Qué entrega
     · EXCEL (para trabajar): una fila por cuenta con TODAS las columnas
       que usan las tres oficinas — periodo, plata, planillas, revisión,
       orden de pago, egreso, giro, documentos y las actividades de cada
       obligación. Mismo orden en las tres apps: una macro o una tabla
       dinámica que sirva en una, sirve en las otras.
     · PDF (para leer): un informe gerencial membretado POR BLOQUES —
       arriba el contrato y las cifras (valor, cobrado, pagado, saldo),
       después una ficha por cuenta con su estado de color. Las
       actividades van solo si se piden (pueden ser decenas de páginas).
       No es la tabla del Excel pasada a PDF (regla de Oss, 23/09).

   Uso
     KIT.piezas.informeCuentas.aExcel(datos)
     KIT.piezas.informeCuentas.aPDF(datos, { actividades: true|false })
     KIT.piezas.informeCuentas.cifras(datos) -> {cuentas, valor, cobrado, pagado, saldo, ...}

   datos = { contrato: {...}, cuentas: [...], generado }  (ruta informeContratista)

   Depende de kit/exportar.js (membrete, jsPDF y Excel bajo demanda).
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) return;

  var PAGADAS = ['PAGADA'];
  var EN_PAGO = ['CERRADA', 'ORDEN DE PAGO', 'EGRESO'];

  function nombre(s) { return K.piezas.personas ? K.piezas.personas.nombrePropio(s) : String(s || ''); }
  function titulo(s) {
    return nombre(s).replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); })
                    .replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); });
  }
  function f(iso) { return iso ? K.fecha(iso) : ''; }
  function plata(v) { return v ? K.pesos(v) : ''; }

  /** El color de cada estado, igual que en las listas de las apps. */
  function tono(estado) {
    var e = K.norm(estado || '');
    if (e === 'PAGADA') return 'ok';
    if (e === 'DEVUELTA' || e === 'INCOMPLETA') return 'malo';
    if (EN_PAGO.indexOf(e) >= 0) return 'info';
    if (e === 'REPORTADA' || e === 'PLAN DE PAGOS' || e === 'REVISADA POR SUPERVISOR' || e === 'APROBADA') return 'aviso';
    return '';
  }

  /** Las cifras del contrato: lo que dice arriba del PDF y lo que pinta la vista. */
  function cifras(d) {
    var c = (d && d.contrato) || {}, L = (d && d.cuentas) || [];
    var cobrado = 0, pagado = 0, enTramite = 0, ultimo = null;
    L.forEach(function (x) {
      if (K.norm(x.estado) === 'BORRADOR') return;
      cobrado += Number(x.cobro) || 0;
      if (PAGADAS.indexOf(K.norm(x.estado)) >= 0) pagado += Number(x.cobro) || 0;
      else enTramite += Number(x.cobro) || 0;
      if (!ultimo || x.informe >= ultimo.informe) ultimo = x;
    });
    var valor = Number(c.valorFinal) || 0;
    var total = (c.informes && c.informes.total) || (ultimo && ultimo.total) || 0;
    return {
      cuentas: L.length, total: total, valor: valor, cobrado: cobrado, pagado: pagado, enTramite: enTramite,
      saldo: ultimo ? (Number(ultimo.nuevo) || 0) : valor,
      avance: valor ? Math.round(cobrado * 100 / valor) : 0,
      pagadas: L.filter(function (x) { return PAGADAS.indexOf(K.norm(x.estado)) >= 0; }).length
    };
  }

  /* ══════════════ EXCEL: las columnas compartidas ══════════════ */

  function columnas(d) {
    var c = d.contrato || {};
    var cols = [
      { titulo: 'ID contrato', campo: function () { return c.id; } },
      { titulo: 'Documento', campo: function () { return c.doc; } },
      { titulo: 'Contratista', campo: function () { return c.nombre; } },
      { titulo: 'N° contrato', campo: function () { return c.contrato; } },
      { titulo: 'Secretaría', campo: function () { return c.secretaria; } },
      { titulo: 'Supervisor', campo: function (x) { return x.supervisor || c.supervisor; } },
      { titulo: 'N° informe', campo: 'informe', tipo: 'numero' },
      { titulo: 'Total informes', campo: 'total', tipo: 'numero' },
      { titulo: 'Tramo', campo: 'tramo' },
      { titulo: 'Cuenta en el tramo', campo: 'cuentaTramo' },
      { titulo: 'Estado', campo: 'estado' },
      { titulo: 'Fecha radicación', campo: 'radicada', tipo: 'fecha' },
      { titulo: 'Periodo desde', campo: 'desde', tipo: 'fecha' },
      { titulo: 'Periodo hasta', campo: 'hasta', tipo: 'fecha' },
      { titulo: 'Saldo anterior', campo: 'saldo', tipo: 'pesos' },
      { titulo: 'Cobro', campo: 'cobro', tipo: 'pesos' },
      { titulo: 'Nuevo saldo', campo: 'nuevo', tipo: 'pesos' },
      { titulo: 'Base estampillas', campo: 'baseEstampillas', tipo: 'pesos' },
      { titulo: 'N° planilla', campo: 'planilla' },
      { titulo: 'Mes planilla', campo: 'mesPlanilla' },
      { titulo: 'Base', campo: 'base', tipo: 'pesos' },
      { titulo: 'Salud', campo: 'salud', tipo: 'pesos' },
      { titulo: 'Pensión', campo: 'pension', tipo: 'pesos' },
      { titulo: 'Riesgos', campo: 'riesgos', tipo: 'pesos' },
      { titulo: 'FSP', campo: 'fsp', tipo: 'pesos' },
      { titulo: 'Fondo solidario', campo: 'fondoSolidario', tipo: 'pesos' },
      { titulo: 'N° planilla 2', campo: 'planilla2' },
      { titulo: 'Mes planilla 2', campo: 'mesPlanilla2' },
      { titulo: 'Base 2', campo: 'base2', tipo: 'pesos' },
      { titulo: 'Salud 2', campo: 'salud2', tipo: 'pesos' },
      { titulo: 'Pensión 2', campo: 'pension2', tipo: 'pesos' },
      { titulo: 'Riesgos 2', campo: 'riesgos2', tipo: 'pesos' },
      { titulo: 'N° factura electrónica', campo: 'factura' },
      { titulo: 'Fecha revisión', campo: 'revisada', tipo: 'fecha' },
      { titulo: 'Decidió en Supervisión', campo: 'decidio' },
      { titulo: 'Observaciones', campo: 'observaciones' },
      { titulo: 'N° orden de pago', campo: 'orden' },
      { titulo: 'Fecha orden de pago', campo: 'fechaOrden', tipo: 'fecha' },
      { titulo: 'N° egreso', campo: 'egreso' },
      { titulo: 'Fecha egreso', campo: 'fechaEgreso', tipo: 'fecha' },
      { titulo: 'N° egreso 2', campo: 'egreso2' },
      { titulo: 'Valor neto girado', campo: 'neto', tipo: 'pesos' },
      { titulo: 'Descuentos aplicados', campo: 'descuentos' },
      { titulo: 'Detalles de pago', campo: 'detallesPago' },
      { titulo: 'RP cesión', campo: 'rpCesion' },
      { titulo: 'Informe de supervisión', campo: 'informeSup' },
      { titulo: 'Acta de cumplimiento', campo: 'acta' },
      { titulo: 'Carpeta de la cuenta', campo: function (x) { return x.idCuenta ? 'https://drive.google.com/drive/folders/' + x.idCuenta : ''; } }
    ];
    (c.obligaciones || []).forEach(function (o, i) {
      cols.push({ titulo: 'Actividades obligación ' + o.n, campo: function (x) { return (x.actividades || [])[i] || ''; } });
    });
    (c.obligaciones || []).forEach(function (o, i) {
      cols.push({ titulo: 'Evidencias obligación ' + o.n, campo: function (x) { return (x.evidencias || [])[i] || 0; }, tipo: 'numero' });
    });
    return cols;
  }

  function nombreArchivo(d, que) {
    var c = d.contrato || {};
    return que + ' ' + (c.nombre || '') + ' - ' + (c.contrato || '');
  }

  function aExcel(d) {
    if (!K.piezas.exportar) return Promise.reject(new Error('Falta el exportador.'));
    return K.piezas.exportar.aExcel(nombreArchivo(d, 'Informe de cuentas'), columnas(d), d.cuentas || []);
  }

  /* ══════════════ PDF: el informe gerencial por bloques ══════════════ */

  function aPDF(d, op) {
    op = op || {};
    if (!K.piezas.exportar) return Promise.reject(new Error('Falta el exportador.'));
    var c = d.contrato || {}, k = cifras(d);
    var obl = c.obligaciones || [];
    var cols = [
      { titulo: 'Periodo', campo: function (x) { return x.desde ? f(x.desde) + ' al ' + f(x.hasta) : ''; } },
      { titulo: 'Radicada', campo: function (x) { return f(x.radicada); } },
      { titulo: 'Saldo anterior', campo: function (x) { return plata(x.saldo); } },
      { titulo: 'Cobro', campo: function (x) { return plata(x.cobro); } },
      { titulo: 'Nuevo saldo', campo: function (x) { return x.saldo || x.nuevo ? K.pesos(x.nuevo) : ''; } },
      { titulo: 'Tramo', campo: function (x) { return x.tramo ? x.tramo + (x.cuentaTramo ? ' · cuenta ' + x.cuentaTramo : '') : ''; } },
      { titulo: 'Planilla', campo: function (x) { return x.planilla ? x.planilla + (x.mesPlanilla ? ' · ' + x.mesPlanilla : '') : ''; } },
      { titulo: 'Seguridad social', campo: function (x) {
          if (!x.base) return '';
          return 'Base ' + K.pesos(x.base) + ' · salud ' + K.pesos(x.salud) + ' · pensión ' + K.pesos(x.pension) + ' · riesgos ' + K.pesos(x.riesgos) +
            (x.fsp ? ' · FSP ' + K.pesos(x.fsp) : '');
        } },
      { titulo: 'Planilla anexa', campo: function (x) { return x.planilla2 ? x.planilla2 + (x.mesPlanilla2 ? ' · ' + x.mesPlanilla2 : '') + (x.base2 ? ' · base ' + K.pesos(x.base2) : '') : ''; } },
      { titulo: 'Revisión', campo: function (x) { return x.revisada ? f(x.revisada) + (x.decidio ? ' · ' + nombre(x.decidio) : '') : ''; } },
      { titulo: 'Orden de pago', campo: function (x) { return x.orden ? 'N° ' + x.orden + (x.fechaOrden ? ' del ' + f(x.fechaOrden) : '') : ''; } },
      { titulo: 'Egreso', campo: function (x) { return x.egreso ? 'N° ' + x.egreso + (x.fechaEgreso ? ' del ' + f(x.fechaEgreso) : '') + (x.egreso2 ? ' y N° ' + x.egreso2 : '') : ''; } },
      { titulo: 'Neto girado', campo: function (x) { return x.neto ? K.pesos(x.neto) : ''; } },
      { titulo: 'RP de la cesión', campo: 'rpCesion' },
      { titulo: 'Documentos', campo: function (x) {
          var t = [];
          if (x.informeSup) t.push('Informe de supervisión: ' + x.informeSup);
          if (x.acta) t.push('Acta de cumplimiento: ' + x.acta);
          return t.join('\n');
        }, largo: true },
      { titulo: 'Observaciones', campo: 'observaciones', largo: true },
      { titulo: 'Descuentos aplicados', campo: 'descuentos', largo: true },
      { titulo: 'Detalles del pago', campo: 'detallesPago', largo: true }
    ];
    if (op.actividades) {
      obl.forEach(function (o, i) {
        cols.push({ titulo: 'Obligación ' + o.n, campo: function (x) { return (x.actividades || [])[i] || ''; }, largo: true });
      });
    }
    var sub = [
      'Contrato ' + (c.contrato || '') + ' · CC/NIT ' + (c.doc || ''),
      titulo(c.secretaria),
      'Supervisor(a): ' + nombre(c.supervisor)
    ].filter(Boolean).join(' · ');
    var resumen = [
      { etiqueta: 'Valor del contrato', valor: K.pesos(k.valor) },
      { etiqueta: 'Cobrado (' + k.cuentas + (k.total ? ' de ' + k.total : '') + ' cuentas)', valor: K.pesos(k.cobrado) },
      { etiqueta: 'Pagado (' + k.pagadas + ')', valor: K.pesos(k.pagado), tono: 'ok' },
      { etiqueta: 'Saldo por ejecutar', valor: K.pesos(k.saldo) }
    ];
    return K.piezas.exportar.aPDF(nombreArchivo(d, 'Informe de cuentas'), cols, (d.cuentas || []).slice(), {
      subtitulo: sub + (c.objeto ? ' · Objeto: ' + c.objeto : '') + (c.inicio ? ' · Plazo: ' + f(c.inicio) + ' al ' + f(c.fin) : ''),
      bloque: {
        titulo: function (x) { return 'Cuenta ' + x.informe + (x.total ? ' de ' + x.total : ''); },
        sub: function (x) { return x.desde ? 'Periodo del ' + f(x.desde) + ' al ' + f(x.hasta) : (x.radicada ? 'Radicada el ' + f(x.radicada) : ''); },
        marca: function (x) { return x.estado; },
        tono: function (x) { return tono(x.estado); },
        omitir: ['Periodo']
      },
      resumen: resumen
    });
  }

  K.piezas.informeCuentas = { columnas: columnas, cifras: cifras, tono: tono, aExcel: aExcel, aPDF: aPDF };
}());
