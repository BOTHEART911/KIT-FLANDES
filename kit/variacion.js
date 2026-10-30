/* ============================================================
   KIT-FLANDES · PIEZA 34 · VARIACIÓN DE ACTIVIDADES (30/10/2026)

   Qué hace
     Mide cuánto de una actividad ya estaba escrito en las cuentas
     anteriores de la MISMA obligación, con la MISMA regla del informe
     gerencial (kit/informe-cuentas.js): frases de 4 palabras, cifras
     normalizadas, el máximo frente a cualquier cuenta anterior, y las
     obligaciones generales no se miden. Lo que dice esta pieza y lo que
     dice el informe gerencial no pueden diferir: usa sus funciones.

   Quién la usa
     · CONTRATISTA (borrador): traer la actividad de la cuenta anterior,
       medidor en vivo, qué se repite y preguntas para variarla. No genera
       texto: no puede inventar actividades.
     · SUPERVISIÓN y CONTRATACIÓN (revisión): "Comparar con la cuenta
       anterior" por obligación, lado a lado.

   Rendimiento
     · Las actividades anteriores viajan por una ruta propia, de FONDO
       (cola, máximo 2 a la vez, se descarta al cambiar de vista) y se
       recuerdan por cuenta durante la sesión: la vista no espera nada.
     · Medir y marcar es local (milisegundos).
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  var CACHE = {};   /* clave -> promesa de las actividades anteriores */

  /** El medidor del informe gerencial (ya cargado o bajo demanda). */
  function ic() {
    var I = K.piezas.informeCuentas;
    if (I && I._palabras && I._tejas && I._esGeneral) return Promise.resolve(I);
    if (K.piezas.exportar && K.piezas.exportar.cargarInformeCuentas) {
      return K.piezas.exportar.cargarInformeCuentas().then(function (x) {
        if (!x || !x._palabras) throw new Error('El medidor no está al día.');
        return x;
      });
    }
    return Promise.reject(new Error('Falta el medidor del informe.'));
  }

  /** Las actividades anteriores, de fondo y una sola vez por cuenta. */
  function anteriores(accion, datos, clave) {
    if (CACHE[clave]) return CACHE[clave];
    var p = K.pedir(accion, datos, { fondo: true, ms: 60000 });
    CACHE[clave] = p;
    p['catch'](function () { if (CACHE[clave] === p) delete CACHE[clave]; });
    return p;
  }
  function olvidar(clave) { delete CACHE[clave]; }

  /** Los textos anteriores de UNA obligación: [{informe, texto}], del más viejo al más nuevo. */
  function previosDe(d, n) {
    if (!d || !d.obligaciones) return [];
    var k = d.obligaciones.indexOf(Number(n));
    if (k < 0) return [];
    return (d.cuentas || []).slice().sort(function (a, b) { return a.informe - b.informe; })
      .map(function (c) { return { informe: c.informe, texto: String((c.actividades || [])[k] || '').trim() }; })
      .filter(function (x) { return x.texto && x.texto !== '-'; });
  }

  var ETIQ = { cuant: 'Cuantifica', parcial: 'Cuantifica poco', desc: 'Solo describe', noreq: 'No requerida', sin: 'Sin actividad' };

  /**
   * La medida de un texto frente a sus anteriores (igual que analizar()):
   *   {general, clase, etiqueta, cifras, rep, repCon, ident, nivel}
   * nivel: 'ok' (<30 %), 'medio' (30–70 %), 'alto' (>70 %) o null si no se mide.
   */
  function medir(I, texto, previos, nContrato, oblTexto) {
    var txt = String(texto || '').trim();
    var r = I._redaccion(txt, nContrato);
    var out = { general: !!(oblTexto && I._esGeneral(oblTexto)), clase: r.clase, etiqueta: ETIQ[r.clase] || '', cifras: r.cifras,
                rep: null, repCon: null, ident: false, nivel: null };
    var mide = r.clase === 'cuant' || r.clase === 'parcial' || r.clase === 'desc';
    if (mide && previos.length) {
      previos.forEach(function (p) {
        var x = I._repetido(txt, p.texto);
        if (out.rep === null || x > out.rep) { out.rep = x; out.repCon = p.informe; }
        if (txt.replace(/\s+/g, ' ').toLowerCase() === p.texto.replace(/\s+/g, ' ').toLowerCase()) out.ident = true;
      });
      if (!out.general) out.nivel = out.rep > 70 ? 'alto' : (out.rep >= 30 ? 'medio' : 'ok');
    }
    return out;
  }

  /** El texto con <mark> en lo que ya estaba escrito antes (frases de 4 palabras). */
  function marcar(I, texto, previos) {
    var vistos = {};
    previos.forEach(function (p) { var t = I._tejas(I._palabras(p.texto), 4); for (var k in t) vistos[k] = 1; });
    var trozos = String(texto || '').split(/(\s+)/);
    var palabras = [], dueno = [];
    trozos.forEach(function (tr, i) {
      if (/^\s*$/.test(tr)) return;
      I._palabras(tr).forEach(function (w) { palabras.push(w); dueno.push(i); });
    });
    var marca = {};
    for (var j = 0; j + 4 <= palabras.length; j++) {
      if (vistos[palabras.slice(j, j + 4).join(' ')]) for (var q = j; q < j + 4; q++) marca[dueno[q]] = 1;
    }
    var html = '', abierto = false;
    trozos.forEach(function (tr, i) {
      var esp = /^\s*$/.test(tr);
      if (!esp && marca[i] && !abierto) { html += '<mark class="var-rep">'; abierto = true; }
      if (!esp && !marca[i] && abierto) { html += '</mark>'; abierto = false; }
      html += K.esc(tr).replace(/\n/g, '<br>');
    });
    if (abierto) html += '</mark>';
    return html;
  }

  /** La pastilla del resultado. */
  function pastilla(m) {
    if (m.general) return '<span class="var-pas var-pas--gen">Obligación general · no se mide</span>';
    if (m.rep === null) return '<span class="var-pas var-pas--gen">' + K.esc(m.etiqueta || 'Sin comparar') + '</span>';
    return '<span class="var-pas var-pas--' + m.nivel + '">' + m.rep + ' % repetido' +
      (m.ident ? ' · idéntica a la cuenta ' + m.repCon : (m.rep > 0 ? ' · de la cuenta ' + m.repCon : '')) + '</span>' +
      '<span class="var-pas var-pas--' + (m.clase === 'cuant' ? 'ok' : (m.clase === 'parcial' ? 'medio' : 'alto')) + '">' + K.esc(m.etiqueta) +
      (m.cifras ? ' · ' + m.cifras + (m.cifras === 1 ? ' cifra' : ' cifras') : '') + '</span>';
  }

  /** Consejos para variar, según lo que mide (sin generar texto). */
  function consejos(m) {
    var c = [];
    if (m.general) return ['Es una obligación general (horario, independencia, aportes…): es normal que se repita y no entra en la calificación.'];
    if (m.ident) c.push('Es igual a la de tu cuenta ' + m.repCon + '. Cuenta lo que hiciste en ESTE periodo.');
    else if (m.nivel === 'alto') c.push('Casi todo ya lo escribiste en la cuenta ' + m.repCon + '. Cambiar solo las cifras no basta: el informe las cuenta como iguales.');
    if (m.clase === 'desc') c.push('Agrega cifras de lo que hiciste: cuántos documentos, visitas, atenciones o procesos.');
    if (m.clase === 'parcial') c.push('Tiene una sola cifra: agrega otra (cuántos, a cuántas personas, en cuántos días).');
    return c;
  }
  var PREGUNTAS = [
    '¿Qué hiciste en ESTE periodo que no hiciste en el anterior?',
    '¿Cuántos? (documentos, visitas, atenciones, procesos, publicaciones)',
    '¿Para quién o con quién? (dependencia, comunidad, entidad)',
    '¿Qué quedó como resultado o entregable?',
    '¿Cuándo? (fechas o semanas del periodo)'
  ];

  /**
   * Panel de comparación para la REVISIÓN (Supervisión y Contratación).
   * o = {n, texto (obligación), actual (actividad de esta cuenta)}, d = respuesta de revisionAnterior.
   */
  function panelComparar(I, o, d, nContrato, informe) {
    var prev = previosDe(d, o.n);
    var caja = K.nodo('<div class="var-cmp" role="region" aria-label="Comparación con la cuenta anterior"></div>');
    if (!prev.length) {
      caja.appendChild(K.nodo('<p class="var-nada">' + (Number(informe) > 1 ? 'Las cuentas anteriores no tienen actividad escrita en esta obligación.' : 'Es la primera cuenta del contrato: no hay con qué comparar.') + '</p>'));
      return caja;
    }
    var ultima = prev[prev.length - 1];
    var m = medir(I, o.actual, prev, nContrato, o.texto);
    caja.appendChild(K.nodo('<div class="var-cmp__pas">' + pastilla(m) + '</div>'));
    var rej = K.nodo('<div class="var-cmp__rej"></div>');
    var a = K.nodo('<div class="var-cmp__col"><p class="var-cmp__t">Cuenta ' + ultima.informe + ' (anterior)</p><div class="var-cmp__txt"></div></div>');
    a.querySelector('.var-cmp__txt').innerHTML = K.esc(ultima.texto).replace(/\n/g, '<br>');
    var b = K.nodo('<div class="var-cmp__col var-cmp__col--act"><p class="var-cmp__t">Cuenta ' + K.esc(String(informe || '')) + ' (esta)</p><div class="var-cmp__txt"></div></div>');
    b.querySelector('.var-cmp__txt').innerHTML = String(o.actual || '').trim() ? marcar(I, o.actual, prev) : '<i>Sin actividades escritas.</i>';
    rej.appendChild(a); rej.appendChild(b);
    caja.appendChild(rej);
    caja.appendChild(K.nodo('<p class="var-cmp__ley"><mark class="var-rep">Resaltado</mark> = frases que ya estaban en alguna cuenta anterior (' +
      prev.length + (prev.length === 1 ? ' cuenta' : ' cuentas') + '). Misma medida del informe gerencial.</p>'));
    return caja;
  }

  K.piezas.variacion = {
    ic: ic, anteriores: anteriores, olvidar: olvidar, previosDe: previosDe,
    medir: medir, marcar: marcar, pastilla: pastilla, consejos: consejos, preguntas: PREGUNTAS,
    panelComparar: panelComparar
  };
}());
