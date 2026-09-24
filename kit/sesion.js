/* ============================================================
   KIT-FLANDES · PIEZA 2 · LOGIN, CAMBIO Y RECUPERACIÓN
   La misma puerta para las 7 apps.

   Qué hace
     Pinta la pantalla de entrada, habla con el CORE (login, recuperar,
     cambiar clave, elegir contrato) y guarda la sesión. Lo que NO hace es
     decidir a qué vista entra el usuario: eso lo sabe la app.

   Cómo se usa

     KIT.piezas.sesion.entrar({
       titulo: 'CONTRATACIÓN',
       imagen: KIT.medio('img/contratacion.webp'),
       alEntrar: function (yo) { arrancarApp(yo); }
     });

     KIT.piezas.sesion.yo()       los datos de quien entró (o null)
     KIT.piezas.sesion.salir()    cierra y vuelve a la puerta

   Lo que se respeta del CORE (Fase 2)
     · El login va por POST, nunca por la URL: la contraseña no puede
       quedar en el historial del navegador ni en los registros de Google.
     · Cinco intentos y bloqueo de 15 minutos: el mensaje lo manda el CORE
       y aquí solo se muestra.
     · Un contratista con dos contratos recibe la lista y elige: sin eso,
       Contratación y Supervisión revisan la cuenta del contrato que no es.
     · "Olvidé mi contraseña" manda la clave al WhatsApp registrado. Aquí
       NO se muestra la clave ni se pide el correo.

   Por qué estas llamadas dicen app 'CORE' (21/09/2026, entrega 4.1)
     Entrar, elegir contrato, recuperar y cambiar la clave son rutas del
     CORE, no de cada app: en el Router viven como CORE.login, CORE.yo…
     Este archivo las pedía como CONTRATISTA.login y el CORE respondía
     "La app CONTRATISTA no tiene la accion login": la puerta no abría en
     NINGUNA de las siete. Por eso van con { app: 'CORE' } y llevan
     appDestino, que es lo que le dice al CORE a qué app se entra.

   Pareja: kit/sesion.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/sesion] falta kit.js'); } catch (e) {} return; }

  var YO_K = 'sesion.yo';
  var capa = null;
  var cfg = {};

  function yo() { return K.guardar.leer(YO_K, null); }
  function guardarYo(d) { if (d) K.guardar.escribir(YO_K, d); else K.guardar.borrar(YO_K); }

  function pintarPuerta() {
    capa = K.nodo(
      '<div class="kit-sesion">' +
      '  <div class="kit-sesion__caja">' +
      '    <div class="kit-sesion__marca">' +
      (cfg.imagen ? '<img class="kit-sesion__logo" src="' + K.esc(cfg.imagen) + '" alt="">' : '') +
      '      <h1 class="kit-sesion__t">' + K.esc(cfg.titulo || 'Alcaldía de Flandes') + '</h1>' +
      '      <p class="kit-sesion__sub">' + K.esc(cfg.sub || 'Ingresa con tu documento y contraseña') + '</p>' +
      '    </div>' +

      /* novalidate: los avisos los damos nosotros, en español y en el sitio
         donde el usuario está mirando. El globo del navegador sale en el
         idioma del sistema y desaparece al primer toque. */
      '    <form class="kit-sesion__form" autocomplete="on" novalidate>' +
      '      <label class="kit-sesion__campo">' +
      '        <span>Documento</span>' +
      '        <input name="documento" type="text" inputmode="numeric" autocomplete="username"' +
      '               required placeholder="Sin puntos ni comas">' +
      '      </label>' +
      '      <label class="kit-sesion__campo">' +
      '        <span>Contraseña</span>' +
      '        <div class="kit-sesion__clave">' +
      '          <input name="clave" type="password" autocomplete="current-password" required>' +
      '          <button type="button" class="kit-sesion__ojo" aria-label="Mostrar la contraseña">' + K.icono('ojo', 18) + '</button>' +
      '        </div>' +
      '      </label>' +
      '      <p class="kit-sesion__error" role="alert"></p>' +
      '      <button type="submit" class="kit-btn kit-btn--marca kit-sesion__entrar">Entrar</button>' +
      '      <button type="button" class="kit-btn kit-btn--plano kit-sesion__olvide">Olvidé mi contraseña</button>' +
      '    </form>' +

      '    <div class="kit-sesion__pie">' +
      '      <span>' + K.esc(cfg.pie || 'Alcaldía Municipal de Flandes') + '</span>' +
      '    </div>' +
      /* 4.7 · el pie de autoría va en TODAS las vistas, también en esta.
         Aquí todavía no hay sesión: se pinta con los textos por defecto y
         no se le cobra un viaje al servidor por dos líneas. */
      (K.piezas.creditos ? '    <footer class="kit-cred kit-sesion__cred">' + K.piezas.creditos.html() + '</footer>' : '') +
      '  </div>' +
      '</div>'
    );
    document.body.appendChild(capa);

    var form = capa.querySelector('.kit-sesion__form');
    var ojo = capa.querySelector('.kit-sesion__ojo');
    var campoClave = capa.querySelector('[name="clave"]');

    ojo.addEventListener('click', function () {
      var ver = campoClave.type === 'password';
      campoClave.type = ver ? 'text' : 'password';
      ojo.innerHTML = K.icono(ver ? 'ojo-tapado' : 'ojo', 18);
      ojo.setAttribute('aria-label', ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      /* 4.9 · el permiso de avisos se pide AQUÍ, dentro del toque de
         "Entrar" (como JHONNY-PERDOMO): es el único momento en que el
         navegador lo muestra seguro, y así no hace falta ninguna hoja. */
      if (K.piezas.avisos && K.piezas.avisos.pedirAlTocar &&
          String(form.documento.value || '').trim() && String(form.clave.value || '')) {
        K.piezas.avisos.pedirAlTocar();
      }
      intentar(form.documento.value, form.clave.value);
    });

    capa.querySelector('.kit-sesion__olvide').addEventListener('click', function () {
      olvide(form.documento.value);
    });

    /* el documento se recuerda; la contraseña NUNCA */
    var ultimo = K.guardar.leer('sesion.ultimoDocumento', '');
    if (ultimo) { form.documento.value = ultimo; campoClave.focus(); }
    else form.documento.focus();
  }

  function error(txt) {
    var p = capa && capa.querySelector('.kit-sesion__error');
    if (!p) return;
    p.textContent = txt || '';
    p.classList.toggle('kit-sesion__error--on', !!txt);
    if (txt) { K.sonar('sound/pay_fail.mp3'); K.vibrar([10, 50, 10]); }
  }

  function ocupado(si) {
    if (!capa) return;
    var b = capa.querySelector('.kit-sesion__entrar');
    b.disabled = si;
    b.classList.toggle('kit-ocupado', si);
    b.textContent = si ? 'Entrando…' : 'Entrar';
  }

  function intentar(documento, clave) {
    var doc = String(documento || '').replace(/[^\d]/g, '');
    if (!doc) return error('Escribe tu número de documento.');
    if (!String(clave || '')) return error('Escribe tu contraseña.');

    error('');
    ocupado(true);

    /* 7.0 · con arranqueEnLogin el CORE devuelve también el 'inicio' de la app en
       este mismo viaje (un viaje a Apps Script cuesta ~2 s de transporte). */
    var pide = { documento: doc, clave: clave, appDestino: K.app };
    if (cfg.arranqueEnLogin) pide.conArranque = true;
    K.pedir('login', pide, { sinToken: true, app: 'CORE' })
      .then(function (d) {
        K.guardar.escribir('sesion.ultimoDocumento', doc);

        /* varios contratos: el CORE devuelve la lista y hay que elegir */
        if (d && d.contratos && d.contratos.length > 1) {
          ocupado(false);
          elegirContrato(d);
          return;
        }
        terminar(d);
      })
      .catch(function (e) {
        ocupado(false);
        error(mensajeDe(e));
      });
  }

  function mensajeDe(e) {
    var c = (e && e.codigo) || '';
    if (c === 'SIN_RED') return 'No hay internet. Es tu conexión, no la aplicación.';
    if (c === 'TIEMPO') return 'El servidor tardó demasiado. Inténtalo otra vez.';
    if (c === 'RESPUESTA_NO_JSON') return 'La aplicación no pudo hablar con el servidor. Avísale a soporte.';
    return (e && e.message) || 'No se pudo entrar.';
  }

  function elegirContrato(d) {
    var lista = d.contratos;
    var hoja = K.nodo(
      '<div class="kit-capa kit-capa--on kit-sesion__elige" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja">' +
      '    <header class="kit-capa__h">Tienes más de un contrato</header>' +
      '    <div class="kit-capa__cuerpo">' +
      '      <p class="kit-sesion__aclara">Elige con cuál vas a trabajar. Todo lo que hagas quedará en ese contrato.</p>' +
      '      <ul class="kit-sesion__contratos"></ul>' +
      '    </div>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);

    var ul = hoja.querySelector('.kit-sesion__contratos');
    lista.forEach(function (c) {
      var li = K.nodo(
        '<li><button type="button" class="kit-sesion__contrato">' +
        '  <b>' + K.esc(c.idContrato || c.numero || '') + '</b>' +
        '  <span>' + K.esc(c.secretaria || '') + '</span>' +
        (c.supervisor ? '<small>Supervisa: ' + K.esc(c.supervisor) + '</small>' : '') +
        '</button></li>'
      );
      li.querySelector('button').addEventListener('click', function () {
        var b = li.querySelector('button');
        b.disabled = true;
        b.classList.add('kit-ocupado');
        K.pedir('elegirContrato', { token: d.token, idContrato: c.idContrato }, { sinToken: true, app: 'CORE' })
          .then(function (dd) {
            hoja.remove();
            terminar(dd);
          })
          .catch(function (e) {
            b.disabled = false;
            b.classList.remove('kit-ocupado');
            K.aviso(mensajeDe(e), 'malo', 5000);
          });
      });
      ul.appendChild(li);
    });
  }

  function terminar(d) {
    if (!d || !d.token) { error('El servidor no devolvió una sesión válida.'); return; }
    K.ponerToken(d.token);
    guardarYo(d.usuario || d.yo || d);
    K.sonar('sound/pay_success.mp3');
    K.vibrar(12);
    cerrarPuerta();
    K.disparar('kit:sesion', { entro: true, yo: yo() });

    /* 4.5: recién entrado hace falta el arranque de la app (contrato,
       avisos, listas, municipios). Si la app dio `comprobar`, se llama
       también aquí: así la pantalla de inicio se pinta con todo puesto y
       no con cuatro llamadas sueltas detrás. Si falla, se entra igual:
       cada vista sabe pedir lo suyo. */
    if (typeof cfg.comprobar === 'function') {
      /* 7.0: se le pasa la respuesta del login: si trae el arranque, no hay otro viaje */
      Promise.resolve(cfg.comprobar(d))
        .then(function (dd) { if (dd) guardarYo(dd.usuario || dd); })
        ['catch'](function () {})
        .then(function () { if (typeof cfg.alEntrar === 'function') cfg.alEntrar(yo()); });
      return;
    }
    if (typeof cfg.alEntrar === 'function') cfg.alEntrar(yo());
  }

  function cerrarPuerta() {
    if (!capa) return;
    capa.classList.add('kit-sesion--fuera');
    var c = capa;
    capa = null;
    setTimeout(function () { if (c.parentNode) c.remove(); }, 260);
  }

  /* ── olvidé mi contraseña ── */

  function olvide(documento) {
    var doc = String(documento || '').replace(/[^\d]/g, '');
    if (!doc) { error('Escribe primero tu documento y vuelve a tocar aquí.'); return; }

    var b = capa.querySelector('.kit-sesion__olvide');
    b.disabled = true;
    b.textContent = 'Enviando…';
    error('');

    K.pedir('recuperarClave', { documento: doc, appDestino: K.app }, { sinToken: true, app: 'CORE' })
      .then(function (d) {
        b.disabled = false;
        b.textContent = 'Olvidé mi contraseña';
        /* El CORE manda la clave por WhatsApp al número registrado. Aquí
           no se muestra ni se dice cuál es el número completo. */
        K.piezas.conexion
          ? K.piezas.conexion.rescate({
              icono: K.icono('telefono', 34),
              titulo: 'Te la mandamos por WhatsApp',
              texto: (d && d.telefono)
                ? 'La enviamos al número que termina en ' + K.esc(String(d.telefono).slice(-4)) + '.'
                : 'La enviamos al número que tienes registrado.',
              atajos: []
            })
          : K.aviso('Te mandamos la contraseña por WhatsApp.', 'ok', 5000);
      })
      .catch(function (e) {
        b.disabled = false;
        b.textContent = 'Olvidé mi contraseña';
        error(mensajeDe(e));
      });
  }

  /* ── cambiar la contraseña ── */

  function cambiarClave() {
    var hoja = K.nodo(
      '<div class="kit-capa kit-capa--on" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja">' +
      '    <header class="kit-capa__h">Cambiar mi contraseña<button type="button" class="kit-capa__x">' + K.icono('cerrar', 18) + '</button></header>' +
      '    <form class="kit-capa__cuerpo kit-sesion__form kit-sesion__form--modal">' +
      '      <label class="kit-sesion__campo"><span>Contraseña actual</span>' +
      '        <input name="actual" type="password" autocomplete="current-password" required></label>' +
      '      <label class="kit-sesion__campo"><span>Contraseña nueva</span>' +
      '        <input name="nueva" type="password" autocomplete="new-password" required minlength="6"></label>' +
      '      <label class="kit-sesion__campo"><span>Repite la nueva</span>' +
      '        <input name="otra" type="password" autocomplete="new-password" required minlength="6"></label>' +
      '      <p class="kit-sesion__error" role="alert"></p>' +
      '    </form>' +
      '    <footer class="kit-capa__pie">' +
      '      <button type="button" class="kit-btn kit-sesion__no">Cancelar</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-sesion__si">Cambiar</button>' +
      '    </footer>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(hoja);

    var form = hoja.querySelector('form');
    var err = hoja.querySelector('.kit-sesion__error');
    function fuera() { hoja.remove(); }
    function marcar(t) {
      err.textContent = t || '';
      err.classList.toggle('kit-sesion__error--on', !!t);
    }

    hoja.querySelector('.kit-capa__x').addEventListener('click', fuera);
    hoja.querySelector('.kit-sesion__no').addEventListener('click', fuera);
    hoja.querySelector('.kit-capa__velo').addEventListener('click', fuera);

    hoja.querySelector('.kit-sesion__si').addEventListener('click', function () {
      var b = this;
      if (form.nueva.value !== form.otra.value) return marcar('Las dos contraseñas nuevas no coinciden.');
      if (String(form.nueva.value).length < 6) return marcar('La contraseña nueva debe tener al menos 6 caracteres.');
      if (form.nueva.value === form.actual.value) return marcar('La contraseña nueva tiene que ser distinta de la actual.');

      marcar('');
      b.disabled = true;
      b.classList.add('kit-ocupado');
      K.pedir('cambiarClave', { actual: form.actual.value, nueva: form.nueva.value }, { app: 'CORE' })
        .then(function () {
          fuera();
          K.aviso('Tu contraseña quedó cambiada.', 'ok', 4000);
        })
        .catch(function (e) {
          b.disabled = false;
          b.classList.remove('kit-ocupado');
          marcar(mensajeDe(e));
        });
    });
  }

  /* ── entrada y salida ── */

  function entrar(opciones) {
    cfg = opciones || {};

    /* ¿ya hay sesión guardada? se comprueba contra el CORE antes de
       dejar pasar: un token viejo no sirve y el usuario se enteraría
       tarde, a mitad de un guardado */
    if (K.token()) {
      /*
       * 4.5 · UNA LLAMADA, NO DOS.
       *
       * Aquí se pedía 'yo' solo para comprobar que el token seguía vivo, y
       * acto seguido la app pedía 'inicio', que YA devuelve el usuario. Eran
       * dos viajes a Apps Script, y cada viaje cuesta entre dos y tres
       * segundos de transporte aunque el servidor conteste en cincuenta
       * milisegundos. Si la app pasa `comprobar`, esa función hace el viaje
       * y devuelve el usuario; si no lo pasa, se sigue pidiendo 'yo' como
       * siempre, que es lo que hacen las otras seis apps.
       */
      var comprobacion = (typeof cfg.comprobar === 'function')
        ? Promise.resolve(cfg.comprobar())
        : K.pedir('yo', {}, { app: 'CORE' });

      return comprobacion
        .then(function (d) {
          guardarYo(d && (d.usuario || d) || null);
          K.disparar('kit:sesion', { entro: true, yo: yo() });
          if (typeof cfg.alEntrar === 'function') cfg.alEntrar(yo());
          return yo();
        })
        .catch(function () {
          K.ponerToken(''); guardarYo(null);
          pintarPuerta();
          return null;
        });
    }
    pintarPuerta();
    return Promise.resolve(null);
  }

  function salir(callado) {
    K.ponerToken('');
    guardarYo(null);
    K.disparar('kit:sesion', { entro: false });
    if (!callado) K.aviso('Cerraste la sesión.', 'info');
    if (typeof cfg.alSalir === 'function') cfg.alSalir();
    else pintarPuerta();
  }

  K.piezas.sesion = {
    entrar: entrar, salir: salir, yo: yo,
    cambiarClave: cambiarClave, olvide: olvide,
    puertaAbierta: function () { return !!capa; }
  };
}());
