/* ============================================================
   KIT-FLANDES · PIEZA 20 · PUERTA DE BIENVENIDA
   Fase 4, entrega 4.1.1 · una sola copia en los 7 fronts.

   Qué hace
     Lo primero que ve alguien que abre el enlace: el escudo de la app y
     dos caminos claros — instalarla o seguir en el navegador. Nada de
     esconder la instalación detrás de un menú.

   Por qué existe
     En las apps viejas el botón de instalar aparecía "a veces", porque
     dependía de que el navegador mandara su aviso. Quien abría el enlace
     en el móvil se quedaba en la pestaña para siempre y nunca llegaba a
     tener la app en su pantalla de inicio — y sin instalar, en iPhone,
     tampoco hay avisos.

   Cuándo NO sale
     · Si la app ya está corriendo INSTALADA (no tiene nada que ofrecer).
     · Si la app se abrió desde un aviso o con un destino concreto en la
       dirección: ahí la persona va a algo, no a mirar una portada.

   Por qué NO se recuerda que "ya eligió" (corregido en la 4.1.3)
     La primera versión guardaba en el aparato que la persona ya había
     visto la puerta y no volvía a salir nunca más. Es exactamente el
     fallo que JHONNY-PERDOMO ya había cazado y quitado a propósito de su
     código: quien entró una vez por el navegador se quedaba sin la vista
     de instalar para siempre. Ahora sale SIEMPRE que se entra desde el
     navegador, y lo único que la salta es que la app ya venga instalada.

   Cómo se usa

     KIT.piezas.bienvenida.abrir({
       titulo: 'Contratista',
       sub: 'Alcaldía de Flandes',
       imagen: KIT.medio('img/contratista.webp')
     }).then(function (salida) {
       // 'instalada' | 'navegador' | 'saltada'
       arrancarLaApp();
     });

     KIT.piezas.bienvenida.olvidar();   // para volver a verla (pruebas)

   Pareja: kit/bienvenida.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/bienvenida] falta kit.js'); } catch (e) {} return; }

  var VISTA_K = 'bienvenida.vista';

  /* La marca de la 4.1.1 se borra al arrancar: los aparatos que ya la
     tienen guardada volverían a quedarse sin puerta para siempre. */
  try { K.guardar.borrar(VISTA_K); } catch (e) {}

  function olvidar() { K.guardar.borrar(VISTA_K); }

  function instalada() {
    return !!(K.piezas.instalar && K.piezas.instalar.instalada());
  }

  function yaSeInstalo() {
    return !!(K.piezas.instalar && K.piezas.instalar.yaSeInstalo && K.piezas.instalar.yaSeInstalo());
  }

  /** ¿Tiene sentido enseñarla ahora mismo? */
  function procede(opciones) {
    var o = opciones || {};
    if (o.forzar) return true;
    /* Si YA se está usando la aplicación instalada, esta pantalla no pinta
       nada: la persona está dentro de lo que se le iba a ofrecer. */
    if (instalada()) return false;
    /* Venir con destino en la dirección es ir a algo concreto (un aviso
       tocado, un enlace compartido): no se le cruza una portada. */
    if (String(location.hash || '').replace(/^#\/?/, '')) return false;
    return true;
  }

  function abrir(opciones) {
    var o = opciones || {};
    if (!procede(o)) return Promise.resolve('saltada');

    return new Promise(function (resolver) {
      /* El rótulo lo dicta la pieza de instalar, que es la que sabe en qué
         aparato estamos. Chrome puede tardar en mandar su aviso, así que
         el botón se vuelve a rotular si llega tarde. */
      function rotulo() {
        return (K.piezas.instalar && K.piezas.instalar.etiqueta)
          ? K.piezas.instalar.etiqueta()
          : 'Instalar la aplicación';
      }

      function pista() {
        return (K.piezas.instalar && K.piezas.instalar.pista) ? K.piezas.instalar.pista() : '';
      }

      var capa = K.nodo(
        '<div class="kit-bien" role="dialog" aria-modal="true" aria-label="Bienvenida">' +
        '  <div class="kit-bien__aurora" aria-hidden="true"></div>' +
        /* 4.5: tres burbujas que suben despacio por detrás. Es lo único que
           se mueve solo; el resto del movimiento cuelga de lo que hace la
           persona, que es como debe ser. */
        '  <div class="kit-bien__burbujas" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '  <div class="kit-bien__caja">' +
        '    <div class="kit-bien__escudo">' +
        '      <span class="kit-bien__aro" aria-hidden="true"></span>' +
        (o.imagen ? '<img src="' + K.esc(o.imagen) + '" alt="">' : '') +
        '      <span class="kit-bien__sello" aria-hidden="true">' + (K.icono ? K.icono('check', 20) : '') + '</span>' +
        '    </div>' +
        '    <h1 class="kit-bien__t">' + K.esc(o.titulo || 'Alcaldía de Flandes') + '</h1>' +
        '    <p class="kit-bien__sub">' + K.esc(o.sub || '') + '</p>' +
        '    <div class="kit-bien__ventajas">' +
        '      <span class="kit-bien__v">Entra de un toque</span>' +
        '      <span class="kit-bien__v">Recibe avisos</span>' +
        '      <span class="kit-bien__v">Sin buscar el enlace</span>' +
        '    </div>' +
        '    <div class="kit-bien__botones">' +
        '      <button type="button" class="kit-btn kit-btn--marca kit-bien__instalar">' +
        '        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
        '          <path d="M12 3v11m0 0l-4-4m4 4l4-4M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '        </svg>' +
        '        <span class="kit-bien__rot">' + K.esc(rotulo()) + '</span>' +
        '      </button>' +
        '      <button type="button" class="kit-btn kit-btn--plano kit-bien__seguir">Continuar en el navegador</button>' +
        '    </div>' +
        '    <p class="kit-bien__pista"></p>' +
        '    <p class="kit-bien__pie">Puedes instalarla más tarde desde el menú de tu perfil.</p>' +
        /* 4.6.1 · la firma también va aquí. Es la PRIMERA pantalla que ve
           quien abre el enlace, y era la única de la app sin el pie de
           autoría. Se pinta con los valores por defecto y no se pide la
           configuración: esta pantalla sale antes de que haya sesión, y no
           se le va a cobrar un viaje al servidor a la portada. */
        '    <footer class="kit-cred kit-bien__cred">' +
        (K.piezas.creditos ? K.piezas.creditos.html() : '') +
        '    </footer>' +
        '  </div>' +
        '</div>'
      );

      document.body.appendChild(capa);
      document.documentElement.classList.add('kit-bien-abierta');
      requestAnimationFrame(function () { capa.classList.add('kit-bien--on'); });

      /**
       * 4.5 · LA VISTA SE TRANSFORMA, NO AVISA.
       *
       * Si la aplicación ya está instalada en este aparato, esta pantalla
       * deja de ofrecer lo que la persona ya tiene: cambia el título, el
       * texto, pone un sello verde sobre el escudo y RETIRA el botón de
       * instalar. Se vuelve a pintar sola cuando llega el aviso del
       * navegador o cuando la persona acaba de instalarla, sin recargar.
       */
      function repintar() {
        var tiene = yaSeInstalo();
        capa.classList.toggle('kit-bien--instalada', tiene);

        var bInst = capa.querySelector('.kit-bien__instalar');
        var bSeguir = capa.querySelector('.kit-bien__seguir');
        var t = capa.querySelector('.kit-bien__t');
        var sub = capa.querySelector('.kit-bien__sub');
        var pie = capa.querySelector('.kit-bien__pie');
        var lin = capa.querySelector('.kit-bien__pista');

        if (tiene) {
          bInst.remove();                       /* se RETIRA, no se esconde */
          /* y las ventajas también: son el argumento para instalarla, y a
             quien ya la tiene instalada se le estaría vendiendo lo suyo. */
          var vent = capa.querySelector('.kit-bien__ventajas');
          if (vent) vent.remove();
          bSeguir.classList.remove('kit-btn--plano');
          bSeguir.classList.add('kit-btn--marca');
          bSeguir.textContent = 'Seguir aquí por ahora';
          t.textContent = 'Ya la tienes instalada';
          sub.textContent = 'Busca la app en el escritorio de tu dispositivo';
          lin.textContent = 'Desde el icono abre más rápido y te llegan los avisos.';
          pie.textContent = '¿No la encuentras? Búscala con el nombre ' + ((window.MARCA && window.MARCA.TITULO) || 'de la app') + '.';
          return;
        }

        capa.querySelector('.kit-bien__rot').textContent = rotulo();
        lin.textContent = pista();
      }

      repintar();
      /* mientras la portada esté abierta, atenta a lo que diga el navegador */
      K.cuando('kit:instalar', repintar);

      function cerrar(salida) {
        capa.classList.remove('kit-bien--on');
        document.documentElement.classList.remove('kit-bien-abierta');
        setTimeout(function () { if (capa.parentNode) capa.remove(); }, 260);
        resolver(salida);
      }

      capa.addEventListener('click', function (ev) {
        var inst = ev.target.closest ? ev.target.closest('.kit-bien__instalar') : null;
        var seg = ev.target.closest ? ev.target.closest('.kit-bien__seguir') : null;

        if (inst) {
          K.vibrar(10);
          inst.classList.add('kit-bien__instalar--yendo');
          if (!K.piezas.instalar) { cerrar('navegador'); return; }
          /* La pieza de instalar ya distingue los ocho casos: aviso del
             navegador, iPhone por Compartir, ya instalada y navegador que no
             puede. Aquí no se repite esa lógica. */
          K.piezas.instalar.abrir().then(function (r) {
            cerrar(r === 'instalada' || r === 'ok' ? 'instalada' : 'navegador');
          })['catch'](function () { cerrar('navegador'); });
          return;
        }
        if (seg) { K.vibrar(6); cerrar('navegador'); }
      });
    });
  }

  K.piezas.bienvenida = {
    abrir: abrir, procede: procede, olvidar: olvidar
  };
}());
