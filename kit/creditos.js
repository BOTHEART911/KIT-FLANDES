/* ============================================================
   KIT-FLANDES · CRÉDITOS
   El pie de autoría de las 7 apps.

   Por qué es una pieza y no una línea de HTML en cada app
     Hoy "GOBIERNO DIGITAL" está escrito a mano en 15 sitios repartidos por
     los seis repos. Cambiarlo obliga a tocar seis proyectos y a acordarse
     de todos. Aquí se escribe una vez, el texto sale de la configuración
     del CORE, y cambiarlo mañana es cambiar una celda de la hoja.

   Se dibuja con texto, no con una imagen
     Una imagen se ve borrosa en pantallas de mucha densidad, pesa, no se
     puede seleccionar ni leer con un lector de pantalla, y hace falta una
     versión distinta para el modo oscuro. El texto no tiene ninguno de
     esos problemas.

   Cómo se usa

     KIT.piezas.creditos.montar('#pie');       donde se quiera
     KIT.piezas.creditos.montar();             al final del <body>

     KIT.piezas.creditos.html()                por si hace falta dentro de
                                               otro contenido (un modal)

   De dónde salen los textos
     De las llaves públicas `MARCA_AUTOR` y `MARCA_AUTOR_FRASE` de CONFIG.
     Mientras no lleguen, se usan los valores de abajo, para que el pie
     nunca salga vacío ni con un hueco a medio pintar.

   Pareja: kit/creditos.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/creditos] falta kit.js'); } catch (e) {} return; }

  var POR_DEFECTO = {
    autor: 'Oscar Polania',
    frase: 'Experto en soluciones digitales'
  };

  var cache = null;

  function textos() {
    if (cache) return Promise.resolve(cache);
    /* la config pública ya viene cacheada por el CORE: esto no cuesta un
       viaje nuevo en la práctica */
    /* app 'CORE': la configuración es una ruta del CORE, no de cada app.
       Sin esto el CORE responde "La app CONTRATISTA no tiene la accion
       config" y el pie se queda con los valores de respaldo para siempre. */
    return K.pedir('config', {}, { sinToken: true, app: 'CORE' })
      .then(function (c) {
        cache = {
          autor: (c && c.MARCA_AUTOR) || POR_DEFECTO.autor,
          frase: (c && c.MARCA_AUTOR_FRASE) || POR_DEFECTO.frase
        };
        return cache;
      })
      .catch(function () { return POR_DEFECTO; });
  }

  function html(t) {
    t = t || POR_DEFECTO;
    return '<p class="kit-cred__cop">Copyright ©</p>' +
           '<p class="kit-cred__autor">' + K.esc(t.autor) + '</p>' +
           '<p class="kit-cred__frase">' + K.esc(t.frase) + '</p>';
  }

  /**
   * montar(destino, {anio:true}) → el elemento del pie.
   * Pinta de inmediato con los valores por defecto y se corrige sola si la
   * configuración trae otros: así no hay un hueco mientras llega.
   */
  function montar(destino, opciones) {
    opciones = opciones || {};
    var caja = destino
      ? (typeof destino === 'string' ? K.$(destino) : destino)
      : document.body;
    if (!caja) return null;

    var pie = K.nodo('<footer class="kit-cred"></footer>');
    pie.innerHTML = html(POR_DEFECTO);
    if (opciones.anio) {
      pie.querySelector('.kit-cred__cop').textContent =
        'Copyright © ' + new Date().getFullYear();
    }
    caja.appendChild(pie);

    textos().then(function (t) {
      pie.innerHTML = html(t);
      if (opciones.anio) {
        pie.querySelector('.kit-cred__cop').textContent =
          'Copyright © ' + new Date().getFullYear();
      }
    });

    return pie;
  }

  K.piezas.creditos = {
    montar: montar, html: html, textos: textos, porDefecto: POR_DEFECTO,
    /* Los textos se guardan en memoria tras la primera lectura: el pie sale
       en todas las vistas y no tiene sentido preguntar cada vez. Esto los
       vuelve a pedir, para cuando cambien desde ADMIN sin recargar. */
    olvidar: function () { cache = null; }
  };
}());
