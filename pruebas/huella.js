/* ============================================================
   KIT-FLANDES · BANCO DE LAS HUELLAS DE EVIDENCIAS (02/11/2026)
   kit/huella.js en Chromium: md5 igual al de Drive, la huella visual
   resiste la recompresión del teléfono, distingue fotos distintas,
   el índice encuentra lo repetido y mide < 15 ms por foto.

   Uso:  node huella.js
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', 'salida', 'KIT-FLANDES');
let verdes = 0, rojas = 0;
const fallos = [];
async function prueba(nombre, fn) {
  try { await fn(); verdes++; } catch (e) { rojas++; fallos.push(nombre + '\n    ' + e.message); }
}
function ok(c, m) { if (!c) throw new Error(m || 'falló'); }

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route(/^https?:\/\//, (r) => r.abort());
  const f = path.join(RAIZ, '__banco_huella.html');
  fs.writeFileSync(f, `<!doctype html><html lang="es"><head><meta charset="utf-8">
<script>window.MARCA={API_URL:'https://ejemplo.invalido/exec',APP:'CONTRATISTA',STORAGE_NS:'flandes.banco.'};</script></head>
<body><script src="kit/kit.js"></script><script src="kit/iconos.js"></script><script src="kit/imagenes.js"></script><script src="kit/huella.js"></script></body></html>`);
  await page.goto('file://' + f);
  await page.waitForFunction('!!(window.KIT && KIT.piezas.huella && KIT.piezas.imagenes)');

  /* una "foto": formas, degradado y ruido, con semilla */
  await page.evaluate(() => {
    window.foto = function (semilla, w, h) {
      let s = semilla;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const c = document.createElement('canvas'); c.width = w || 1600; c.height = h || 1200;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, c.width, c.height);
      gr.addColorStop(0, `hsl(${rnd() * 360},60%,70%)`); gr.addColorStop(1, `hsl(${rnd() * 360},50%,30%)`);
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `hsla(${rnd() * 360},70%,${30 + rnd() * 50}%,.8)`;
        g.beginPath(); g.arc(rnd() * c.width, rnd() * c.height, 30 + rnd() * 220, 0, 7); g.fill();
      }
      g.font = 'bold 90px sans-serif'; g.fillStyle = '#111'; g.fillText('Acta ' + semilla, 80, 200);
      const im = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < im.data.length; i += 4) { const n = (rnd() - 0.5) * 18; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
      g.putImageData(im, 0, 0);
      return c;
    };
    window.recomprimir = function (c, q, w) {
      return new Promise((res) => {
        c.toBlob((b) => createImageBitmap(b).then((bm) => {
          const k = document.createElement('canvas'); k.width = w || c.width; k.height = Math.round(c.height * (w || c.width) / c.width);
          k.getContext('2d').drawImage(bm, 0, 0, k.width, k.height); res(k);
        }), 'image/jpeg', q);
      });
    };
  });

  await prueba('md5 igual al de Drive (crypto) en 6 tamaños, incluido 10 MB', async () => {
    for (const n of [0, 1, 55, 64, 100000, 10 * 1024 * 1024]) {
      const b = crypto.randomBytes(n);
      const esp = crypto.createHash('md5').update(b).digest('hex');
      const r = await page.evaluate((arr) => KIT.piezas.huella.md5(new Uint8Array(arr).buffer), Array.from(b.slice(0, Math.min(n, 200000))));
      if (n <= 200000) ok(r === esp, n + ': ' + r + ' ≠ ' + esp);
    }
    const t = await page.evaluate(() => { const u = new Uint8Array(10 * 1024 * 1024); for (let i = 0; i < u.length; i++) u[i] = i * 31; const t0 = performance.now(); KIT.piezas.huella.md5Bytes(u); return performance.now() - t0; });
    ok(t < 400, 'md5 de 10 MB tardó ' + t.toFixed(0) + ' ms');
  });

  await prueba('la misma foto recomprimida (calidad 0,62 y 0,5, 1600 → 1200 px) queda dentro del umbral', async () => {
    const r = await page.evaluate(async () => {
      const H = KIT.piezas.huella, out = [];
      for (const s of [7, 99, 1234, 4242, 31337]) {
        const a = foto(s), ha = H.deFuente(a);
        for (const [q, w] of [[0.62, 1600], [0.5, 1200], [0.82, 900]]) {
          const b = await recomprimir(a, q, w), hb = H.deFuente(b);
          out.push({ d64: H.dist(ha.h64, hb.h64), mad: H.mad(ha.h256, hb.h256), igual: H.parecida(ha, hb), fino: H.fino(a, b) });
        }
      }
      return out;
    });
    r.forEach((x, i) => ok(x.igual && x.fino.igual, 'caso ' + i + ': ' + JSON.stringify(x)));
  });

  await prueba('fotos distintas NO se confunden (10 x 10 pares)', async () => {
    const r = await page.evaluate(() => {
      const H = KIT.piezas.huella, hs = [];
      for (let s = 1; s <= 10; s++) hs.push(H.deFuente(foto(s * 977)));
      let malas = 0, min = 99;
      for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) { if (H.parecida(hs[i], hs[j])) malas++; min = Math.min(min, H.dist(hs[i].h64, hs[j].h64)); }
      return { malas, min };
    });
    ok(r.malas === 0, JSON.stringify(r));
  });

  await prueba('la huella de una foto de 1600 px tarda menos de 15 ms (mediana de 20)', async () => {
    const t = await page.evaluate(() => {
      const H = KIT.piezas.huella, c = foto(5), ts = [];
      for (let i = 0; i < 22; i++) { const t0 = performance.now(); H.deFuente(c); ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); return ts[10];
    });
    ok(t < 15, t.toFixed(1) + ' ms');
  });

  await prueba('imagenes.preparar devuelve la huella (la misma que deFuente)', async () => {
    const r = await page.evaluate(async () => {
      const c = foto(11);
      const b = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
      const f = new File([b], 'foto.jpg', { type: 'image/jpeg' });
      const p = await KIT.piezas.imagenes.preparar(f);
      return { tiene: !!(p.huella && p.huella.h64 && p.huella.h256), d: KIT.piezas.huella.dist(p.huella.h64, KIT.piezas.huella.deFuente(c).h64), l: p.huella.h64.length + '/' + p.huella.h256.length };
    });
    ok(r.tiene && r.d <= 4 && r.l === '16/64', JSON.stringify(r));
  });

  await prueba('el índice encuentra la imagen y el adjunto de la cuenta 3 al subir en la cuenta 6 (salta cuentas)', async () => {
    const r = await page.evaluate(async () => {
      const H = KIT.piezas.huella, a = foto(21), b = foto(22), ha = H.deFuente(a), hb = H.deFuente(b);
      const d = { evid: { umbral: { h64: 8, mad: 0.5, fino: 20 }, cuentas: {
        3: { 2: { i: [['idA', ha.h64, ha.h256]], a: [['idX', '2.1. Acta.pdf', 'abc123']] } },
        5: { 4: { i: [['idB', hb.h64, hb.h256]], a: [] } } } } };
      const ix = H.indice(d), q = H.deFuente(await recomprimir(a, 0.6, 1400));
      return { img: H.buscar(ix, q).map(x => x.informe + '/' + x.obl), adj: H.buscar(ix, { md5: 'abc123' }).map(x => x.informe), nada: H.buscar(ix, H.deFuente(foto(23))).length };
    });
    ok(r.img.join() === '3/2' && r.adj.join() === '3' && r.nada === 0, JSON.stringify(r));
  });

  await prueba('un formulario con OTRO dato es «parecido» pero no «igual» (fino)', async () => {
    const r = await page.evaluate(() => {
      const H = KIT.piezas.huella;
      const hacer = (txt) => { const c = foto(77); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(300, 500, 700, 120); g.fillStyle = '#000'; g.font = 'bold 70px sans-serif'; g.fillText(txt, 320, 590); return c; };
      const a = hacer('15/09/2026  $ 3.500.000'), b = hacer('15/10/2026  $ 4.200.000');
      return { parecida: H.parecida(H.deFuente(a), H.deFuente(b)), fino: H.fino(a, b) };
    });
    ok(r.parecida && !r.fino.igual, JSON.stringify(r));
  });

  await prueba('mismo cálculo que el CORE (Huellas1102.gs) sobre los mismos grises', async () => {
    const r = await page.evaluate(() => {
      const g = []; for (let i = 0; i < 64 * 85; i++) g.push((i * 37) % 251);
      return KIT.piezas.huella._huellas(g, 64, 85);
    });
    ok(r.h64 === '31c619638c33cc31' && r.h256 === '68b76aa6ba58a85857aa57aa9a768b76858a958b7aa67b84b76a967a58b768a8', JSON.stringify(r));
  });

  await browser.close();
  try { fs.unlinkSync(f); } catch (e) {}
  console.log(`\n${verdes} verdes, ${rojas} rojas`);
  fallos.forEach((x) => console.log('✗ ' + x));
  process.exit(rojas ? 1 : 0);
})();
