/* ============================================================
   KIT-FLANDES · PIEZA 13 · SOPORTE CON HASTA 3 FOTOS
   El camino corto entre "esto no funciona" y alguien que lo arregle.

   Por qué con fotos
     Un reporte que dice "no me deja guardar" no sirve. Con la captura de
     pantalla se ve el mensaje exacto. Se admiten tres porque el problema
     suele estar en la secuencia: lo que llené, lo que toqué y lo que salió.

   Qué se manda sin preguntar (y se le dice al usuario)
     La app, la vista, el usuario, el rol, la versión del navegador y la
     hora. Eso es lo que siempre hay que volver a preguntar por WhatsApp.

   Cómo se usa

     KIT.piezas.soporte.abrir();                    // desde el menú del banner
     KIT.piezas.soporte.abrir({ vista: 'Radicar cuenta' });

   A dónde va
     A la acción 'soporte' del CORE, que avisa al grupo de desarrollo por
     WhatsApp. Si el CORE no responde, se ofrece WhatsApp directo con el
     texto ya armado: el reporte no se pierde porque el servidor esté mal,
     que es justo cuando más falta hace.

   10.4 · SOPORTE PROFESIONAL
     · ESTRELLAS: cuando un soporte queda RESUELTO, el CORE lo pega a
       'inicio' de cualquier app ('_soporte') y K.pedir dispara
       'kit:soporte'. Esta pieza abre la calificación de 1 a 5 estrellas.
       Con 1 o 2 (reabreHasta) pide el comentario y el caso se REABRE.
       "Después" la cierra hasta la próxima vez que se abra la app.
     · MIS SOLICITUDES: desde el modal de soporte, la lista de las propias
       (de todas las apps) con su estado, la respuesta y las estrellas.

       KIT.piezas.soporte.mias();
       KIT.piezas.soporte.calificar(caso, { reabreHasta: 2 });

   Pareja: kit/soporte.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/soporte] falta kit.js'); } catch (e) {} return; }

  var MAX_FOTOS = 3;

  function contexto(extra) {
    var yo = (K.piezas.sesion && K.piezas.sesion.yo && K.piezas.sesion.yo()) || {};
    var d = {
      app: K.app,
      vista: (extra && extra.vista) || (K.piezas.banner && K.piezas.banner.elemento && document.title) || '',
      usuario: yo.nombre || yo.documento || '',
      rol: yo.rol || '',
      navegador: navigator.userAgent,
      pantalla: window.innerWidth + 'x' + window.innerHeight,
      cuando: new Date().toLocaleString('es-CO'),
      url: location.href.split('#')[0]
    };
    return d;
  }

  function abrir(opciones) {
    opciones = opciones || {};
    var ctx = contexto(opciones);
    var adj = null;

    var hoja = K.nodo(
      '<div class="kit-capa kit-sop kit-capa--on" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-sop__hoja">' +
      '    <header class="kit-capa__h">Contar un problema<button type="button" class="kit-capa__x">' + K.icono('cerrar', 18) + '</button></header>' +
      '    <div class="kit-capa__cuerpo kit-sop__cuerpo">' +
      '      <button type="button" class="kit-sop__mias">' + K.icono('reloj', 16) + '<span>Ver mis solicitudes y su respuesta</span>' + K.icono('adelante', 14) + '</button>' +
      '      <label class="kit-sop__campo">' +
      '        <span>¿Qué pasó?</span>' +
      '        <textarea rows="4" placeholder="Qué estabas haciendo y qué salió mal. Entre más concreto, más rápido se arregla."></textarea>' +
      '      </label>' +
      '      <div class="kit-sop__fotos">' +
      '        <span class="kit-sop__et">Fotos o capturas (hasta ' + MAX_FOTOS + ')</span>' +
      '        <div class="kit-sop__zona"></div>' +
      '      </div>' +
      '      <details class="kit-sop__datos">' +
      '        <summary>Qué se envía además de tu mensaje</summary>' +
      '        <ul></ul>' +
      '      </details>' +
      '      <p class="kit-sop__error" role="alert"></p>' +
      '    </div>' +
      '    <footer class="kit-capa__pie">' +
      '      <button type="button" class="kit-btn kit-sop__no">Cancelar</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-sop__si">Enviar</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);

    /* lo que se manda, a la vista: nada a escondidas */
    var ul = hoja.querySelector('.kit-sop__datos ul');
    [['Aplicación', ctx.app], ['Vista', ctx.vista], ['Usuario', ctx.usuario],
     ['Rol', ctx.rol], ['Fecha y hora', ctx.cuando], ['Pantalla', ctx.pantalla],
     ['Navegador', ctx.navegador]].forEach(function (p) {
      if (!p[1]) return;
      ul.appendChild(K.nodo('<li><b>' + K.esc(p[0]) + ':</b> ' + K.esc(p[1]) + '</li>'));
    });

    if (K.piezas.adjuntos) {
      adj = K.piezas.adjuntos.montar(hoja.querySelector('.kit-sop__zona'), {
        acepta: 'image/*', varios: true, maximo: MAX_FOTOS, maximoMB: 6
      });
    } else {
      hoja.querySelector('.kit-sop__fotos').classList.add('kit-oculto');
    }

    var texto = hoja.querySelector('textarea');
    var err = hoja.querySelector('.kit-sop__error');
    function marcar(t) {
      err.textContent = t || '';
      err.classList.toggle('kit-sop__error--on', !!t);
    }
    function fuera() { if (adj) adj.desmontar(); hoja.remove(); }

    hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
    hoja.querySelector('.kit-sop__no').addEventListener('click', fuera);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    hoja.querySelector('.kit-sop__mias').addEventListener('click', function () { fuera(); mias(); });

    hoja.querySelector('.kit-sop__si').addEventListener('click', function () {
      var b = this;
      var msj = String(texto.value || '').trim();
      if (msj.length < 10) return marcar('Cuéntame un poco más: con diez letras no se puede buscar el problema.');

      marcar('');
      b.disabled = true;
      b.classList.add('kit-ocupado');

      fotosListas(adj)
        .then(function (fotos) {
          return K.pedir('soporte', { mensaje: msj, contexto: ctx, fotos: fotos }, { ms: 90000 });
        })
        .then(function (r) {
          fuera();
          /* 5.1.1: el CORE guarda en la hoja SOPORTE y avisa al grupo de
             desarrollo. Se le da a la persona el número para que pueda
             preguntar por él. */
          var n = r && r.id ? ' Tu número es ' + r.id + '.' : '';
          K.aviso('Tu solicitud quedó registrada y llegó a soporte.' + n, 'ok', 7000);
        })
        .catch(function (e) {
          b.disabled = false;
          b.classList.remove('kit-ocupado');
          /* el CORE no contesta: se ofrece WhatsApp, que es justo cuando
             el usuario más necesita que el reporte salga */
          marcar('No se pudo enviar por la aplicación. Puedes mandarlo por WhatsApp.');
          porWhatsapp(msj, ctx, hoja);
        });
    });

    setTimeout(function () { texto.focus(); }, 80);
    return { cerrar: fuera };
  }

  /**
   * 5.1.1 · LAS FOTOS VIAJAN REDUCIDAS. Una captura de teléfono pesa de 2 a
   * 8 MB y tres de ellas en base64 tumban el POST a Apps Script. Si la pieza
   * de imágenes está cargada, cada foto se pasa a JPEG de 1.600 px antes de
   * salir (la misma regla de las evidencias); si no, va tal cual.
   */
  function fotosListas(adj) {
    if (!adj) return Promise.resolve([]);
    var I = K.piezas.imagenes;
    var lista = adj.archivos ? adj.archivos() : [];
    if (!I || !I.preparar || !lista.length) return adj.aBase64();
    return Promise.all(lista.map(function (f, i) {
      return I.preparar(f).then(function (r) {
        return { nombre: 'captura-' + (i + 1) + '.jpg', tipo: 'image/jpeg', datos: String(r.dataUrl).slice(String(r.dataUrl).indexOf(',') + 1) };
      });
    }));
  }

  function porWhatsapp(msj, ctx, hoja) {
    if (hoja.querySelector('.kit-sop__wa')) return;
    var numero = String((window.MARCA && window.MARCA.SOPORTE_WHATSAPP) || '').replace(/\D/g, '');
    var cuerpo = 'REPORTE ' + ctx.app + '\n' +
                 'Vista: ' + ctx.vista + '\n' +
                 'Usuario: ' + ctx.usuario + (ctx.rol ? ' (' + ctx.rol + ')' : '') + '\n' +
                 'Fecha: ' + ctx.cuando + '\n\n' + msj;
    var url = 'https://wa.me/' + (numero || '') + '?text=' + encodeURIComponent(cuerpo);

    var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca kit-sop__wa">Abrir WhatsApp con el reporte escrito</button>');
    b.addEventListener('click', function () {
      window.open(url, '_blank', 'noopener');
      K.aviso('Las fotos hay que adjuntarlas en WhatsApp a mano.', 'aviso', 5500);
    });
    hoja.querySelector('.kit-sop__cuerpo').appendChild(b);
  }

  /* ══════════════ 10.4 · CALIFICAR CON ESTRELLAS ══════════════ */

  var ETIQUETAS = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];
  var APP_T = { CONTRATISTA: 'Contratista', CONTRATACION: 'Contratación', SUPERVISION: 'Supervisión',
                CONTABILIDAD: 'Contabilidad', TESORERIA: 'Tesorería', COMUNICACIONES: 'Comunicaciones', ADMIN: 'Admin' };
  var VISTOS = {};          /* casos ya ofrecidos en esta visita: "Después" no insiste */
  var COLA = [];
  var ABIERTA = null;
  var CFG = { reabreHasta: 2, comentarioHasta: 3 };

  function dato(t) { return String(t === null || t === undefined ? '' : t); }

  /** Lo que llega con 'inicio': se encolan los que no se han ofrecido. */
  function pendientes(d) {
    d = d || {};
    if (d.reabreHasta) CFG.reabreHasta = Number(d.reabreHasta);
    if (d.comentarioHasta) CFG.comentarioHasta = Number(d.comentarioHasta);
    (d.pendientes || []).forEach(function (c) {
      if (!c || !c.id || VISTOS[c.id]) return;
      VISTOS[c.id] = 1;
      COLA.push(c);
    });
    siguiente();
  }

  function siguiente() {
    /* si alguien quito la capa de la pagina sin cerrarla, no se queda trabada la cola */
    if (ABIERTA && !document.body.contains(ABIERTA)) ABIERTA = null;
    if (ABIERTA || !COLA.length) return;
    /* con otra capa encima (un formulario, el visor) se espera a que cierre */
    if (document.querySelector('.kit-capa--on:not(.kit-est-capa)')) { setTimeout(siguiente, 2500); return; }
    calificar(COLA.shift(), CFG);
  }

  function estrellasHtml(n, tam) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<span class="kit-est__v' + (i <= n ? ' kit-est__v--on' : '') + '">' + K.icono('estrella', tam || 15) + '</span>';
    return '<span class="kit-est__ver" aria-label="' + n + (n === 1 ? ' estrella' : ' estrellas') + '">' + h + '</span>';
  }

  /**
   * La capa de estrellas para UN caso. alTerminar(r) recibe la respuesta del
   * CORE (o null si se cerró con "Después").
   */
  function calificar(caso, cfg, alTerminar) {
    cfg = cfg || CFG;
    var reabre = Number(cfg.reabreHasta || 2), pide = Number(cfg.comentarioHasta || 3);
    var elegido = 0;
    var hoja = K.nodo(
      '<div class="kit-capa kit-sop kit-est-capa kit-capa--on" role="dialog" aria-modal="true" aria-labelledby="kitEstT">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-sop__hoja">' +
      '    <header class="kit-capa__h" id="kitEstT">Califica la atención<button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button></header>' +
      '    <div class="kit-capa__cuerpo kit-sop__cuerpo">' +
      '      <p class="kit-est__cab"><b></b><span></span></p>' +
      '      <div class="kit-est__bloque"><span class="kit-sop__et">Lo que pediste</span><p class="kit-est__sol"></p></div>' +
      '      <div class="kit-est__bloque kit-est__bloque--resp"><span class="kit-sop__et">Lo que hicimos</span><p class="kit-est__resp"></p><small class="kit-est__quien"></small></div>' +
      '      <div class="kit-est" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas"></div>' +
      '      <p class="kit-est__et" aria-live="polite">Toca las estrellas</p>' +
      '      <label class="kit-sop__campo kit-est__com">' +
      '        <span></span>' +
      '        <textarea rows="3" maxlength="1000"></textarea>' +
      '      </label>' +
      '      <p class="kit-sop__error" role="alert"></p>' +
      '    </div>' +
      '    <footer class="kit-capa__pie">' +
      '      <button type="button" class="kit-btn kit-est__luego">Después</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-est__si" disabled>Calificar</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    hoja.querySelector('.kit-est__cab b').textContent = dato(caso.id);
    hoja.querySelector('.kit-est__cab span').textContent = [APP_T[caso.app] || caso.app, caso.fechaRespuesta || caso.fecha].filter(Boolean).join(' · ');
    hoja.querySelector('.kit-est__sol').textContent = dato(caso.solicitud);
    hoja.querySelector('.kit-est__resp').textContent = dato(caso.respuesta) || 'Quedó resuelto.';
    hoja.querySelector('.kit-est__quien').textContent = caso.respondidoPor ? 'Atendió: ' + nombreBonito(caso.respondidoPor) : '';
    if (caso.reabierto) hoja.querySelector('.kit-est__cab').appendChild(K.nodo('<em class="kit-est__re">Reabierto ' + Number(caso.reabierto) + (caso.reabierto === 1 ? ' vez' : ' veces') + '</em>'));

    var zona = hoja.querySelector('.kit-est');
    var et = hoja.querySelector('.kit-est__et');
    var com = hoja.querySelector('.kit-est__com');
    var comT = com.querySelector('span');
    var txt = com.querySelector('textarea');
    var si = hoja.querySelector('.kit-est__si');
    var err = hoja.querySelector('.kit-sop__error');
    com.classList.add('kit-oculto');

    var botones = [];
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = K.nodo('<button type="button" class="kit-est__b" role="radio" aria-checked="false" aria-label="' + n + (n === 1 ? ' estrella' : ' estrellas') + ' · ' + ETIQUETAS[n] + '">' + K.icono('estrella', 34) + '</button>');
        b.addEventListener('click', function () { elegir(n); });
        b.addEventListener('mouseenter', function () { pintar(n, true); });
        b.addEventListener('mouseleave', function () { pintar(elegido, false); });
        zona.appendChild(b);
        botones.push(b);
      })(i);
    }
    zona.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); elegir(Math.min(5, elegido + 1)); botones[elegido - 1].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); elegir(Math.max(1, elegido - 1)); botones[elegido - 1].focus(); }
    });

    function pintar(n, previo) {
      botones.forEach(function (b, i) { b.classList.toggle('kit-est__b--on', i < n); b.classList.toggle('kit-est__b--previo', !!previo && i < n); });
      et.textContent = n ? ETIQUETAS[n] : 'Toca las estrellas';
      et.className = 'kit-est__et' + (n ? ' kit-est__et--' + (n <= reabre ? 'malo' : (n <= pide ? 'aviso' : 'ok')) : '');
    }
    function elegir(n) {
      elegido = n;
      K.vibrar(6);
      botones.forEach(function (b, i) { b.setAttribute('aria-checked', String(i === n - 1)); b.tabIndex = (i === n - 1) ? 0 : -1; });
      pintar(n, false);
      si.disabled = false;
      com.classList.remove('kit-oculto');
      if (n <= reabre) {
        comT.textContent = 'Cuéntanos qué faltó (obligatorio): con ' + n + (n === 1 ? ' estrella' : ' estrellas') + ' el caso se vuelve a abrir';
        txt.placeholder = 'Qué sigue sin funcionar o qué no quedó claro';
        si.textContent = 'Calificar y reabrir';
      } else {
        comT.textContent = n <= pide ? '¿Qué podemos mejorar? (opcional)' : 'Un comentario (opcional)';
        txt.placeholder = n <= pide ? 'Lo que habría hecho mejor la atención' : '';
        si.textContent = 'Calificar';
      }
      marcar('');
    }
    function marcar(t) { err.textContent = t || ''; err.classList.toggle('kit-sop__error--on', !!t); }

    var cerrado = false;
    function fuera(r) {
      if (cerrado) return;
      cerrado = true;
      document.removeEventListener('keydown', tecla);
      hoja.remove();
      ABIERTA = null;
      if (alTerminar) alTerminar(r || null);
      setTimeout(siguiente, 450);
    }
    function tecla(e) { if (e.key === 'Escape') fuera(null); }
    document.addEventListener('keydown', tecla);
    hoja.querySelector('.kit-capa__x').addEventListener('click', function () { fuera(null); });
    hoja.querySelector('.kit-est__luego').addEventListener('click', function () { fuera(null); });
    hoja.querySelector('.kit-capa__velo').addEventListener('click', function () { fuera(null); });

    si.addEventListener('click', function () {
      var c = String(txt.value || '').trim();
      if (!elegido) return marcar('Escoge de 1 a 5 estrellas.');
      if (elegido <= reabre && c.length < 5) { txt.focus(); return marcar('Cuéntanos qué faltó para poder volver a abrir el caso.'); }
      marcar('');
      si.disabled = true;
      si.classList.add('kit-ocupado');
      K.pedir('soporteCalificar', { id: caso.id, estrellas: elegido, comentario: c }, { ms: 60000 })
        .then(function (r) {
          K.aviso(r && r.reabierto
            ? 'Volvimos a abrir el caso ' + caso.id + '. Soporte ya lo tiene con tu comentario.'
            : '¡Gracias! Calificaste el soporte ' + caso.id + ' con ' + elegido + (elegido === 1 ? ' estrella.' : ' estrellas.'), r && r.reabierto ? 'aviso' : 'ok', 6500);
          if (r && r.pendientes) pendientes({ pendientes: r.pendientes });
          fuera(r);
        }, function (e) {
          si.disabled = false;
          si.classList.remove('kit-ocupado');
          marcar((e && e.message) || 'No se pudo guardar la calificación. Intenta otra vez.');
        });
    });

    ABIERTA = hoja;
    document.body.appendChild(hoja);
    setTimeout(function () { if (botones[0]) botones[0].focus(); }, 80);
    return { cerrar: function () { fuera(null); } };
  }

  function nombreBonito(n) {
    return K.piezas.personas && K.piezas.personas.nombrePropio ? K.piezas.personas.nombrePropio(n) : dato(n);
  }

  /* ══════════════ 10.4 · MIS SOLICITUDES ══════════════ */

  var TONO = { PENDIENTE: 'aviso', 'EN PROCESO': 'info', RESUELTO: 'ok', REABIERTO: 'malo', CERRADO: 'nada' };
  var TEXTO_ESTADO = {
    PENDIENTE: 'Recibida: todavía no la atienden.',
    'EN PROCESO': 'La están atendiendo.',
    RESUELTO: 'Resuelta: falta que la califiques.',
    REABIERTO: 'La volviste a abrir: soporte ya tiene tu comentario.',
    CERRADO: 'Cerrada.'
  };

  function mias() {
    var hoja = K.nodo(
      '<div class="kit-capa kit-sop kit-capa--on" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-sop__hoja kit-mias">' +
      '    <header class="kit-capa__h">Mis solicitudes de soporte<button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button></header>' +
      '    <div class="kit-capa__cuerpo kit-sop__cuerpo"><div class="kit-mias__lista"></div></div>' +
      '    <footer class="kit-capa__pie">' +
      '      <button type="button" class="kit-btn kit-mias__nueva">' + K.icono('mas', 16) + ' Contar un problema</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-mias__ok">Listo</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    var lista = hoja.querySelector('.kit-mias__lista');
    function fuera() { document.removeEventListener('keydown', tecla); hoja.remove(); }
    function tecla(e) { if (e.key === 'Escape') fuera(); }
    document.addEventListener('keydown', tecla);
    hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);
    hoja.querySelector('.kit-mias__ok').addEventListener('click', fuera);
    hoja.querySelector('.kit-mias__nueva').addEventListener('click', function () { fuera(); abrir(); });
    document.body.appendChild(hoja);

    function cargar() {
      var p = K.pedir('soporteMios', {}, { ms: 45000 });
      var espera = K.piezas.esqueletos && K.piezas.esqueletos.mientras
        ? K.piezas.esqueletos.mientras(lista, p, { forma: 'ficha', cuantos: 2, espera: 'Trayendo tus solicitudes' })
        : p;
      espera.then(pintar, function (e) {
        lista.innerHTML = '';
        var b = K.nodo('<div class="kit-mias__vacio"><p></p><button type="button" class="kit-btn">Reintentar</button></div>');
        b.querySelector('p').textContent = (e && e.message) || 'No se pudieron traer tus solicitudes.';
        b.querySelector('button').addEventListener('click', cargar);
        lista.appendChild(b);
      });
    }
    function pintar(r) {
      r = r || {};
      lista.innerHTML = '';
      var l = r.lista || [];
      if (!l.length) {
        lista.appendChild(K.nodo('<div class="kit-mias__vacio">' + K.icono('comentario', 30) + '<p>Todavía no has pedido soporte. Cuando lo hagas, aquí ves en qué va y la respuesta.</p></div>'));
        return;
      }
      if (r.total > l.length) lista.appendChild(K.nodo('<p class="kit-mias__nota">Se muestran las ' + l.length + ' más recientes de ' + r.total + '.</p>'));
      l.forEach(function (x) {
        var t = K.nodo(
          '<article class="kit-mias__c">' +
          '  <div class="kit-mias__cab"><b></b><span class="kit-mias__est"></span></div>' +
          '  <small class="kit-mias__meta"></small>' +
          '  <p class="kit-mias__sol"></p>' +
          '</article>');
        t.querySelector('b').textContent = x.id;
        var est = t.querySelector('.kit-mias__est');
        est.textContent = x.estado;
        est.classList.add('kit-mias__est--' + (TONO[x.estado] || 'nada'));
        t.querySelector('.kit-mias__meta').textContent = [APP_T[x.app] || x.app, x.fecha, x.tipo && x.tipo !== 'SOLICITUD' ? x.tipo.toLowerCase() : ''].filter(Boolean).join(' · ');
        t.querySelector('.kit-mias__sol').textContent = x.solicitud;
        if (x.respuesta) {
          var rsp = K.nodo('<div class="kit-mias__resp"><span class="kit-sop__et">Respuesta</span><p></p><small></small></div>');
          rsp.querySelector('p').textContent = x.respuesta;
          rsp.querySelector('small').textContent = [x.respondidoPor ? nombreBonito(x.respondidoPor) : '', x.fechaRespuesta].filter(Boolean).join(' · ');
          t.appendChild(rsp);
        }
        var pie = K.nodo('<p class="kit-mias__pie"></p>');
        pie.textContent = TEXTO_ESTADO[x.estado] || '';
        if (x.estrellas) {
          pie.innerHTML = '';
          pie.appendChild(K.nodo(estrellasHtml(x.estrellas)));
          pie.appendChild(document.createTextNode(' ' + (x.comentario ? '“' + x.comentario + '”' : ETIQUETAS[x.estrellas])));
        }
        t.appendChild(pie);
        if (x.porCalificar) {
          var b = K.nodo('<button type="button" class="kit-btn kit-btn--marca kit-mias__cal">' + K.icono('estrella', 16) + ' Calificar</button>');
          b.addEventListener('click', function () {
            VISTOS[x.id] = 1;
            calificar(x, { reabreHasta: r.reabreHasta, comentarioHasta: r.comentarioHasta }, function (res) { if (res) cargar(); });
          });
          t.appendChild(b);
        }
        lista.appendChild(t);
      });
    }
    cargar();
    return { cerrar: fuera };
  }

  if (K.cuando) K.cuando('kit:soporte', pendientes);

  K.piezas.soporte = { abrir: abrir, contexto: contexto, calificar: calificar, pendientes: pendientes, mias: mias,
                       _cola: function () { return COLA.slice(); }, _vistos: function () { return VISTOS; } };
}());

