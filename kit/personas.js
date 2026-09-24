/* ============================================================
   KIT-FLANDES · PIEZA 25 · PERSONAS (caras de quien atiende)
   Fase 4, entrega 4.9

   Qué resuelve
     El contratista ve nombres de gente de las otras apps: quien le
     reviso la cuenta, quien la aprobo en Contratacion, quien hizo la
     orden en Contabilidad o el egreso en Tesoreria, quien firma un
     comunicado, quien atiende su solicitud a Comunicaciones. Un nombre suelto
     no dice nada; una cara si. Y si esa persona todavia no tiene foto,
     un circulo con sus INICIALES, nunca un icono gris vacio.

   De donde salen las fotos
     El CORE manda en el arranque un mapa pequeño (unas 40 personas):
       { 'OLGA ALCENDRA': { n: 'OLGA ALCENDRA', f: 'https://drive...thumbnail', a: 'CONTABILIDAD' } }
     Esta pieza lo guarda y resuelve cualquier nombre SIN volver al
     servidor. La comparacion es sin tildes ni mayusculas, y para
     emparejar la Ñ cuenta como N (ver clave(): las hojas no coinciden).

   Cómo se usa
     KIT.piezas.personas.cargar(mapa)                 // en el arranque
     KIT.piezas.personas.avatar('YESICA ALFARO')      // elemento <span>
     KIT.piezas.personas.avatar('X', { tam: 44, foto: 'url' })
     KIT.piezas.personas.chip('OLGA ALCENDRA', 'Hizo la orden de pago')
     KIT.piezas.personas.foto('OLGA ALCENDRA')        // url o ''
     KIT.miniDrive(url, 256)                          // enlace de Drive → miniatura

   Tocar una cara con foto la abre en grande (visor del kit, con zoom).

   Pareja: kit/personas.css
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/personas] falta kit.js'); } catch (e) {} return; }

  var MAPA = {};
  var LLAVE = 'personas.mapa';

  /* Cualquier forma de enlace de Drive → la miniatura que <img> sí pinta.
     Un /view dentro de <img> no carga nunca: es una página, no una imagen. */
  function miniDrive(url, ancho) {
    var s = String(url || '').trim();
    if (!s) return '';
    if (/drive\.google\.com\/thumbnail/.test(s)) {
      return ancho ? s.replace(/([?&]sz=)w\d+/, '$1w' + ancho) : s;
    }
    var m = s.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]{15,})/);
    var id = m ? m[1] : (/^[a-zA-Z0-9_-]{25,}$/.test(s) ? s : '');
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (ancho || 256);
    return /^(https?:|data:image\/)/.test(s) ? s : '';
  }
  K.miniDrive = miniDrive;

  /* Para EMPAREJAR nombres la Ñ se pliega a N: el CORE ya entrega las
     llaves así (FC_norm) y SUPERVISORES escribe "SANCHEZ PEÑA" donde
     USUARIOS dice "SANCHEZ PENA" (medido el 22/09). Con 40 personas no hay
     dos que se confundan por eso; K.norm sigue intacto para lo demás. */
  function clave(nombre) { return K.norm(String(nombre || '')).replace(/Ñ/g, 'N'); }

  function cargar(mapa) {
    if (!mapa || typeof mapa !== 'object') {
      MAPA = K.guardar.leer(LLAVE, {}) || {};
      return;
    }
    MAPA = {};
    Object.keys(mapa).forEach(function (k) { MAPA[clave(k)] = mapa[k]; });
    K.guardar.escribir(LLAVE, MAPA);
  }

  function de(nombre) { return MAPA[clave(nombre)] || null; }
  function foto(nombre) { var p = de(nombre); return p && p.f ? p.f : ''; }

  function iniciales(nombre) {
    var p = String(nombre || '').trim().split(/\s+/).filter(function (x) { return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(x); });
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    /* nombre + primer apellido: en "YULI ALEXANDRA MORALES" son Y y M */
    var ap = p.length >= 3 ? p[p.length - 2] : p[1];
    if (p.length === 3) ap = p[2];
    return (p[0].charAt(0) + ap.charAt(0)).toUpperCase();
  }

  /* Un color estable por persona: la misma cara, el mismo tono, siempre. */
  var TONOS = [152, 200, 28, 265, 340, 180, 45, 220, 120, 300];
  function tono(nombre) {
    var s = clave(nombre), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return TONOS[h % TONOS.length];
  }

  /**
   * avatar(nombre, { tam, foto, clase, sinZoom })
   * foto: si se pasa, manda sobre la del mapa (la mía, por ejemplo).
   */
  function avatar(nombre, o) {
    o = o || {};
    var tam = o.tam || 36;
    var url = miniDrive(o.foto !== undefined ? o.foto : foto(nombre), tam > 96 ? 512 : 200);
    var el = K.nodo('<span class="kit-av' + (o.clase ? ' ' + o.clase : '') + '" role="img"></span>');
    el.setAttribute('aria-label', String(nombre || 'Sin nombre'));
    el.style.setProperty('--kit-av-tam', tam + 'px');
    el.style.setProperty('--kit-av-tono', tono(nombre));
    var ini = K.nodo('<b class="kit-av__ini" aria-hidden="true"></b>');
    ini.textContent = iniciales(nombre);
    el.appendChild(ini);
    if (url) {
      var img = K.nodo('<img class="kit-av__img" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">');
      /* si Drive no la da (archivo borrado, sin permiso), quedan las
         iniciales, que ya estaban debajo: nunca una imagen rota */
      img.addEventListener('error', function () { img.remove(); el.classList.remove('kit-av--foto'); });
      img.addEventListener('load', function () { el.classList.add('kit-av--foto'); });
      img.src = url;
      el.appendChild(img);
      if (!o.sinZoom && K.piezas.visor) {
        el.classList.add('kit-av--toca');
        el.setAttribute('tabindex', '0');
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          ev.preventDefault();
          K.piezas.visor.abrir([{ titulo: nombrePropio(nombre), url: miniDrive(url, 1000), tipo: 'imagen' }]);
        });
      }
    }
    return el;
  }

  /** Cara + nombre + qué hizo. Para las líneas de "quién atendió". */
  function chip(nombre, que, o) {
    o = o || {};
    var c = K.nodo('<span class="kit-av-chip"><span class="kit-av-chip__txt"><b></b><small></small></span></span>');
    c.querySelector('b').textContent = nombrePropio(nombre);
    var p = de(nombre);
    var sub = que || (p && p.a ? AREA[p.a] || p.a : '');
    if (sub) c.querySelector('small').textContent = sub;
    else c.querySelector('small').remove();
    c.insertBefore(avatar(nombre, { tam: o.tam || 30, foto: o.foto }), c.firstChild);
    return c;
  }

  var AREA = {
    CONTRATACION: 'Contratación', SUPERVISION: 'Supervisión', CONTABILIDAD: 'Contabilidad',
    TESORERIA: 'Tesorería', COMUNICACIONES: 'Comunicaciones', ADMIN: 'Administración',
    /* Fase 9: la app PRENSA se llama COMUNICACIONES; por si llega el nombre viejo */
    PRENSA: 'Comunicaciones'
  };

  function nombrePropio(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(.-])([a-záéíóúñü])/g,
      function (t, a, l) { return a + l.toUpperCase(); });
  }

  cargar(null);   /* lo guardado en el teléfono, hasta que llegue el arranque */

  K.piezas.personas = {
    cargar: cargar, avatar: avatar, chip: chip, foto: foto, de: de,
    iniciales: iniciales, nombrePropio: nombrePropio,
    _mapa: function () { return MAPA; }
  };
}());
