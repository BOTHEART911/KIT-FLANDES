/* ============================================================
   KIT-FLANDES · PIEZA 26 · FOTO DE PERFIL
   Fase 4, entrega 4.9

   Qué hace
     Subir, recortar (arrastrar + zoom con dos dedos, rueda o barra),
     girar, cambiar y quitar la foto de perfil. Como en SEP-GROUP, pero
     con un paso que alla no existe: el RECORTE en el telefono. Alla la
     foto viaja entera (una foto de celular pesa 3 a 6 MB) y la cara sale
     donde caiga. Aqui sale un cuadrado de 512 px (~60 KB) con la cara
     centrada donde la persona la puso.

   La misma foto en las siete apps
     El CORE la guarda por DOCUMENTO en todas las filas de la persona
     (CONTRATISTAS, USUARIOS y SUPERVISORES). Por eso esta pieza no
     sabe de apps: la usa igual Contratista que Supervision o Admin.

   Cómo se usa
     KIT.piezas.perfil.abrir({ nombre, foto, alCambiar: function (r) {} })
       r = { url, foto, mini }   (foto vacia si la quito)
     KIT.piezas.perfil.cara(nombre, foto, { tam: 72 })  → boton con camarita

   Depende de: kit.js · personas.js (avatar) · guardado.js · confirmar.js
   Pareja: kit/personas.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/perfil] falta kit.js'); } catch (e) {} return; }

  var SALIDA = 512;          /* px del cuadrado que se sube */
  var CALIDAD = 0.88;
  var LADO_MAX = 2048;       /* lo que se guarda en memoria para recortar */
  var ZOOM_MAX = 4;

  function P() { return K.piezas.personas; }

  /* ══════════════ la hoja de perfil ══════════════ */

  function abrir(o) {
    o = o || {};
    var estado = { foto: o.foto || '' };

    var capa = K.nodo(
      '<div class="kit-capa kit-perfil" role="dialog" aria-modal="true" aria-label="Foto de perfil">' +
      '  <div class="kit-capa__velo"></div>' +
      '  <section class="kit-capa__hoja kit-perfil__hoja">' +
      '    <header class="kit-capa__h"><span>Foto de perfil</span>' +
      '      <button type="button" class="kit-capa__x" aria-label="Cerrar">' + K.icono('cerrar', 18) + '</button></header>' +
      '    <div class="kit-capa__cuerpo kit-perfil__cuerpo"></div>' +
      '  </section>' +
      '</div>'
    );
    document.body.appendChild(capa);
    requestAnimationFrame(function () { capa.classList.add('kit-capa--on'); });
    var cuerpo = capa.querySelector('.kit-perfil__cuerpo');

    var input = K.nodo('<input type="file" accept="image/*" class="kit-perfil__archivo" tabindex="-1" aria-hidden="true">');
    capa.appendChild(input);

    function cerrar() {
      capa.classList.remove('kit-capa--on');
      setTimeout(function () { if (capa.parentNode) capa.remove(); }, 220);
    }
    capa.querySelector('.kit-capa__x').addEventListener('click', cerrar);
    capa.querySelector('.kit-capa__velo').addEventListener('click', cerrar);

    function inicio() {
      cuerpo.innerHTML = '';
      var cara = P().avatar(o.nombre, { tam: 132, foto: estado.foto, sinZoom: !estado.foto });
      var envol = K.nodo('<div class="kit-perfil__cara"></div>');
      envol.appendChild(cara);
      cuerpo.appendChild(envol);
      cuerpo.appendChild(K.nodo('<p class="kit-perfil__nombre">' + K.esc(P().nombrePropio(o.nombre)) + '</p>'));
      cuerpo.appendChild(K.nodo('<p class="kit-perfil__nota">' + (estado.foto
        ? 'Tócala para verla en grande. Es la misma en todas las apps de la Alcaldía.'
        : 'Sin foto, se ven tus iniciales. La foto que subas la ven en Supervisión, Contratación, Contabilidad, Tesorería, Prensa y Administración.') +
        '</p>'));

      var acc = K.nodo('<div class="kit-perfil__acciones"></div>');
      var subir = K.nodo('<button type="button" class="kit-btn kit-btn--marca">' + K.icono('camara', 17) + ' ' +
        (estado.foto ? 'Cambiar foto' : 'Subir foto') + '</button>');
      subir.addEventListener('click', function () { input.value = ''; input.click(); });
      acc.appendChild(subir);

      if (estado.foto) {
        var quitar = K.nodo('<button type="button" class="kit-btn kit-btn--plano">' + K.icono('basura', 17) + ' Quitar</button>');
        quitar.addEventListener('click', function () { pedirQuitar(); });
        acc.appendChild(quitar);
      }
      cuerpo.appendChild(acc);
    }

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name || '')) {
        K.aviso('Elige una imagen (JPG, PNG o WebP).', 'malo', 4000);
        return;
      }
      leer(f).then(function (fuente) { recortar(fuente); })
        ['catch'](function () {
          K.aviso('No pudimos abrir esa imagen. Si es de iPhone (HEIC), tómale captura o elige otra.', 'malo', 6000);
        });
    });

    /* ---------- el recorte ---------- */

    function recortar(fuente) {
      cuerpo.innerHTML = '';
      var r = K.nodo(
        '<div class="kit-recorte">' +
        '  <div class="kit-recorte__marco" aria-label="Arrastra para mover la foto">' +
        '    <canvas class="kit-recorte__img"></canvas>' +
        '    <div class="kit-recorte__mascara"></div>' +
        '  </div>' +
        '  <label class="kit-recorte__zoom">' + K.icono('menos', 16) +
        '    <input type="range" min="1" max="' + ZOOM_MAX + '" step="0.01" value="1" aria-label="Acercar o alejar">' +
             K.icono('mas', 16) + '</label>' +
        '  <p class="kit-recorte__pista">Arrastra para centrar tu cara. Acerca con dos dedos, con la rueda o con la barra.</p>' +
        '  <div class="kit-recorte__botones">' +
        '    <button type="button" class="kit-btn kit-btn--plano kit-recorte__girar">' + K.icono('girar', 16) + ' Girar</button>' +
        '    <button type="button" class="kit-btn kit-btn--plano kit-recorte__otra">Elegir otra</button>' +
        '    <button type="button" class="kit-btn kit-btn--marca kit-recorte__listo">' + K.icono('check', 16) + ' Guardar foto</button>' +
        '  </div>' +
        '</div>'
      );
      cuerpo.appendChild(r);

      var marco = r.querySelector('.kit-recorte__marco');
      var lienzo = r.querySelector('.kit-recorte__img');
      var barra = r.querySelector('input[type="range"]');
      var E = new Encuadre(marco, lienzo, fuente, function (z) { barra.value = String(z); });

      barra.addEventListener('input', function () { E.zoomA(parseFloat(barra.value) || 1); });
      r.querySelector('.kit-recorte__girar').addEventListener('click', function () { E.girar(); barra.value = '1'; });
      r.querySelector('.kit-recorte__otra').addEventListener('click', function () { input.value = ''; input.click(); });
      r.querySelector('.kit-recorte__listo').addEventListener('click', function () {
        var dataUrl = E.exportar();
        guardar(dataUrl);
      });
    }

    function guardar(dataUrl) {
      var G = K.piezas.guardado;
      if (G) G.abrir({ titulo: 'Guardando tu foto', sub: 'La vas a ver en todas las apps de la Alcaldía.' });
      K.pedir('fotoPerfilGuardar', { imagen: dataUrl })
        .then(function (res) {
          estado.foto = res.foto || res.mini || '';
          if (G) G.listo({ sub: 'Tu foto quedó puesta.' });
          avisar(res);
          inicio();
        })
        ['catch'](function (e) {
          if (G) G.fallo();
          K.aviso(e && e.message ? e.message : 'No se pudo guardar la foto.', 'malo', 6000);
        });
    }

    function pedirQuitar() {
      var C = K.piezas.confirmar;
      var pregunta = C && C.preguntar ? C.preguntar({
        titulo: '¿Quitar tu foto?', texto: 'En todas las apps se verán tus iniciales en su lugar.',
        si: 'Quitar foto', no: 'Dejarla'
      }) : Promise.resolve(true);
      pregunta.then(function (ok) {
        if (!ok) return;
        var G = K.piezas.guardado;
        if (G) G.abrir({ titulo: 'Quitando tu foto' });
        K.pedir('fotoPerfilQuitar', {})
          .then(function (res) {
            estado.foto = '';
            if (G) G.listo({ sub: 'Listo.' });
            avisar(res || { foto: '', mini: '', url: '' });
            inicio();
          })
          ['catch'](function (e) {
            if (G) G.fallo();
            K.aviso(e && e.message ? e.message : 'No se pudo quitar la foto.', 'malo', 6000);
          });
      });
    }

    function avisar(res) {
      K.disparar('kit:foto', { foto: res.foto || '', mini: res.mini || '', url: res.url || '' });
      if (typeof o.alCambiar === 'function') { try { o.alCambiar(res); } catch (e) {} }
    }

    inicio();
    return { cerrar: cerrar };
  }

  /* ══════════════ leer la imagen ══════════════ */

  function leer(archivo) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        try {
          /* se reduce a 2048 de lado: una foto de 12 MP en un canvas se
             come la memoria de un Android modesto y el recorte se traba */
          var w = img.naturalWidth, h = img.naturalHeight;
          var f = Math.min(1, LADO_MAX / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * f));
          c.height = Math.max(1, Math.round(h * f));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          ok(c);
        } catch (e) { URL.revokeObjectURL(url); mal(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('no carga')); };
      img.src = url;
    });
  }

  /* ══════════════ el encuadre ══════════════
     La imagen siempre CUBRE el cuadrado: no se puede dejar un hueco negro
     a un lado (la foto saldria con una franja en las siete apps). */

  function Encuadre(marco, lienzo, fuente, alZoom) {
    this.marco = marco;
    this.lienzo = lienzo;
    this.alZoom = alZoom || function () {};
    this.poner(fuente);
    this.gestos();
  }

  Encuadre.prototype.lado = function () { return this.marco.clientWidth || 300; };

  Encuadre.prototype.poner = function (fuente) {
    this.fuente = fuente;
    this.lienzo.width = fuente.width;
    this.lienzo.height = fuente.height;
    this.lienzo.getContext('2d').drawImage(fuente, 0, 0);
    var S = this.lado();
    this.base = Math.max(S / fuente.width, S / fuente.height);
    this.zoom = 1;
    this.x = (S - fuente.width * this.base) / 2;
    this.y = (S - fuente.height * this.base) / 2;
    this.pintar();
    this.alZoom(1);
  };

  Encuadre.prototype.escala = function () { return this.base * this.zoom; };

  Encuadre.prototype.acotar = function () {
    var S = this.lado(), s = this.escala();
    var w = this.fuente.width * s, h = this.fuente.height * s;
    this.x = Math.min(0, Math.max(S - w, this.x));
    this.y = Math.min(0, Math.max(S - h, this.y));
  };

  Encuadre.prototype.pintar = function () {
    this.acotar();
    var s = this.escala();
    this.lienzo.style.transform = 'translate(' + this.x + 'px,' + this.y + 'px) scale(' + s + ')';
  };

  /** Zoom manteniendo quieto el punto (cx, cy) del marco. Por defecto, el centro. */
  Encuadre.prototype.zoomA = function (z, cx, cy) {
    var S = this.lado();
    if (cx === undefined) { cx = S / 2; cy = S / 2; }
    z = Math.max(1, Math.min(ZOOM_MAX, z));
    var s0 = this.escala();
    var px = (cx - this.x) / s0, py = (cy - this.y) / s0;   /* punto de la imagen bajo el dedo */
    this.zoom = z;
    var s1 = this.escala();
    this.x = cx - px * s1;
    this.y = cy - py * s1;
    this.pintar();
    this.alZoom(this.zoom);
  };

  Encuadre.prototype.girar = function () {
    var f = this.fuente, c = document.createElement('canvas');
    c.width = f.height; c.height = f.width;
    var g = c.getContext('2d');
    g.translate(c.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(f, 0, 0);
    this.poner(c);
  };

  Encuadre.prototype.gestos = function () {
    var yo = this, dedos = {}, ultimo = null, distancia0 = 0, zoom0 = 1;
    var m = this.marco;

    function punto(e) {
      var r = m.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function lista() { return Object.keys(dedos).map(function (k) { return dedos[k]; }); }

    m.addEventListener('pointerdown', function (e) {
      try { m.setPointerCapture(e.pointerId); } catch (x) {}
      dedos[e.pointerId] = punto(e);
      var l = lista();
      if (l.length === 2) {
        distancia0 = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y) || 1;
        zoom0 = yo.zoom;
      }
      ultimo = punto(e);
    });
    m.addEventListener('pointermove', function (e) {
      if (!dedos[e.pointerId]) return;
      var p = punto(e);
      dedos[e.pointerId] = p;
      var l = lista();
      if (l.length >= 2) {
        var d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
        yo.zoomA(zoom0 * d / distancia0, (l[0].x + l[1].x) / 2, (l[0].y + l[1].y) / 2);
      } else if (ultimo) {
        yo.x += p.x - ultimo.x;
        yo.y += p.y - ultimo.y;
        yo.pintar();
      }
      ultimo = p;
    });
    function fuera(e) {
      delete dedos[e.pointerId];
      var l = lista();
      ultimo = l.length ? l[0] : null;
      if (l.length < 2) distancia0 = 0;
    }
    m.addEventListener('pointerup', fuera);
    m.addEventListener('pointercancel', fuera);
    m.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = punto(e);
      yo.zoomA(yo.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y);
    }, { passive: false });
  };

  /** El cuadrado que se sube: exactamente lo que se ve dentro del marco. */
  Encuadre.prototype.exportar = function () {
    var S = this.lado(), s = this.escala();
    var c = document.createElement('canvas');
    c.width = SALIDA; c.height = SALIDA;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff';                 /* un PNG con transparencia no sale negro */
    g.fillRect(0, 0, SALIDA, SALIDA);
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.fuente, -this.x / s, -this.y / s, S / s, S / s, 0, 0, SALIDA, SALIDA);
    return c.toDataURL('image/jpeg', CALIDAD);
  };

  /* ══════════════ la cara tocable (inicio) ══════════════ */

  function cara(nombre, foto, o) {
    o = o || {};
    var b = K.nodo('<button type="button" class="kit-perfil-cara" aria-label="Tu foto de perfil"></button>');
    b.appendChild(P().avatar(nombre, { tam: o.tam || 64, foto: foto, sinZoom: true }));
    b.appendChild(K.nodo('<span class="kit-perfil-cara__cam" aria-hidden="true">' + K.icono('camara', 14) + '</span>'));
    b.addEventListener('click', function () {
      K.vibrar(8);
      abrir({ nombre: nombre, foto: o.fotoActual ? o.fotoActual() : foto, alCambiar: o.alCambiar });
    });
    return b;
  }

  K.piezas.perfil = { abrir: abrir, cara: cara, _Encuadre: Encuadre, _leer: leer };
}());
