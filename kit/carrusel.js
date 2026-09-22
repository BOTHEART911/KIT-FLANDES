/* ============================================================
   KIT-FLANDES · PIEZA 8 · CARRUSEL DE IMÁGENES CON ZOOM
   Para las fotos de perfil, las firmas y las evidencias.

   Qué resuelve
     El visor (pieza 7) es para documentos: abre uno, con flechas. Este es
     para IMÁGENES que hay que mirar de cerca — una firma escaneada, la
     foto de una planilla, un comprobante — donde lo importante es el zoom
     y poder reemplazar la que está mal.

   Cómo se usa

     KIT.piezas.carrusel.abrir([
       { url: '...', titulo: 'Firma del supervisor' },
       { url: '...', titulo: 'Cédula' }
     ], {
       indice: 0,
       alReemplazar: function (indice, archivo) { ... }   // opcional
     });

   Gestos
     · rueda del ratón o pellizco: zoom
     · arrastrar con zoom: mover la imagen
     · doble toque: entra y sale del zoom
     · flechas ← →: cambiar de imagen

   Pareja: kit/carrusel.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/carrusel] falta kit.js'); } catch (e) {} return; }

  var MIN = 1, MAX = 6;

  var capa = null;
  var fotos = [];
  var i = 0;
  var z = 1, x = 0, y = 0;
  var opts = {};

  function crear() {
    capa = K.nodo(
      '<div class="kit-carr" role="dialog" aria-modal="true" aria-label="Imágenes">' +
      '  <div class="kit-carr__velo"></div>' +
      '  <header class="kit-carr__barra">' +
      '    <span class="kit-carr__t"></span>' +
      '    <span class="kit-carr__cuenta"></span>' +
      '    <div class="kit-carr__acciones">' +
      '      <button type="button" class="kit-carr__b" data-a="menos" title="Alejar">−</button>' +
      '      <span class="kit-carr__z">100%</span>' +
      '      <button type="button" class="kit-carr__b" data-a="mas" title="Acercar">+</button>' +
      '      <button type="button" class="kit-carr__b" data-a="reset" title="Tamaño original">⤢</button>' +
      '      <button type="button" class="kit-carr__b kit-carr__b--rep kit-oculto" data-a="reemplazar" title="Reemplazar">' + K.icono('recargar', 18) + '</button>' +
      '      <button type="button" class="kit-carr__b kit-carr__b--x" data-a="cerrar" title="Cerrar">' + K.icono('cerrar', 18) + '</button>' +
      '    </div>' +
      '  </header>' +
      '  <div class="kit-carr__escena">' +
      '    <button type="button" class="kit-carr__fl kit-carr__fl--izq" aria-label="Anterior">‹</button>' +
      '    <img class="kit-carr__img" alt="">' +
      '    <button type="button" class="kit-carr__fl kit-carr__fl--der" aria-label="Siguiente">›</button>' +
      '  </div>' +
      '  <footer class="kit-carr__tiras"></footer>' +
      '  <input type="file" class="kit-carr__file kit-oculto" accept="image/*">' +
      '</div>'
    );
    document.body.appendChild(capa);

    capa.querySelector('.kit-carr__velo').addEventListener('click', cerrar);
    capa.querySelectorAll('.kit-carr__b').forEach(function (b) {
      b.addEventListener('click', function () { accion(b.dataset.a); });
    });
    capa.querySelector('.kit-carr__fl--izq').addEventListener('click', function () { ir(i - 1); });
    capa.querySelector('.kit-carr__fl--der').addEventListener('click', function () { ir(i + 1); });
    capa.querySelector('.kit-carr__file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f && typeof opts.alReemplazar === 'function') opts.alReemplazar(i, f);
    });

    document.addEventListener('keydown', teclas);
    gestos();
  }

  function teclas(e) {
    if (!capa || !capa.classList.contains('kit-carr--on')) return;
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowRight') ir(i + 1);
    else if (e.key === 'ArrowLeft') ir(i - 1);
    else if (e.key === '+' || e.key === '=') zoom(z + 0.4);
    else if (e.key === '-') zoom(z - 0.4);
    else if (e.key === '0') reset();
  }

  function img() { return capa.querySelector('.kit-carr__img'); }

  function aplicar() {
    var el = img();
    el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')';
    el.classList.toggle('kit-carr__img--zoom', z > 1);
    capa.querySelector('.kit-carr__z').textContent = Math.round(z * 100) + '%';
  }

  function zoom(nuevo, cx, cy) {
    var antes = z;
    z = Math.min(MAX, Math.max(MIN, nuevo));
    if (z === MIN) { x = 0; y = 0; }
    else if (cx !== undefined) {
      /* que el zoom crezca hacia donde señala el dedo, no hacia el centro */
      var r = img().getBoundingClientRect();
      var px = cx - (r.left + r.width / 2);
      var py = cy - (r.top + r.height / 2);
      var f = z / antes;
      x = x - px * (f - 1);
      y = y - py * (f - 1);
    }
    aplicar();
  }
  function reset() { z = 1; x = 0; y = 0; aplicar(); }

  function gestos() {
    var escena = capa.querySelector('.kit-carr__escena');
    var el = img();

    escena.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom(z + (e.deltaY < 0 ? 0.28 : -0.28), e.clientX, e.clientY);
    }, { passive: false });

    /* arrastrar cuando hay zoom */
    var mov = false, x0 = 0, y0 = 0, ax = 0, ay = 0;
    el.addEventListener('pointerdown', function (e) {
      if (z <= 1) return;
      mov = true; x0 = e.clientX; y0 = e.clientY; ax = x; ay = y;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!mov) return;
      x = ax + (e.clientX - x0);
      y = ay + (e.clientY - y0);
      aplicar();
    });
    el.addEventListener('pointerup', function () { mov = false; });
    el.addEventListener('pointercancel', function () { mov = false; });

    /* doble toque */
    var ultimo = 0;
    el.addEventListener('click', function (e) {
      var ahora = Date.now();
      if (ahora - ultimo < 300) { zoom(z > 1 ? 1 : 2.5, e.clientX, e.clientY); K.vibrar(8); }
      ultimo = ahora;
    });

    /* pellizco */
    var toques = {}, dist0 = 0, z0 = 1;
    escena.addEventListener('pointerdown', function (e) {
      toques[e.pointerId] = e;
      var ids = Object.keys(toques);
      if (ids.length === 2) { dist0 = separacion(); z0 = z; }
    });
    escena.addEventListener('pointermove', function (e) {
      if (!toques[e.pointerId]) return;
      toques[e.pointerId] = e;
      var ids = Object.keys(toques);
      if (ids.length === 2 && dist0 > 0) {
        var d = separacion();
        var c = centro();
        zoom(z0 * (d / dist0), c.x, c.y);
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      escena.addEventListener(ev, function (e) { delete toques[e.pointerId]; dist0 = 0; });
    });
    function dos() { var k = Object.keys(toques); return [toques[k[0]], toques[k[1]]]; }
    function separacion() {
      var p = dos();
      if (!p[0] || !p[1]) return 0;
      return Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
    }
    function centro() {
      var p = dos();
      if (!p[0] || !p[1]) return { x: 0, y: 0 };
      return { x: (p[0].clientX + p[1].clientX) / 2, y: (p[0].clientY + p[1].clientY) / 2 };
    }
  }

  function accion(a) {
    if (a === 'cerrar') return cerrar();
    if (a === 'mas') return zoom(z + 0.4);
    if (a === 'menos') return zoom(z - 0.4);
    if (a === 'reset') return reset();
    if (a === 'reemplazar') capa.querySelector('.kit-carr__file').click();
  }

  function pintar() {
    var f = fotos[i];
    if (!f) return;
    reset();
    var el = img();
    el.src = f.url;
    el.alt = f.titulo || '';
    capa.querySelector('.kit-carr__t').textContent = f.titulo || 'Imagen';
    capa.querySelector('.kit-carr__cuenta').textContent = fotos.length > 1 ? (i + 1) + ' / ' + fotos.length : '';
    capa.querySelector('.kit-carr__fl--izq').disabled = (i <= 0);
    capa.querySelector('.kit-carr__fl--der').disabled = (i >= fotos.length - 1);
    capa.querySelector('.kit-carr__fl--izq').classList.toggle('kit-oculto', fotos.length < 2);
    capa.querySelector('.kit-carr__fl--der').classList.toggle('kit-oculto', fotos.length < 2);

    var tiras = capa.querySelector('.kit-carr__tiras');
    tiras.innerHTML = '';
    tiras.classList.toggle('kit-oculto', fotos.length < 2);
    fotos.forEach(function (ft, k) {
      var b = K.nodo('<button type="button" class="kit-carr__tira' + (k === i ? ' sel' : '') + '"></button>');
      var im = new Image();
      im.alt = '';
      im.loading = 'lazy';
      im.src = ft.url;
      b.appendChild(im);
      b.addEventListener('click', function () { ir(k); });
      tiras.appendChild(b);
    });
  }

  function ir(n) {
    if (n < 0 || n >= fotos.length) return;
    i = n;
    pintar();
    K.vibrar(6);
  }

  function abrir(lista, opciones) {
    opts = opciones || {};
    fotos = (Array.isArray(lista) ? lista : [lista]).filter(function (f) { return f && f.url; });
    if (!fotos.length) { K.aviso('No hay imágenes para mostrar.', 'aviso'); return; }
    i = Math.min(Math.max(opts.indice || 0, 0), fotos.length - 1);

    if (!capa) crear();
    capa.classList.add('kit-carr--on');
    capa.querySelector('.kit-carr__b--rep').classList.toggle('kit-oculto', typeof opts.alReemplazar !== 'function');
    pintar();
  }

  function cerrar() {
    if (!capa) return;
    capa.classList.remove('kit-carr--on');
    img().src = '';
    fotos = [];
    reset();
  }

  K.piezas.carrusel = {
    abrir: abrir, cerrar: cerrar, ir: ir, zoom: zoom, reset: reset,
    abierto: function () { return !!(capa && capa.classList.contains('kit-carr--on')); },
    nivel: function () { return z; }
  };
}());
