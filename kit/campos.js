/* ============================================================
   KIT-FLANDES · CAMPOS DEL CONTRATO Y DE LA ADICIÓN (25/11/2026)

   Los mismos campos, con el mismo comportamiento, que AGREGAR
   CONTRATISTA y ADICIÓN de Contratación y ADMIN (js/gestion.js):
     · N° de contrato y de proceso: solo dígitos (3).
     · Fechas con la rueda del kit y el año de la vigencia fijo.
     · Valor: se escribe en números, se ve con puntos y, debajo, en letras.
     · CDP: el año lo pone la app; se escribe el final (526 → 2026000526).
     · Pagos: de 1 a 24.
   Lo usa CONTRATISTA en sus solicitudes a Contratación (nuevo contrato
   y adición). Necesita kit.js, iconos.js y fechas.js.

   K.piezas.campos.contrato(caja, D, o)  → { falta(): [], datos(): {} }
       o: { opc: {tipos, secretarias, vigencia}, conSecretaria, secretaria }
   K.piezas.campos.adicion(caja, D, o)   → { falta(): [], datos(): {} }
       o: { ctx: {vigencia, valorInicial, adicion1, adicion2, siguiente,
                  fechaInicio, primario, informes} }
   K.piezas.campos.aviso(caja, o)        el aviso «¿No tienes tu clausulado?»
       o: { texto, tutorial: 4, secop: url }
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  function ayuda(c, texto) { if (texto) c.appendChild(K.nodo('<small class="campo__ayuda">' + texto + '</small>')); }
  function oblig() { return ' <i class="tr-oblig" aria-hidden="true">*</i>'; }

  function texto(donde, D, clave, titulo, txt, o) {
    o = o || {};
    var c = K.nodo('<label class="campo"><span>' + K.esc(titulo) + oblig() + '</span></label>');
    var inp = K.nodo('<input type="text" autocomplete="off"' + (o.numerico ? ' inputmode="numeric"' : '') + '>');
    if (o.marcador) inp.placeholder = o.marcador;
    inp.value = D[clave] || '';
    c.appendChild(inp);
    ayuda(c, txt);
    inp.addEventListener('input', function () {
      if (o.numerico) inp.value = inp.value.replace(/\D/g, '').slice(0, o.numerico);
      D[clave] = inp.value.trim();
      if (o.alCambiar) o.alCambiar(D[clave]);
    });
    donde.appendChild(c);
    return inp;
  }

  function lista(donde, D, clave, titulo, txt, opciones, o) {
    o = o || {};
    var c = K.nodo('<label class="campo"><span>' + K.esc(titulo) + oblig() + '</span></label>');
    var sel = K.nodo('<select><option value="">Selecciona</option></select>');
    opciones.forEach(function (op) {
      var x = document.createElement('option');
      x.value = op.valor; x.textContent = op.texto;
      if (K.norm(op.valor) === K.norm(D[clave] || '')) { x.selected = true; D[clave] = op.valor; }
      sel.appendChild(x);
    });
    c.appendChild(sel);
    ayuda(c, txt);
    sel.addEventListener('change', function () { D[clave] = sel.value; if (o.alCambiar) o.alCambiar(sel.value); });
    donde.appendChild(c);
    return sel;
  }

  function fecha(donde, D, clave, titulo, txt, o) {
    o = o || {};
    var c = K.nodo('<label class="campo"><span>' + K.esc(titulo) + oblig() + '</span></label>');
    var inp = K.nodo('<input type="text" readonly data-kit-fecha placeholder="dd/mm/aaaa" data-titulo="' + K.esc(titulo) + '"' +
      (o.anioFijo ? ' data-anio-fijo="' + o.anioFijo + '"' : '') + '>');
    inp.value = D[clave] || '';
    c.appendChild(inp);
    ayuda(c, txt);
    inp.addEventListener('change', function () {
      D[clave] = K.fecha(inp.value.trim());   /* la rueda deja ISO; se guarda dd/mm/aaaa */
      if (o.alCambiar) o.alCambiar(D[clave]);
    });
    donde.appendChild(c);
    return inp;
  }

  /* ---- valor en letras: la MISMA función de js/gestion.js (Contratación y ADMIN) ---- */
  function letras(numero) {
    var U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    var D = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    var Cc = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
              'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    var E = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    function dec(n) {
      if (n < 10) return U[n];
      if (n < 20) return E[n - 10];
      if (n === 20) return 'VEINTE';
      if (n < 30) return 'VEINTI' + U[n % 10];
      return D[Math.floor(n / 10)] + (n % 10 ? ' Y ' + U[n % 10] : '');
    }
    function cen(n) {
      if (n === 100) return 'CIEN';
      if (n > 100) return (Cc[Math.floor(n / 100)] + ' ' + dec(n % 100)).trim();
      return dec(n);
    }
    function mil(n) {
      if (n < 1000) return cen(n);
      if (n < 1000000) {
        var m = Math.floor(n / 1000), r = n % 1000;
        return ((m === 1 ? 'MIL' : cen(m) + ' MIL') + (r ? ' ' + cen(r) : '')).trim();
      }
      var mi = Math.floor(n / 1000000), re = n % 1000000;
      return ((mi === 1 ? 'UN MILLON' : cen(mi) + ' MILLONES') + ' ' + (re ? mil(re) : 'DE')).trim();
    }
    var n = Math.round(Number(numero) || 0);
    return n ? (mil(n) + ' PESOS M/CTE').replace(/\s+/g, ' ') : '';
  }

  function pesos(donde, D, clave, titulo, txt, o) {
    o = o || {};
    var c = K.nodo('<label class="campo"><span>' + K.esc(titulo) + oblig() + '</span></label>');
    var caja = K.nodo('<div class="kc-pesos"><span class="kc-pesos__signo" aria-hidden="true">$</span></div>');
    var inp = K.nodo('<input type="tel" inputmode="numeric" class="kc-pesos__inp" autocomplete="off" placeholder="0">');
    if (D[clave]) inp.value = K.numero(D[clave]);
    caja.appendChild(inp);
    c.appendChild(caja);
    var eco = K.nodo('<p class="kc-letras" aria-live="polite"></p>');
    c.appendChild(eco);
    ayuda(c, txt);
    function pintar() {
      var n = K.aNumero(D[clave]);
      eco.textContent = n ? letras(n) : '';
      if (o.alCambiar) o.alCambiar(n);
    }
    K.pesosEnVivo(inp, function (limpio) { D[clave] = limpio; pintar(); });
    pintar();
    donde.appendChild(c);
    return inp;
  }

  /** CDP: 10 dígitos que empiezan por el año. El año lo pone la app. */
  function codigo(donde, D, clave, titulo, txt, anio) {
    anio = String(anio);
    var c = K.nodo('<label class="campo kc-cdp"><span>' + K.esc(titulo) + oblig() + '</span></label>');
    var caja = K.nodo('<div class="kc-cdp__caja"></div>');
    var pre = K.nodo('<span class="kc-cdp__anio" aria-hidden="true">' + K.esc(anio) + '</span>');
    var inp = K.nodo('<input type="text" inputmode="numeric" class="kc-cdp__final" autocomplete="off" maxlength="10" placeholder="Ej: 526" aria-label="' + K.esc(titulo) + ' (el final; el año ' + K.esc(anio) + ' va solo)">');
    var previo = String(D[clave] || '');
    inp.value = previo.length === 10 ? previo.slice(4).replace(/^0+/, '') : previo;
    caja.appendChild(pre); caja.appendChild(inp);
    c.appendChild(caja);
    var eco = K.nodo('<p class="kc-cdp__eco" aria-live="polite"></p>');
    c.appendChild(eco);
    ayuda(c, txt);
    function repintar() {
      var d = inp.value.replace(/\D/g, '').slice(0, 10);
      inp.value = d;
      var full = !d ? '' : (d.length > 6 ? d : anio + ('000000' + d).slice(-6));
      D[clave] = full;
      var ok = full.length === 10 && full.indexOf(anio) === 0;
      c.classList.toggle('kc-ok', ok);
      eco.textContent = full ? (ok ? 'Va a quedar como ' + full : (full.length !== 10 ? 'Un CDP completo tiene 10 dígitos' : full + ' no empieza por ' + anio)) : '';
    }
    inp.addEventListener('input', repintar);
    pre.addEventListener('click', function () { inp.focus(); });
    repintar();
    donde.appendChild(c);
    return inp;
  }

  function fila() { return K.nodo('<div class="campo-fila"></div>'); }
  function nombrePropio(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s,])([a-záéíóúñü])/g, function (t, a, l) { return a + l.toUpperCase(); })
      .replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (m) { return m.toLowerCase(); });
  }
  function fechaDe(t) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t || '').trim());
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  }
  function pagosOk(v) { var n = K.aNumero(v); return n >= 1 && n <= 24; }
  function cdpOk(v, anio) { return new RegExp('^' + anio + '\\d{6}$').test(String(v || '')); }

  /* ════════════ CONTRATO NUEVO ════════════ */
  function contrato(caja, D, o) {
    o = o || {};
    var opc = o.opc || {};
    var anio = opc.vigencia || new Date().getFullYear();
    if (o.conSecretaria) {
      if (!D.secretaria && o.secretaria) D.secretaria = o.secretaria;
      lista(caja, D, 'secretaria', 'Secretaría del contrato nuevo', 'La de tu contrato nuevo. Puede ser otra distinta a la del contrato que terminó.',
        (opc.secretarias || []).map(function (s) { return { valor: s, texto: nombrePropio(s) }; }));
    }
    var f1 = fila();
    texto(f1, D, 'contrato', 'N° de contrato', 'Tres dígitos, como sale en el clausulado.', { numerico: 3, marcador: 'Ej: 027' });
    fecha(f1, D, 'fechaContrato', 'Fecha del contrato', '', { anioFijo: anio });
    caja.appendChild(f1);
    texto(caja, D, 'proceso', 'N° de proceso SECOP II', 'Está en tu clausulado: el número del medio en CPS-(aquí)-' + anio + '. Ejemplo: 021.', { numerico: 3, marcador: 'Ej: 021' });
    lista(caja, D, 'tipo', 'Tipo de contrato', '',
      (opc.tipos || []).map(function (t) { return { valor: t, texto: t.charAt(0) + t.slice(1).toLowerCase() }; }));
    pesos(caja, D, 'valor', 'Valor del contrato', 'El valor en letras se escribe solo.');
    var f2 = fila();
    texto(f2, D, 'pagos', 'Cantidad de pagos (informes)', 'Revisa tu clausulado, cláusula 6: Forma de pago. De 1 a 24.', { numerico: 2, marcador: 'Ej: 10', valido: pagosOk });
    caja.appendChild(f2);
    codigo(f2, D, 'cdp', 'CDP', 'Revisa tu clausulado, cláusula 7: Imputación presupuestal. Escribe el final; el año lo pone la app.', anio);
    if (K.piezas.fechas) K.piezas.fechas.montar(caja);
    return {
      falta: function () {
        var f = [];
        if (o.conSecretaria && !D.secretaria) f.push('la secretaría');
        var nc = String(D.contrato || '').replace(/\D/g, '');
        if (!nc || Number(nc) < 1) f.push('el N° de contrato');
        if (!D.fechaContrato) f.push('la fecha del contrato');
        var np = String(D.proceso || '').replace(/\D/g, '').replace(/^0+/, '');
        if (!np || np.length > 3) f.push('el N° de proceso SECOP II');
        if (!D.tipo) f.push('el tipo de contrato');
        var v = K.aNumero(D.valor);
        if (!v || v < 100000) f.push('el valor del contrato');
        if (!pagosOk(D.pagos)) f.push('la cantidad de pagos (de 1 a 24)');
        if (!cdpOk(D.cdp, anio)) f.push('el CDP');
        return f;
      },
      datos: function () {
        var x = { contrato: ('00' + String(D.contrato || '').replace(/\D/g, '')).slice(-3), fechaContrato: D.fechaContrato,
                  proceso: ('00' + String(D.proceso || '').replace(/\D/g, '').replace(/^0+/, '')).slice(-3), tipo: D.tipo,
                  valor: String(K.aNumero(D.valor)), pagos: String(K.aNumero(D.pagos)), cdp: D.cdp };
        if (o.conSecretaria) x.secretaria = D.secretaria;
        return x;
      },
      resumen: function () {
        return [o.conSecretaria ? ['Secretaría', nombrePropio(D.secretaria)] : null,
          ['Contrato', ('00' + String(D.contrato || '')).slice(-3) + ' · ' + (D.fechaContrato || '')],
          ['N° de proceso', 'CPS-' + ('00' + String(D.proceso || '').replace(/^0+/, '')).slice(-3) + '-' + anio],
          ['Tipo', D.tipo], ['Valor', K.pesos(D.valor)], ['Pagos', String(K.aNumero(D.pagos))], ['CDP', D.cdp]].filter(Boolean);
      }
    };
  }

  /* ════════════ ADICIÓN ════════════ */
  function plazoEntre(a, b) {
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    var d = b.getDate() - a.getDate() + 1;
    if (d < 0) { m--; d += 30; }
    if (d >= 30) { m++; d -= 30; }
    return { meses: Math.max(0, m), dias: Math.max(0, d) };
  }
  function tiempo(m, d) {
    var p = [];
    if (m) p.push(m + (m === 1 ? ' mes' : ' meses'));
    if (d) p.push(d + (d === 1 ? ' día' : ' días'));
    return p.join(' y ') || '0 días';
  }

  function adicion(caja, D, o) {
    o = o || {};
    var c = o.ctx || {};
    var anio = c.vigencia || new Date().getFullYear();
    var cual = c.siguiente === 2 ? 2 : 1;
    var otra = cual === 2 ? (c.adicion1 || 0) : 0;
    var f1 = fila();
    fecha(f1, D, 'inicio', 'Inicio de la adición', '', { anioFijo: anio, alCambiar: calc });
    fecha(f1, D, 'fin', 'Fin de la adición', 'Pasa a ser la fecha final de tu contrato.', { anioFijo: anio, alCambiar: calc });
    caja.appendChild(f1);
    var plazo = K.nodo('<p class="kc-calc" aria-live="polite"></p>');
    caja.appendChild(plazo);
    pesos(caja, D, 'valor', 'Valor de la adición', c.valorInicial ? 'Hasta el 50 % del valor inicial (' + K.pesos(c.valorInicial) + ')' + (otra ? ', sumando las dos adiciones' : '') + '.' : '', { alCambiar: calc });
    var tope = K.nodo('<p class="kc-calc" aria-live="polite"></p>');
    caja.appendChild(tope);
    var f2 = fila();
    codigo(f2, D, 'cdp', 'CDP de la adición', 'El final del CDP de la adición; el año lo pone la app.', anio);
    texto(f2, D, 'pagos', 'Total de pagos de la adición', 'Los pagos (informes) que trae la adición. De 1 a 24.', { numerico: 2, marcador: 'Ej: 2', valido: pagosOk, alCambiar: calc });
    caja.appendChild(f2);
    var total = K.nodo('<p class="kc-calc kc-calc--total" aria-live="polite"></p>');
    caja.appendChild(total);
    if (K.piezas.fechas) K.piezas.fechas.montar(caja);

    var malTope = false;
    function calc() {
      if (!total) return;
      var ini = fechaDe(D.inicio), fin = fechaDe(D.fin);
      if (ini && fin) {
        if (fin < ini) plazo.textContent = 'El fin está antes del inicio.';
        else {
          var p = plazoEntre(ini, fin);
          plazo.textContent = 'Adición de ' + tiempo(p.meses, p.dias) + ', hasta el ' + D.fin + '.';
        }
      } else plazo.textContent = '';
      var v = K.aNumero(D.valor);
      malTope = false;
      if (v && c.valorInicial) {
        malTope = (v + otra) * 2 > c.valorInicial;
        tope.textContent = malTope ? 'Se pasa del 50 % del valor inicial: el tope es ' + K.pesos(Math.floor(c.valorInicial / 2) - otra) + '. Revisa el otrosí.'
                                   : 'Valor final de tu contrato: ' + K.pesos(c.valorInicial + v + otra + (cual === 1 ? (c.adicion2 || 0) : 0)) + '.';
        tope.classList.toggle('kc-calc--mal', malTope);
      } else tope.textContent = '';
      var b = K.aNumero(D.pagos);
      total.innerHTML = (b && c.informes) ? 'Tu contrato quedaría en <b>' + (c.informes + b) + '</b> pagos (' + c.informes + ' + ' + b + ').' : '';
    }
    setTimeout(calc, 0);
    return {
      falta: function () {
        var f = [];
        if (!D.inicio) f.push('el inicio');
        if (!D.fin) f.push('el fin');
        var a = fechaDe(D.inicio), b = fechaDe(D.fin);
        if (a && b && b < a) f.push('un fin después del inicio');
        if (!K.aNumero(D.valor)) f.push('el valor');
        if (malTope) f.push('un valor que no pase del 50 % del valor inicial');
        if (!cdpOk(D.cdp, anio)) f.push('el CDP');
        if (!pagosOk(D.pagos)) f.push('el total de pagos (de 1 a 24)');
        return f;
      },
      datos: function () {
        return { inicio: D.inicio, fin: D.fin, valor: String(K.aNumero(D.valor)), cdp: D.cdp, pagos: String(K.aNumero(D.pagos)) };
      },
      resumen: function () {
        return [['Periodo', (D.inicio || '') + ' a ' + (D.fin || '')], ['Valor', K.pesos(D.valor)], ['CDP', D.cdp], ['Pagos de la adición', String(K.aNumero(D.pagos))]];
      }
    };
  }

  /* ════════════ AVISO: ¿NO TIENES TU CLAUSULADO? ════════════ */
  function aviso(caja, o) {
    o = o || {};
    var a = K.nodo('<div class="kc-aviso" role="note"><span class="kc-aviso__ico" aria-hidden="true">' + K.icono('info', 18) + '</span>' +
      '<div class="kc-aviso__txt"><p class="kc-aviso__t"></p><div class="kc-aviso__botones"></div></div></div>');
    a.querySelector('.kc-aviso__t').textContent = o.texto || '¿No tienes tu clausulado? Aquí te enseñamos cómo obtenerlo.';
    var bs = a.querySelector('.kc-aviso__botones');
    var T = window.TUTORIALES, id = '';
    if (T && T.activo && T.activo()) {
      (T.indice() || []).forEach(function (x) { if (Number(x.n) === Number(o.tutorial)) id = x.id; });
    }
    if (id) {
      var v = K.nodo('<button type="button" class="kit-btn kit-btn--marca kc-aviso__b">' + K.icono('play', 16) + ' VER VIDEO</button>');
      v.addEventListener('click', function () { K.vibrar && K.vibrar(6); T.verSuelto(id); });
      bs.appendChild(v);
    }
    var s = K.nodo('<a class="kit-btn kit-btn--plano kc-aviso__b" target="_blank" rel="noopener">' + K.icono('globo', 16) + ' IR A SECOP II</a>');
    s.href = o.secop || 'https://community.secop.gov.co/STS/Users/Login/Index?SkinName=CCE&currentLanguage=es-CO&Page=login&Country=CO';
    bs.appendChild(s);
    caja.appendChild(a);
    return a;
  }

  K.piezas = K.piezas || {};
  K.piezas.campos = { texto: texto, lista: lista, fecha: fecha, pesos: pesos, codigo: codigo, letras: letras,
                      contrato: contrato, adicion: adicion, aviso: aviso, _plazo: plazoEntre };
}());
