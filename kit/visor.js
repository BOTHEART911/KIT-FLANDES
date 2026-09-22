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

   Lo que hace de verdad, no de adorno
     · Abrir en pestaña, descargar e imprimir funcionan sobre el documento
       que se está viendo, no sobre el primero.
     · Los enlaces de Drive se convierten a /preview, que es el único que
       se deja incrustar. Un /view dentro de un iframe sale en blanco.

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
      '    <div class="kit-visor__lienzo"></div>' +
      '    <footer class="kit-visor__pie">' +
      '      <button type="button" class="kit-btn kit-visor__nav" data-p="-1">‹ Anterior</button>' +
      '      <span class="kit-visor__puntos"></span>' +
      '      <button type="button" class="kit-btn kit-visor__nav" data-p="1">Siguiente ›</button>' +
      '    </footer>' +
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
    document.addEventListener('keydown', teclas);
    arrastrable(capa.querySelector('.kit-visor__caja'), capa.querySelector('.kit-visor__barra'));
  }

  function teclas(e) {
    if (!capa) return;
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowRight') ir(i + 1);
    else if (e.key === 'ArrowLeft') ir(i - 1);
  }

  /** Mover la ventana por la barra, con dedo o con ratón. */
  function arrastrable(caja, asa) {
    var moviendo = false, x0 = 0, y0 = 0, dx = 0, dy = 0, ax = 0, ay = 0;

    function baja(e) {
      if (e.target.closest('.kit-visor__b')) return;   /* los botones no arrastran */
      moviendo = true;
      var p = punto(e);
      x0 = p.x; y0 = p.y; ax = dx; ay = dy;
      caja.classList.add('kit-visor__caja--movida');
      document.addEventListener('pointermove', mueve);
      document.addEventListener('pointerup', sube, { once: true });
    }
    function mueve(e) {
      if (!moviendo) return;
      var p = punto(e);
      dx = ax + (p.x - x0);
      dy = ay + (p.y - y0);
      /* no dejar que se escape de la pantalla */
      var r = caja.getBoundingClientRect();
      var margen = 60;
      if (r.left < -r.width + margen && p.x < x0) dx = ax;
      if (r.top < 0 && p.y < y0) dy = ay;
      if (r.top > window.innerHeight - margen && p.y > y0) dy = ay;
      caja.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    function sube() {
      moviendo = false;
      document.removeEventListener('pointermove', mueve);
    }
    function punto(e) { return { x: e.clientX, y: e.clientY }; }

    asa.addEventListener('pointerdown', baja);
    /* al cerrar se olvida dónde estaba: la próxima abre centrada */
    capa.__resetPos = function () { dx = dy = ax = ay = 0; caja.style.transform = ''; caja.classList.remove('kit-visor__caja--movida'); };
  }

  function actual() { return docs[i] || null; }

  function accion(a) {
    var d = actual();
    if (!d && a !== 'cerrar' && a !== 'encoger') return;
    if (a === 'cerrar') return cerrar();
    if (a === 'encoger') {
      capa.classList.toggle('kit-visor--chico');
      var b = capa.querySelector('[data-a="encoger"]');
      var chico = capa.classList.contains('kit-visor--chico');
      b.textContent = chico ? '▢' : '–';
      b.title = chico ? 'Volver al tamaño normal' : 'Minimizar';
      return;
    }
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

  function pintar() {
    var d = actual();
    var lienzo = capa.querySelector('.kit-visor__lienzo');
    capa.querySelector('.kit-visor__t').textContent = d ? (d.titulo || 'Documento') : '';
    capa.querySelector('.kit-visor__cuenta').textContent = docs.length > 1 ? (i + 1) + ' de ' + docs.length : '';

    lienzo.innerHTML = '<div class="kit-visor__cargando">Abriendo el documento…</div>';
    if (!d) return;

    var marco;
    if (tipoDe(d) === 'imagen') {
      marco = new Image();
      marco.className = 'kit-visor__img';
      marco.alt = d.titulo || '';
      marco.src = d.url;
    } else {
      marco = document.createElement('iframe');
      marco.className = 'kit-visor__marco';
      marco.setAttribute('allow', 'autoplay');
      marco.setAttribute('referrerpolicy', 'no-referrer');
      marco.src = paraVer(d.url);
    }
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
    docs = (Array.isArray(lista) ? lista : [lista]).filter(function (d) { return d && d.url; });
    if (!docs.length) { K.aviso('No hay documentos para mostrar.', 'aviso'); return; }
    i = Math.min(Math.max(opciones.indice || 0, 0), docs.length - 1);

    if (!capa) crear();
    if (capa.__resetPos) capa.__resetPos();
    capa.classList.remove('kit-visor--chico');
    capa.classList.add('kit-visor--on');
    pintar();
  }

  function cerrar() {
    if (!capa) return;
    capa.classList.remove('kit-visor--on');
    capa.querySelector('.kit-visor__lienzo').innerHTML = '';   /* suelta el iframe */
    docs = [];
    i = 0;
  }

  K.piezas.visor = {
    abrir: abrir, cerrar: cerrar, ir: ir,
    abierto: function () { return !!(capa && capa.classList.contains('kit-visor--on')); },
    idDrive: idDrive, paraVer: paraVer, paraAbrir: paraAbrir, paraBajar: paraBajar
  };
}());
