/* ============================================================
   KIT-FLANDES · HUELLAS DE LAS EVIDENCIAS (02/11/2026)

   Para qué
     Saber si una evidencia ya se presentó en una cuenta anterior del mismo
     contrato (aunque salte cuentas: la de la cuenta 3 en la 6).

       · Imagen: el teléfono recomprime cada foto, así que dos copias de la
         misma foto nunca tienen los mismos bytes. Se compara su FORMA, en
         dos niveles (calibrado con 6.216 fotos reales del 02/11):
           1. Parecida: h64 (dHash 9×8, 64 bits) y la REJILLA de brillos
              normalizados 8×8 (64 hex). Mismo cálculo que el CORE (Huellas1102.gs)
              con la miniatura de 256 px de Drive. La misma foto por los dos
              caminos: d64 0–3, rejilla 0,0–0,22; fotos distintas: rejilla ≥ 0,9.
           2. Igual: a esa escala, dos capturas del MISMO formulario con otros
              datos se ven iguales. Por eso «Igual» se confirma comparando los
              archivos de verdad (512 px, bloques de 16): la misma imagen vuelta
              a subir no pasa de 20 en ningún bloque; otra captura, sí.
       · Adjunto (PDF/Word/Excel): huella exacta (md5), la misma que Drive
         guarda como md5Checksum.

   Rendimiento
     · Una foto: < 15 ms (se mide sobre la imagen ya preparada).
     · md5 de un adjunto de 10 MB: ~60 ms. Ningún viaje al servidor.
     · «Igual» trae de Drive (directo, con la llave, por la cola del visor)
       solo las imágenes que ya salieron parecidas: casi nunca más de 2.

   Cómo se usa
     H.deFuente(canvas|img|bitmap)      → {v:3, h64, h256}
     H.deArchivo(File)                  → Promise {v:3, h64, h256}
     H.md5(File|ArrayBuffer)            → Promise 'hex'
     H.parecida(a, b, umbral)           → true si a esa escala son la misma
     H.fino(fuenteA, fuenteB)           → {peor, igual} comparando los píxeles
     H.confirmar(fuente|id, id)         → Promise {igual, peor} (trae de Drive)
     H.indice(d)                        → índice de las cuentas anteriores
                                           (respuesta de revisionAnterior /
                                           actividadesAnteriores con ev:1)
     H.buscar(indice, {h64,h256}|{md5}) → [{informe, obl, id}] parecidas (la más reciente primero)
   ============================================================ */
