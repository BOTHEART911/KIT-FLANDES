/* ============================================================
   SOLICITUD-PRENSA-FLANDES · LA WEB
   Ajuste previo a la Fase 11 · 25/09/2026

   Para quien le pide apoyo a Comunicaciones y NO es contratista ni
   supervisor. No es una app (no se instala): es una página.

   Entrar
     · Con el ENLACE que le manda Comunicaciones por WhatsApp: trae un
       código firmado en el # (…/#e=SOL0001.abcdef…). Se entra de una vez
       y el # se borra de la barra de direcciones.
     · O con su número de WhatsApp registrado (decidido el 25/09: sin
       código por mensaje).
     · Si ya entró en este equipo, se queda dentro (sesión de 12 h); al
       vencer vuelve a la entrada con su número ya escrito.

   Lo que hace
     · Ve sus solicitudes y en qué va cada una (Recibida → En proceso →
       Realizada) y quién la atiende.
     · Pide una nueva con las MISMAS reglas del contratista (3 días de
       antelación): las hace cumplir el CORE; aquí solo se ayudan.
     · Corrige las suyas SOLO mientras sigan pendientes y sin asignar.

   UN SOLO LLAMADO: entrar trae el arranque; pedir y corregir devuelven
   la lista ya al día.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  var M = window.MARCA || {};
  var app = K.id('app');
  var A = null;              /* el arranque: yo, requerimientos, fechas, solicitudes */
  var FILTRO = '';
  var TEL_K = 'ultimoWhatsapp';

  var TEXTO = { PENDIENTE: 'Recibida', 'EN PROCESO': 'En proceso', REALIZADA: 'Realizada' };
  var TONO = { PENDIENTE: 'aviso', 'EN PROCESO': 'info', REALIZADA: 'ok' };

  /* ══════════════ utilidades ══════════════ */

  function tildes(s) {
    return String(s || '').replace(/\besta\b/g, 'está').replace(/\bdias\b/g, 'días').replace(/\bnumero\b/g, 'número')
      .replace(/\bpublicacion\b/g, 'publicación').replace(/\bantelacion\b/g, 'antelación').replace(/\bvalida\b/g, 'válida')
      .replace(/\bterminacion\b/g, 'terminación').replace(/\bdespues\b/g, 'después').replace(/\bComunicate\b/g, 'Comunícate')
      .replace(/\bdigitos\b/g, 'dígitos').replace(/\bpaso\b/g, 'pasó').replace(/\bno es valido\b/g, 'no es válido');
  }
  function iso(dmy) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dmy || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(dmy || ''); }
  function dmy(i) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(i || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(i || ''); }
  function largo(i) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(i || ''));
    if (!m) return String(i || '');
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return (+m[3]) + ' de ' + meses[+m[2] - 1] + (+m[1] !== new Date().getFullYear() ? ' de ' + m[1] : '');
  }
  function propio(s) { return K.piezas.personas ? K.piezas.personas.nombrePropio(s) : String(s || ''); }
  function titulo(s) { return propio(s).replace(/ (De|Del|La|Las|Los|Y|E|En) /g, function (x) { return x.toLowerCase(); }); }
  function resumen(t, n) { var s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  /** "08:00 AM" -> "08:00" para el input de hora. */
  function hhmm(v) {
    var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(v || '').trim());
    if (!m) return /^\d{2}:\d{2}$/.test(String(v || '')) ? v : '';
    return ('0' + (Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0))).slice(-2) + ':' + m[2];
  }
  function saludoDelDia() { var h = new Date().getHours(); return h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches'); }

  function pasos(estado) {
    var n = { PENDIENTE: 1, 'EN PROCESO': 2, REALIZADA: 3 }[estado] || 1;
    return '<ol class="tr-pasos" aria-label="En qué va">' + ['Recibida', 'En proceso', 'Realizada'].map(function (t, i) {
      var cl = i + 1 < n ? ' tr-paso--hecho' : (i + 1 === n ? ' tr-paso--actual' : '');
      return '<li class="tr-paso' + cl + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '><i></i>' + t + '</li>';
    }).join('') + '</ol>';
  }
  function dato(t, v) { v = String(v || '').trim(); return v ? '<div class="seg-dato"><dt>' + K.esc(t) + '</dt><dd>' + K.esc(v) + '</dd></div>' : ''; }

  /* ══════════════ arranque ══════════════ */

  var TITULO = 'Solicitud a Comunicaciones';

  K.listo(function () {
    if (K.piezas.version) K.piezas.version.vigilar();
    /* el banner va desde la entrada: trae el botón del modo oscuro */
    K.piezas.banner.montar({ titulo: TITULO });
    if (K.piezas.cielo) K.piezas.cielo.soloFondo(document.querySelector('.kit-banner'));
    var cod = leerEnlace();
    if (cod) return entrar({ enlace: cod }, true);
    if (K.token()) {
      var quitar = K.piezas.esqueletos.poner(app, { forma: 'ficha', cuantos: 2, sitio: 'reemplaza', espera: 'Abriendo tus solicitudes' });
      K.pedir('inicio', {}, { ms: 45000 }).then(function (d) { quitar(); listo(d); },
        function (e) {
          quitar();
          /* 25/09 · un corte de red no cierra la sesión: se conserva el token y se vuelve a intentar al recargar */
          var red = e && /^(SIN_RED|TIEMPO|RESPUESTA_NO_JSON)$/.test(e.codigo);
          if (!red) K.ponerToken('');
          puerta(e && e.codigo === 'SIN_RED' ? 'Sin conexión. Revisa tu internet y vuelve a entrar.' : tildes(e && e.message));
        });
      return;
    }
    puerta();
  });

  /** El código del enlace (#e=...). Se borra de la barra enseguida: no queda en el historial. */
  function leerEnlace() {
    var m = /[#&]e=([A-Za-z0-9]+\.[0-9a-f]{12})/.exec(location.hash || '');
    if (!m) return '';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    return m[1];
  }

  function entrar(datos, conEnlace, boton) {
    var quitar = conEnlace ? K.piezas.esqueletos.poner(app, { forma: 'ficha', cuantos: 2, sitio: 'reemplaza', espera: 'Entrando con tu enlace' }) : function () {};
    if (boton) { boton.disabled = true; boton.classList.add('kit-ocupado'); }
    return K.pedir('entrar', datos, { ms: 45000, sinToken: true }).then(function (r) {
      quitar();
      K.ponerToken(r.token);
      if (datos.whatsapp) K.guardar.escribir(TEL_K, datos.whatsapp);
      listo(r.arranque);
    }, function (e) {
      quitar();
      if (boton) { boton.disabled = false; boton.classList.remove('kit-ocupado'); }
      var msg = e && e.codigo === 'SIN_RED' ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : tildes((e && e.message) || 'No se pudo entrar.');
      if (conEnlace) puerta(msg); else K.aviso(msg, 'malo', 8000);
    });
  }

  function salir() {
    K.ponerToken('');
    A = null;
    K.piezas.banner.atras(null);
    K.piezas.banner.montar({ titulo: TITULO });
    puerta();
  }

  /* ══════════════ la entrada ══════════════ */

  function puerta(error) {
    app.innerHTML = '';
    /* en la entrada no hay cuenta que mostrar: fuera el círculo del perfil */
    var perf = document.querySelector('.kit-banner__perfil');
    if (perf) perf.style.display = 'none';
    var c = K.nodo(
      '<section class="sx-puerta">' +
      '  <div class="kit-tarjeta sx-puerta__caja">' +
      '    <img class="sx-puerta__escudo" src="img/escudo.webp" width="150" height="150" alt="Solicitud externa · Prensa · Alcaldía de Flandes">' +
      '    <h1 class="sx-puerta__t">Solicitud a Comunicaciones</h1>' +
      '    <p class="sx-puerta__p">' + K.esc(M.MUNICIPIO || 'Alcaldía de Flandes') + '. Pide fotos, video, piezas gráficas, perifoneo o publicaciones y sigue en qué va tu solicitud.</p>' +
      '    <form class="sx-puerta__form" novalidate>' +
      '      <label class="campo"><span>Tu número de WhatsApp</span>' +
      '        <input type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="Celular de 10 dígitos" required></label>' +
      '      <button type="submit" class="kit-btn kit-btn--marca sx-puerta__b">' + K.icono('whatsapp', 18) + ' Entrar</button>' +
      '    </form>' +
      '    <p class="sx-puerta__nota">' + K.icono('info', 14) + ' Solo entran los números que registró la Oficina de Comunicaciones. Si no estás registrado, pídeles que te registren.</p>' +
      '  </div>' +
      '</section>');
    var inp = c.querySelector('input');
    inp.value = K.guardar.leer(TEL_K, '') || '';
    inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 10); });
    c.querySelector('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = inp.value.trim();
      if (!/^3\d{9}$/.test(t)) { K.aviso('Escribe tu número de WhatsApp: 10 dígitos, empieza por 3.', 'aviso', 4500); inp.focus(); return; }
      entrar({ whatsapp: t }, false, c.querySelector('button'));
    });
    app.appendChild(c);
    if (error) c.querySelector('.sx-puerta__caja').insertBefore(K.nodo('<p class="sx-puerta__error" role="alert">' + K.icono('aviso', 16) + ' ' + K.esc(error) + '</p>'), c.querySelector('form'));
    K.piezas.creditos.montar(c);
    setTimeout(function () { if (!inp.value) try { inp.focus(); } catch (e) {} }, 300);
  }

  /* ══════════════ dentro ══════════════ */

  function listo(d) {
    A = d;
    if (d.config && K.piezas.creditos.configurar) K.piezas.creditos.configurar(d.config);
    if (d.config && K.piezas.guia) K.piezas.guia.configurar(d.config);
    K.piezas.banner.montar({
      titulo: TITULO,
      nombre: A.yo.nombre, rol: titulo(A.yo.cargo),
      menu: [{ texto: 'Refrescar mis solicitudes', al: refrescar },
             /* en pantallas angostas el kit esconde el botón de tema del banner */
             { texto: 'Descargar guía rápida', al: function () { if (K.piezas.guia) K.piezas.guia.descargar('SOLICITUD_PRENSA'); } },
             { texto: 'Modo claro / oscuro', al: function () { K.alternarTema(); } },
             { texto: 'Salir', al: salir, peligro: true }]
    });
    /* la entrada lo dejó escondido (sin nombre ni menú) */
    var perf = document.querySelector('.kit-banner__perfil');
    if (perf) { perf.hidden = false; perf.style.display = ''; }
    inicio();
  }

  function refrescar() {
    return K.pedir('inicio', {}, { ms: 45000 }).then(function (d) { A = d; inicio(); K.aviso('Al día.', 'ok', 2000); },
      function (e) { K.aviso(tildes((e && e.message) || 'No se pudo refrescar.'), 'malo', 7000); if (/INACTIVO|ya no existe|sesion/i.test(String(e && e.message))) salir(); });
  }

  function inicio(abrirForm) {
    K.piezas.banner.vista(TITULO);
    K.piezas.banner.atras(null);
    app.innerHTML = '';
    var c = K.nodo('<div class="kit-ancho vista sx-vista"></div>');
    var sal = K.nodo(
      '<section class="saludo">' +
      '  <div class="saludo__txt">' +
      '    <p class="saludo__hola">' + K.esc(saludoDelDia()) + ',</p>' +
      '    <h2 class="saludo__nombre">' + K.esc(propio(A.yo.nombre)) + '</h2>' +
      '    <p class="saludo__doc">' + K.esc(titulo(A.yo.cargo)) + ' · ' + K.esc(titulo(A.yo.dependencia)) + '</p>' +
      '  </div>' +
      '</section>');
    if (K.piezas.personas) sal.appendChild(K.piezas.personas.avatar(A.yo.nombre, { tam: 60, sinZoom: true }));
    if (K.piezas.cielo) K.piezas.cielo.poner(sal, { burbujas: 3 });
    c.appendChild(sal);

    var cab = K.nodo(
      '<section class="kit-tarjeta tr-cab sx-cab">' +
      '  <span class="tr-cab__ico">' + K.icono('megafono', 24) + '</span>' +
      '  <div class="tr-cab__txt"><h2 class="tr-cab__t">SOLICITUD A COMUNICACIONES</h2>' +
      '  <p class="tr-cab__p">Pide apoyo al equipo de Comunicaciones: fotos, video, piezas gráficas, perifoneo o publicación. ' +
      'Pídela con <b>' + A.antelacion + ' días de antelación</b>. Puedes corregirla mientras no se haya asignado.</p></div>' +
      '</section>');
    c.appendChild(cab);

    var zona = K.nodo('<section class="kit-tarjeta tr-nueva"></section>');
    var boton = K.nodo('<button type="button" class="kit-btn kit-btn--marca tr-nueva__b">' + K.icono('mas', 18) + ' Nueva solicitud</button>');
    zona.appendChild(boton);
    boton.addEventListener('click', function () {
      /* .kit-btn pone su propio display y le gana a [hidden]: se esconde a mano
         (si no, un segundo toque abría otro formulario debajo del primero) */
      boton.hidden = true; boton.style.display = 'none';
      zona.appendChild(formulario(null, function () { boton.hidden = false; boton.style.display = ''; }));
      zona.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    c.appendChild(zona);
    c.appendChild(mias());
    app.appendChild(c);
    K.piezas.creditos.montar(c);
    if (abrirForm) boton.click();
  }

  function mias() {
    var s = K.nodo('<section class="kit-tarjeta tr-mias"><h3 class="seg-sec__t">MIS SOLICITUDES</h3></section>');
    var L = A.solicitudes || [];
    if (!L.length) {
      s.appendChild(K.nodo('<p class="seg-nada">Todavía no has pedido nada. Toca <b>Nueva solicitud</b> para empezar.</p>'));
      return s;
    }
    var conteos = { '': L.length };
    L.forEach(function (x) { conteos[x.estado] = (conteos[x.estado] || 0) + 1; });
    var ops = [{ valor: '', texto: 'Todas' }];
    ['PENDIENTE', 'EN PROCESO', 'REALIZADA'].forEach(function (e) { if (conteos[e]) ops.push({ valor: e, texto: { PENDIENTE: 'Recibidas', 'EN PROCESO': 'En proceso', REALIZADA: 'Realizadas' }[e] || TEXTO[e], tono: e === 'REALIZADA' ? 'ok' : 'aviso' }); });
    if (FILTRO && !conteos[FILTRO]) FILTRO = '';
    var fil = K.nodo('<div></div>');
    s.appendChild(fil);
    var lista = K.nodo('<div class="tr-lista"></div>');
    s.appendChild(lista);
    var pp = K.piezas.pastillas.montar(fil, { opciones: ops, valor: FILTRO, alCambiar: function (v) { FILTRO = v || ''; pintar(); } });
    if (pp && pp.conteos) pp.conteos(conteos);
    function pintar() {
      lista.innerHTML = '';
      L.filter(function (x) { return !FILTRO || x.estado === FILTRO; }).forEach(function (x) { lista.appendChild(tarjeta(x)); });
    }
    pintar();
    return s;
  }

  function tarjeta(x) {
    var tono = TONO[x.estado] || 'aviso';
    var quien = x.asignados && x.asignados.length ? x.asignados : [];
    var d = K.nodo(
      '<details class="tr-sol tr-sol--' + tono + '">' +
      '  <summary>' +
      '    <span class="tr-sol__cab"><b>' + K.esc(x.codigo) + '</b><span class="tr-est tr-est--' + tono + '">' + K.esc(TEXTO[x.estado] || x.estado) + '</span></span>' +
      '    <span class="tr-sol__t">' + K.esc(x.evento || resumen(x.detalles, 90)) + '</span>' +
      '    <span class="tr-sol__meta">' + K.esc(['Pedida el ' + dmy(x.fecha), x.publicacion ? 'para el ' + largo(x.publicacion) : ''].filter(Boolean).join(' · ')) + '</span>' +
      (quien.length ? '<span class="tr-sol__quien">' + K.icono('check', 13) + ' <span class="tr-sol__cara"></span>La atiende ' + K.esc(quien.map(propio).join(', ')) + '</span>' : '') +
      '  </summary>' +
      '  <div class="tr-sol__cuerpo">' + pasos(x.estado) +
      '    <div class="tr-chips tr-chips--quietas">' + (x.requerimientos || []).map(function (r) { return '<span class="kit-pastilla">' + K.esc(r) + '</span>'; }).join('') + '</div>' +
      '    <p class="tr-sol__det"></p>' +
      '    <dl class="seg-datos">' +
      dato('Evento', x.evento) + dato('Fecha del evento', [x.fechaEvento ? dmy(x.fechaEvento) : '', x.horaInicio && x.horaFin ? x.horaInicio + ' a ' + x.horaFin : x.horaInicio].filter(Boolean).join(' · ')) +
      dato('Lugar', x.lugar) + dato('Otros', x.otros) + dato('Entrega o publicación', x.publicacion ? dmy(x.publicacion) : '') +
      '    </dl>' +
      '    <div class="sx-sol__acc"></div>' +
      '  </div>' +
      '</details>');
    d.querySelector('.tr-sol__det').textContent = x.detalles || '';
    var hueco = d.querySelector('.tr-sol__cara');
    if (hueco && K.piezas.personas) hueco.appendChild(K.piezas.personas.avatar(quien[0], { tam: 22, sinZoom: true }));
    else if (hueco) hueco.remove();
    var acc = d.querySelector('.sx-sol__acc');
    if (x.editable) {
      var ed = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + K.icono('lapiz', 16) + ' Corregir</button>');
      ed.addEventListener('click', function () {
        acc.innerHTML = '';
        acc.appendChild(formulario(x, function () { inicio(); }));
      });
      acc.appendChild(ed);
    } else {
      acc.appendChild(K.nodo('<p class="sx-sol__candado">' + K.icono('candado', 14) + ' ' +
        (x.estado === 'REALIZADA' ? 'Ya está realizada' : 'Ya está asignada al equipo') + ' y no se puede editar. Si necesitas un cambio, escríbele a Comunicaciones.</p>'));
    }
    return d;
  }

  /* ══════════════ el formulario (nueva y corregir) ══════════════ */

  function campo(etiqueta, ayuda, control, obligatorio) {
    var c = K.nodo('<label class="campo"><span>' + K.esc(etiqueta) + (obligatorio ? ' <i class="tr-oblig" aria-hidden="true">*</i>' : '') + '</span></label>');
    c.appendChild(control);
    if (ayuda) c.appendChild(K.nodo('<p class="campo__ayuda">' + ayuda + '</p>'));
    return c;
  }

  function formulario(x, alCerrar) {
    x = x || null;
    var D = { requerimientos: x ? x.requerimientos.slice() : [], detalles: x ? x.detalles : '', publicacion: x ? x.publicacion : '',
              evento: x ? x.evento : '', fechaEvento: x ? x.fechaEvento : '', horaInicio: x ? hhmm(x.horaInicio) : '', horaFin: x ? hhmm(x.horaFin) : '',
              lugar: x ? x.lugar : '', otros: x ? x.otros : '' };
    var f = K.nodo('<form class="formulario tr-form" novalidate><h3 class="grupo__t">' + (x ? 'Corregir ' + K.esc(x.codigo) : 'Nueva solicitud') + '</h3></form>');

    var chips = K.nodo('<div class="tr-chips" role="group" aria-label="Qué necesitas"></div>');
    (A.requerimientos || []).forEach(function (r) {
      var on = D.requerimientos.some(function (q) { return K.norm(q) === K.norm(r); });
      var b = K.nodo('<button type="button" class="kit-pastilla tr-chip" aria-pressed="' + on + '">' + K.icono('check', 14) + K.esc(r) + '</button>');
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        D.requerimientos = [].map.call(chips.querySelectorAll('[aria-pressed="true"]'), function (y) { return y.textContent.trim(); });
        cReq.classList.toggle('campo--ok', D.requerimientos.length > 0);
      });
      chips.appendChild(b);
    });
    var cReq = K.nodo('<div class="campo"><span>¿Qué necesitas? <i class="tr-oblig" aria-hidden="true">*</i></span></div>');
    cReq.appendChild(chips);
    cReq.appendChild(K.nodo('<p class="campo__ayuda">Elige uno o varios.</p>'));
    f.appendChild(cReq);

    var det = K.nodo('<textarea rows="5" maxlength="5000" placeholder="Objetivo, participantes, el texto que debe llevar la pieza, logos, logística…"></textarea>');
    det.value = D.detalles || '';
    var cuenta = K.nodo('<small class="tr-cuenta"></small>');
    var cDet = campo('Detalles del evento o requerimiento', 'Cuenta todo lo que Comunicaciones necesita saber. Mínimo una frase completa.', det, true);
    cDet.appendChild(cuenta);
    function contar() { D.detalles = det.value; cuenta.textContent = det.value.trim().length + ' caracteres'; cDet.classList.toggle('campo--ok', det.value.trim().length >= 15); }
    det.addEventListener('input', contar); contar();
    f.appendChild(cDet);

    var pub = K.nodo('<input type="date" data-kit-fecha data-titulo="Entrega o publicación" min="' + K.esc(A.minPublicacion) + '" placeholder="dd/mm/aaaa">');
    pub.value = D.publicacion || '';
    pub.addEventListener('change', function () { D.publicacion = pub.value; });
    f.appendChild(campo('Fecha de entrega o publicación', 'Desde el <b>' + K.esc(dmy(A.minPublicacion)) + '</b>: ' + A.antelacion + ' días de antelación.', pub, true));

    f.appendChild(K.nodo('<h3 class="grupo__t grupo__t--sub">Si es un evento</h3>'));
    var ev = K.nodo('<input type="text" maxlength="300" placeholder="Ej: Reunión de la junta de acción comunal">');
    ev.value = D.evento || '';
    ev.addEventListener('input', function () { D.evento = ev.value; });
    f.appendChild(campo('Nombre del evento', 'Si no es un evento, déjalo vacío.', ev, false));
    var fe = K.nodo('<input type="date" data-kit-fecha data-titulo="Fecha del evento" min="' + K.esc(A.hoy) + '" placeholder="dd/mm/aaaa">');
    fe.value = D.fechaEvento || '';
    fe.addEventListener('change', function () { D.fechaEvento = fe.value; });
    f.appendChild(campo('Fecha del evento', '', fe, false));
    var fila = K.nodo('<div class="campo-fila"></div>');
    var hi = K.nodo('<input type="time">'), hf = K.nodo('<input type="time">');
    hi.value = D.horaInicio || ''; hf.value = D.horaFin || '';
    hi.addEventListener('input', function () { D.horaInicio = hi.value; });
    hf.addEventListener('input', function () { D.horaFin = hf.value; });
    fila.appendChild(campo('Hora de inicio', '', hi, false));
    fila.appendChild(campo('Hora de terminación', '', hf, false));
    f.appendChild(fila);
    var lug = K.nodo('<input type="text" maxlength="300" placeholder="Lugar o punto de encuentro">');
    lug.value = D.lugar || '';
    lug.addEventListener('input', function () { D.lugar = lug.value; });
    f.appendChild(campo('Lugar', '', lug, false));
    var otr = K.nodo('<textarea rows="2" maxlength="1000" placeholder="Algo más que no esté en la lista"></textarea>');
    otr.value = D.otros || '';
    otr.addEventListener('input', function () { D.otros = otr.value; });
    f.appendChild(campo('Otros', '', otr, false));

    f.appendChild(K.nodo('<h3 class="grupo__t grupo__t--sub">Quién lo pide</h3>'));
    f.appendChild(K.nodo('<div class="dato"><span class="dato__e">Nombre</span><span class="dato__v">' + K.esc(A.yo.nombre) + '</span></div>'));
    f.appendChild(K.nodo('<div class="dato"><span class="dato__e">Dependencia</span><span class="dato__v">' + K.esc(A.yo.dependencia) + '</span></div>'));
    f.appendChild(K.nodo('<div class="dato"><span class="dato__e">Cargo</span><span class="dato__v">' + K.esc(A.yo.cargo) + '</span></div>'));
    f.appendChild(K.nodo('<p class="campo__ayuda">Si algún dato tuyo cambió, pídele a Comunicaciones que lo corrija.</p>'));

    var pie = K.nodo('<div class="campo-fila campo-fila--botones"></div>');
    var no = K.nodo('<button type="button" class="kit-btn kit-btn--plano">Cancelar</button>');
    var si = K.nodo('<button type="submit" class="kit-btn kit-btn--marca">' + K.icono('enviar', 16) + (x ? ' Revisar y guardar' : ' Revisar y enviar') + '</button>');
    pie.appendChild(no); pie.appendChild(si);
    f.appendChild(pie);
    no.addEventListener('click', function () { f.remove(); if (alCerrar) alCerrar(); });

    f.addEventListener('submit', function (evn) {
      evn.preventDefault();
      var falta = faltaDe(D);
      if (falta) { K.aviso(falta, 'aviso', 5000); return; }
      K.piezas.confirmar.abrir({
        titulo: x ? 'Guardar los cambios de ' + x.codigo : 'Resumen de tu solicitud',
        lista: [
          ['Necesitas', D.requerimientos.join(', ')],
          ['Entrega o publicación', dmy(D.publicacion)],
          D.evento ? ['Evento', D.evento] : null,
          D.fechaEvento ? ['Fecha del evento', dmy(D.fechaEvento) + (D.horaInicio ? ' · ' + D.horaInicio + (D.horaFin ? ' a ' + D.horaFin : '') : '')] : null,
          D.lugar ? ['Lugar', D.lugar] : null,
          ['Detalles', resumen(D.detalles, 140)]
        ].filter(Boolean),
        nota: x ? 'Puedes corregirla mientras siga sin asignar.' : 'Le avisamos al equipo de Comunicaciones. Aquí mismo vas a ver cuándo la toman y quién la atiende; también te llega un WhatsApp.',
        si: x ? 'Guardar' : 'Enviar', no: 'Editar'
      }).then(function (ok) { if (ok) enviar(D, x, si); });
    });

    if (K.piezas.fechas) setTimeout(function () { K.piezas.fechas.montar(f); }, 0);
    return f;
  }

  /** Lo mismo que va a exigir el CORE, dicho antes de viajar. */
  function faltaDe(D) {
    if (!D.requerimientos.length) return 'Elige al menos una cosa que necesitas.';
    if (String(D.detalles || '').trim().length < 15) return 'Cuenta con más detalle lo que necesitas.';
    if (!D.publicacion) return 'Elige la fecha de entrega o publicación.';
    if (iso(D.publicacion) < A.minPublicacion) return 'La entrega o publicación va desde el ' + dmy(A.minPublicacion) + ' (' + A.antelacion + ' días de antelación).';
    if (D.fechaEvento && iso(D.fechaEvento) < A.hoy) return 'La fecha del evento ya pasó.';
    if (D.horaInicio && D.horaFin && D.horaFin <= D.horaInicio) return 'La hora de terminación tiene que ser después de la de inicio.';
    return '';
  }

  function enviar(D, x, boton) {
    boton.disabled = true;
    var campos = { requerimientos: D.requerimientos, detalles: D.detalles, publicacion: iso(D.publicacion), evento: D.evento || '',
                   fechaEvento: D.fechaEvento ? iso(D.fechaEvento) : '', horaInicio: D.horaInicio || '', horaFin: D.horaFin || '',
                   lugar: D.lugar || '', otros: D.otros || '' };
    var accion = x ? 'editar' : 'solicitar';
    var cuerpo = x ? { codigo: x.codigo, campos: campos } : { campos: campos };
    K.piezas.guardado.mientras(K.pedir(accion, cuerpo, { ms: 90000 }), {
      titulo: x ? 'Guardando los cambios' : 'Enviando tu solicitud a Comunicaciones',
      sub: 'No cierres la página hasta que termine.',
      pasos: x ? ['Guardando…'] : ['Guardando la solicitud', 'Avisando al equipo de Comunicaciones'],
      listo: { titulo: x ? 'Cambios guardados' : 'Solicitud enviada', paso: 'Listo' }
    }).then(function (r) {
      A.solicitudes = r.solicitudes || A.solicitudes;
      FILTRO = '';
      inicio();
      if (!x) {
        K.aviso('Quedó con el código ' + r.codigo + '.', 'ok', 5000);
        if (r.aviso && r.aviso.ok === false) {
          K.piezas.confirmar.avisar({
            titulo: 'El aviso a Comunicaciones no salió',
            texto: 'Tu solicitud ' + r.codigo + ' SÍ quedó registrada, pero el WhatsApp al grupo de Comunicaciones no se pudo enviar.',
            nota: 'Coméntaselo al equipo de Comunicaciones para que la busquen en su app.', si: 'Entendido'
          });
        }
      }
    }, function (e) {
      boton.disabled = false;
      var msg = tildes((e && e.message) || 'No se pudo guardar.');
      K.aviso(msg, 'malo', 9000);
      if (/INACTIVO|ya no existe|Vuelve a iniciar/i.test(msg)) setTimeout(salir, 2500);
    });
  }

  window.WEB = { _arranque: function () { return A; }, _faltaDe: faltaDe, _leerEnlace: leerEnlace, _tildes: tildes };
}());
