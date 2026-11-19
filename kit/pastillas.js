/* ============================================================
   KIT-FLANDES · PIEZA 10 · PASTILLAS DE FILTRO
   Estado, secretaría, supervisor, adicionados.

   Por qué pastillas y no un desplegable
     Un <select> esconde cuántas cuentas hay en cada estado. La pastilla
     lleva el conteo encima, así que el revisor ve de un vistazo que tiene
     14 devueltas sin abrir nada. Y con el pulgar se cambia de filtro en
     un toque.

   Cómo se usa

     var f = KIT.piezas.pastillas.montar('#filtros', {
       opciones: [
         { valor: '',          texto: 'Todas' },
         { valor: 'REPORTADA', texto: 'Reportadas', tono: 'ok' },
         { valor: 'DEVUELTA',  texto: 'Devueltas',  tono: 'malo' }
       ],
       valor: '',
       alCambiar: function (valor, valores) { repintar(); }
     });

     f.conteos({ '': 120, REPORTADA: 40, DEVUELTA: 14 });   // números encima
     f.valor()          lo elegido
     f.poner('DEVUELTA')

   Varias a la vez
     Con {multiple:true} se pueden marcar varias; alCambiar recibe el array.
     La opción de valor '' se entiende como "todas" y apaga a las demás.

   El CSS vive en kit/base.css (las pastillas las usan muchas vistas).
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/pastillas] falta kit.js'); } catch (e) {} return; }

  function montar(destino, opciones) {
    opciones = opciones || {};
    var caja = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!caja) return null;

    var lista = (opciones.opciones || []).slice();
    var multiple = opciones.multiple === true;
    var elegidos = multiple
      ? (Array.isArray(opciones.valor) ? opciones.valor.slice() : (opciones.valor ? [opciones.valor] : []))
      : [opciones.valor === undefined ? (lista[0] ? lista[0].valor : '') : opciones.valor];
    var conteos = {};

    caja.classList.add('kit-pastillas');
    if (opciones.envuelve) caja.classList.add('kit-pastillas--envuelve');
    caja.setAttribute('role', 'group');
    if (opciones.etiqueta) caja.setAttribute('aria-label', opciones.etiqueta);

    function esta(v) { return elegidos.indexOf(v) >= 0; }

    function pintar() {
      caja.innerHTML = '';
      lista.forEach(function (op) {
        var n = conteos[op.valor];
        var b = K.nodo(
          '<button type="button" class="kit-pastilla' + (op.tono ? ' kit-pastilla--' + op.tono : '') + '"' +
          ' aria-pressed="' + (esta(op.valor) ? 'true' : 'false') + '"' +
          ' data-valor="' + K.esc(op.valor) + '">' +
          K.esc(op.texto) +
          (n === undefined ? '' : '<span class="kit-pastilla__conteo">' + K.numero(n) + '</span>') +
          '</button>'
        );
        b.addEventListener('click', function () { tocar(op.valor); });
        caja.appendChild(b);
      });
    }

    function tocar(v) {
      if (multiple) {
        if (v === '') elegidos = [];                       /* "todas" apaga el resto */
        else {
          var k = elegidos.indexOf(v);
          if (k >= 0) elegidos.splice(k, 1); else elegidos.push(v);
        }
      } else {
        if (elegidos[0] === v && opciones.sueltaAlRepetir) elegidos = [''];
        else elegidos = [v];
      }
      K.vibrar(6);
      pintar();
      avisar();
    }

    function avisar() {
      if (typeof opciones.alCambiar !== 'function') return;
      opciones.alCambiar(multiple ? elegidos.slice() : (elegidos[0] || ''), elegidos.slice());
    }

    /**
     * conteos({VALOR: n, ...}). Lo que no venga se queda sin número:
     * mejor sin número que con un cero que hace dudar de si está cargado.
     */
    function ponerConteos(mapa) {
      conteos = mapa || {};
      pintar();
    }

    /** Recalcula los conteos a partir de las filas, sin que la app cuente. */
    function contarSobre(filas, deQue) {
      var mapa = {}, i, v;
      mapa[''] = filas.length;
      for (i = 0; i < filas.length; i++) {
        v = typeof deQue === 'function' ? deQue(filas[i]) : filas[i][deQue];
        v = String(v === null || v === undefined ? '' : v);
        mapa[v] = (mapa[v] || 0) + 1;
      }
      ponerConteos(mapa);
      return mapa;
    }

    /** Construye las opciones a partir de los valores que traen las filas. */
    function opcionesDesde(filas, deQue, extra) {
      var vistos = {}, orden = [], i, v;
      for (i = 0; i < filas.length; i++) {
        v = typeof deQue === 'function' ? deQue(filas[i]) : filas[i][deQue];
        v = String(v === null || v === undefined ? '' : v).trim();
        if (!v || vistos[v]) continue;
        vistos[v] = 1;
        orden.push(v);
      }
      orden.sort(function (a, b) { return a.localeCompare(b, 'es'); });
      lista = [{ valor: '', texto: (extra && extra.textoTodas) || 'Todas' }].concat(
        orden.map(function (v) { return { valor: v, texto: v }; })
      );
      pintar();
      return lista.slice();
    }

    pintar();

    var api = {
      valor: function () { return multiple ? elegidos.slice() : (elegidos[0] || ''); },
      poner: function (v) {
        elegidos = multiple ? (Array.isArray(v) ? v.slice() : [v]) : [v];
        pintar(); avisar();
      },
      conteos: ponerConteos,
      contarSobre: contarSobre,
      opcionesDesde: opcionesDesde,
      opciones: function (nuevas) { lista = nuevas.slice(); pintar(); },
      /** ¿pasa esta fila el filtro? La app no tiene que repetir la lógica. */
      deja: function (valorDeLaFila) {
        var v = String(valorDeLaFila === null || valorDeLaFila === undefined ? '' : valorDeLaFila);
        if (multiple) return !elegidos.length || elegidos.indexOf(v) >= 0;
        return !elegidos[0] || elegidos[0] === v;
      },
      elemento: function () { return caja; }
    };
    caja.__kitPastillas = api;
    return api;
  }

  /* ══════════ 19/11 · ARRASTRAR CON EL MOUSE LAS FILAS QUE SE SALEN ══════════
     En el PC, una fila de pastillas (secretarías, supervisores…) que no cabe
     se desplaza con clic sostenido y arrastre, como con el dedo en el
     celular. Vale para TODA fila horizontal con desplazamiento (flex sin
     envolver), sea del kit o propia de la app: un solo escucha delegado en
     el documento, nada por fila. Si se arrastró, el clic que suelta no
     marca la pastilla. En el táctil no hace nada: el navegador ya desliza. */
  var UMBRAL = 6;
  function filaArrastrable(el) {
    for (var n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
      if (n.scrollWidth - n.clientWidth < 2) continue;
      var cs = getComputedStyle(n);
      if (!/(auto|scroll)/.test(cs.overflowX)) continue;
      if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection) || cs.flexWrap === 'wrap') continue;
      return n;
    }
    return null;
  }
  var A = null, comerClic = false;
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    var fila = filaArrastrable(ev.target);
    if (!fila) return;
    A = { fila: fila, x: ev.clientX, izq: fila.scrollLeft, mov: false, id: ev.pointerId };
  }, true);
  document.addEventListener('pointermove', function (ev) {
    if (!A || ev.pointerId !== A.id) return;
    var dx = ev.clientX - A.x;
    if (!A.mov) {
      if (Math.abs(dx) < UMBRAL) return;
      A.mov = true;
      A.fila.classList.add('kit-arrastrando');
      try { A.fila.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    A.fila.scrollLeft = A.izq - dx;
    ev.preventDefault();
  }, true);
  function soltar(ev) {
    if (!A || (ev && ev.pointerId !== A.id)) return;
    if (A.mov) {
      comerClic = true;
      setTimeout(function () { comerClic = false; }, 0);
      A.fila.classList.remove('kit-arrastrando');
      try { A.fila.releasePointerCapture(A.id); } catch (e) {}
    }
    A = null;
  }
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);
  document.addEventListener('click', function (ev) {
    if (!comerClic) return;
    comerClic = false;
    ev.preventDefault(); ev.stopPropagation();
  }, true);
  /* la mano abierta solo donde de verdad hay algo que arrastrar */
  document.addEventListener('mouseover', function (ev) {
    var fila = filaArrastrable(ev.target);
    if (fila && !fila.classList.contains('kit-arrastrable')) fila.classList.add('kit-arrastrable');
  }, { passive: true });
  /* que el arrastre no seleccione texto ni arrastre imágenes */
  document.addEventListener('dragstart', function (ev) { if (A) ev.preventDefault(); }, true);

  K.piezas.pastillas = { montar: montar, filaArrastrable: filaArrastrable };

  /* ══════════ 19/11 · CUENTA PRIORITARIA ══════════
     Las cuentas de OSCAR MAURICIO POLANIA GUERRA salen SIEMPRE como primera
     tarjeta (revisión y plan de pagos en Supervisión, revisión en
     Contratación, órdenes de pago en Contabilidad, egresos pendientes y
     emitidos en Tesorería), sin importar la fecha ni el orden del resto.
     Partición estable en el dispositivo: el resto conserva su orden y no
     hay viajes. Vive aquí porque las 7 apps ya cargan esta pieza. */
  var PRIORITARIOS = [['OSCAR', 'MAURICIO', 'POLANIA', 'GUERRA']];
  function normal(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function esPrioritario(c) {
    if (!c) return false;
    var n = normal(c.nombre || c.contratista || c.beneficiario || c.tercero || '');
    if (!n) return false;
    var pal = n.split(/[^A-Z]+/);
    return PRIORITARIOS.some(function (p) { return p.every(function (x) { return pal.indexOf(x) >= 0; }); });
  }
  function primero(filas) {
    if (!filas || filas.length < 2) return filas;
    var si = [], no = [];
    for (var i = 0; i < filas.length; i++) (esPrioritario(filas[i]) ? si : no).push(filas[i]);
    return si.length ? si.concat(no) : filas;
  }
  K.piezas.prioridad = { primero: primero, es: esPrioritario };
}());
