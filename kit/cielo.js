/* ============================================================
   KIT-FLANDES · PIEZA 22 · EL CIELO
   Fase 4, entrega 4.6.1 · una sola copia en los 7 fronts.

   Qué hace
     Le mete a un elemento el fondo vivo de la portada de bienvenida: la
     aurora que respira por detrás y las burbujas que suben. Nada más.

   Por qué es una pieza y no CSS suelto
     Porque hacen falta nodos (las burbujas son elementos, no se pueden
     pintar con un solo pseudo-elemento sin renunciar a que cada una lleve
     su tamaño y su ritmo). Ponerlos a mano en cada vista obligaría a
     acordarse del orden y del z-index en siete sitios distintos.

   Cómo se usa

     KIT.piezas.cielo.poner('.saludo');                 // con burbujas
     KIT.piezas.cielo.poner(nodo, { burbujas: 3, luz: 'suave', franja: true });
     KIT.piezas.cielo.soloFondo('.kit-banner');         // sin nodos
     KIT.piezas.cielo.quitar(nodo);

   Opciones
     burbujas  cuántas suben (0 a 4). Por defecto 3.
     luz       'suave' baja la aurora, para franjas pequeñas.
     franja    true en barras bajitas: burbujas más chicas.

   CUÁL DE LAS DOS  (4.6.2, y esto me costó una entrega)
     poner()     mete nodos dentro. SOLO para contenedores de contenido
                 llano: una franja con textos, una portada.
     soloFondo() no mete nada: pinta la luz en el fondo del propio elemento.
                 Es la que hay que usar en una barra FIJA o en cualquier
                 sitio que tenga dentro un menú desplegable.

     Se la puse a la barra de arriba, que es position:fixed, y pasaron dos
     cosas: el `relative` la sacó de su sitio —se fue con el scroll y dejó
     un hueco blanco arriba, porque el body reserva su alto— y el
     `isolation:isolate` atrapó el menú del perfil dentro de la barra, así
     que salía POR DETRÁS de las tarjetas.
     Una pieza de adorno JAMÁS puede cambiar la posición ni el apilado de lo
     que decora. Ahora no lo hace.

   Es idempotente: llamarla dos veces sobre lo mismo no duplica nada, así
   que se puede invocar cada vez que se repinta una vista sin llevar la
   cuenta.

   Pareja: kit/cielo.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/cielo] falta kit.js'); } catch (e) {} return; }

  function poner(destino, opciones) {
    var el = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!el) return null;
    opciones = opciones || {};

    /* ya lo tiene: se deja como está y no se pinta otra vez */
    if (el.querySelector(':scope > .kit-cielo__capa')) return el;

    var cuantas = opciones.burbujas === undefined ? 3 : Number(opciones.burbujas);
    if (!(cuantas >= 0)) cuantas = 3;
    if (cuantas > 4) cuantas = 4;

    el.classList.add('kit-cielo');
    /* La posición solo se toca si NO tenía ninguna. Pisar un fixed o un
       sticky le cambia el sitio al elemento, y eso no es cosa del adorno. */
    var pos = '';
    try { pos = window.getComputedStyle(el).position; } catch (e) { pos = 'static'; }
    if (pos === 'static') el.classList.add('kit-cielo--relativo');
    if (opciones.luz === 'suave') el.classList.add('kit-cielo--suave');
    if (opciones.franja) el.classList.add('kit-cielo--franja');

    var burbujas = '';
    for (var i = 0; i < cuantas; i++) burbujas += '<i></i>';

    var capa = K.nodo(
      '<div class="kit-cielo__capa" aria-hidden="true">' +
      '  <div class="kit-cielo__aurora"></div>' +
      (cuantas ? '  <div class="kit-cielo__burbujas">' + burbujas + '</div>' : '') +
      '</div>'
    );

    /* SIEMPRE el primero: lo que ya estaba pintado se queda encima sin que
       haya que tocarle el z-index a nada. */
    el.insertBefore(capa, el.firstChild);
    return el;
  }

  /**
   * La versión sin nodos: pinta la luz en el fondo del propio elemento.
   * No toca la posición, no crea contexto de apilado, no mete hijos. Es la
   * que va en una barra fija o en cualquier sitio con menús dentro.
   */
  function soloFondo(destino) {
    var el = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!el) return null;
    el.classList.add('kit-cielo-fondo');
    return el;
  }

  function quitar(destino) {
    var el = (typeof destino === 'string') ? K.$(destino) : destino;
    if (!el) return;
    var capa = el.querySelector(':scope > .kit-cielo__capa');
    if (capa) capa.remove();
    el.classList.remove('kit-cielo', 'kit-cielo--relativo', 'kit-cielo--suave',
                        'kit-cielo--franja', 'kit-cielo-fondo');
  }

  K.piezas.cielo = { poner: poner, soloFondo: soloFondo, quitar: quitar };
}());