(function () {
  'use strict';
  var K = window.KIT;
  if (!K) return;

  var MINI = 512;   /* ancho de trabajo (la rejilla es un promedio por cajas: da igual que la miniatura de 256 de Drive) */
  var UMBRAL = { h64: 8, mad: 0.5, fino: 20 };   /* el CORE manda el suyo (d.evid.umbral) */

  /* ── el algoritmo (IGUAL en el CORE) ── */
  function grilla(g, w, h, cols, rows) {
    var out = new Array(cols * rows);
    for (var cy = 0; cy < rows; cy++) {
      var y0 = Math.floor(cy * h / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / rows));
      for (var cx = 0; cx < cols; cx++) {
        var x0 = Math.floor(cx * w / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cols));
        var s = 0, n = 0;
        for (var y = y0; y < y1 && y < h; y++) for (var x = x0; x < x1 && x < w; x++) { s += g[y * w + x]; n++; }
        out[cy * cols + cx] = n ? s / n : 0;
      }
    }
    return out;
  }
  function dhash(g, w, h, cols, rows) {
    var a = grilla(g, w, h, cols, rows), hex = '', nib = 0, k = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols - 1; x++) {
        nib = (nib << 1) | (a[y * cols + x] > a[y * cols + x + 1] ? 1 : 0);
        if (++k === 4) { hex += nib.toString(16); nib = 0; k = 0; }
      }
    }
    return hex;
  }
  /** Rejilla 8×8 normalizada (media 0, desviación 1) en 16 niveles: 64 hex. */
  function rejilla(g, w, h) {
    var a = grilla(g, w, h, 8, 8), n = a.length, m = 0, s = 0, i;
    for (i = 0; i < n; i++) m += a[i];
    m /= n;
    for (i = 0; i < n; i++) s += (a[i] - m) * (a[i] - m);
    s = Math.sqrt(s / n) || 1;
    var hex = '';
    for (i = 0; i < n; i++) { var q = Math.round((a[i] - m) / s * 2) + 8; q = q < 0 ? 0 : q > 15 ? 15 : q; hex += q.toString(16); }
    return hex;
  }
  function huellas(g, w, h) { return { v: 3, h64: dhash(g, w, h, 9, 8), h256: rejilla(g, w, h) }; }
  function mad(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a.length !== 64 || b.length !== 64) return -1;
    var s = 0;
    for (var i = 0; i < 64; i++) s += Math.abs(parseInt(a.charAt(i), 16) - parseInt(b.charAt(i), 16));
    return s / 64;
  }

  var POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  function dist(a, b) {
    a = String(a || ''); b = String(b || '');
    if (!a || a.length !== b.length) return -1;
    var d = 0;
    for (var i = 0; i < a.length; i++) d += POP[parseInt(a.charAt(i), 16) ^ parseInt(b.charAt(i), 16)];
    return d;
  }
  function parecida(x, y, um) {
    um = um || UMBRAL;
    if (!x || !y) return false;
    var d1 = dist(x.h64, y.h64);
    if (d1 < 0 || d1 > (um.h64 || UMBRAL.h64)) return false;
    var d2 = mad(x.h256, y.h256);
    return d2 >= 0 && d2 <= (um.mad || UMBRAL.mad);
  }

  /* ── del navegador ── */

  /**
   * La imagen de trabajo (512 px de ancho como mucho), bajando por mitades con
   * suavizado alto: de un salto el navegador submuestrea y cambia entre equipos.
   */
  function mini(src, ancho) {
    var MINI = ancho || 512;
    var w = src.width || src.naturalWidth || 0, h = src.height || src.naturalHeight || 0;
    if (!w || !h) throw new Error('imagen vacía');
    var cur = src, cw = w, ch = h;
    if (cw <= MINI) MINI = cw;
    while (cw > MINI * 2) {
      var nw = Math.max(MINI, Math.round(cw / 2)), nh = Math.max(1, Math.round(ch * nw / cw));
      var c = document.createElement('canvas'); c.width = nw; c.height = nh;
      var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff'; g.fillRect(0, 0, nw, nh);
      g.drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    var fw = MINI, fh = Math.max(1, Math.round(ch * MINI / cw));
    var f = document.createElement('canvas'); f.width = fw; f.height = fh;
    var fg = f.getContext('2d', { willReadFrequently: true }); fg.imageSmoothingEnabled = true; fg.imageSmoothingQuality = 'high';
    fg.fillStyle = '#fff'; fg.fillRect(0, 0, fw, fh);
    fg.drawImage(cur, 0, 0, fw, fh);
    return { g: fg, w: fw, h: fh };
  }

  function grises(src, ancho, alto) {
    var m = mini(src, ancho);
    if (alto && alto !== m.h) {   /* para comparar dos imágenes, la segunda a la medida de la primera */
      var c = document.createElement('canvas'); c.width = m.w; c.height = alto;
      var g2 = c.getContext('2d', { willReadFrequently: true }); g2.imageSmoothingQuality = 'high';
      g2.drawImage(m.g.canvas, 0, 0, m.w, alto);
      m = { g: g2, w: m.w, h: alto };
    }
    var px = m.g.getImageData(0, 0, m.w, m.h).data, n = m.w * m.h, gris = new Float32Array(n);
    for (var i = 0; i < n; i++) gris[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    return { g: gris, w: m.w, h: m.h };
  }

  /** Huellas de un canvas, <img> o ImageBitmap ya dibujable. */
  function deFuente(src) {
    var x = grises(src, MINI);
    return huellas(x.g, x.w, x.h);
  }

  /**
   * ¿Son de verdad la misma imagen? Ambas a 512 px de ancho y la misma
   * altura; en bloques de 16×16 px, la diferencia media del PEOR bloque.
   * La misma imagen vuelta a subir (recomprimida o reescalada) no pasa de 20;
   * otra captura del mismo formulario cambia el texto y algún bloque se va
   * arriba de 30. Si el recorte o la proporción cambian, se queda en
   * «parecida» (el revisor decide mirándolas lado a lado).
   */
  function fino(a, b, um) {
    um = um || UMBRAL;
    var wa = a.width || a.naturalWidth, ha = a.height || a.naturalHeight, wb = b.width || b.naturalWidth, hb = b.height || b.naturalHeight;
    if (!wa || !wb) return { peor: 999, igual: false };
    if (Math.abs(ha / wa - hb / wb) > 0.02) return { peor: 999, igual: false, proporcion: true };
    var A = grises(a, 512), B = grises(b, A.w, A.h), W = A.w, H = A.h, T = 16, peor = 0;
    for (var by = 0; by + T <= H; by += T) for (var bx = 0; bx + T <= W; bx += T) {
      var s = 0;
      for (var y = by; y < by + T; y++) for (var x = bx; x < bx + T; x++) s += Math.abs(A.g[y * W + x] - B.g[y * W + x]);
      s /= T * T;
      if (s > peor) peor = s;
    }
    peor = Math.round(peor * 10) / 10;
    return { peor: peor, igual: peor <= (um.fino || UMBRAL.fino) };
  }

  /** Una imagen de Drive lista para dibujar (directo con la llave, por la cola del visor). */
  function traer(id) {
    if (!K.drive || !K.drive.bytes) return Promise.reject(new Error('sin visor'));
    return K.drive.bytes(id, '').then(function (r) {
      return createImageBitmap(new Blob([r.bytes], { type: r.mime || 'image/jpeg' }));
    });
  }
  var FINO = {};   /* 'a|b' -> promesa (una vez por sesión) */
  /** Confirma «igual» entre una imagen (fuente ya cargada o id de Drive) y la de otra cuenta (id). */
  function confirmar(a, idB, um) {
    var k = (typeof a === 'string' ? a : '') + '|' + idB;
    if (typeof a === 'string' && FINO[k]) return FINO[k];
    var p = Promise.all([typeof a === 'string' ? traer(a) : Promise.resolve(a), traer(idB)]).then(function (r) {
      var x = fino(r[0], r[1], um);
      if (typeof a === 'string' && r[0].close) try { r[0].close(); } catch (e) {}
      if (r[1].close) try { r[1].close(); } catch (e) {}
      return x;
    });
    if (typeof a === 'string') { FINO[k] = p; p['catch'](function () { delete FINO[k]; }); }
    return p;
  }

  function deArchivo(file) {
    var abrir = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: 'from-image' })['catch'](function () { return createImageBitmap(file); })
      : new Promise(function (ok, mal) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { URL.revokeObjectURL(u); ok(im); };
        im.onerror = function () { URL.revokeObjectURL(u); mal(new Error('no se pudo leer la imagen')); };
        im.src = u;
      });
    return Promise.resolve(abrir).then(function (b) {
      var r = deFuente(b);
      if (b.close) try { b.close(); } catch (e) {}
      return r;
    });
  }

  /* ── md5 (RFC 1321), sobre los bytes del archivo ── */
  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var T = new Int32Array(64);
  for (var ti = 0; ti < 64; ti++) T[ti] = Math.floor(Math.abs(Math.sin(ti + 1)) * 4294967296) | 0;

  function md5Bytes(u8) {
    var n = u8.length, total = ((n + 8) >>> 6) + 1, W = new Int32Array(16);
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var blk = 0; blk < total; blk++) {
      var base = blk * 64;
      for (var j = 0; j < 16; j++) {
        var w = 0;
        for (var q = 0; q < 4; q++) {
          var p = base + j * 4 + q, by;
          if (p < n) by = u8[p]; else if (p === n) by = 0x80; else by = 0;
          w |= by << (q * 8);
        }
        W[j] = w;
      }
      if (blk === total - 1) { var bits = n * 8; W[14] = bits | 0; W[15] = Math.floor(bits / 4294967296) | 0; }
      var A = a0, B = b0, C = c0, D = d0;
      for (var i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        var tmp = D; D = C; C = B;
        var x = (A + F + T[i] + W[g]) | 0;
        B = (B + ((x << S[i]) | (x >>> (32 - S[i])))) | 0;
        A = tmp;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    function hex(v) { var s = ''; for (var k = 0; k < 4; k++) s += ('0' + ((v >>> (k * 8)) & 255).toString(16)).slice(-2); return s; }
    return hex(a0) + hex(b0) + hex(c0) + hex(d0);
  }

  function md5(x) {
    if (x instanceof ArrayBuffer) return Promise.resolve(md5Bytes(new Uint8Array(x)));
    var leer = x && x.arrayBuffer ? x.arrayBuffer() : new Promise(function (ok, mal) {
      var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = mal; r.readAsArrayBuffer(x);
    });
    return leer.then(function (ab) { return md5Bytes(new Uint8Array(ab)); });
  }

  /* ── el índice de las cuentas anteriores ──
     d.evid = { umbral:{h64,h256}, cuentas:{ "<informe>": { "<obl>": {i:[[id,h64,h256]], a:[[id,nombre,md5]]} } },
                actual:{...igual...}, otros:[...] } */
  function indice(d) {
    var ev = d && d.evid;
    if (!ev) return null;
    var img = [], adj = [];
    Object.keys(ev.cuentas || {}).forEach(function (inf) {
      var c = ev.cuentas[inf] || {};
      Object.keys(c).forEach(function (o) {
        (c[o].i || []).forEach(function (x) { if (x[1] && x[1] !== 'ERR') img.push({ informe: +inf, obl: +o, id: x[0], h64: x[1], h256: x[2] || '' }); });
        (c[o].a || []).forEach(function (x) { if (x[2]) adj.push({ informe: +inf, obl: +o, id: x[0], nombre: x[1] || '', md5: x[2] }); });
      });
    });
    img.sort(function (a, b) { return b.informe - a.informe; });
    adj.sort(function (a, b) { return b.informe - a.informe; });
    return { img: img, adj: adj, umbral: ev.umbral || UMBRAL, actual: ev.actual || {}, otros: ev.otros || [] };
  }

  /** Dónde se usó antes. q = {h64,h256} o {md5}. Devuelve las coincidencias (más reciente primero). */
  function buscar(ix, q) {
    if (!ix || !q) return [];
    if (q.md5) return ix.adj.filter(function (x) { return x.md5 === q.md5; });
    return ix.img.filter(function (x) { return parecida(q, x, ix.umbral); });
  }

  K.piezas.huella = {
    deFuente: deFuente, deArchivo: deArchivo, md5: md5, md5Bytes: md5Bytes,
    dist: dist, mad: mad, parecida: parecida, fino: fino, confirmar: confirmar, traer: traer,
    indice: indice, buscar: buscar, _huellas: huellas, umbral: UMBRAL
  };
}());
