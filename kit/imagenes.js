/* ============================================================
   KIT-FLANDES · PIEZA 21 · PREPARAR IMÁGENES ANTES DE SUBIRLAS

   Por qué existe
     La pieza 6 (adjuntos) entrega el archivo tal cual lo dio el teléfono.
     Para un PDF eso está bien; para una foto, no:

       · Un iPhone guarda en HEIC. Windows y el navegador del supervisor no
         lo abren. La evidencia queda subida y, en la práctica, invisible.
       · Una foto de cámara pesa entre 4 y 12 MB. En base64 crece un tercio
         más, y el POST a Apps Script se cae sin decir por qué.
       · Las fotos de teléfono llevan la orientación en los datos EXIF. Al
         dibujarlas en un lienzo sin mirar eso, salen acostadas.

     La app vieja ya convertía todo a JPEG y reducía el lado mayor a 1.600
     px. Eso no se podía perder, así que aquí está, y como pieza del kit lo
     heredan las siete apps.

   Lo que añade sobre la app vieja
     Cuando la evidencia son varias fotos, la app vieja le pedía a la
     persona que se armara un collage por su cuenta, porque la hoja guarda
     una sola imagen por obligación. Aquí el collage se arma solo.

   Cómo se usa

     KIT.piezas.imagenes.preparar(archivo).then(function (r) {
       r.dataUrl   // 'data:image/jpeg;base64,...' listo para el CORE
       r.ancho, r.alto, r.pesoKB, r.origen
     });

     KIT.piezas.imagenes.collage([a, b, c]).then(...)   // una sola imagen

   Pareja: no tiene CSS. No dibuja nada.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/imagenes] falta kit.js'); } catch (e) {} return; }

  var LADO_MAYOR = 1600;   /* lo mismo que hacía la app vieja */
  var TOPE_KB = 900;       /* por encima de esto el POST empieza a sufrir */
  var CALIDADES = [0.82, 0.72, 0.62, 0.5];
  var SEPARACION = 12;     /* franja entre fotos del collage */

  /* ── leer el archivo ── */

  /**
   * Un mapa de bits a partir del archivo.
   *
   * createImageBitmap con imageOrientation 'from-image' aplica el EXIF solo
   * y es mucho más rápido, pero no está en todos los navegadores ni acepta
   * siempre la opción; por eso hay respaldo con <img>, que en los
   * navegadores de hoy también respeta la orientación al dibujar.
   */
  function aMapa(archivo) {
    if (window.createImageBitmap) {
      try {
        return createImageBitmap(archivo, { imageOrientation: 'from-image' })
          ['catch'](function () { return createImageBitmap(archivo); })
          ['catch'](function () { return porEtiqueta(archivo); });
      } catch (e) { /* sigue por etiqueta */ }
    }
    return porEtiqueta(archivo);
  }

  function porEtiqueta(archivo) {
    return new Promise(function (listo, falla) {
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); listo(img); };
      img.onerror = function () { URL.revokeObjectURL(url); falla(noSeAbre(archivo)); };
      img.src = url;
    });
  }

  /**
   * El aviso cuando el navegador no sabe abrir la foto.
   *
   * Casi siempre es un HEIC en un computador. Decir "formato no soportado"
   * no le sirve a nadie; se dice qué hacer. En el iPhone el propio sistema
   * entrega JPEG al elegir la foto desde el navegador, así que este caso se
   * ve sobre todo cuando alguien pasa el archivo del teléfono al PC.
   */
  function noSeAbre(archivo) {
    var n = String((archivo && archivo.name) || '').toLowerCase();
    if (/\.(heic|heif)$/.test(n)) {
      return new Error('Esa foto está en formato HEIC y este equipo no lo abre. ' +
                       'Ábrela en el teléfono y compártela como JPG, o vuelve a ' +
                       'tomarla desde la app.');
    }
    return new Error('No se pudo leer esa imagen. Intenta con otra foto.');
  }

  /* ── medidas ── */

  function medida(m) {
    return { w: m.width || m.naturalWidth || 0, h: m.height || m.naturalHeight || 0 };
  }

  function cabe(w, h) {
    var mayor = Math.max(w, h);
    if (mayor <= LADO_MAYOR) return { w: w, h: h };
    var f = LADO_MAYOR / mayor;
    return { w: Math.round(w * f), h: Math.round(h * f) };
  }

  function lienzo(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    /* Fondo blanco: un PNG con transparencia pasado a JPEG deja los huecos
       en negro, y una planilla escaneada se vuelve ilegible. */
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    return { c: c, g: g };
  }

  /**
   * De lienzo a JPEG, bajando la calidad hasta que quepa.
   * Se prueba de mejor a peor y se para en la primera que entra: así la foto
   * pequeña conserva su calidad y solo se castiga a la que de verdad pesa.
   */
  function aJpeg(canvas) {
    for (var i = 0; i < CALIDADES.length; i++) {
      var url = canvas.toDataURL('image/jpeg', CALIDADES[i]);
      if (pesoKB(url) <= TOPE_KB || i === CALIDADES.length - 1) {
        return { dataUrl: url, calidad: CALIDADES[i], pesoKB: pesoKB(url) };
      }
    }
    return null;
  }

  function pesoKB(dataUrl) {
    var coma = dataUrl.indexOf(',');
    var crudo = coma > 0 ? dataUrl.length - coma - 1 : dataUrl.length;
    return Math.round(crudo * 0.75 / 1024);
  }

  /* ── lo que se usa desde fuera ── */

  /** Una foto lista para subir: JPEG, derecha, y como mucho de 1.600 px. */
  function preparar(archivo) {
    if (!archivo) return Promise.reject(new Error('No llegó ninguna imagen.'));
    if (archivo.type && archivo.type.indexOf('image/') !== 0 &&
        !/\.(heic|heif)$/i.test(archivo.name || '')) {
      return Promise.reject(new Error('Eso no es una imagen. La evidencia es una foto.'));
    }

    return Promise.resolve(aMapa(archivo)).then(function (mapa) {
      var m = medida(mapa);
      if (!m.w || !m.h) throw noSeAbre(archivo);
      var d = cabe(m.w, m.h);
      var l = lienzo(d.w, d.h);
      l.g.drawImage(mapa, 0, 0, d.w, d.h);
      if (mapa.close) try { mapa.close(); } catch (e) {}

      var r = aJpeg(l.c);
      return {
        dataUrl: r.dataUrl, ancho: d.w, alto: d.h,
        pesoKB: r.pesoKB, calidad: r.calidad,
        origen: { ancho: m.w, alto: m.h, pesoKB: Math.round((archivo.size || 0) / 1024) }
      };
    });
  }

  /**
   * Varias fotos en una sola imagen, una debajo de otra.
   *
   * La hoja guarda UNA evidencia por obligación. Antes eso significaba que
   * quien tenía tres soportes tenía que montarse el collage a mano en el
   * teléfono; muchos acababan subiendo solo uno. Se apilan en vertical
   * porque las evidencias suelen ser capturas de pantalla o planillas, que
   * se leen mejor a lo ancho completo.
   */
  function collage(archivos) {
    var lista = [].slice.call(archivos || []);
    if (!lista.length) return Promise.reject(new Error('No llegó ninguna imagen.'));
    if (lista.length === 1) return preparar(lista[0]);

    return Promise.all(lista.map(function (a) { return aMapa(a); })).then(function (mapas) {
      var ancho = 0, alto = 0, i;
      var medidas = mapas.map(function (m) { return medida(m); });

      for (i = 0; i < medidas.length; i++) ancho = Math.max(ancho, medidas[i].w);
      ancho = Math.min(ancho, LADO_MAYOR);

      var escaladas = medidas.map(function (m) {
        var f = ancho / m.w;
        return { w: ancho, h: Math.max(1, Math.round(m.h * f)) };
      });
      for (i = 0; i < escaladas.length; i++) alto += escaladas[i].h;
      alto += SEPARACION * (escaladas.length - 1);

      /* Si el apilado se pasa de largo, se encoge todo por igual: mejor una
         tira un poco más pequeña que una imagen que el CORE no admite. */
      var f = alto > LADO_MAYOR * 2 ? (LADO_MAYOR * 2) / alto : 1;
      var l = lienzo(Math.round(ancho * f), Math.round(alto * f));

      var y = 0;
      for (i = 0; i < mapas.length; i++) {
        var w = Math.round(escaladas[i].w * f), h = Math.round(escaladas[i].h * f);
        l.g.drawImage(mapas[i], 0, y, w, h);
        y += h + Math.round(SEPARACION * f);
        if (mapas[i].close) try { mapas[i].close(); } catch (e) {}
      }

      var r = aJpeg(l.c);
      return {
        dataUrl: r.dataUrl, ancho: l.c.width, alto: l.c.height,
        pesoKB: r.pesoKB, calidad: r.calidad, juntadas: mapas.length,
        origen: { ancho: ancho, alto: alto, pesoKB: 0 }
      };
    });
  }

  K.piezas.imagenes = {
    preparar: preparar,
    collage: collage,
    ladoMayor: LADO_MAYOR,
    topeKB: TOPE_KB
  };
}());
