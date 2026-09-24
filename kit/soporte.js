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

  K.piezas.soporte = { abrir: abrir, contexto: contexto };
}());
