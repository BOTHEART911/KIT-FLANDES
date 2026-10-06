/* ============================================================
   KIT-FLANDES · PIEZA 7 · VISOR DE DOCUMENTOS
   Multi-documento, minimizable y arrastrable.

   Por qué no vale abrir el PDF en otra pestaña
     Revisar una cuenta es comparar: la planilla contra el informe, el RUT
     contra la cédula. Si cada documento se va a otra pestaña, el revisor
     pierde el hilo. Aquí los documentos van en una sola ventana con
     flechas, y la ventana se puede encoger y mover para ver la tarjeta de
     la cuenta por debajo.

   Cómo se usa

     KIT.piezas.visor.abrir([
       { titulo: 'Planilla de seguridad social', url: 'https://drive.google.com/file/d/ID/preview' },
       { titulo: 'Informe de actividades',       url: '...', tipo: 'pdf' },
       { titulo: 'Cédula',                       url: '...', tipo: 'imagen' }
     ], { indice: 0 });

   4.7 · DOCUMENTOS QUE LLEGAN DEL SERVIDOR, NO DE DRIVE
     Un documento puede traer `cargar` en vez de `url`:

       { titulo: 'Planilla.pdf', tipo: 'pdf',
         cargar: function () { return KIT.pedir('...', {...}); } }

     `cargar` devuelve {nombre, mime, base64} o {nombre, mime, bytes} (5.4:
     Uint8Array ya listo, sin base64). El visor lo pide SOLO cuando
     se va a ver (no todos de golpe) y lo guarda mientras esté abierto.

     Por qué hace falta: el /preview de Drive solo se ve si el teléfono
     tiene abierta la cuenta de Google con permiso sobre ese archivo. El
     contratista casi nunca la tiene, y al reportar el plan de pagos se le
     quita el permiso. Con los bytes en la mano:
       · la imagen se pinta directa;
       · el PDF se dibuja página por página con pdf.js, que se baja del CDN
         la primera vez. Un PDF dentro de un iframe NO se ve en Android
         (Chrome no trae visor ahí) y en iPhone solo sale la primera hoja.
         Si el CDN no responde, se cae a un iframe y se ofrece descargarlo.
       · descargar, abrir e imprimir trabajan sobre ese mismo archivo.

   Lo que hace de verdad, no de adorno
     · Abrir en pestaña, descargar e imprimir funcionan sobre el documento
       que se está viendo, no sobre el primero.
     · Los enlaces de Drive se convierten a /preview, que es el único que
       se deja incrustar. Un /view dentro de un iframe sale en blanco.

   29/09 · TAMAÑO AL GUSTO Y ZOOM
     · La ventana se agranda o se achica desde el borde derecho, el
       izquierdo, el de abajo o las dos esquinas de abajo. Crece en
       PROPORCIÓN (conserva la forma) y nunca se sale de la pantalla.
       Minimizada también se agranda, se achica y se mueve, y cada modo
       recuerda su tamaño y su sitio al ir y volver. Al cerrar se olvida:
       la próxima abre en su tamaño normal.
     · Zoom sobre el documento (PDF dibujado e imágenes): botones − / + y
       el porcentaje (tocarlo vuelve a "ajustado"), Ctrl + rueda (en la
       imagen basta la rueda), pellizco en el teléfono, doble clic o doble
       toque sobre la parte que se quiere ver, y las teclas + − 0. El zoom
       crece hacia donde está el puntero; con zoom, se arrastra para
       moverse por la hoja. Las páginas visibles se vuelven a dibujar a
       la resolución del zoom para que la letra no se vea borrosa.
     · Los documentos de Drive que se ven en un marco (/preview) traen su
       propio zoom: ahí los botones no se muestran.

   Pareja: kit/visor.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/visor] falta kit.js'); } catch (e) {} return; }

  var capa = null;
  var docs = [];
  var i = 0;

  /* ── Drive ── */

  var RE_DRIVE = /(?:drive|docs)\.google\.com\/.*?(?:\/d\/|id=)([a-zA-Z0-9_-]{15,})/;

  function idDrive(url) {
    var m = RE_DRIVE.exec(String(url || ''));
    return m ? m[1] : '';
  }
  /** La única forma de Drive que se deja incrustar en un iframe. */
  function paraVer(url) {
    var id = idDrive(url);
    return id ? 'https://drive.google.com/file/d/' + id + '/preview' : url;
  }
  function paraAbrir(url) {
    var id = idDrive(url);
    return id ? 'https://drive.google.com/file/d/' + id + '/view' : url;
  }
  function paraBajar(url) {
    var id = idDrive(url);
    return id ? 'https://drive.google.com/uc?export=download&id=' + id : url;
  }

  /* ── 30/09 · DIRECTO DE DRIVE (el de REVISAR CUENTAS de Contratación) ──
     Medido en producción: abrir un documento por el CORE es 0,5 s de
     servidor y 2 a 22 s de fila de Apps Script. Con la llave de Google
     (MARCA.DRIVE_LLAVE: solo API de Drive y solo botheart911.github.io)
     el teléfono le pide los bytes a Drive sin pasar por Apps Script y los
     pinta en este mismo visor, en memoria: nada se descarga al equipo.
     Si no hay llave o Drive no lo entrega (no compartido por enlace,
     cuota, red), ese documento sigue por el camino de antes.

     Uso: un documento del visor puede traer `drive` (id de Drive, o
     {id, google}) junto a su `cargar` o su `url` de siempre. Un `url` de
     un archivo de Drive ya cuenta como `drive` sin hacer nada.
     KIT.drive.deBoleto(t) saca el id de un boleto del CORE (6.3/5.4). */

  var DRV = { cache: {}, malo: {}, pend: {}, cola: [], vuelo: 0, peso: 0, orden: [], medidas: [], ctrl: [] };
  var DRV_A_LA_VEZ = 3, DRV_MS = 15000, DRV_TOPE = 40 * 1024 * 1024;
  var DRV_API = 'https://www.googleapis.com/drive/v3/files/';

  function drvLlave() { return String((window.MARCA && window.MARCA.DRIVE_LLAVE) || '').trim(); }
  function drvListo() { return !!drvLlave() && typeof fetch === 'function'; }
  function drvTipo(mime) { return /^image\//.test(mime) ? 'imagen' : (/pdf/.test(mime) ? 'pdf' : 'otro'); }

  /** Boleto del CORE "id.fila.doc.vence.g.firma" → {id, google}. El id ya
      viaja dentro del boleto: no se expone nada nuevo. */
  function deBoleto(t) {
    var p = String(t || '').split('.');
    if (p.length !== 6 || !/^[a-zA-Z0-9_-]{15,}$/.test(p[0])) return null;
    return { id: p[0], google: p[4] === '1' };
  }

  function drvNorm(x) {
    if (!x) return null;
    if (typeof x === 'string') return /^[a-zA-Z0-9_-]{15,}$/.test(x) ? { id: x, google: false } : null;
    return x.id ? { id: String(x.id), google: !!x.google, mime: x.mime || '', nombre: x.nombre || '' } : null;
  }

  function drvGuardar(id, v) {
    DRV.cache[id] = v;
    DRV.orden.push(id);
    DRV.peso += v.bytes.length;
    while (DRV.peso > DRV_TOPE && DRV.orden.length > 1) {
      var viejo = DRV.orden.shift(), c = DRV.cache[viejo];
      if (c && c.bytes) DRV.peso -= c.bytes.length;
      delete DRV.cache[viejo];
    }
  }

  function drvBombear() {
    while (DRV.vuelo < DRV_A_LA_VEZ && DRV.cola.length) drvSalir(DRV.cola.shift());
  }

  function drvSalir(p) {
    DRV.vuelo++;
    var t0 = Date.now(), ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var corte = setTimeout(function () { if (ctrl) ctrl.abort(); }, DRV_MS);
    if (ctrl) DRV.ctrl.push(ctrl);
    var k = encodeURIComponent(drvLlave());
    function url(exportar) {
      return DRV_API + encodeURIComponent(p.id) + (exportar ? '/export?mimeType=application%2Fpdf&' : '?alt=media&supportsAllDrives=true&') + 'key=' + k;
    }
    function bajar(exportar) {
      return fetch(url(exportar), { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' }).then(function (r) {
        if (r.ok) {
          var mime = exportar ? 'application/pdf' : String(r.headers.get('content-type') || p.mime || '').split(';')[0].trim();
          return r.arrayBuffer().then(function (ab) { return { mime: mime, bytes: new Uint8Array(ab) }; });
        }
        /* un Documento de Google no se baja "tal cual": se exporta a PDF */
        if (!exportar && r.status === 403) {
          return r.text().then(function (txt) {
            if (/fileNotDownloadable|binary content/i.test(txt)) return bajar(true);
            throw new Error('Drive ' + r.status);
          });
        }
        throw new Error('Drive ' + r.status);
      });
    }
    bajar(p.google).then(function (x) {
      var v = { nombre: p.nombre || '', mime: x.mime, tipo: drvTipo(x.mime), bytes: x.bytes };
      drvGuardar(p.id, v);
      DRV.medidas.push({ id: p.id.slice(0, 6), via: 'drive', kb: Math.round(x.bytes.length / 1024), ms: Date.now() - t0 });
      p.res(v);
    }, function (e) {
      var cortado = !!(ctrl && ctrl.signal.aborted && ctrl.__cortado);
      DRV.medidas.push({ id: p.id.slice(0, 6), via: 'drive', ms: Date.now() - t0, error: cortado ? 'cortado' : ((e && e.message) || 'red') });
      if (!cortado) DRV.malo[p.id] = true;     /* este ya no se intenta directo */
      var err = new Error(cortado ? 'cortado' : 'Drive no lo entregó');
      err.cortado = cortado;
      p.rej(err);
    }).then(function () {
      clearTimeout(corte);
      if (ctrl) DRV.ctrl = DRV.ctrl.filter(function (c) { return c !== ctrl; });
      delete DRV.pend[p.id];
      DRV.vuelo--;
      drvBombear();
    });
  }

  /** Bytes de un archivo de Drive, directo. Rechaza si no se puede. */
  function drvBytes(ref, nombre, urgente) {
    var r = drvNorm(ref);
    if (!r || !drvListo()) return Promise.reject(new Error('sin llave'));
    if (DRV.malo[r.id]) return Promise.reject(new Error('Drive no lo entregó'));
    var c = DRV.cache[r.id];
    if (c) return Promise.resolve({ nombre: nombre || c.nombre, mime: c.mime, tipo: c.tipo, bytes: c.bytes });
    var p = DRV.pend[r.id];
    if (!p) {
      p = { id: r.id, google: r.google, mime: r.mime, nombre: nombre || '' };
      p.prom = new Promise(function (res, rej) { p.res = res; p.rej = rej; });
      DRV.pend[r.id] = p;
      if (urgente) DRV.cola.unshift(p); else DRV.cola.push(p);
      drvBombear();
    } else if (urgente) {
      var k = DRV.cola.indexOf(p);
      if (k > 0) { DRV.cola.splice(k, 1); DRV.cola.unshift(p); }
    }
    return p.prom.then(function (v) { return { nombre: nombre || v.nombre, mime: v.mime, tipo: v.tipo, bytes: v.bytes }; });
  }

  /** Corta lo que se está bajando y lo que espera en cola (al cerrar el visor). */
  function drvCortar() {
    DRV.cola.splice(0).forEach(function (p) {
      delete DRV.pend[p.id];
      var e = new Error('cortado'); e.cortado = true; p.rej(e);
    });
    DRV.ctrl.forEach(function (c) { c.__cortado = true; try { c.abort(); } catch (e) {} });
  }

  /** Lo que el visor necesita para abrir `d` directo de Drive (o null). */
  function drvDe(d) {
    if (!drvListo()) return null;
    if (d.drive) return drvNorm(d.drive);
    if (d.url && !/\/thumbnail\b|[?&]sz=/.test(d.url)) { var id = idDrive(d.url); if (id) return { id: id, google: /docs\.google\.com\/document/.test(d.url) }; }
    return null;
  }

  /** Prepara un documento: lo directo primero y, si Drive no lo entrega, el
      camino de antes (su `cargar` del CORE o su `url` en el marco). */
  function drvPreparar(d) {
    if (d._drv !== undefined) return;
    var r = drvDe(d);
    d._drv = r || null;
    if (!r) return;
    var antes = typeof d.cargar === 'function' ? d.cargar : null;
    if (!antes && d.url) { d._urlAntes = d.url; d.url = ''; }
    d.cargar = function () {
      return drvBytes(r, r.nombre || '', true).then(null, function (e) {
        if (e && e.cortado) throw e;
        DRV.medidas.push({ id: r.id.slice(0, 6), via: antes ? 'core' : 'marco', ms: 0 });
        if (antes) return antes();
        var x = new Error('al marco'); x.aMarco = true; throw x;
      });
    };
  }

  /** Vuelve un documento al marco de Drive de siempre (Drive no lo entregó). */
  function drvAlMarco(d) {
    d.url = d._urlAntes; d.cargar = null; d._drv = null;
    soltar([d]);
  }

  K.drive = {
    listo: drvListo, deBoleto: deBoleto,
    bytes: function (ref, nombre) { return drvBytes(ref, nombre, true); },
    precargar: function (ref) { if (drvNorm(ref) && drvListo()) drvBytes(ref, '', false)['catch'](function () {}); },
    cortar: drvCortar,
    medidas: function () { return DRV.medidas.slice(); }
  };

  /* ── 4.7 · documentos con bytes ── */

  var CDN_PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  var pdfjsCargando = null;

  function pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsCargando) return pdfjsCargando;
    pdfjsCargando = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = CDN_PDFJS + 'pdf.min.js';
      s.async = true;
      s.onload = function () {
        if (!window.pdfjsLib) { rej(new Error('pdf.js no quedó cargado')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDFJS + 'pdf.worker.min.js';
        /* 5.4 · UN solo trabajador para todos los PDF de la sesión: arrancarlo
           cuesta y antes se arrancaba con cada documento. Si el navegador no
           deja crearlo así, pdf.js lo crea a su manera. */
        try {
          var arranque = new Blob(['importScripts("' + CDN_PDFJS + 'pdf.worker.min.js");'], { type: 'application/javascript' });
          window.pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(arranque));
        } catch (e) { /* pdf.js se arregla solo */ }
        res(window.pdfjsLib);
      };
      s.onerror = function () { pdfjsCargando = null; rej(new Error('No se pudo bajar pdf.js')); };
      document.head.appendChild(s);
    });
    return pdfjsCargando;
  }

  function aBytes(b64) {
    var bin = atob(String(b64 || '').replace(/\s/g, ''));
    var n = bin.length, out = new Uint8Array(n);
    for (var k = 0; k < n; k++) out[k] = bin.charCodeAt(k);
    return out;
  }

  /** Trae los bytes de un documento con `cargar`, una sola vez. */
  function traer(d) {
    if (d._url) return Promise.resolve(d);
    if (d._pidiendo) return d._pidiendo;
    d._pidiendo = Promise.resolve(d.cargar()).then(function (r) {
      /* 5.4 · `cargar` puede devolver los bytes ya listos (Uint8Array) */
      var bytes = (r && r.bytes && typeof r.bytes.length === 'number' && !r.base64) ? r.bytes : aBytes(r.base64);
      var mime = r.mime || 'application/octet-stream';
      d._bytes = bytes;
      d._blob = new Blob([bytes], { type: mime });
      d._url = URL.createObjectURL(d._blob);
      d._nombre = r.nombre || d.titulo || 'documento';
      d._tipo = d.tipo || r.tipo || (/^image\//.test(mime) ? 'imagen' : (/pdf/.test(mime) ? 'pdf' : 'otro'));
      d._pidiendo = null;
      return d;
    }, function (e) { d._pidiendo = null; throw e; });
    return d._pidiendo;
  }

  function soltar(lista) {
    (lista || []).forEach(function (d) {
      if (d && d._url) { try { URL.revokeObjectURL(d._url); } catch (e) {} d._url = null; d._blob = null; d._bytes = null; }
    });
  }

  /** Dibuja un PDF página por página dentro del lienzo. */
  function dibujarPDF(d, lienzo) {
    return pdfjs().then(function (lib) {
      return lib.getDocument({ data: d._bytes.slice() }).promise;
    }).then(function (pdf) {
      if (actual() !== d) return;
      var esc = escena(lienzo, 'pdf');
      var ancho = anchoBase();
      var escalaPantalla = Math.min(window.devicePixelRatio || 1, 2);
      var cadena = Promise.resolve();
      for (var p = 1; p <= pdf.numPages; p++) {
        (function (n) {
          cadena = cadena.then(function () {
            if (actual() !== d) return;
            return pdf.getPage(n).then(function (pag) {
              var base = pag.getViewport({ scale: 1 });
              var pxAncho = Math.floor(ancho * escalaPantalla);
              var c = lienzoDe(pag, pxAncho);
              Z.paginas.push({ pag: pag, c: c, px: pxAncho, pxBase: pxAncho, w1: base.width, h1: base.height });
              if (Z.paginas.length === 1) { Z.aspecto = base.width / base.height; ajustar(); }
              esc.pliego.appendChild(c);
              return pag.render({ canvasContext: c.getContext('2d'), viewport: pag.getViewport({ scale: pxAncho / base.width }) }).promise;
            });
          });
        })(p);
      }
      return cadena.then(function () { if (actual() === d) nitidez(); });
    });
  }

  function lienzoDe(pag, pxAncho) {
    var vista = pag.getViewport({ scale: pxAncho / pag.getViewport({ scale: 1 }).width });
    var c = document.createElement('canvas');
    c.className = 'kit-visor__hoja';
    c.width = Math.floor(vista.width);
    c.height = Math.floor(vista.height);
    return c;
  }

  /** Lo que se ve de un documento que llegó con bytes. */
  function pintarBytes(d, lienzo) {
    lienzo.innerHTML = '<div class="kit-visor__cargando">Abriendo el documento…</div>';
    traer(d).then(function () {
      if (actual() !== d) return;
      vecinos();
      if (d._tipo === 'imagen') {
        montarImagen(lienzo, d._url, d.titulo);
        return;
      }
      if (d._tipo === 'pdf') {
        return dibujarPDF(d, lienzo)['catch'](function () {
          /* sin pdf.js (sin red hacia el CDN): el iframe, y si el teléfono
             no lo pinta, la persona igual tiene el botón de descargar */
          if (actual() !== d) return;
          sinZoom();
          lienzo.innerHTML = '';
          var f = document.createElement('iframe');
          f.className = 'kit-visor__marco';
          f.src = d._url;
          lienzo.appendChild(f);
          lienzo.appendChild(K.nodo('<p class="kit-visor__nota">¿No se ve? Toca descargar ' + K.icono('descargar', 14) + ' arriba.</p>'));
        });
      }
      lienzo.innerHTML = '<div class="kit-visor__malo">Este tipo de archivo no se puede ver aquí.<br>' +
        '<button type="button" class="kit-btn kit-btn--marca">Descargarlo</button></div>';
      lienzo.querySelector('button').addEventListener('click', function () { accion('bajar'); });
    })['catch'](function (e) {
      if (actual() !== d) return;
      /* 30/09 · Drive no lo entregó y no hay camino del CORE: el marco de antes */
      if (e && e.aMarco) { drvAlMarco(d); pintar(); return; }
      lienzo.innerHTML = '<div class="kit-visor__malo">' + K.esc((e && e.message) || 'No se pudo abrir el documento.') + '<br>' +
        '<button type="button" class="kit-btn kit-btn--marca">Volver a intentar</button></div>';
      lienzo.querySelector('button').addEventListener('click', function () { pintar(); });
    });
  }

  /* 30/09 · el siguiente y el anterior se adelantan directo de Drive (no
     tocan la fila de Apps Script); lo que va por el CORE no se adelanta. */
  function vecinos() {
    [i + 1, i - 1].forEach(function (k) {
      var v = docs[k];
      if (v && v._drv) K.drive.precargar(v._drv);
    });
  }

  function tipoDe(d) {
    if (d.tipo) return d.tipo;
    var u = String(d.url || '').toLowerCase();
    if (/\.(png|jpe?g|webp|gif|bmp)(\?|$)/.test(u)) return 'imagen';
    return 'pdf';
  }

  /* ── ventana ── */

  function crear() {
    capa = K.nodo(
      '<div class="kit-visor" role="dialog" aria-modal="false" aria-label="Documentos">' +
      '  <div class="kit-visor__velo"></div>' +
      '  <section class="kit-visor__caja">' +
      '    <header class="kit-visor__barra">' +
      '      <span class="kit-visor__agarre" aria-hidden="true">⠿</span>' +
      '      <span class="kit-visor__t"></span>' +
      '      <span class="kit-visor__cuenta"></span>' +
      '      <div class="kit-visor__acciones">' +
      '        <button type="button" class="kit-visor__b" data-a="abrir"    title="Abrir en una pestaña">' + K.icono('abrir-pestana', 18) + '</button>' +
      '        <button type="button" class="kit-visor__b" data-a="bajar"    title="Descargar">' + K.icono('descargar', 18) + '</button>' +
      '        <button type="button" class="kit-visor__b" data-a="imprimir" title="Imprimir">' + K.icono('imprimir', 18) + '</button>' +
      '        <button type="button" class="kit-visor__b" data-a="encoger"  title="Minimizar">–</button>' +
      '        <button type="button" class="kit-visor__b kit-visor__b--x" data-a="cerrar" title="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
      '      </div>' +
      '    </header>' +
      '    <div class="kit-visor__cuerpo">' +
      '      <div class="kit-visor__lienzo"></div>' +
      '      <div class="kit-visor__zoom kit-oculto" role="group" aria-label="Zoom del documento">' +
      '        <button type="button" class="kit-visor__zb" data-z="menos" title="Alejar (tecla −)" aria-label="Alejar">' + K.icono('menos', 16) + '</button>' +
      '        <button type="button" class="kit-visor__zp" data-z="ajustar" title="Ajustar a la ventana (tecla 0)">100%</button>' +
      '        <button type="button" class="kit-visor__zb" data-z="mas" title="Acercar (tecla +). También: Ctrl + rueda, pellizco o doble clic sobre la parte que quieres ver" aria-label="Acercar">' + K.icono('mas', 16) + '</button>' +
      '      </div>' +
      '    </div>' +
      '    <footer class="kit-visor__pie">' +
      '      <button type="button" class="kit-btn kit-visor__nav" data-p="-1">‹ Anterior</button>' +
      '      <span class="kit-visor__puntos"></span>' +
      '      <button type="button" class="kit-btn kit-visor__nav" data-p="1">Siguiente ›</button>' +
      '    </footer>' +
      '    <span class="kit-visor__asa kit-visor__asa--e"  data-lado="e"  aria-hidden="true"></span>' +
      '    <span class="kit-visor__asa kit-visor__asa--w"  data-lado="w"  aria-hidden="true"></span>' +
      '    <span class="kit-visor__asa kit-visor__asa--s"  data-lado="s"  aria-hidden="true"></span>' +
      '    <span class="kit-visor__asa kit-visor__asa--se" data-lado="se" aria-hidden="true" title="Arrastra para cambiar el tamaño"></span>' +
      '    <span class="kit-visor__asa kit-visor__asa--sw" data-lado="sw" aria-hidden="true" title="Arrastra para cambiar el tamaño"></span>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(capa);

    capa.querySelector('.kit-visor__velo').addEventListener('click', cerrar);
    capa.querySelectorAll('.kit-visor__b').forEach(function (b) {
      b.addEventListener('click', function () { accion(b.dataset.a); });
    });
    capa.querySelectorAll('.kit-visor__nav').forEach(function (b) {
      b.addEventListener('click', function () { ir(i + (+b.dataset.p)); });
    });
    capa.querySelectorAll('.kit-visor__zb, .kit-visor__zp').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.z === 'mas') zoomA(Z.z * 1.25);
        else if (b.dataset.z === 'menos') zoomA(Z.z / 1.25);
        else zoomA(1);
      });
    });
    document.addEventListener('keydown', teclas);
    var caja = capa.querySelector('.kit-visor__caja');
    arrastrable(caja, capa.querySelector('.kit-visor__barra'));
    redimensionable(caja);
    window.addEventListener('resize', function () { if (capa.classList.contains('kit-visor--on')) dentro(caja); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (Z.sc) requestAnimationFrame(ajustar); }).observe(capa.querySelector('.kit-visor__lienzo'));
    }
  }

  function teclas(e) {
    if (!capa || !capa.classList.contains('kit-visor--on')) return;
    var t = e.target && e.target.tagName;
    var escribiendo = t === 'INPUT' || t === 'TEXTAREA' || (e.target && e.target.isContentEditable);
    if (!escribiendo && Z.sc) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomA(Z.z * 1.25); return; }
      if (e.key === '-') { e.preventDefault(); zoomA(Z.z / 1.25); return; }
      if (e.key === '0') { e.preventDefault(); zoomA(1); return; }
    }
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowRight') ir(i + 1);
    else if (e.key === 'ArrowLeft') ir(i - 1);
  }

  /* ── posición y tamaño libres ──
     La caja nace centrada por la capa. Al primer arrastre o cambio de
     tamaño pasa a posición fija con su sitio y su tamaño actuales, y desde
     ahí se mueve con left/top y crece con width/height. */

  var MARGEN = 8, VISIBLE = 60, MIN_W = 320, MIN_H = 220;

  function libre(caja) {
    if (caja.classList.contains('kit-visor__caja--libre')) return;
    var r = caja.getBoundingClientRect();
    caja.classList.add('kit-visor__caja--libre', 'kit-visor__caja--movida');
    caja.style.left = r.left + 'px';
    caja.style.top = r.top + 'px';
    caja.style.width = r.width + 'px';
    caja.style.height = r.height + 'px';
  }

  /** Que la ventana no se quede por fuera (al girar el teléfono o achicar el navegador). */
  function dentro(caja) {
    if (!caja.classList.contains('kit-visor__caja--libre')) return;
    var W = window.innerWidth, H = window.innerHeight;
    var w = caja.offsetWidth, h = caja.offsetHeight;
    if (!capa.classList.contains('kit-visor--chico') && (w > W - 2 * MARGEN || h > H - 2 * MARGEN)) {
      var f = Math.min((W - 2 * MARGEN) / w, (H - 2 * MARGEN) / h);
      w = Math.round(w * f); h = Math.round(h * f);
      caja.style.width = w + 'px'; caja.style.height = h + 'px';
    }
    var l = parseFloat(caja.style.left) || 0, t = parseFloat(caja.style.top) || 0;
    caja.style.left = Math.min(Math.max(l, -w + VISIBLE), W - VISIBLE) + 'px';
    caja.style.top = Math.min(Math.max(t, 0), H - VISIBLE) + 'px';
  }

  /** Mover la ventana por la barra, con dedo o con ratón. */
  function arrastrable(caja, asa) {
    var moviendo = false, x0 = 0, y0 = 0, l0 = 0, t0 = 0;

    function baja(e) {
      if (e.target.closest('.kit-visor__b')) return;   /* los botones no arrastran */
      if (e.button !== undefined && e.button !== 0) return;
      libre(caja);
      moviendo = true;
      x0 = e.clientX; y0 = e.clientY;
      l0 = parseFloat(caja.style.left) || 0; t0 = parseFloat(caja.style.top) || 0;
      document.addEventListener('pointermove', mueve);
      document.addEventListener('pointerup', sube, { once: true });
      document.addEventListener('pointercancel', sube, { once: true });
    }
    function mueve(e) {
      if (!moviendo) return;
      var w = caja.offsetWidth;
      /* no dejar que se escape de la pantalla: siempre queda un trozo de barra a la vista */
      var l = Math.min(Math.max(l0 + (e.clientX - x0), -w + VISIBLE), window.innerWidth - VISIBLE);
      var t = Math.min(Math.max(t0 + (e.clientY - y0), 0), window.innerHeight - VISIBLE);
      caja.style.left = l + 'px';
      caja.style.top = t + 'px';
    }
    function sube() {
      moviendo = false;
      document.removeEventListener('pointermove', mueve);
    }

    asa.addEventListener('pointerdown', baja);
    /* al cerrar se olvida dónde estaba y qué tamaño tenía: la próxima abre centrada */
    capa.__resetPos = function () {
      ['left', 'top', 'width', 'height', 'transform'].forEach(function (k) { caja.style[k] = ''; });
      caja.classList.remove('kit-visor__caja--movida', 'kit-visor__caja--libre');
      caja.__normal = null;
      caja.__chico = null;
    };
  }

  /**
   * Cambiar el tamaño desde un borde o esquina, EN PROPORCIÓN: el ancho y el
   * alto crecen por el mismo factor, así la ventana conserva su forma.
   * Borde derecho/esquina derecha: queda fija la izquierda. Borde izquierdo/
   * esquina izquierda: queda fija la derecha. Arriba no hay asa: la barra es
   * para mover.
   */
  function redimensionable(caja) {
    var lado = '', x0 = 0, y0 = 0, w0 = 0, h0 = 0, l0 = 0, t0 = 0, activo = null;

    function factor(e) {
      var dx = e.clientX - x0, dy = e.clientY - y0;
      var fe = (w0 + dx) / w0, fw = (w0 - dx) / w0, fs = (h0 + dy) / h0;
      if (lado === 'e') return fe;
      if (lado === 'w') return fw;
      if (lado === 's') return fs;
      if (lado === 'se') return (fe + fs) / 2;
      return (fw + fs) / 2;                                   /* sw */
    }
    function baja(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      libre(caja);
      activo = e.currentTarget;
      lado = activo.dataset.lado;
      x0 = e.clientX; y0 = e.clientY;
      w0 = caja.offsetWidth; h0 = caja.offsetHeight;
      l0 = parseFloat(caja.style.left) || 0; t0 = parseFloat(caja.style.top) || 0;
      caja.classList.add('kit-visor__caja--cambiando');
      try { activo.setPointerCapture(e.pointerId); } catch (x) {}
      activo.addEventListener('pointermove', mueve);
      activo.addEventListener('pointerup', sube);
      activo.addEventListener('pointercancel', sube);
    }
    function mueve(e) {
      var W = window.innerWidth, H = window.innerHeight;
      var fMin = Math.max(Math.min(MIN_W, W - 2 * MARGEN) / w0, Math.min(MIN_H, H - 2 * MARGEN) / h0);
      var fMax = Math.min((W - 2 * MARGEN) / w0, (H - 2 * MARGEN) / h0);
      var f = Math.min(Math.max(factor(e), fMin), Math.max(fMax, fMin));
      var w = Math.round(w0 * f), h = Math.round(h0 * f);
      var l = (lado === 'w' || lado === 'sw') ? l0 + w0 - w : l0;
      var t = t0;
      /* si al crecer se sale por un lado, se corre hacia adentro */
      l = Math.min(Math.max(l, MARGEN), W - w - MARGEN);
      t = Math.min(Math.max(t, MARGEN), H - h - MARGEN);
      caja.style.width = w + 'px';
      caja.style.height = h + 'px';
      caja.style.left = l + 'px';
      caja.style.top = t + 'px';
    }
    function sube(e) {
      caja.classList.remove('kit-visor__caja--cambiando');
      if (activo) {
        try { activo.releasePointerCapture(e.pointerId); } catch (x) {}
        activo.removeEventListener('pointermove', mueve);
        activo.removeEventListener('pointerup', sube);
        activo.removeEventListener('pointercancel', sube);
      }
      activo = null;
      if (Z.sc) { ajustar(); nitidezLuego(); }
    }
    caja.querySelectorAll('.kit-visor__asa').forEach(function (a) { a.addEventListener('pointerdown', baja); });
  }

  /* ══════════════ ZOOM ══════════════
     El documento va en una ESCENA (la que tiene el scroll) con un PLIEGO
     adentro. Ajustado (100 %) el pliego mide lo que cabe; con zoom mide
     ancho × zoom y la escena deja moverse por él. Las páginas del PDF y la
     imagen ocupan el ancho del pliego. */

  var Z_MIN = 0.5, Z_MAX = 5;
  var Z = { z: 1, sc: null, pliego: null, tipo: '', aspecto: 0, paginas: [], t: 0 };

  function sinZoom() {
    Z.sc = null; Z.pliego = null; Z.tipo = ''; Z.z = 1; Z.aspecto = 0; Z.paginas = [];
    clearTimeout(Z.t);
    if (capa) capa.querySelector('.kit-visor__zoom').classList.add('kit-oculto');
  }

  /** Arma la escena dentro del lienzo y la deja lista para el zoom. */
  function escena(lienzo, tipo) {
    sinZoom();
    var sc = document.createElement('div');
    sc.className = 'kit-visor__hojas' + (tipo === 'imagen' ? ' kit-visor__hojas--img' : '');
    var pl = document.createElement('div');
    pl.className = 'kit-visor__pliego';
    sc.appendChild(pl);
    lienzo.innerHTML = '';
    lienzo.appendChild(sc);
    Z.sc = sc; Z.pliego = pl; Z.tipo = tipo;
    gestos(sc);
    capa.querySelector('.kit-visor__zoom').classList.remove('kit-oculto');
    pintarPorcentaje();
    return { sc: sc, pliego: pl };
  }

  function montarImagen(lienzo, src, alt) {
    var esc = escena(lienzo, 'imagen');
    var img = new Image();
    img.className = 'kit-visor__img';
    img.alt = alt || '';
    img.draggable = false;
    img.addEventListener('load', function () {
      if (Z.pliego !== esc.pliego) return;
      Z.aspecto = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      ajustar();
      var c = lienzo.querySelector('.kit-visor__cargando');
      if (c) c.remove();
    });
    img.addEventListener('error', function () {
      if (Z.pliego !== esc.pliego) return;
      sinZoom();
      lienzo.innerHTML = '<div class="kit-visor__malo">No se pudo abrir el documento.<br>' +
        '<button type="button" class="kit-btn kit-btn--marca">Abrir en una pestaña</button></div>';
      lienzo.querySelector('button').addEventListener('click', function () { accion('abrir'); });
    });
    img.src = src;
    esc.pliego.appendChild(img);
  }

  /** El ancho "ajustado" del pliego (zoom 100 %). */
  function anchoBase() {
    var sc = Z.sc || (capa && capa.querySelector('.kit-visor__lienzo'));
    var w = Math.max(120, (sc ? sc.clientWidth : 600) - 24);
    if (Z.tipo === 'imagen') {
      var h = Math.max(120, (sc ? sc.clientHeight : 400) - 24);
      return Z.aspecto ? Math.min(w, h * Z.aspecto) : w;
    }
    return Math.max(280, Math.min(w, 1100));
  }

  /** Pone el pliego al ancho que toca (base × zoom). */
  function ajustar() {
    if (!Z.pliego) return;
    if (Z.tipo === 'imagen' && !Z.aspecto) return;
    Z.pliego.style.width = Math.round(anchoBase() * Z.z) + 'px';
    Z.sc.classList.toggle('kit-visor__hojas--zoom', Z.z > 1.001);
  }

  function pintarPorcentaje() {
    if (!capa) return;
    capa.querySelector('.kit-visor__zp').textContent = Math.round(Z.z * 100) + '%';
    capa.querySelector('[data-z="menos"]').disabled = Z.z <= Z_MIN + 0.001;
    capa.querySelector('[data-z="mas"]').disabled = Z.z >= Z_MAX - 0.001;
  }

  /**
   * Cambia el zoom dejando QUIETO el punto (cx, cy) de la pantalla: lo que
   * estaba bajo el puntero sigue bajo el puntero. Sin punto, el centro.
   */
  function zoomA(nz, cx, cy) {
    if (!Z.sc || !Z.pliego) return;
    nz = Math.min(Z_MAX, Math.max(Z_MIN, nz));
    if (Math.abs(nz - 1) < 0.04) nz = 1;
    var sc = Z.sc, rs = sc.getBoundingClientRect();
    if (cx === undefined) { cx = rs.left + sc.clientWidth / 2; cy = rs.top + sc.clientHeight / 2; }
    var rp = Z.pliego.getBoundingClientRect();
    var fx = rp.width ? (cx - rp.left) / rp.width : 0.5;
    var fy = rp.height ? (cy - rp.top) / rp.height : 0.5;
    Z.z = nz;
    ajustar();
    var rp2 = Z.pliego.getBoundingClientRect();
    sc.scrollLeft += (rp2.left + fx * rp2.width) - cx;
    sc.scrollTop += (rp2.top + fy * rp2.height) - cy;
    pintarPorcentaje();
    nitidezLuego();
  }

  /* Las páginas del PDF que se ven se vuelven a dibujar a la resolución del
     zoom (si no, la letra sale borrosa). Las que se van de la vista vuelven a
     su resolución de base para no llenar la memoria del teléfono. */
  var TOPE_PX = 3200;

  function nitidezLuego() { clearTimeout(Z.t); Z.t = setTimeout(nitidez, 220); }

  function nitidez() {
    if (Z.tipo !== 'pdf' || !Z.sc || !Z.paginas.length) return;
    var d = actual(), sc = Z.sc, rs = sc.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var quiere = Math.min(TOPE_PX, Math.floor(Z.pliego.clientWidth * dpr));
    var cadena = Promise.resolve();
    Z.paginas.forEach(function (p) {
      var r = p.c.getBoundingClientRect();
      var visible = r.bottom > rs.top - 200 && r.top < rs.bottom + 200;
      var meta = visible ? Math.max(quiere, p.pxBase) : p.pxBase;
      if (Math.abs(meta - p.px) / p.px < 0.12) return;
      cadena = cadena.then(function () {
        if (actual() !== d || !p.c.parentNode) return;
        var nuevo = lienzoDe(p.pag, meta);
        return p.pag.render({ canvasContext: nuevo.getContext('2d'), viewport: p.pag.getViewport({ scale: meta / p.w1 }) }).promise
          .then(function () {
            if (actual() !== d || !p.c.parentNode) return;
            p.c.parentNode.replaceChild(nuevo, p.c);
            p.c = nuevo; p.px = meta;
          });
      })['catch'](function () {});
    });
    return cadena;
  }

  /** Rueda, arrastrar con zoom, doble clic/toque y pellizco. */
  function gestos(sc) {
    sc.addEventListener('wheel', function (e) {
      /* en el PDF la rueda sola baja por las páginas; con Ctrl (o el
         pellizco del touchpad, que llega como Ctrl + rueda) es zoom */
      if (!(e.ctrlKey || e.metaKey || Z.tipo === 'imagen')) { nitidezLuego(); return; }
      e.preventDefault();
      var f = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0022);
      zoomA(Z.z * f, e.clientX, e.clientY);
    }, { passive: false });
    sc.addEventListener('scroll', function () { if (Z.z > 1.001) nitidezLuego(); }, { passive: true });

    /* con zoom, el ratón arrastra la hoja (en el teléfono ya se mueve con el dedo) */
    var mov = false, x0 = 0, y0 = 0, sl = 0, st = 0;
    sc.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (sc.scrollWidth <= sc.clientWidth && sc.scrollHeight <= sc.clientHeight) return;
      mov = true; x0 = e.clientX; y0 = e.clientY; sl = sc.scrollLeft; st = sc.scrollTop;
      sc.classList.add('kit-visor__hojas--agarrada');
      try { sc.setPointerCapture(e.pointerId); } catch (x) {}
    });
    sc.addEventListener('pointermove', function (e) {
      if (!mov) return;
      sc.scrollLeft = sl - (e.clientX - x0);
      sc.scrollTop = st - (e.clientY - y0);
    });
    function suelta() { mov = false; sc.classList.remove('kit-visor__hojas--agarrada'); }
    sc.addEventListener('pointerup', suelta);
    sc.addEventListener('pointercancel', suelta);

    /* doble clic: acerca a la parte señalada; otra vez, vuelve a ajustado */
    sc.addEventListener('dblclick', function (e) {
      e.preventDefault();
      zoomA(Z.z > 1.05 ? 1 : 2.5, e.clientX, e.clientY);
      K.vibrar(8);
    });

    /* teléfono: doble toque y pellizco con touch (el navegador no se queda
       con el pellizco porque la escena lleva touch-action: pan-x pan-y) */
    var ultimo = 0, d0 = 0, z0 = 1;
    function sep(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    sc.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { d0 = sep(e.touches); z0 = Z.z; }
      else if (e.touches.length === 1) {
        var ahora = Date.now();
        if (ahora - ultimo < 300) {
          e.preventDefault();
          zoomA(Z.z > 1.05 ? 1 : 2.5, e.touches[0].clientX, e.touches[0].clientY);
          K.vibrar(8);
          ultimo = 0;
        } else ultimo = ahora;
      }
    }, { passive: false });
    sc.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || !d0) return;
      e.preventDefault();
      var t = e.touches;
      zoomA(z0 * (sep(t) / d0), (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
    }, { passive: false });
    sc.addEventListener('touchend', function (e) { if (e.touches.length < 2) d0 = 0; });
  }

  function actual() { return docs[i] || null; }

  function accion(a) {
    var d = actual();
    if (!d && a !== 'cerrar' && a !== 'encoger') return;
    if (a === 'cerrar') return cerrar();
    if (a === 'encoger') {
      var caja = capa.querySelector('.kit-visor__caja');
      var yaChico = capa.classList.contains('kit-visor--chico');
      /* 29/09 · el tamaño y el sitio elegidos se guardan al minimizar y
         vuelven al restaurar; minimizada, la esquina manda */
      if (!yaChico) {
        caja.__normal = { css: caja.style.cssText, libre: caja.classList.contains('kit-visor__caja--libre') };
        caja.style.cssText = '';
        caja.classList.remove('kit-visor__caja--libre', 'kit-visor__caja--movida');
        /* 29/09 · minimizada también se agranda o se mueve; si ya se había
           ajustado antes, vuelve con ese tamaño y en ese sitio */
        if (caja.__chico) { caja.style.cssText = caja.__chico; caja.classList.add('kit-visor__caja--libre', 'kit-visor__caja--movida'); dentro(caja); }
      } else {
        caja.__chico = caja.classList.contains('kit-visor__caja--libre') ? caja.style.cssText : null;
        caja.style.cssText = caja.__normal ? caja.__normal.css : '';
        caja.classList.remove('kit-visor__caja--libre', 'kit-visor__caja--movida');
        if (caja.__normal && caja.__normal.libre) { caja.classList.add('kit-visor__caja--libre', 'kit-visor__caja--movida'); dentro(caja); }
        caja.__normal = null;
      }
      capa.classList.toggle('kit-visor--chico');
      var b = capa.querySelector('[data-a="encoger"]');
      var chico = capa.classList.contains('kit-visor--chico');
      b.textContent = chico ? '▢' : '–';
      b.title = chico ? 'Volver al tamaño normal' : 'Minimizar';
      return;
    }
    if (d.cargar && !d.url) { accionBytes(a, d); return; }
    if (a === 'abrir') { window.open(paraAbrir(d.url), '_blank', 'noopener'); return; }
    if (a === 'bajar') {
      var l = document.createElement('a');
      l.href = paraBajar(d.url);
      l.download = (d.titulo || 'documento').replace(/[^\w.\- ]/g, '') || 'documento';
      l.target = '_blank';
      l.rel = 'noopener';
      document.body.appendChild(l);
      l.click();
      l.remove();
      return;
    }
    if (a === 'imprimir') {
      /* El iframe de Drive es de otro origen: no se puede mandar a
         imprimir desde aquí. Se abre en pestaña y ahí sí imprime.
         Mentir con un botón que no hace nada es peor que decirlo. */
      var v = capa.querySelector('.kit-visor__lienzo iframe, .kit-visor__lienzo img');
      if (v && v.tagName === 'IMG') {
        var w = window.open('', '_blank');
        if (!w) { K.aviso('El navegador bloqueó la ventana de impresión.', 'aviso'); return; }
        w.document.write('<img src="' + K.esc(v.src) + '" style="max-width:100%" onload="window.print();window.close()">');
        w.document.close();
        return;
      }
      window.open(paraAbrir(d.url), '_blank', 'noopener');
      K.aviso('Se abrió en otra pestaña: desde ahí puedes imprimir.', 'info', 4200);
    }
  }

  /* 4.7 · abrir, descargar e imprimir un documento que llegó con bytes */
  function accionBytes(a, d) {
    traer(d).then(function () {
      if (a === 'bajar') {
        var l = document.createElement('a');
        l.href = d._url;
        l.download = d._nombre;
        document.body.appendChild(l);
        l.click();
        l.remove();
        K.aviso('Descargando ' + d._nombre, 'ok', 2600);
        return;
      }
      var w = window.open(d._url, '_blank');
      if (!w) { K.aviso('El navegador bloqueó la ventana. Usa descargar.', 'aviso'); return; }
      if (a === 'imprimir') K.aviso('Se abrió en otra pestaña: desde ahí puedes imprimir.', 'info', 4200);
    })['catch'](function (e) { K.aviso((e && e.message) || 'No se pudo abrir.', 'malo'); });
  }

  function pintar() {
    var d = actual();
    var lienzo = capa.querySelector('.kit-visor__lienzo');
    capa.querySelector('.kit-visor__t').textContent = d ? (d.titulo || 'Documento') : '';
    capa.querySelector('.kit-visor__cuenta').textContent = docs.length > 1 ? (i + 1) + ' de ' + docs.length : '';

    sinZoom();
    lienzo.innerHTML = '<div class="kit-visor__cargando">Abriendo el documento…</div>';
    if (!d) return;

    if (d.cargar && !d.url) {
      pintarBytes(d, lienzo);
      puntos();
      return;
    }

    if (tipoDe(d) === 'imagen') {
      /* la imagen también lleva zoom: el aviso de "abriendo" se queda hasta que carga */
      var espera = lienzo.innerHTML;
      montarImagen(lienzo, d.url, d.titulo);
      lienzo.insertAdjacentHTML('afterbegin', espera);
      puntos();
      return;
    }
    /* el /preview de Drive trae su propio zoom: aquí no hay pastilla */
    var marco = document.createElement('iframe');
    marco.className = 'kit-visor__marco';
    marco.setAttribute('allow', 'autoplay');
    marco.setAttribute('referrerpolicy', 'no-referrer');
    marco.src = paraVer(d.url);
    marco.addEventListener('load', function () {
      var c = lienzo.querySelector('.kit-visor__cargando');
      if (c) c.remove();
    });
    marco.addEventListener('error', function () {
      lienzo.innerHTML = '<div class="kit-visor__malo">No se pudo abrir el documento.<br>' +
        '<button type="button" class="kit-btn kit-btn--marca">Abrir en una pestaña</button></div>';
      lienzo.querySelector('button').addEventListener('click', function () { accion('abrir'); });
    });
    lienzo.appendChild(marco);
    puntos();
  }

  function puntos() {
    /* puntos de navegación */
    var p = capa.querySelector('.kit-visor__puntos');
    p.innerHTML = '';
    if (docs.length > 1) {
      docs.forEach(function (_, k) {
        var b = K.nodo('<button type="button" class="kit-visor__punto' + (k === i ? ' sel' : '') +
          '" aria-label="Documento ' + (k + 1) + '"></button>');
        b.addEventListener('click', function () { ir(k); });
        p.appendChild(b);
      });
    }
    capa.querySelector('.kit-visor__pie').classList.toggle('kit-oculto', docs.length < 2);
    capa.querySelectorAll('.kit-visor__nav').forEach(function (b) {
      var destino = i + (+b.dataset.p);
      b.disabled = destino < 0 || destino >= docs.length;
    });
  }

  function ir(n) {
    if (!docs.length) return;
    if (n < 0 || n >= docs.length) return;
    i = n;
    pintar();
    K.vibrar(6);
  }

  function abrir(lista, opciones) {
    opciones = opciones || {};
    soltar(docs);
    docs = (Array.isArray(lista) ? lista : [lista]).filter(function (d) { return d && (d.url || typeof d.cargar === 'function'); });
    if (!docs.length) { K.aviso('No hay documentos para mostrar.', 'aviso'); return; }
    i = Math.min(Math.max(opciones.indice || 0, 0), docs.length - 1);
    docs.forEach(drvPreparar);

    if (!capa) crear();
    /* 05/10 · si ya estaba abierto, se cambia el documento SIN mover la
       ventana; si estaba minimizado, se restaura sola (con el tamaño que la
       persona le había dado y el botón de minimizar en su sitio). Solo una
       ventana cerrada vuelve a su sitio de siempre. */
    var yaAbierto = capa.classList.contains('kit-visor--on');
    if (yaAbierto && capa.classList.contains('kit-visor--chico')) accion('encoger');
    else if (!yaAbierto) {
      if (capa.__resetPos) capa.__resetPos();
      capa.classList.remove('kit-visor--chico');
      var bE = capa.querySelector('[data-a="encoger"]');
      if (bE) { bE.textContent = '–'; bE.title = 'Minimizar'; }
    }
    capa.classList.add('kit-visor--on');
    pintar();
  }

  function cerrar() {
    if (!capa) return;
    capa.classList.remove('kit-visor--on');
    capa.querySelector('.kit-visor__lienzo').innerHTML = '';   /* suelta el iframe */
    sinZoom();
    soltar(docs);
    drvCortar();
    docs = [];
    i = 0;
  }

  K.piezas.visor = {
    abrir: abrir, cerrar: cerrar, ir: ir,
    /* 29/09 · zoom del documento que se está viendo (1 = ajustado) */
    zoom: function (n) { if (n !== undefined) zoomA(n); return Z.z; },
    abierto: function () { return !!(capa && capa.classList.contains('kit-visor--on')); },
    idDrive: idDrive, paraVer: paraVer, paraAbrir: paraAbrir, paraBajar: paraBajar,
    /* 5.4 · bajar pdf.js y su trabajador ANTES del primer documento */
    precalentar: function () { return pdfjs()['catch'](function () { return null; }); }
  };
}());
