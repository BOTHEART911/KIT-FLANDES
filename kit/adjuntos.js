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
      '    <span>arrastra el archivo aquí, o pega con Ctrl+V</span>' +
      '  </div>' +
      '</div>' +
      '<input type="file" class="kit-adj__input kit-oculto"' +
      (acepta ? ' accept="' + K.esc(acepta) + '"' : '') +
      (varios ? ' multiple' : '') + '>' +
      '<ul class="kit-adj__lista"></ul>';

    var soltar = zona.querySelector('.kit-adj__soltar');
    var input = zona.querySelector('.kit-adj__input');
    var ul = zona.querySelector('.kit-adj__lista');

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
        K.aviso('"' + f.name + '" no es un tipo de archivo admitido aquí.', 'aviso', 4500);
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

    function tipoVale(f) {
      var reglas = acepta.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      if (!reglas.length) return true;
      var tipo = String(f.type || '').toLowerCase();
      var nombre = String(f.name || '').toLowerCase();
      var i, r;
      for (i = 0; i < reglas.length; i++) {
        r = reglas[i];
        if (r.charAt(0) === '.') { if (nombre.slice(-r.length) === r) return true; }
        else if (r.slice(-2) === '/*') { if (tipo.indexOf(r.slice(0, -1)) === 0) return true; }
        else if (tipo === r) return true;
      }
      /* algunos navegadores no rellenan .type: si la extensión cuadra, pasa */
      return false;
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

    /* ── pegar ── */
    var quitarPegar = K.on(document, 'paste', function (e) {
      /* solo si esta zona está a la vista y nadie está escribiendo */
      if (!zona.offsetParent) return;
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a !== soltar) {
        if (a.type !== 'file') return;
      }
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var sacados = [], i, f;
      for (i = 0; i < items.length; i++) {
        if (items[i].kind !== 'file') continue;
        f = items[i].getAsFile();
        if (!f) continue;
        /* una captura llega sin nombre: se le pone uno con la fecha */
        if (!f.name || f.name === 'image.png') {
          try {
            f = new File([f], 'captura-' + Date.now() + '.png', { type: f.type });
          } catch (e2) {}
        }
        sacados.push(f);
      }
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
