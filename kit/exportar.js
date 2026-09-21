/* ============================================================
   KIT-FLANDES · PIEZA 12 · EXPORTADOR
   PDF membretado (estilo sec-hacienda) y Excel, con elección de columnas
   y rango de fechas.

   Cómo funciona por dentro
     Ni jsPDF ni la librería de Excel se cargan al abrir la app: pesan y
     casi nadie exporta. Se bajan del CDN la primera vez que se pulsa. Si
     el CDN no responde — pasa, y pasa justo cuando hay que entregar algo —
     hay dos respaldos que SÍ funcionan siempre:
       · Excel  → CSV con punto y coma (Excel en español lo abre en columnas)
       · PDF    → la ventana de impresión del navegador, que en móvil y en
                  PC ofrece "Guardar como PDF"

   Cómo se usa

     KIT.piezas.exportar.modal({
       titulo: 'Cuentas por revisar',
       columnas: [
         { campo: 'idContrato',  titulo: 'ID Contrato',  fijo: true },
         { campo: 'contratista', titulo: 'Contratista',  marcado: true },
         { campo: 'valor',       titulo: 'Valor', tipo: 'pesos', marcado: true },
         { campo: 'radicada',    titulo: 'Radicación', tipo: 'fecha' }
       ],
       campoFecha: 'radicada',            // para el rango; opcional
       filas: function () { return lista; }
     });

     // o directo, sin modal:
     KIT.piezas.exportar.aExcel('Cuentas', columnas, filas);
     KIT.piezas.exportar.aPDF('Cuentas', columnas, filas, { orientacion: 'landscape' });

   El membrete
     Escudo, MUNICIPIO DE FLANDES, NIT y la fecha de generación salen de
     la configuración pública del CORE (MARCA_*), no escritos a mano: si
     cambia la administración, cambia solo.

   Pareja: kit/exportar.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/exportar] falta kit.js'); } catch (e) {} return; }

  var CDN_PDF  = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  var CDN_XLSX = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

  /* La marca de orden de bytes que hace que Excel respete las tildes del CSV.
     Se construye con fromCharCode y no escrita a mano: es un carácter
     invisible, y cualquier editor que "limpie" el archivo se lo llevaría
     sin que nadie lo note hasta ver los acentos rotos en Excel. */
  var BOM = String.fromCharCode(0xFEFF);

  var marca = null;      /* MARCA_* del CORE, pedidas una sola vez */
  var escudo = null;     /* el logo ya convertido a PNG para el PDF */

  /* ══════════════ cargar librerías bajo demanda ══════════════ */

  function guion(url) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { res(true); };
      s.onerror = function () { rej(K.problema('CDN', 'No se pudo bajar la librería.')); };
      document.head.appendChild(s);
    });
  }
  function hayPDF() { return !!(window.jspdf && window.jspdf.jsPDF); }
  function hayXLSX() { return !!window.XLSX; }

  /* ══════════════ valores ══════════════ */

  function valor(fila, col) {
    var v = typeof col.campo === 'function' ? col.campo(fila) : fila[col.campo];
    if (v === null || v === undefined) return '';
    if (col.tipo === 'pesos') return K.pesos(v);
    if (col.tipo === 'fecha') return K.fecha(v);
    if (col.tipo === 'numero') return K.numero(v);
    return String(v);
  }
  /** Para Excel: el número entra como NÚMERO, no como texto, o no suma. */
  function valorCrudo(fila, col) {
    var v = typeof col.campo === 'function' ? col.campo(fila) : fila[col.campo];
    if (v === null || v === undefined) return '';
    if (col.tipo === 'pesos' || col.tipo === 'numero') return K.aNumero(v);
    if (col.tipo === 'fecha') return K.fecha(v);
    return v;
  }

  function cabeceras(cols) { return cols.map(function (c) { return c.titulo || c.campo; }); }

  /* ══════════════ EXCEL ══════════════ */

  function aExcel(titulo, cols, filas) {
    var nombre = limpiarNombre(titulo) + '.xlsx';
    var cab = cabeceras(cols);
    var cuerpo = filas.map(function (f) { return cols.map(function (c) { return valorCrudo(f, c); }); });

    var hacer = function () {
      var hoja = window.XLSX.utils.aoa_to_sheet([cab].concat(cuerpo));
      hoja['!cols'] = anchos(cab, cuerpo);
      var libro = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(libro, hoja, recortar(titulo, 31));
      window.XLSX.writeFile(libro, nombre);
      return 'xlsx';
    };

    if (hayXLSX()) return Promise.resolve(hacer());
    return guion(CDN_XLSX).then(hacer).catch(function () {
      K.aviso('No se pudo bajar la librería de Excel. Te dejo un CSV, que Excel abre igual.', 'aviso', 6000);
      return aCSV(titulo, cab, cuerpo);
    });
  }

  function anchos(cab, filas) {
    return cab.map(function (t, c) {
      var max = String(t || '').length, i, l;
      for (i = 0; i < filas.length; i++) {
        l = String(filas[i][c] === null || filas[i][c] === undefined ? '' : filas[i][c]).length;
        if (l > max) max = l;
      }
      return { wch: Math.min(Math.max(max + 2, 8), 52) };
    });
  }

  function aCSV(titulo, cab, filas) {
    /* punto y coma: el Excel en español separa por coma los decimales,
       y con coma como separador la tabla sale en una sola columna */
    var esc = function (v) {
      var s = String(v === null || v === undefined ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var txt = [cab.map(esc).join(';')]
      .concat(filas.map(function (f) { return f.map(esc).join(';'); }))
      .join('\r\n');
    /* el BOM hace que Excel respete las tildes */
    bajar(new Blob([BOM + txt], { type: 'text/csv;charset=utf-8' }), limpiarNombre(titulo) + '.csv');
    return 'csv';
  }

  /* ══════════════ PDF MEMBRETADO ══════════════ */

  function datosMarca() {
    if (marca) return Promise.resolve(marca);
    /* app 'CORE': config es ruta del CORE, no de la app. */
    return K.pedir('config', {}, { sinToken: true, app: 'CORE' })
      .then(function (c) { marca = c || {}; return marca; })
      .catch(function () { marca = {}; return marca; });
  }

  /** jsPDF no entiende WebP: el escudo se pasa por un lienzo y sale PNG. */
  function logoPNG() {
    if (escudo !== null) return Promise.resolve(escudo);
    return new Promise(function (res) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          escudo = c.toDataURL('image/png');
        } catch (e) { escudo = ''; }
        res(escudo);
      };
      img.onerror = function () { escudo = ''; res(''); };
      img.src = K.medio('img/logo.webp');
    });
  }

  function aPDF(titulo, cols, filas, op) {
    op = op || {};
    return Promise.all([
      hayPDF() ? Promise.resolve(true) : guion(CDN_PDF).catch(function () { return false; }),
      datosMarca(),
      logoPNG()
    ]).then(function (r) {
      if (!hayPDF()) {
        K.aviso('No se pudo bajar la librería de PDF. Te abro la ventana de impresión: ahí puedes guardar como PDF.', 'aviso', 7000);
        return aImprimir(titulo, cols, filas, r[1]);
      }
      return dibujarPDF(titulo, cols, filas, op, r[1], r[2]);
    });
  }

  function dibujarPDF(titulo, cols, filas, op, m, logo) {
    var jsPDF = window.jspdf.jsPDF;
    var horizontal = op.orientacion === 'landscape' || cols.length > 6;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: horizontal ? 'landscape' : 'portrait' });

    var ancho = doc.internal.pageSize.getWidth();
    var alto = doc.internal.pageSize.getHeight();
    var mx = 12;                    /* margen lateral */
    var yCuerpo = 40;               /* dónde empieza la tabla en cada página */

    var cab = cabeceras(cols);
    var anchoUtil = ancho - mx * 2;
    var anchoCol = repartirAnchos(cols, anchoUtil, filas);

    var pagina = 0;

    function membrete() {
      pagina++;
      doc.setFillColor(6, 64, 43);
      doc.rect(0, 0, ancho, 26, 'F');
      if (logo) { try { doc.addImage(logo, 'PNG', mx, 4, 18, 18); } catch (e) {} }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(String(m.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES'), logo ? mx + 22 : mx, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (m.MARCA_NIT) doc.text('NIT ' + m.MARCA_NIT, logo ? mx + 22 : mx, 17);
      doc.text(String(K.app || ''), logo ? mx + 22 : mx, 21.5);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('Generado el ' + new Date().toLocaleString('es-CO'), ancho - mx, 12, { align: 'right' });
      doc.text(String(filas.length) + (filas.length === 1 ? ' registro' : ' registros'), ancho - mx, 17, { align: 'right' });

      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(String(titulo || ''), mx, 34);

      filaCabecera(yCuerpo - 5);
    }

    function filaCabecera(y) {
      doc.setFillColor(238, 242, 240);
      doc.rect(mx, y, anchoUtil, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 40, 35);
      var x = mx + 1.5;
      cab.forEach(function (t, c) {
        doc.text(recortarAncho(doc, String(t), anchoCol[c] - 3), x, y + 4.8);
        x += anchoCol[c];
      });
    }

    function pie() {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 125);
      doc.text('Página ' + pagina, ancho - mx, alto - 7, { align: 'right' });
      doc.text('Documento generado por el sistema. ' + (m.MARCA_MUNICIPIO || ''), mx, alto - 7);
    }

    membrete();
    var y = yCuerpo + 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    filas.forEach(function (f, n) {
      if (y > alto - 16) {
        pie();
        doc.addPage();
        membrete();
        y = yCuerpo + 3.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }
      if (n % 2 === 1) {
        doc.setFillColor(249, 250, 249);
        doc.rect(mx, y - 4, anchoUtil, 6, 'F');
      }
      doc.setTextColor(35, 45, 40);
      var x = mx + 1.5;
      cols.forEach(function (c, k) {
        var v = valor(f, c);
        var alinea = (c.tipo === 'pesos' || c.tipo === 'numero');
        if (alinea) doc.text(recortarAncho(doc, v, anchoCol[k] - 3), x + anchoCol[k] - 3, y, { align: 'right' });
        else doc.text(recortarAncho(doc, v, anchoCol[k] - 3), x, y);
        x += anchoCol[k];
      });
      y += 6;
    });

    pie();
    doc.save(limpiarNombre(titulo) + '.pdf');
    return 'pdf';
  }

  function repartirAnchos(cols, total, filas) {
    /* peso por lo largo que sea el contenido real, no a partes iguales:
       una columna de fechas no necesita lo mismo que una de nombres */
    var pesos = cols.map(function (c) {
      var max = String(c.titulo || c.campo).length, i, l;
      for (i = 0; i < Math.min(filas.length, 120); i++) {
        l = String(valor(filas[i], c)).length;
        if (l > max) max = l;
      }
      return Math.min(Math.max(max, 6), 40);
    });
    var suma = pesos.reduce(function (a, b) { return a + b; }, 0) || 1;
    return pesos.map(function (p) { return total * p / suma; });
  }

  function recortarAncho(doc, txt, mm) {
    var s = String(txt);
    if (doc.getTextWidth(s) <= mm) return s;
    while (s.length > 1 && doc.getTextWidth(s + '…') > mm) s = s.slice(0, -1);
    return s + '…';
  }

  /** Respaldo del PDF: la ventana de impresión, que siempre está. */
  function aImprimir(titulo, cols, filas, m) {
    var w = window.open('', '_blank');
    if (!w) { K.aviso('El navegador bloqueó la ventana. Permite las ventanas emergentes.', 'malo', 6000); return 'bloqueado'; }
    var cab = cabeceras(cols);
    var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + K.esc(titulo) + '</title>' +
      '<style>body{font:11px/1.4 system-ui,sans-serif;margin:16px;color:#1e2a24}' +
      'h1{font-size:15px;margin:0 0 4px}.m{background:#06402B;color:#fff;padding:10px 14px;margin:-16px -16px 14px}' +
      '.m b{font-size:13px}.m span{display:block;font-size:10px;opacity:.9}' +
      'table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7e0db;padding:4px 6px;text-align:left;font-size:10px}' +
      'th{background:#eef2f0}tr:nth-child(even) td{background:#f9faf9}' +
      '@media print{.m{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>' +
      '<div class="m"><b>' + K.esc(m.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES') + '</b>' +
      '<span>' + (m.MARCA_NIT ? 'NIT ' + K.esc(m.MARCA_NIT) + ' · ' : '') + K.esc(K.app || '') +
      ' · Generado el ' + K.esc(new Date().toLocaleString('es-CO')) + '</span></div>' +
      '<h1>' + K.esc(titulo) + '</h1><p>' + filas.length + ' registros</p>' +
      '<table><thead><tr>' + cab.map(function (t) { return '<th>' + K.esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr>' + cols.map(function (c) { return '<td>' + K.esc(valor(f, c)) + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
    w.document.write(html);
    w.document.close();
    return 'impresion';
  }

  /* ══════════════ MODAL DE DESCARGA ══════════════ */

  function modal(op) {
    op = op || {};
    var cols = (op.columnas || []).map(function (c, i) {
      return { campo: c.campo, titulo: c.titulo || c.campo, tipo: c.tipo, fijo: !!c.fijo,
               marcado: c.fijo || c.marcado !== false, i: i };
    });

    var hoja = K.nodo(
      '<div class="kit-capa kit-exp kit-capa--on" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-exp__hoja">' +
      '    <header class="kit-capa__h">Descargar ' + K.esc(op.titulo || '') +
      '      <button type="button" class="kit-capa__x">✕</button></header>' +
      '    <div class="kit-capa__cuerpo kit-exp__cuerpo">' +
      (op.campoFecha ?
        '      <div class="kit-exp__rango">' +
        '        <span class="kit-exp__et">Rango de fechas (opcional)</span>' +
        '        <div class="kit-exp__fechas">' +
        '          <input type="date" data-kit-fecha class="kit-exp__desde" aria-label="Desde">' +
        '          <span>a</span>' +
        '          <input type="date" data-kit-fecha class="kit-exp__hasta" aria-label="Hasta">' +
        '        </div>' +
        '      </div>' : '') +
      '      <div class="kit-exp__cols">' +
      '        <div class="kit-exp__colscab">' +
      '          <span class="kit-exp__et">Columnas</span>' +
      '          <button type="button" class="kit-exp__todas">Marcar todas</button>' +
      '        </div>' +
      '        <div class="kit-exp__lista"></div>' +
      '      </div>' +
      '      <p class="kit-exp__cuenta"></p>' +
      '    </div>' +
      '    <footer class="kit-capa__pie">' +
      '      <button type="button" class="kit-btn kit-exp__excel">Excel</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-exp__pdf">PDF</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);

    if (op.campoFecha && K.piezas.fechas) K.piezas.fechas.montar(hoja);

    var lista = hoja.querySelector('.kit-exp__lista');
    cols.forEach(function (c) {
      var l = K.nodo('<label class="kit-exp__col' + (c.fijo ? ' kit-exp__col--fijo' : '') + '">' +
        '<input type="checkbox"' + (c.marcado ? ' checked' : '') + (c.fijo ? ' disabled' : '') + '>' +
        '<span>' + K.esc(c.titulo) + '</span></label>');
      l.querySelector('input').addEventListener('change', function () { c.marcado = this.checked; contar(); });
      lista.appendChild(l);
    });

    hoja.querySelector('.kit-exp__todas').addEventListener('click', function () {
      var faltan = cols.some(function (c) { return !c.marcado; });
      cols.forEach(function (c, i) {
        if (c.fijo) return;
        c.marcado = faltan;
        lista.children[i].querySelector('input').checked = faltan;
      });
      this.textContent = faltan ? 'Desmarcar todas' : 'Marcar todas';
      contar();
    });

    function filasAhora() {
      var f = typeof op.filas === 'function' ? op.filas() : (op.filas || []);
      if (!op.campoFecha) return f;
      var d = hoja.querySelector('.kit-exp__desde');
      var h = hoja.querySelector('.kit-exp__hasta');
      var desde = d && d.value, hasta = h && h.value;
      if (!desde && !hasta) return f;
      return f.filter(function (x) {
        var v = String(x[op.campoFecha] || '').slice(0, 10);
        if (!v) return false;
        if (desde && v < desde) return false;
        if (hasta && v > hasta) return false;
        return true;
      });
    }

    function elegidas() { return cols.filter(function (c) { return c.marcado; }); }

    function contar() {
      var n = filasAhora().length;
      var c = elegidas().length;
      hoja.querySelector('.kit-exp__cuenta').textContent =
        n + (n === 1 ? ' registro' : ' registros') + ' · ' + c + (c === 1 ? ' columna' : ' columnas');
      hoja.querySelector('.kit-exp__excel').disabled = !n || !c;
      hoja.querySelector('.kit-exp__pdf').disabled = !n || !c;
    }
    hoja.addEventListener('change', contar);
    contar();

    function fuera() { hoja.remove(); }
    hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);

    function lanzar(como) {
      var b = hoja.querySelector(como === 'pdf' ? '.kit-exp__pdf' : '.kit-exp__excel');
      b.disabled = true;
      b.classList.add('kit-ocupado');
      var f = filasAhora();
      var c = elegidas();
      var p = (como === 'pdf') ? aPDF(op.titulo || 'Informe', c, f, op) : aExcel(op.titulo || 'Informe', c, f);
      p.then(function () { fuera(); K.aviso('Descarga lista.', 'ok'); })
       .catch(function (e) {
         b.disabled = false;
         b.classList.remove('kit-ocupado');
         K.aviso('No se pudo generar el archivo.', 'malo', 5000);
       });
    }
    hoja.querySelector('.kit-exp__excel').addEventListener('click', function () { lanzar('excel'); });
    hoja.querySelector('.kit-exp__pdf').addEventListener('click', function () { lanzar('pdf'); });

    return { cerrar: fuera };
  }

  /* ══════════════ utilidades ══════════════ */

  function bajar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function limpiarNombre(t) {
    return String(t || 'informe').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'informe';
  }
  function recortar(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) : s; }

  K.piezas.exportar = {
    modal: modal, aExcel: aExcel, aPDF: aPDF, aCSV: aCSV, aImprimir: aImprimir,
    limpiarNombre: limpiarNombre, valor: valor, valorCrudo: valorCrudo
  };
}());
