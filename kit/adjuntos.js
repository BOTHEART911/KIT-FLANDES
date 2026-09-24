/* ============================================================
   KIT-FLANDES · PIEZA 6 · ADJUNTAR, ARRASTRAR Y PEGAR
   El patrón de SEP-GROUP, generalizado.

   Tres formas de meter un archivo, porque cada persona usa la suya:
     · el botón de siempre
     · arrastrarlo encima (escritorio)
     · Ctrl+V con una captura en el portapapeles  ← la que más se usa
       cuando alguien recorta la planilla de la EPS

   Cómo se usa

     var caja = KIT.piezas.adjuntos.montar('#zona', {
       acepta: 'application/pdf,image/*',
       varios: true,
       maximoMB: 10,
       maximo: 5,
       alCambiar: function (archivos) { ... }   // Array de File
     });

     caja.archivos()   lista actual
     caja.limpiar()
     caja.aBase64()    Promise con [{nombre, tipo, datos}] listo para el CORE

   Por qué base64
     Apps Script recibe el archivo dentro del JSON del POST. No hay
     multipart. Se avisa del peso porque un PDF de 20 MB en base64 pasa de
     26 MB y el POST se cae.

   Pareja: kit/adjuntos.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/adjuntos] falta kit.js'); } catch (e) {} return; }

  function pesoLegible(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function icono(tipo, nombre) {
    var t = String(tipo || '');
    var n = String(nombre || '').toLowerCase();
    if (t.indexOf('image/') === 0) return K.icono('imagen', 18);
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return K.icono('pdf', 18);
    if (/sheet|excel|csv/.test(t) || /\.(xlsx?|csv)$/.test(n)) return K.icono('hoja', 18);
    if (/word|document/.test(t) || /\.docx?$/.test(n)) return K.icono('documento', 18);
    return K.icono('clip', 18);
  }

  /*
   * 4.6 · CUÁL DE LAS VEINTE CASILLAS SE QUEDA CON EL Ctrl+V
   *
   * El fallo que encontró Oss: el escuchador de "paste" se colgaba del
   * DOCUMENTO, una vez por casilla montada. En la vista de Documentos hay
   * veinte a la vista, así que un solo Ctrl+V metía el MISMO PDF en las
   * veinte. Verlo es fácil; darse cuenta después, no.
   *
   * Ahora hay una sola zona ACTIVA en toda la página — la última que la
   * persona tocó — y el pegado va ahí y en ningún otro sitio. Si no hay
   * ninguna tocada, no se pega nada y se explica por qué; es mejor eso que
   * repartir el archivo a ciegas.
   */
  /* Qué extensiones corresponden a cada tipo. Vive FUERA de montar() a
     propósito: el rótulo de la zona la consulta al pintarse, y declarada
     dentro solo se izaba el nombre —no el valor— y la vista reventaba con
     "Cannot read properties of undefined (reading 'image/*')". */
  var EXTENSION_DE = {
    'application/pdf': ['.pdf'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
    'image/heic': ['.heic'],
    'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.gif', '.bmp']
  };

  var zonaActiva = null;

  function montar(destino, opciones) {
    opciones = opciones || {};
    var zona = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!zona) return null;

    var acepta = opciones.acepta || '';
    var varios = opciones.varios !== false;
    var topeMB = opciones.maximoMB || 10;
    var tope = opciones.maximo || (varios ? 5 : 1);
    var lista = [];

    zona.classList.add('kit-adj');
    zona.innerHTML =
      '<div class="kit-adj__soltar" tabindex="0" role="button" aria-label="Adjuntar archivos">' +
      '  <div class="kit-adj__icono">' + K.icono('clip', 26) + '</div>' +
      '  <div class="kit-adj__texto">' +
      '    <b>Toca para adjuntar</b>' +
      '    <span class="kit-adj__admite"></span>' +
      '  </div>' +
      '</div>' +
      '<input type="file" class="kit-adj__input kit-oculto"' +
      (acepta ? ' accept="' + K.esc(acepta) + '"' : '') +
      (varios ? ' multiple' : '') + '>' +
      '<ul class="kit-adj__lista"></ul>';

    var soltar = zona.querySelector('.kit-adj__soltar');
    var input = zona.querySelector('.kit-adj__input');
    var ul = zona.querySelector('.kit-adj__lista');

    /* Se dice AQUÍ lo que admite la casilla. Antes había que intentarlo y
       fallar para enterarse. */
    var rotuloAdmite = zona.querySelector('.kit-adj__admite');
    if (rotuloAdmite) {
      var queAdmite = acepta ? loQueAdmite() : '';
      rotuloAdmite.textContent = queAdmite
        ? 'Admite ' + queAdmite + ' · arrástralo aquí o pégalo'
        : 'arrástralo aquí o pégalo';
    }

    function avisar() {
      if (typeof opciones.alCambiar === 'function') opciones.alCambiar(lista.slice());
    }

    function cabe(f) {
      if (lista.length >= tope) {
        K.aviso('Solo se pueden adjuntar ' + tope + (tope === 1 ? ' archivo.' : ' archivos.'), 'aviso');
        return false;
      }
      if (f.size > topeMB * 1048576) {
        K.aviso('"' + f.name + '" pesa ' + pesoLegible(f.size) + '. El tope es ' + topeMB + ' MB.', 'malo', 5000);
        return false;
      }
      if (acepta && !tipoVale(f)) {
        K.aviso('"' + f.name + '" no sirve aquí. ' +
                (opciones.etiqueta ? opciones.etiqueta + ' admite ' : 'Este campo admite ') +
                loQueAdmite() + '.', 'aviso', 5000);
        return false;
      }
      /* mismo nombre y mismo peso = el mismo archivo dos veces */
      var i;
      for (i = 0; i < lista.length; i++) {
        if (lista[i].name === f.name && lista[i].size === f.size) {
          K.aviso('"' + f.name + '" ya estaba adjunto.', 'aviso');
          return false;
        }
      }
      return true;
    }

    /*
     * 4.6 · POR QUÉ ESTO MIRA TAMBIÉN LA EXTENSIÓN
     *
     * Varios navegadores de Android entregan el archivo con `type` vacío.
     * Con la versión anterior, un PDF de verdad se rechazaba con "no es un
     * tipo de archivo admitido" y la persona se quedaba sin poder adjuntar
     * nada. Ahora, si el tipo no dice nada o no cuadra, se mira el nombre.
     */
    function reglas() {
      return acepta.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }

    /** Todas las extensiones que esta zona admite, las dichas y las deducidas. */
    function extensionesAdmitidas() {
      var out = [];
      reglas().forEach(function (r) {
        if (r.charAt(0) === '.') { out.push(r); return; }
        (EXTENSION_DE[r] || []).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); });
      });
      return out;
    }

    function tipoVale(f) {
      var rs = reglas();
      if (!rs.length) return true;
      var tipo = String(f.type || '').toLowerCase();
      var nombre = String(f.name || '').toLowerCase();
      var i, r;

      if (tipo) {
        for (i = 0; i < rs.length; i++) {
          r = rs[i];
          if (r.charAt(0) === '.') continue;
          if (r.slice(-2) === '/*') { if (tipo.indexOf(r.slice(0, -1)) === 0) return true; }
          else if (tipo === r) return true;
        }
      }

      /* por el nombre: la red de seguridad cuando el tipo viene vacío o raro */
      var exts = extensionesAdmitidas();
      for (i = 0; i < exts.length; i++) {
        if (nombre.slice(-exts[i].length) === exts[i]) return true;
      }
      return false;
    }

    /** "PDF" · "PDF o imagen (PNG, JPG)": lo que se le dice a la persona. */
    function loQueAdmite() {
      var exts = extensionesAdmitidas().map(function (e) { return e.slice(1).toUpperCase(); });
      var vistos = [], i;
      for (i = 0; i < exts.length; i++) if (vistos.indexOf(exts[i]) < 0) vistos.push(exts[i]);
      if (!vistos.length) return '';
      if (vistos.length === 1) return vistos[0];
      return vistos.slice(0, -1).join(', ') + ' o ' + vistos[vistos.length - 1];
    }

    function meter(archivos) {
      var i, f, entraron = 0;
      for (i = 0; i < archivos.length; i++) {
        f = archivos[i];
        if (!varios) lista = [];
        if (!cabe(f)) continue;
        lista.push(f);
        entraron++;
        if (!varios) break;
      }
      if (entraron) { K.sonar('sound/keyboard_enter.mp3'); K.vibrar(8); pintar(); avisar(); }
    }

    function quitar(i) {
      lista.splice(i, 1);
      pintar();
      avisar();
    }

    function pintar() {
      ul.innerHTML = '';
      lista.forEach(function (f, i) {
        var li = K.nodo(
          '<li class="kit-adj__item">' +
          '  <span class="kit-adj__ico">' + icono(f.type, f.name) + '</span>' +
          '  <span class="kit-adj__nom" title="' + K.esc(f.name) + '">' + K.esc(f.name) + '</span>' +
          '  <span class="kit-adj__peso">' + pesoLegible(f.size) + '</span>' +
          '  <button type="button" class="kit-adj__x" aria-label="Quitar ' + K.esc(f.name) + '">' + K.icono('cerrar', 16) + '</button>' +
          '</li>'
        );
        li.querySelector('.kit-adj__x').addEventListener('click', function () { quitar(i); });

        /* miniatura de verdad para las imágenes: evita adjuntar la captura
           equivocada, que es el error más común al radicar */
        if (String(f.type).indexOf('image/') === 0) {
          var url = URL.createObjectURL(f);
          var img = new Image();
          img.className = 'kit-adj__mini';
          img.alt = '';
          img.src = url;
          img.onload = function () { URL.revokeObjectURL(url); };
          li.replaceChild(img, li.querySelector('.kit-adj__ico'));
        }
        ul.appendChild(li);
      });
      zona.classList.toggle('kit-adj--con', lista.length > 0);
    }

    /* ── botón ── */
    soltar.addEventListener('click', function () { input.click(); });
    soltar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () {
      meter(input.files);
      input.value = '';           /* para poder volver a elegir el mismo */
    });

    /* ── arrastrar ── */
    ['dragenter', 'dragover'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zona.classList.add('kit-adj--encima');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        if (ev === 'dragleave' && zona.contains(e.relatedTarget)) return;
        zona.classList.remove('kit-adj--encima');
      });
    });
    zona.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) meter(e.dataTransfer.files);
    });

    /*
     * ── ESTA ZONA PASA A SER LA ACTIVA EN CUANTO EL PUNTERO SE POSA ──
     *
     * 4.6.1 · basta con PONERSE ENCIMA. Se quitó el botón "Pegar": leía el
     * portapapeles con navigator.clipboard.read(), que NO ve los archivos
     * copiados desde el explorador (ahí el portapapeles lleva una lista de
     * ficheros, no un blob de imagen). Por eso decía "no hay ninguna imagen
     * ni PDF" y, acto seguido, el Ctrl+V sí funcionaba: ese otro camino lee
     * clipboardData.items, que son los archivos de verdad. Un botón que
     * miente sobra.
     *
     * Con el puntero encima ya se ve cuál casilla se va a quedar el pegado,
     * y en el móvil el toque hace lo mismo. Sigue habiendo UNA sola zona
     * activa en toda la página, que es lo que arregló el Ctrl+V que se
     * repartía entre las veinte casillas.
     */
    function activar() {
      if (zonaActiva && zonaActiva !== zona) zonaActiva.classList.remove('kit-adj--activa');
      zonaActiva = zona;
      zona.classList.add('kit-adj--activa');
    }
    zona.addEventListener('pointerenter', activar);
    zona.addEventListener('pointerdown', activar);
    zona.addEventListener('focusin', activar);

    /* ── pegar: SOLO en la zona activa ── */
    function deLosItems(items) {
      var sacados = [], i, f;
      for (i = 0; i < items.length; i++) {
        if (items[i].kind !== 'file') continue;
        f = items[i].getAsFile();
        if (!f) continue;
        f = conNombre(f);
        sacados.push(f);
      }
      return sacados;
    }

    /* una captura llega sin nombre: se le pone uno con la fecha */
    function conNombre(f) {
      if (f.name && f.name !== 'image.png') return f;
      var ext = String(f.type || '').indexOf('image/jpeg') === 0 ? '.jpg' : '.png';
      try { return new File([f], 'captura-' + Date.now() + ext, { type: f.type }); }
      catch (e) { return f; }
    }

    var quitarPegar = K.on(document, 'paste', function (e) {
      if (!zona.offsetParent) return;                 /* no está a la vista */

      /* si están escribiendo en un campo de texto, el pegado es suyo */
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.type !== 'file' && !zona.contains(a)) return;

      if (zonaActiva !== zona) {
        /* la primera zona visible avisa una sola vez y ninguna se queda el
           archivo: mejor no pegar nada que pegarlo en la casilla equivocada */
        if (!zonaActiva && !document.__kitAdjAviso) {
          document.__kitAdjAviso = true;
          setTimeout(function () { document.__kitAdjAviso = false; }, 1500);
          K.aviso('Toca primero la casilla donde quieres pegarlo.', 'aviso', 4000);
        }
        return;
      }

      var sacados = deLosItems((e.clipboardData && e.clipboardData.items) || []);
      if (sacados.length) { e.preventDefault(); meter(sacados); }
    });

    function aBase64() {
      return Promise.all(lista.map(function (f) {
        return new Promise(function (res, rej) {
          var lector = new FileReader();
          lector.onload = function () {
            var s = String(lector.result || '');
            res({ nombre: f.name, tipo: f.type || 'application/octet-stream', datos: s.slice(s.indexOf(',') + 1) });
          };
          lector.onerror = function () { rej(K.problema('ARCHIVO', 'No se pudo leer "' + f.name + '".')); };
          lector.readAsDataURL(f);
        });
      }));
    }

    var api = {
      archivos: function () { return lista.slice(); },
      limpiar: function () { lista = []; pintar(); avisar(); },
      aBase64: aBase64,
      desmontar: function () { quitarPegar(); zona.innerHTML = ''; zona.classList.remove('kit-adj'); }
    };
    zona.__kitAdjuntos = api;
    return api;
  }

  K.piezas.adjuntos = { montar: montar, pesoLegible: pesoLegible };
}());
