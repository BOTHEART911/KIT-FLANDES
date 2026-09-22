/* ============================================================
   KIT-FLANDES · CONFIRMAR (pieza 25)
   Fase 4 · entrega 4.4

   El problema que resuelve
     La app vieja, antes de guardar los datos del contrato o los datos
     personales, enseñaba un "Resumen de Cambios" con dos botones:
     Confirmar y Editar. No era adorno: son formularios de veinte campos
     donde un dedazo en el número de cuenta o en el RP se descubre semanas
     después, cuando el pago se devuelve. Al pasar la app al kit esa
     pantalla se había quedado por el camino, y lo único que había era el
     window.confirm del navegador, que no puede enseñar una lista y sale
     en el idioma del sistema.

   Qué hace
     Una capa con el título, la lista de lo que va a cambiar y dos
     botones. Devuelve una promesa que se resuelve con true o false.

   Cómo se usa

     KIT.piezas.confirmar.abrir({
       titulo: 'Resumen de cambios',
       lista: [ ['RP', '2026000049'], ['Régimen', 'NO pertenezco…'] ],
       si: 'Confirmar',
       no: 'Editar'
     }).then(function (ok) { if (ok) guardar(); });

     También acepta `texto` en vez de `lista` para una pregunta suelta.

   Se cierra con Escape y tocando el velo: las dos cuentan como "no".
   ============================================================ */

(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/confirmar] falta kit.js'); } catch (e) {} return; }

  var capa = null;
  var resolver = null;

  function cerrar(respuesta) {
    if (!capa) return;
    /* El nodo se guarda EN LA VARIABLE LOCAL antes del temporizador.
       Con la variable del módulo pasaba esto: si se abría una segunda capa
       antes de los 200 ms, el temporizador de la primera borraba la
       SEGUNDA, que ya era la que estaba en `capa`. Lo cazó la prueba de
       abrir dos veces seguidas. */
    var vieja = capa;
    capa = null;
    vieja.classList.remove('kit-capa--on');
    var r = resolver;
    resolver = null;
    /* Se espera la transición para que no desaparezca de golpe. */
    setTimeout(function () { vieja.remove(); }, 200);
    if (r) r(!!respuesta);
  }

  function abrir(o) {
    o = o || {};
    /* Si ya había una abierta, la anterior se responde "no": dejar dos
       promesas vivas es la forma de que una de las dos no termine nunca. */
    if (resolver) cerrar(false);

    var cuerpo;
    if (o.lista && o.lista.length) {
      cuerpo = '<ul class="kit-conf__lista">' + o.lista.map(function (par) {
        var etiqueta = (par && par.length) ? par[0] : '';
        var valor = (par && par.length > 1) ? par[1] : '';
        return '<li><span>' + K.esc(etiqueta) + '</span><b>' + K.esc(valor) + '</b></li>';
      }).join('') + '</ul>';
    } else {
      cuerpo = '<p class="kit-conf__texto">' + K.esc(o.texto || '¿Seguimos?') + '</p>';
    }

    var hoja = K.nodo(
      '<div class="kit-capa kit-conf" role="dialog" aria-modal="true">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-conf__hoja">' +
      '    <header class="kit-capa__h">' + K.esc(o.titulo || 'Resumen de cambios') +
      '      <button type="button" class="kit-capa__x" aria-label="Cerrar">' +
             (K.icono ? K.icono('cerrar', 18) : '') + '</button>' +
      '    </header>' +
      '    <div class="kit-capa__cuerpo">' + cuerpo +
      (o.nota ? '<p class="kit-conf__nota">' + K.esc(o.nota) + '</p>' : '') +
      '    </div>' +
      '    <div class="kit-capa__pie kit-conf__pie">' +
      '      <button type="button" class="kit-btn kit-btn--plano kit-conf__no">' +
             K.esc(o.no || 'Editar') + '</button>' +
      '      <button type="button" class="kit-btn kit-btn--marca kit-conf__si">' +
             K.esc(o.si || 'Confirmar') + '</button>' +
      '    </div>' +
      '  </section>' +
      '</div>'
    );
    capa = hoja;
    document.body.appendChild(hoja);

    hoja.querySelector('.kit-conf__si').addEventListener('click', function () { cerrar(true); });
    hoja.querySelector('.kit-conf__no').addEventListener('click', function () { cerrar(false); });
    hoja.querySelector('.kit-capa__x').addEventListener('click', function () { cerrar(false); });
    hoja.querySelector('.kit-capa__velo').addEventListener('click', function () { cerrar(false); });

    var conEscape = function (ev) {
      if (ev.key === 'Escape') { document.removeEventListener('keydown', conEscape); cerrar(false); }
    };
    document.addEventListener('keydown', conEscape);

    /* El foco va al botón de confirmar, no al de editar: es la acción que
       la persona viene a hacer. */
    setTimeout(function () {
      /* la suya, no la que esté puesta en ese momento */
      if (capa !== hoja) return;
      hoja.classList.add('kit-capa--on');
      try { hoja.querySelector('.kit-conf__si').focus(); } catch (e) {}
    }, 10);

    return new Promise(function (res) { resolver = res; });
  }

  K.piezas.confirmar = { abrir: abrir, cerrar: function () { cerrar(false); } };
}());
