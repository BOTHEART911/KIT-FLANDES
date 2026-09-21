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
     · Si la app ya está instalada (no tiene nada que ofrecer).
     · Si la persona ya eligió una vez (se recuerda en este aparato).
     · Si la app se abrió desde un aviso o con un destino concreto en la
       dirección: ahí la persona va a algo, no a mirar una portada.

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

  function yaEligio() { return K.guardar.leer(VISTA_K, false) === true; }
  function recordar() { K.guardar.escribir(VISTA_K, true); }
  function olvidar() { K.guardar.borrar(VISTA_K); }

  function instalada() {
    return !!(K.piezas.instalar && K.piezas.instalar.instalada());
  }

  /** ¿Tiene sentido enseñarla ahora mismo? */
  function procede(opciones) {
    var o = opciones || {};
    if (o.forzar) return true;
    if (instalada()) return false;
    if (yaEligio()) return false;
    /* Venir con destino en la dirección es ir a algo concreto (un aviso
       tocado, un enlace compartido): no se le cruza una portada. */
    if (String(location.hash || '').replace(/^#\/?/, '')) return false;
    return true;
  }

  function abrir(opciones) {
    var o = opciones || {};
    if (!procede(o)) return Promise.resolve('saltada');

    return new Promise(function (resolver) {
      var esIOS = !!(K.piezas.avisos && K.piezas.avisos.esIOS && K.piezas.avisos.esIOS());

      var capa = K.nodo(
        '<div class="kit-bien" role="dialog" aria-modal="true" aria-label="Bienvenida">' +
        '  <div class="kit-bien__aurora" aria-hidden="true"></div>' +
        '  <div class="kit-bien__caja">' +
        '    <div class="kit-bien__escudo">' +
        (o.imagen ? '<img src="' + K.esc(o.imagen) + '" alt="">' : '') +
        '    </div>' +
        '    <h1 class="kit-bien__t">' + K.esc(o.titulo || 'Alcaldía de Flandes') + '</h1>' +
        '    <p class="kit-bien__sub">' + K.esc(o.sub || '') + '</p>' +
        '    <div class="kit-bien__ventajas">' +
        '      <span class="kit-bien__v">Entra de un toque</span>' +
        '      <span class="kit-bien__v">Recibe avisos</span>' +
        '    </div>' +
        '    <div class="kit-bien__botones">' +
        '      <button type="button" class="kit-btn kit-btn--marca kit-bien__instalar">' +
        '        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
        '          <path d="M12 3v11m0 0l-4-4m4 4l4-4M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '        </svg>' +
        '        <span>' + (esIOS ? 'Añadir a mi pantalla' : 'Instalar la aplicación') + '</span>' +
        '      </button>' +
        '      <button type="button" class="kit-btn kit-btn--plano kit-bien__seguir">Continuar en el navegador</button>' +
        '    </div>' +
        '    <p class="kit-bien__pie">Puedes instalarla más tarde desde el menú de tu perfil.</p>' +
        '  </div>' +
        '</div>'
      );

      document.body.appendChild(capa);
      document.documentElement.classList.add('kit-bien-abierta');
      requestAnimationFrame(function () { capa.classList.add('kit-bien--on'); });

      function cerrar(salida) {
        recordar();
        capa.classList.remove('kit-bien--on');
        document.documentElement.classList.remove('kit-bien-abierta');
        setTimeout(function () { if (capa.parentNode) capa.remove(); }, 260);
        resolver(salida);
      }

      capa.querySelector('.kit-bien__instalar').addEventListener('click', function () {
        K.vibrar(10);
        if (!K.piezas.instalar) { cerrar('navegador'); return; }
        /* La pieza de instalar ya distingue los cuatro casos: aviso del
           navegador, iPhone por Compartir, ya instalada y navegador que no
           puede. Aquí no se repite esa lógica. */
        K.piezas.instalar.abrir().then(function (r) {
          cerrar(r === 'instalada' || r === 'ok' ? 'instalada' : 'navegador');
        })['catch'](function () { cerrar('navegador'); });
      });

      capa.querySelector('.kit-bien__seguir').addEventListener('click', function () {
        K.vibrar(6);
        cerrar('navegador');
      });
    });
  }

  K.piezas.bienvenida = {
    abrir: abrir, procede: procede, olvidar: olvidar, yaEligio: yaEligio
  };
}());
