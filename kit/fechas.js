/* ============================================================
   KIT-FLANDES · PIEZA 5 · RUEDA DE FECHAS ESTILO iOS
   Una sola rueda para todos los campos de fecha de las 7 apps.

   Por qué
     El calendario nativo del navegador se ve distinto en cada teléfono y
     en escritorio abre un diálogo enorme. La rueda es igual en todos y se
     maneja con el pulgar. Viene de SEP-GROUP, pasó por sec-hacienda y
     aquí queda desacoplada: ya no conoce ningún id de ninguna app.

   Dos maneras de usarla

     1) Declarativa — la normal. En el HTML:

        <input type="date" data-kit-fecha>                        día/mes/año
        <input type="date" data-kit-fecha data-desde="2010">       año mínimo
        <input type="text" data-kit-fecha data-anio-fijo="2026">   día y mes, año fijo
        <input type="text" data-kit-fecha data-solo-anio data-desde="1975">

        KIT.piezas.fechas.montar();   // una vez, tras pintar la vista

        El <input type="date"> pasa a texto (para que el navegador no abra
        su calendario) PERO su propiedad .value sigue devolviendo ISO
        (aaaa-mm-dd), que es lo que espera el backend. En pantalla se ve
        dd/mm/aaaa. `min`, `max` y el evento `change` siguen funcionando.

     2) A mano, cuando no hay input:

        KIT.piezas.fechas.abrir({
          titulo: 'Fecha del acta',
          anioDesde: 2020, anioHasta: 2026, descendente: true,
          valor: {y:2026, m:9, d:21},
          alElegir: function (f) { ... }     // f = {y, m, d}
        });

   Trampa heredada, documentada para que nadie la repita
     Las columnas de la rueda se posicionan con scrollTop. Si el contenedor
     está oculto, scrollTop vale 0 y la rueda se queda en el primer valor.
     Por eso se hace visible ANTES de posicionar, y al aceptar se lee todo
     ANTES de cerrar.

   Pareja: kit/fechas.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/fechas] falta kit.js'); } catch (e) {} return; }

  var ALTO = 42;      /* tiene que casar con --k-rueda-fila del CSS */
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  var capa = null;

  /* ── fechas ── */

  function pad(n) { return String(n).padStart(2, '0'); }
  function hoy() { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; }
  function diasDelMes(y, m) { return new Date(y, m, 0).getDate(); }
  function serie(y, m, d) { return y * 10000 + m * 100 + d; }

  function deISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function deTexto(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
    return m ? { y: +m[3], m: +m[2], d: +m[1] } : null;
  }
  function aISO(f) { return f.y + '-' + pad(f.m) + '-' + pad(f.d); }
  function aTexto(f) { return pad(f.d) + '/' + pad(f.m) + '/' + f.y; }

  /* ── una columna de la rueda ── */

  function elegido(col) { return Math.max(0, Math.round(col.scrollTop / ALTO)); }

  function marcar(col) {
    var i = elegido(col);
    var items = col.querySelectorAll('.kit-rueda__item'), k;
    for (k = 0; k < items.length; k++) items[k].classList.toggle('sel', +items[k].dataset.i === i);
  }

  /**
   * Monta una columna y la deja en `inicial`.
   *
   * Cuidado con la cascada: poner scrollTop dispara 'scroll', y si ese
   * scroll vuelve a llamar a alQuedar (año → meses → días), las columnas
   * se reconstruyen mientras el desplazamiento suave aún va por el aire y
   * el día elegido se lee mal. Por eso alQuedar solo corre cuando lo movió
   * una persona, nunca durante el montaje.
   */
  function construir(col, items, inicial, alQuedar) {
    col.innerHTML = '<div class="kit-rueda__hueco"></div>' +
      items.map(function (it, i) {
        return '<div class="kit-rueda__item" data-i="' + i + '">' + K.esc(it.txt) + '</div>';
      }).join('') +
      '<div class="kit-rueda__hueco"></div>';
    col.__items = items;
    col.onscroll = null;
    col.__montando = true;
    col.scrollTop = Math.max(0, inicial) * ALTO;
    marcar(col);

    var t = null;
    col.onscroll = function () {
      marcar(col);
      if (col.__montando) return;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        var i = elegido(col);
        col.scrollTo({ top: i * ALTO, behavior: 'smooth' });
        K.vibrar(4);
        if (alQuedar) alQuedar(i);
      }, 90);
    };

    /* dos cuadros después el navegador ya asentó el scroll: a partir de
       ahí, cualquier movimiento es del usuario */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { col.__montando = false; });
    });

    var filas = col.querySelectorAll('.kit-rueda__item'), k;
    for (k = 0; k < filas.length; k++) {
      filas[k].addEventListener('click', function () {
        col.scrollTop = (+this.dataset.i) * ALTO;   /* instantáneo: lectura fiable */
        marcar(col);
        if (alQuedar) alQuedar(+this.dataset.i);
      });
    }
  }

  function valorDe(col) {
    var items = (col && col.__items) || [];
    if (!items.length) return null;
    return items[Math.min(elegido(col), items.length - 1)].v;
  }

  /* ── cotas ── */

  function dentro(o, y, m, d) {
    var v = serie(y, m, d);
    if (o.min && v < serie(o.min.y, o.min.m, o.min.d)) return false;
    if (o.max && v > serie(o.max.y, o.max.m, o.max.d)) return false;
    return true;
  }
  function anios(o) {
    var out = [], y;
    for (y = o.anioDesde; y <= o.anioHasta; y++) out.push(y);
    if (o.descendente) out.reverse();
    return out.map(function (y) { return { v: y, txt: String(y) }; });
  }
  function meses(o, y) {
    var out = [], m, d, tot, vale;
    for (m = 1; m <= 12; m++) {
      vale = false; tot = diasDelMes(y, m);
      for (d = 1; d <= tot; d++) if (dentro(o, y, m, d)) { vale = true; break; }
      if (vale) out.push({ v: m, txt: MESES[m - 1] });
    }
    return out;
  }
  function dias(o, y, m) {
    var out = [], d, tot = diasDelMes(y, m);
    for (d = 1; d <= tot; d++) if (dentro(o, y, m, d)) out.push({ v: d, txt: pad(d) });
    return out;
  }
  function indiceDe(items, valor, pordefecto) {
    var i;
    for (i = 0; i < items.length; i++) if (items[i].v === valor) return i;
    return pordefecto || 0;
  }

  /* ── la hoja ── */

  function cerrar() {
    if (!capa) return;
    var c = capa; capa = null;
    c.classList.remove('kit-rueda--on');
    setTimeout(function () { if (c.parentNode) c.remove(); }, 170);
    document.removeEventListener('keydown', escape);
  }
  function escape(e) { if (e.key === 'Escape') cerrar(); }

  function abrir(o) {
    if (capa) return;
    /* Una rueda recién cerrada tarda 170 ms en irse del DOM (la animación
       de salida). Si se abre otra en ese hueco quedan dos en pantalla y
       las consultas por selector leen la columna equivocada. */
    K.$$('.kit-rueda').forEach(function (vieja) { vieja.remove(); });

    o = o || {};
    var h = hoy();
    var val = o.valor || null;

    if (o.anioFijo) { o.anioDesde = o.anioFijo; o.anioHasta = o.anioFijo; }
    if (!o.anioDesde) o.anioDesde = h.y;
    if (!o.anioHasta) o.anioHasta = h.y;
    if (o.anioHasta < o.anioDesde) o.anioHasta = o.anioDesde;

    var conAnio = !o.anioFijo;
    var y = (val && val.y >= o.anioDesde && val.y <= o.anioHasta) ? val.y
          : (o.anioFijo || (h.y >= o.anioDesde && h.y <= o.anioHasta ? h.y : o.anioHasta));
    var m = val ? val.m : h.m;
    var d = val ? val.d : h.d;

    var colHTML = function (nombre) {
      return '<div class="kit-rueda__colcaja">' +
             '  <button type="button" class="kit-rueda__fl" data-col="' + nombre + '" data-p="-1" aria-label="Subir">▲</button>' +
             '  <div class="kit-rueda__col" data-col="' + nombre + '"></div>' +
             '  <button type="button" class="kit-rueda__fl" data-col="' + nombre + '" data-p="1" aria-label="Bajar">▼</button>' +
             '</div>';
    };

    capa = K.nodo(
      '<div class="kit-rueda" role="dialog" aria-modal="true" aria-label="Seleccionar fecha">' +
      '  <div class="kit-rueda__velo"></div>' +
      '  <section class="kit-rueda__hoja">' +
      '    <header class="kit-rueda__h">' +
      '      <span class="kit-rueda__t">' + K.esc(o.titulo || 'Fecha') + '</span>' +
      (o.anioFijo ? '<span class="kit-rueda__anio">' + K.esc(o.anioFijo) + '</span>' : '') +
      '    </header>' +
      '    <div class="kit-rueda__ruedas">' +
      '      <div class="kit-rueda__marca"></div>' +
      (o.soloAnio ? '' : colHTML('dia') + colHTML('mes')) +
      (conAnio ? colHTML('anio') : '') +
      '    </div>' +
      '    <footer class="kit-rueda__pie">' +
      '      <button type="button" class="kit-btn kit-rueda__cancelar">Cancelar</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-rueda__ok">Listo</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );

    document.body.appendChild(capa);
    /* visible ANTES de posicionar: si no, scrollTop no agarra */
    requestAnimationFrame(function () { if (capa) capa.classList.add('kit-rueda--on'); });

    var colAnio = capa.querySelector('.kit-rueda__col[data-col="anio"]');
    var colMes  = capa.querySelector('.kit-rueda__col[data-col="mes"]');
    var colDia  = capa.querySelector('.kit-rueda__col[data-col="dia"]');

    function rehacerDias() {
      if (!colDia) return;
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var mm = colMes ? valorDe(colMes) : m;
      var actual = valorDe(colDia);
      var items = dias(o, yy, mm);
      if (!items.length) items = [{ v: 1, txt: '01' }];
      construir(colDia, items, indiceDe(items, actual, 0));
    }
    function rehacerMeses() {
      if (!colMes) return;
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var actual = valorDe(colMes);
      var items = meses(o, yy);
      if (!items.length) items = [{ v: 1, txt: MESES[0] }];
      construir(colMes, items, indiceDe(items, actual, 0), rehacerDias);
      rehacerDias();
    }

    if (colAnio) {
      var iA = anios(o);
      construir(colAnio, iA, indiceDe(iA, y, 0), rehacerMeses);
    }
    if (colMes) {
      var iM = meses(o, y);
      construir(colMes, iM, indiceDe(iM, m, 0), rehacerDias);
    }
    if (colDia) {
      var iD = dias(o, y, m);
      construir(colDia, iD, indiceDe(iD, d, 0));
    }

    capa.querySelector('.kit-rueda__velo').addEventListener('click', cerrar);
    capa.querySelector('.kit-rueda__cancelar').addEventListener('click', cerrar);
    document.addEventListener('keydown', escape);

    var flechas = capa.querySelectorAll('.kit-rueda__fl'), k;
    for (k = 0; k < flechas.length; k++) {
      flechas[k].addEventListener('click', function () {
        var col = capa.querySelector('.kit-rueda__col[data-col="' + this.dataset.col + '"]');
        if (!col) return;
        var n = (col.__items || []).length;
        var i = Math.min(Math.max(elegido(col) + (+this.dataset.p), 0), n - 1);
        col.scrollTop = i * ALTO;
        marcar(col);
        K.vibrar(4);
        if (this.dataset.col === 'anio') rehacerMeses();
        if (this.dataset.col === 'mes') rehacerDias();
      });
    }

    capa.querySelector('.kit-rueda__ok').addEventListener('click', function () {
      /* leer TODO antes de cerrar */
      var yy = colAnio ? valorDe(colAnio) : (o.anioFijo || y);
      var mm = colMes ? valorDe(colMes) : 1;
      var dd = colDia ? valorDe(colDia) : 1;
      var fn = o.alElegir;
      cerrar();
      if (fn) fn({ y: yy, m: mm, d: dd });
    });
  }

  /* ══════════════ MODO DECLARATIVO ══════════════ */

  function leerOpciones(inp) {
    var o = {};
    var ds = inp.dataset;
    var h = hoy();

    o.titulo = ds.titulo || inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || 'Selecciona la fecha';
    o.soloAnio = ds.soloAnio !== undefined;
    if (ds.anioFijo) o.anioFijo = +ds.anioFijo;
    o.anioDesde = ds.desde ? +ds.desde : (o.anioFijo || h.y - 5);
    o.anioHasta = ds.hasta ? +ds.hasta : (o.anioFijo || h.y + 1);
    o.descendente = ds.descendente !== undefined || (!ds.descendente && o.anioHasta - o.anioDesde > 12);

    /* min/max del propio input mandan sobre lo anterior */
    var mn = deISO(inp.getAttribute('min'));
    var mx = deISO(inp.getAttribute('max'));
    if (mn) { o.min = mn; if (mn.y > o.anioDesde) o.anioDesde = mn.y; }
    if (mx) { o.max = mx; if (mx.y < o.anioHasta) o.anioHasta = mx.y; }
    if (o.anioHasta < o.anioDesde) o.anioHasta = o.anioDesde;
    return o;
  }

  /**
   * Convierte un <input type="date"> en campo de rueda sin que el resto
   * del código note el cambio: .value sigue siendo ISO.
   */
  function preparar(inp) {
    if (inp.__kitFecha) return;
    inp.__kitFecha = true;

    var eraFecha = (inp.getAttribute('type') || '').toLowerCase() === 'date';
    var guardado = eraFecha ? (inp.value || '') : (deTexto(inp.value) ? aISO(deTexto(inp.value)) : '');

    if (eraFecha) {
      inp.setAttribute('type', 'text');
      inp.setAttribute('inputmode', 'none');
    }
    inp.setAttribute('readonly', 'readonly');
    inp.classList.add('kit-campo-fecha');

    /* El setter NATIVO se guarda ANTES de redefinir la propiedad: es el
       único que escribe lo que se ve en pantalla. Sin esto, el campo se
       queda en blanco aunque tenga fecha. */
    var nativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    function pintar(iso) {
      var f = deISO(iso);
      var txt = f ? aTexto(f) : '';
      if (nativo && nativo.set) nativo.set.call(inp, txt);
      else inp.setAttribute('value', txt);
    }

    /* .value habla ISO hacia fuera (backend) y dd/mm/aaaa hacia dentro (pantalla) */
    var propio = { iso: guardado };
    try {
      Object.defineProperty(inp, 'value', {
        configurable: true,
        get: function () { return propio.iso; },
        set: function (v) {
          var f = deISO(v) || deTexto(v);
          propio.iso = f ? aISO(f) : '';
          pintar(propio.iso);
        }
      });
    } catch (e) { /* navegador viejo: se queda con el texto y ya */ }

    pintar(propio.iso);

    function abrirla() {
      if (inp.disabled) return;
      var o = leerOpciones(inp);
      o.valor = deISO(propio.iso) || null;
      o.alElegir = function (f) {
        propio.iso = aISO(f);
        pintar(propio.iso);
        try { inp.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      };
      abrir(o);
    }

    inp.addEventListener('click', abrirla);
    inp.addEventListener('focus', function () { inp.blur(); abrirla(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirla(); }
    });
  }

  /** montar() o montar('#miFormulario'): prepara los campos que falten. */
  function montar(ambito) {
    var raiz = ambito ? (typeof ambito === 'string' ? K.$(ambito) : ambito) : document;
    if (!raiz) return 0;
    var campos = K.$$('[data-kit-fecha]', raiz), i, n = 0;
    for (i = 0; i < campos.length; i++) {
      if (!campos[i].__kitFecha) { preparar(campos[i]); n++; }
    }
    return n;
  }

  K.piezas.fechas = {
    abrir: abrir, cerrar: cerrar, montar: montar, preparar: preparar,
    aISO: aISO, aTexto: aTexto, deISO: deISO, deTexto: deTexto, meses: MESES
  };
}());
