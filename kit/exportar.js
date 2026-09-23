/* ============================================================
   KIT-FLANDES · PIEZA 12 · EXPORTADOR
   PDF membretado (estilo sec-hacienda) y Excel, con elección de columnas
   y rango de fechas.

   6.1 · EL PDF ES UN INFORME, NO LA TABLA DEL EXCEL (regla de Oss, 23/09)
     En todas las apps menos CONTRATISTA el PDF sale por BLOQUES: membrete,
     un resumen arriba (cifras) y cada registro como una ficha con su
     titulo, su estado de color y sus datos en dos columnas; los textos
     largos (motivos, observaciones) a lo ancho y completos, sin "…".
     Se puede agrupar (por estado, por revisor, por secretaria). El Excel
     sigue plano: una fila por registro. Es la logica de sec-hacienda
     (descarga de bitacoras): Excel para trabajar, PDF para leer.
     La tabla de antes sigue disponible con { modo: 'tabla' }.

       KIT.piezas.exportar.aPDF('Cuentas', columnas, filas, {
         subtitulo: 'Del 01/09 al 23/09 · 12 cuentas',
         bloque: {
           titulo: function (f) { return f.nombre; },             // cabeza de la ficha
           sub:    function (f) { return 'Contrato 029 · cuenta 6 de 10'; },
           marca:  function (f) { return f.estado; },             // la etiqueta de color
           tono:   function (f) { return 'ok' | 'aviso' | 'malo' | ''; }
         },
         grupo:   function (f) { return f.sec; },                 // opcional: bloques agrupados
         resumen: function (filas) { return [{ etiqueta: 'Aprobadas', valor: 10 }]; }   // opcional
       });

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
     KIT.piezas.exportar.aPDF('Cuentas', columnas, filas, { modo: 'tabla', orientacion: 'landscape' });   // la tabla de antes
     // 5.4: { subtitulo: 'Del 01/09/2026 al 23/09/2026 · 120 cuentas' } pone una línea bajo el título

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
        return aImprimir(titulo, cols, filas, r[1], op);
      }
      return op.modo === 'tabla' ? dibujarPDF(titulo, cols, filas, op, r[1], r[2])
                                 : dibujarInforme(titulo, cols, filas, op, r[1], r[2]);
    });
  }

  /* ══════════════ 6.1 · EL INFORME POR BLOQUES ══════════════ */

  var TONOS = {
    ok:    [30, 132, 73],
    aviso: [196, 132, 18],
    malo:  [192, 57, 43],
    info:  [41, 98, 160],
    '':    [6, 64, 43]
  };

  function fnDe(x) { return typeof x === 'function' ? x : function () { return x === undefined ? '' : x; }; }

  /** El resumen de arriba: lo que pida la app o, si no, total y sumas de plata. */
  function resumenDe(cols, filas, op) {
    if (typeof op.resumen === 'function') return op.resumen(filas) || [];
    if (op.resumen && op.resumen.length) return op.resumen;
    var r = [{ etiqueta: filas.length === 1 ? 'Registro' : 'Registros', valor: K.numero(filas.length) }];
    cols.forEach(function (c) {
      if (c.tipo !== 'pesos') return;
      var t = 0;
      filas.forEach(function (f) { t += K.aNumero(typeof c.campo === 'function' ? c.campo(f) : f[c.campo]) || 0; });
      r.push({ etiqueta: 'Total ' + String(c.titulo || c.campo).toLowerCase(), valor: K.pesos(t) });
    });
    return r;
  }

  /** Agrupa conservando el orden en que aparece cada grupo (o el que diga op.ordenGrupos). */
  function agrupar(filas, op) {
    if (!op.grupo) return [{ nombre: '', filas: filas }];
    var g = fnDe(op.grupo), mapa = {}, orden = [];
    filas.forEach(function (f) {
      var k = String(g(f) || 'Sin dato');
      if (!mapa[k]) { mapa[k] = []; orden.push(k); }
      mapa[k].push(f);
    });
    if (op.ordenGrupos) {
      var o = op.ordenGrupos;
      orden.sort(function (a, b) {
        var ia = o.indexOf(a), ib = o.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'es');
      });
    }
    return orden.map(function (k) { return { nombre: k, filas: mapa[k] }; });
  }

  /** Lo que se escribe en la ficha: los campos elegidos que tienen valor. */
  function camposDeFicha(f, cols, op) {
    var usados = op.bloque && op.bloque.omitir ? op.bloque.omitir : [];
    var out = [];
    cols.forEach(function (c) {
      var t = String(c.titulo || c.campo);
      if (usados.indexOf(t) >= 0) return;
      var v = valor(f, c);
      if (v === '' || v === null || v === undefined) return;
      v = String(v).replace(/\r/g, '').trim();
      if (!v) return;
      out.push({ e: t, v: v, largo: !!c.largo || v.length > 70 || /\n/.test(v) });
    });
    return out;
  }

  function dibujarInforme(titulo, cols, filas, op, m, logo) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var ancho = doc.internal.pageSize.getWidth();
    var alto = doc.internal.pageSize.getHeight();
    var mx = 14, util = ancho - mx * 2;
    var abajo = alto - 16;                     /* hasta donde se escribe (el pie va debajo) */
    var bloque = op.bloque || {};
    var tituloDe = bloque.titulo ? fnDe(bloque.titulo) : function (f) { return valor(f, cols[0]); };
    var subDe = fnDe(bloque.sub || '');
    var marcaDe = fnDe(bloque.marca || '');
    var tonoDe = fnDe(bloque.tono || '');
    /* la primera columna ya es el titulo de la ficha: no se repite dentro */
    if (!bloque.titulo && cols[0]) { op.bloque = op.bloque || {}; op.bloque.omitir = [String(cols[0].titulo || cols[0].campo)]; }

    function fuente(estilo, tam, rgb) {
      doc.setFont('helvetica', estilo);
      doc.setFontSize(tam);
      if (rgb) doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    }
    /* REGLA (sec-hacienda, 10/09): en jsPDF la fuente va PRIMERO y despues se corta */
    function cortar(txt, estilo, tam, mm) {
      fuente(estilo, tam);
      return doc.splitTextToSize(String(txt), mm);
    }

    function membrete(primera) {
      doc.setFillColor(6, 64, 43);
      doc.rect(0, 0, ancho, 26, 'F');
      if (logo) { try { doc.addImage(logo, 'PNG', mx, 4, 18, 18); } catch (e) {} }
      var xt = logo ? mx + 22 : mx;
      fuente('bold', 12, [255, 255, 255]);
      doc.text(String(m.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES'), xt, 12);
      fuente('normal', 8, [255, 255, 255]);
      if (m.MARCA_NIT) doc.text('NIT ' + m.MARCA_NIT, xt, 17);
      doc.text(String((window.MARCA && window.MARCA.TITULO) || K.app || ''), xt, 21.5);
      doc.text('Generado el ' + new Date().toLocaleString('es-CO'), ancho - mx, 12, { align: 'right' });
      doc.text(K.numero(filas.length) + (filas.length === 1 ? ' registro' : ' registros'), ancho - mx, 17, { align: 'right' });
      if (!primera) {
        fuente('bold', 8.5, [70, 85, 78]);
        doc.text(recortarAncho(doc, String(titulo || ''), util), mx, 32);
        return 37;
      }
      var y = 35;
      var tl = cortar(titulo || 'Informe', 'bold', 14, util);
      fuente('bold', 14, [20, 30, 25]);
      tl.forEach(function (l) { doc.text(l, mx, y); y += 6; });
      if (op.subtitulo) {
        var sl = cortar(op.subtitulo, 'normal', 8.5, util);
        fuente('normal', 8.5, [70, 85, 78]);
        sl.forEach(function (l) { doc.text(l, mx, y - 1); y += 4; });
      }
      return y + 2;
    }

    function resumen(y) {
      var r = resumenDe(cols, filas, op);
      if (!r.length) return y;
      var porFila = Math.min(4, r.length), gap = 3;
      var w = (util - gap * (porFila - 1)) / porFila, h = 15;
      r.forEach(function (x, i) {
        var c = i % porFila;
        if (i && c === 0) y += h + gap;
        var xx = mx + c * (w + gap);
        doc.setFillColor(240, 246, 243);
        doc.setDrawColor(214, 228, 220);
        doc.roundedRect(xx, y, w, h, 2, 2, 'FD');
        var tono = TONOS[x.tono || ''] || TONOS[''];
        fuente('bold', 12, tono);
        doc.text(recortarAncho(doc, String(x.valor), w - 6), xx + 3, y + 7);
        fuente('normal', 7, [80, 95, 88]);
        doc.text(recortarAncho(doc, String(x.etiqueta).toUpperCase(), w - 6), xx + 3, y + 12);
      });
      return y + h + 6;
    }

    /* mide y arma una ficha: devuelve su alto y una funcion que la dibuja en y */
    function ficha(f) {
      var t = String(tituloDe(f) || '').trim() || '—';
      var marca = String(marcaDe(f) || '').trim();
      var tono = TONOS[String(tonoDe(f) || '')] || TONOS[''];
      var pad = 3.2, x0 = mx + 2.4, anchoIn = util - 2.4 - pad * 2;
      fuente('bold', 7);
      var anchoMarca = marca ? doc.getTextWidth(marca) + 6 : 0;
      var tl = cortar(t, 'bold', 9.5, anchoIn - anchoMarca - 2);
      var sub = String(subDe(f) || '').trim();
      var sl = sub ? cortar(sub, 'normal', 7.8, anchoIn) : [];
      var campos = camposDeFicha(f, cols, op);
      var cortos = campos.filter(function (c) { return !c.largo; });
      var largos = campos.filter(function (c) { return c.largo; });
      var colW = (anchoIn - 4) / 2;
      var filasC = [];
      for (var i = 0; i < cortos.length; i += 2) {
        var par = [cortos[i], cortos[i + 1]].filter(Boolean).map(function (c) {
          return { e: c.e, lineas: cortar(c.v, 'normal', 8.3, colW) };
        });
        filasC.push({ par: par, h: 3.2 + Math.max.apply(null, par.map(function (p) { return p.lineas.length; })) * 3.7 + 1.6 });
      }
      var filasL = largos.map(function (c) {
        var l = cortar(c.v, 'normal', 8.3, anchoIn);
        if (l.length > 48) { l = l.slice(0, 48); l[47] = String(l[47]).replace(/.{0,3}$/, '…'); }
        return { e: c.e, lineas: l, h: 3.2 + l.length * 3.7 + 1.6 };
      });
      var h = pad + tl.length * 4.4 + (sl.length ? sl.length * 3.6 + 0.6 : 0) + 1.8;
      filasC.forEach(function (x) { h += x.h; });
      filasL.forEach(function (x) { h += x.h; });
      h += pad - 1;

      function dibujar(y) {
        doc.setDrawColor(214, 224, 218);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(mx, y, util, h, 2, 2, 'FD');
        doc.setFillColor(tono[0], tono[1], tono[2]);
        doc.rect(mx, y, 1.6, h, 'F');
        var yy = y + pad + 3.2;
        fuente('bold', 9.5, [20, 30, 25]);
        tl.forEach(function (l) { doc.text(l, x0 + pad - 1, yy); yy += 4.4; });
        if (marca) {
          fuente('bold', 7);
          var wm = doc.getTextWidth(marca) + 5;
          doc.setFillColor(tono[0], tono[1], tono[2]);
          doc.roundedRect(mx + util - pad - wm, y + pad - 0.6, wm, 5, 2.2, 2.2, 'F');
          fuente('bold', 7, [255, 255, 255]);
          doc.text(marca, mx + util - pad - wm / 2, y + pad + 2.9, { align: 'center' });
        }
        if (sl.length) {
          fuente('normal', 7.8, [80, 95, 88]);
          sl.forEach(function (l) { doc.text(l, x0 + pad - 1, yy - 0.6); yy += 3.6; });
          yy += 0.6;
        }
        doc.setDrawColor(232, 238, 235);
        doc.line(x0 + pad - 1, yy - 2.2, mx + util - pad, yy - 2.2);
        yy += 1;
        filasC.forEach(function (fc) {
          fc.par.forEach(function (p, k) {
            var xx = x0 + pad - 1 + k * (colW + 4);
            fuente('bold', 6.6, [110, 125, 118]);
            doc.text(recortarAncho(doc, p.e.toUpperCase(), colW), xx, yy);
            fuente('normal', 8.3, [30, 40, 35]);
            p.lineas.forEach(function (l, j) { doc.text(l, xx, yy + 3.7 + j * 3.7); });
          });
          yy += fc.h;
        });
        filasL.forEach(function (fl) {
          fuente('bold', 6.6, [110, 125, 118]);
          doc.text(recortarAncho(doc, fl.e.toUpperCase(), anchoIn), x0 + pad - 1, yy);
          fuente('normal', 8.3, [30, 40, 35]);
          fl.lineas.forEach(function (l, j) { doc.text(l, x0 + pad - 1, yy + 3.7 + j * 3.7); });
          yy += fl.h;
        });
      }
      return { h: h, dibujar: dibujar };
    }

    var y = membrete(true);
    y = resumen(y);
    agrupar(filas, op).forEach(function (g) {
      if (g.nombre) {
        if (y + 9 + 20 > abajo) { doc.addPage(); y = membrete(false); }
        doc.setFillColor(232, 241, 236);
        doc.roundedRect(mx, y, util, 7.5, 1.5, 1.5, 'F');
        fuente('bold', 8.6, [6, 64, 43]);
        doc.text(recortarAncho(doc, g.nombre.toUpperCase(), util - 30), mx + 3, y + 5.1);
        fuente('bold', 8.6, [6, 64, 43]);
        doc.text(K.numero(g.filas.length), mx + util - 3, y + 5.1, { align: 'right' });
        y += 10;
      }
      g.filas.forEach(function (f) {
        var fi = ficha(f);
        if (y + fi.h > abajo) { doc.addPage(); y = membrete(false); }
        fi.dibujar(y);
        y += fi.h + 3;
      });
    });

    var total = doc.internal.getNumberOfPages();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      fuente('normal', 7, [120, 130, 125]);
      doc.text('Página ' + p + ' de ' + total, ancho - mx, alto - 7, { align: 'right' });
      doc.text(recortarAncho(doc, 'Documento generado por el sistema. ' + (m.MARCA_MUNICIPIO || ''), util - 30), mx, alto - 7);
    }
    doc.save(limpiarNombre(titulo) + '.pdf');
    return 'pdf';
  }

  function dibujarPDF(titulo, cols, filas, op, m, logo) {
    var jsPDF = window.jspdf.jsPDF;
    var horizontal = op.orientacion === 'landscape' || cols.length > 6;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: horizontal ? 'landscape' : 'portrait' });

    var ancho = doc.internal.pageSize.getWidth();
    var alto = doc.internal.pageSize.getHeight();
    var mx = 12;                    /* margen lateral */
    var sub = String(op.subtitulo || '');   /* 5.4 · una línea bajo el título (rango, filtros, totales) */
    var yCuerpo = sub ? 48 : 40;    /* dónde empieza la tabla en cada página */

    var cab = cabeceras(cols);
    var anchoUtil = ancho - mx * 2;
    var anchoCol = repartirAnchos(cols, anchoUtil, filas, doc);

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
      doc.text(String((window.MARCA && window.MARCA.TITULO) || K.app || ''), logo ? mx + 22 : mx, 21.5);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('Generado el ' + new Date().toLocaleString('es-CO'), ancho - mx, 12, { align: 'right' });
      doc.text(String(filas.length) + (filas.length === 1 ? ' registro' : ' registros'), ancho - mx, 17, { align: 'right' });

      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(String(titulo || ''), mx, 34);
      if (sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(70, 85, 78);
        doc.text(recortarAncho(doc, sub, anchoUtil), mx, 39.5);
      }

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

  function repartirAnchos(cols, total, filas, doc) {
    /* 5.4 · Con el PDF a mano se mide el texto de verdad (mm, no letras).
       Cada columna pide lo que ocupa su texto más largo; si no caben todas,
       se recortan SOLO las más anchas hasta que quepan (una fecha o un
       estado nunca salen cortados por culpa de una columna de motivos).
       Si sobra espacio, se reparte en proporción. */
    if (doc && typeof doc.getTextWidth === 'function') {
      var nat = cols.map(function (c) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        var m = doc.getTextWidth(String(c.titulo || c.campo));
        doc.setFont('helvetica', 'normal');
        for (var i = 0; i < Math.min(filas.length, 300); i++) {
          var w = doc.getTextWidth(String(valor(filas[i], c)));
          if (w > m) m = w;
        }
        return Math.min(m + 3.5, 90);
      });
      var sumaN = nat.reduce(function (a, b) { return a + b; }, 0) || 1;
      if (sumaN <= total) return nat.map(function (w) { return w * total / sumaN; });
      var bajo = 0, alto = 90;
      for (var k = 0; k < 40; k++) {
        var tope = (bajo + alto) / 2;
        var s2 = nat.reduce(function (a, w) { return a + Math.min(w, tope); }, 0);
        if (s2 > total) alto = tope; else bajo = tope;
      }
      return nat.map(function (w) { return Math.min(w, bajo); });
    }
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
  function aImprimir(titulo, cols, filas, m, op) {
    op = op || {};
    if (op.modo !== 'tabla') return imprimirInforme(titulo, cols, filas, m, op);
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
      '<span>' + (m.MARCA_NIT ? 'NIT ' + K.esc(m.MARCA_NIT) + ' · ' : '') + K.esc((window.MARCA && window.MARCA.TITULO) || K.app || '') +
      ' · Generado el ' + K.esc(new Date().toLocaleString('es-CO')) + '</span></div>' +
      '<h1>' + K.esc(titulo) + '</h1><p>' + (op.subtitulo ? K.esc(op.subtitulo) : filas.length + ' registros') + '</p>' +
      '<table><thead><tr>' + cab.map(function (t) { return '<th>' + K.esc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr>' + cols.map(function (c) { return '<td>' + K.esc(valor(f, c)) + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
    w.document.write(html);
    w.document.close();
    return 'impresion';
  }

  /** 6.1 · el mismo informe por bloques, en la ventana de impresión (sin CDN). */
  function imprimirInforme(titulo, cols, filas, m, op) {
    var w = window.open('', '_blank');
    if (!w) { K.aviso('El navegador bloqueó la ventana. Permite las ventanas emergentes.', 'malo', 6000); return 'bloqueado'; }
    var b = op.bloque || {};
    var tituloDe = b.titulo ? fnDe(b.titulo) : function (f) { return valor(f, cols[0]); };
    if (!b.titulo && cols[0]) { op.bloque = op.bloque || {}; op.bloque.omitir = [String(cols[0].titulo || cols[0].campo)]; }
    var colores = { ok: '#1e8449', aviso: '#c48412', malo: '#c0392b', info: '#2962a0', '': '#06402B' };
    var res = resumenDe(cols, filas, op).map(function (x) {
      return '<div class="r"><b>' + K.esc(x.valor) + '</b><span>' + K.esc(x.etiqueta) + '</span></div>';
    }).join('');
    var cuerpo = agrupar(filas, op).map(function (g) {
      return (g.nombre ? '<h2>' + K.esc(g.nombre) + ' <small>' + g.filas.length + '</small></h2>' : '') +
        g.filas.map(function (f) {
          var tono = colores[String(fnDe(b.tono || '')(f) || '')] || colores[''];
          var marca = String(fnDe(b.marca || '')(f) || '');
          var sub = String(fnDe(b.sub || '')(f) || '');
          var campos = camposDeFicha(f, cols, op);
          return '<article style="border-left-color:' + tono + '"><header><b>' + K.esc(tituloDe(f)) + '</b>' +
            (marca ? '<i style="background:' + tono + '">' + K.esc(marca) + '</i>' : '') + '</header>' +
            (sub ? '<p class="s">' + K.esc(sub) + '</p>' : '') + '<dl>' +
            campos.map(function (c) { return '<div' + (c.largo ? ' class="l"' : '') + '><dt>' + K.esc(c.e) + '</dt><dd>' + K.esc(c.v) + '</dd></div>'; }).join('') +
            '</dl></article>';
        }).join('');
    }).join('');
    var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + K.esc(titulo) + '</title>' +
      '<style>body{font:11px/1.45 system-ui,sans-serif;margin:16px;color:#1e2a24}' +
      '.m{background:#06402B;color:#fff;padding:10px 14px;margin:-16px -16px 14px}.m b{font-size:13px}.m span{display:block;font-size:10px;opacity:.9}' +
      'h1{font-size:17px;margin:0 0 2px}.st{color:#46554e;margin:0 0 10px}' +
      '.rs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px}.r{background:#f0f6f3;border:1px solid #d6e4dc;border-radius:8px;padding:6px 8px}' +
      '.r b{display:block;font-size:15px;color:#06402B}.r span{font-size:9px;text-transform:uppercase;color:#50605a}' +
      'h2{font-size:11px;background:#e8f1ec;color:#06402B;border-radius:6px;padding:4px 8px;text-transform:uppercase}h2 small{float:right}' +
      'article{border:1px solid #d6e0da;border-left:5px solid;border-radius:8px;padding:8px 10px;margin:0 0 8px;break-inside:avoid}' +
      'header{display:flex;justify-content:space-between;gap:8px}header i{font-style:normal;color:#fff;border-radius:9px;padding:1px 8px;font-size:9px;font-weight:700;align-self:flex-start}' +
      '.s{margin:1px 0 5px;color:#50605a;font-size:10px}dl{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:0}' +
      'dl .l{grid-column:1/-1}dt{font-size:8.5px;font-weight:700;color:#6e7d76;text-transform:uppercase}dd{margin:0;white-space:pre-wrap}' +
      '@media print{.m,article,h2,.r{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>' +
      '<div class="m"><b>' + K.esc(m.MARCA_MUNICIPIO || 'MUNICIPIO DE FLANDES') + '</b>' +
      '<span>' + (m.MARCA_NIT ? 'NIT ' + K.esc(m.MARCA_NIT) + ' · ' : '') + K.esc((window.MARCA && window.MARCA.TITULO) || K.app || '') +
      ' · Generado el ' + K.esc(new Date().toLocaleString('es-CO')) + '</span></div>' +
      '<h1>' + K.esc(titulo) + '</h1><p class="st">' + K.esc(op.subtitulo || (filas.length + ' registros')) + '</p>' +
      '<div class="rs">' + res + '</div>' + cuerpo +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
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
      '      <button type="button" class="kit-capa__x">' + K.icono('cerrar', 18) + '</button></header>' +
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
    _agrupar: agrupar, _resumen: resumenDe, _campos: camposDeFicha,
    limpiarNombre: limpiarNombre, valor: valor, valorCrudo: valorCrudo
  };
}());
