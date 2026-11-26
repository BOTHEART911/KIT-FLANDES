/* ============================================================
   KIT-FLANDES · FORMATO DEL TEXTO (26/11/2026)
   Negrilla, cursiva, tachado, subrayado, resaltado y listas en los
   comunicados, sin que nadie tenga que saberse los asteriscos.

   Cómo se guarda
     El texto viaja y se guarda con marcas tipo WhatsApp, nunca HTML:
       *negrilla*   _cursiva_   ~tachado~   ++subrayado++   ==resaltado==
       - renglón de lista
     Así el CORE no cambia, el push sale limpio (plano) y lo que ya se
     publicó con *asteriscos* se ve en negrilla sin republicar.

   Cómo se usa
     KIT.piezas.formato.html(texto)    HTML seguro para pintar (escapa
                                       primero, luego convierte marcas,
                                       enlaces y saltos de renglón)
     KIT.piezas.formato.plano(texto)   el texto sin marcas (resúmenes, push)

     var ed = KIT.piezas.formato.editor(caja, { max: 4000, placeholder: '…' });
       ed.valor()   el texto con marcas      ed.foco()
       ed.largo()   caracteres con marcas    ed.el (el cuadro editable)
     El editor es visual: se selecciona el texto, se toca B y queda en
     negrilla ahí mismo. Ctrl+B, Ctrl+I y Ctrl+U también sirven. Lo que
     se pega llega como texto simple.
   ============================================================ */
(function () {
  'use strict';

  var K = window.KIT;
  if (!K) { try { console.warn('[kit/formato] falta kit.js'); } catch (e) {} return; }

  /* ══════════════ marcas → HTML ══════════════ */

  var URL_RE = /https?:\/\/[^\s<>"']+/gi;

  /* Orden: dobles primero (== ++), luego * ~ _. La _ pide borde de
     palabra para no partir nombres_de_archivo; las demás no, para que
     la negrilla a media palabra que deja el editor también se vea. */
  var MARCAS = [
    { re: /==(\S(?:.*?\S)?)==/g, tag: 'mark' },
    { re: /\+\+(\S(?:.*?\S)?)\+\+/g, tag: 'u' },
    { re: /\*(\S(?:.*?\S)?)\*/g, tag: 'strong' },
    { re: /~(\S(?:.*?\S)?)~/g, tag: 's' }
  ];
  var CURSIVA;
  try { CURSIVA = new RegExp('(^|[^\\p{L}\\p{N}_])_(\\S(?:.*?\\S)?)_(?![\\p{L}\\p{N}])', 'gu'); }
  catch (e) { CURSIVA = /(^|[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_])_(\S(?:.*?\S)?)_(?![A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ])/g; }

  var LISTA_RE = /^\s*[-•]\s+/;

  function enLinea(s, html) {
    MARCAS.forEach(function (m) {
      s = s.replace(m.re, function (_, x) { return html ? '<' + m.tag + '>' + x + '</' + m.tag + '>' : x; });
    });
    s = s.replace(CURSIVA, function (_, a, x) { return a + (html ? '<em>' + x + '</em>' : x); });
    return s;
  }

  /** Saca los enlaces para que sus _ y * no se lean como marcas. */
  function apartarEnlaces(s) {
    var urls = [];
    s = s.replace(URL_RE, function (u) {
      var cola = (u.match(/[).,;:!?\]]+$/) || [''])[0];
      var limpio = u.slice(0, u.length - cola.length);
      urls.push(limpio);
      return '\u0000' + (urls.length - 1) + '\u0000' + cola;
    });
    return { s: s, urls: urls };
  }

  function html(texto) {
    var a = apartarEnlaces(String(texto || '').replace(/\r/g, ''));
    var renglones = K.esc(a.s).split('\n');
    var out = [], lista = null, prev = false;
    renglones.forEach(function (r) {
      if (LISTA_RE.test(r)) {
        if (!lista) { lista = []; }
        lista.push('<li>' + enLinea(r.replace(LISTA_RE, ''), true) + '</li>');
        return;
      }
      if (lista) { out.push('<ul class="kfmt-lista">' + lista.join('') + '</ul>'); lista = null; prev = false; }
      out.push((prev ? '<br>' : '') + enLinea(r, true));
      prev = true;
    });
    if (lista) out.push('<ul class="kfmt-lista">' + lista.join('') + '</ul>');
    return out.join('').replace(/\u0000(\d+)\u0000/g, function (_, n) {
      var u = K.esc(a.urls[+n]);
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>';
    });
  }

  function plano(texto) {
    var a = apartarEnlaces(String(texto || '').replace(/\r/g, ''));
    return a.s.split('\n').map(function (r) { return enLinea(r, false); }).join('\n')
      .replace(/\u0000(\d+)\u0000/g, function (_, n) { return a.urls[+n]; });
  }

  /* ══════════════ editor visual → marcas ══════════════ */

  var BLOQUE = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE)$/;
  var SUAVE = '\u0001', VACIO = '\u0002';

  function marcasDe(el) {
    var t = el.tagName, st = el.style || {}, m = [];
    var fw = st.fontWeight;
    if (t === 'B' || t === 'STRONG' || fw === 'bold' || (+fw >= 600)) m.push('*');
    if (t === 'I' || t === 'EM' || st.fontStyle === 'italic') m.push('_');
    var deco = (st.textDecoration || '') + ' ' + (st.textDecorationLine || '');
    if (t === 'S' || t === 'STRIKE' || t === 'DEL' || /line-through/.test(deco)) m.push('~');
    if (t === 'U' || t === 'INS' || /underline/.test(deco)) m.push('++');
    var bg = st.backgroundColor;
    if (t === 'MARK' || (bg && !/transparent|rgba\(0, 0, 0, 0\)|initial|inherit/.test(bg))) m.push('==');
    return m;
  }

  /** Envuelve cada renglón; los espacios de las puntas quedan afuera. */
  function envolver(s, m) {
    return s.split('\n').map(function (r) {
      var x = /^(\s*)([\s\S]*?)(\s*)$/.exec(r);
      return x[2] ? x[1] + m + x[2] + m + x[3] : r;
    }).join('\n');
  }

  function recorrer(n) {
    if (n.nodeType === 3) return n.nodeValue.replace(/ /g, ' ').replace(/[\u0000-\u0002]/g, '');
    if (n.nodeType !== 1) return '';
    if (n.tagName === 'BR') return '\n';
    var hijos = [].slice.call(n.childNodes);
    var bloque = BLOQUE.test(n.tagName);
    /* El <br> final de un bloque no es un renglón más: es el que pone el
       navegador para que el bloque vacío tenga alto. */
    if (bloque && hijos.length && hijos[hijos.length - 1].tagName === 'BR') hijos.pop();
    var dentro = hijos.map(recorrer).join('');
    marcasDe(n).forEach(function (m) { dentro = envolver(dentro, m); });
    if (!bloque) return dentro;
    if (n.tagName === 'UL' || n.tagName === 'OL') return SUAVE + dentro + SUAVE;
    if (n.tagName === 'LI') return SUAVE + '- ' + dentro.replace(/\n/g, ' ') + SUAVE;
    return SUAVE + (dentro.replace(/[\u0001]/g, '') === '' && !/\n/.test(dentro) ? VACIO : dentro) + SUAVE;
  }

  /** <b>ho</b><b>la</b> → <b>hola</b>, para que no salga *ho**la*. */
  function juntarVecinos(raiz) {
    [].slice.call(raiz.querySelectorAll('*')).forEach(function (el) {
      var sig = el.nextSibling;
      while (sig && sig.nodeType === 1 && sig.tagName === el.tagName && sig.tagName !== 'BR' &&
             !BLOQUE.test(sig.tagName) && (sig.getAttribute('style') || '') === (el.getAttribute('style') || '')) {
        while (sig.firstChild) el.appendChild(sig.firstChild);
        var x = sig.nextSibling; sig.parentNode.removeChild(sig); sig = x;
      }
    });
  }

  function aMarcas(raiz) {
    var c = raiz.cloneNode(true);
    juntarVecinos(c);
    var crudo = [].slice.call(c.childNodes).map(recorrer).join(''), out = '';
    for (var i = 0; i < crudo.length; i++) {
      var ch = crudo[i];
      if (ch === SUAVE) { if (out && out.slice(-1) !== '\n') out += '\n'; }
      else if (ch === VACIO) out += '\n';
      else out += ch;
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '');
  }

  /* ══════════════ el editor ══════════════ */

  var SVG = 'xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var BOTONES = [
    { cmd: 'bold', txt: '<b>B</b>', t: 'Negrilla (Ctrl+B)' },
    { cmd: 'italic', txt: '<i>I</i>', t: 'Cursiva (Ctrl+I)' },
    { cmd: 'underline', txt: '<u>S</u>', t: 'Subrayado (Ctrl+U)' },
    { cmd: 'strikeThrough', txt: '<s>T</s>', t: 'Tachado' },
    { cmd: 'resaltar', txt: '<svg ' + SVG + '><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>', t: 'Resaltar' },
    { cmd: 'insertUnorderedList', txt: '<svg ' + SVG + '><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>', t: 'Lista' }
  ];

  function editor(destino, op) {
    op = op || {};
    var max = op.max || 4000;
    var caja = typeof destino === 'string' ? K.$(destino) : destino;
    var w = K.nodo('<div class="kfmt"></div>');
    var barra = K.nodo('<div class="kfmt-barra" role="toolbar" aria-label="Formato del texto"></div>');
    var ed = K.nodo('<div class="kfmt-ed kfmt-txt" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true"></div>');
    ed.setAttribute('data-ph', op.placeholder || 'Escribe aquí.');
    ed.setAttribute('aria-label', op.etiqueta || 'Texto del comunicado');
    var pie = K.nodo('<p class="kfmt-pie"><span>Selecciona el texto y toca un botón.</span><span class="kfmt-cuenta">0 / ' + max + '</span></p>');
    var cuenta = pie.querySelector('.kfmt-cuenta');
    var rango = null;

    BOTONES.forEach(function (b) {
      var x = K.nodo('<button type="button" class="kfmt-b" aria-pressed="false">' + b.txt + '</button>');
      x.setAttribute('aria-label', b.t); x.title = b.t; x.dataset.cmd = b.cmd;
      /* Sin esto el toque le quita el foco al texto y se pierde lo seleccionado. */
      x.addEventListener('mousedown', function (e) { e.preventDefault(); });
      x.addEventListener('click', function () { K.vibrar && K.vibrar(6); aplicar(b.cmd); });
      barra.appendChild(x);
    });

    w.appendChild(barra); w.appendChild(ed); w.appendChild(pie);
    caja.appendChild(w);

    function dentro(n) { return n && (n === ed || ed.contains(n)); }
    function guardarRango() {
      var s = window.getSelection();
      if (s && s.rangeCount && dentro(s.getRangeAt(0).commonAncestorContainer)) rango = s.getRangeAt(0).cloneRange();
    }
    function volverRango() {
      if (document.activeElement !== ed) ed.focus();
      if (!rango) return;
      var s = window.getSelection();
      if (s.rangeCount && dentro(s.getRangeAt(0).commonAncestorContainer)) return;
      s.removeAllRanges(); s.addRange(rango);
    }
    function cerca(tag) {
      var s = window.getSelection();
      if (!s || !s.rangeCount) return null;
      var n = s.getRangeAt(0).commonAncestorContainer;
      while (n && n !== ed) { if (n.nodeType === 1 && n.tagName === tag) return n; n = n.parentNode; }
      return null;
    }
    /** Los resaltados que toca la selección (o donde está el cursor). */
    function marcasTocadas() {
      var s = window.getSelection();
      if (!s || !s.rangeCount) return [];
      var r = s.getRangeAt(0), un = cerca('MARK');
      if (un) return [un];
      return [].slice.call(ed.querySelectorAll('mark')).filter(function (m) {
        try { return r.intersectsNode(m) && !r.collapsed; } catch (e) { return false; }
      });
    }
    function desenvolver(el) {
      var p = el.parentNode;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
    }
    /** El resaltado del navegador llega como <span style="background">: pasa a <mark>. */
    function aMark() {
      var hecho = [];
      [].slice.call(ed.querySelectorAll('[style*="background"]')).forEach(function (sp) {
        var bg = sp.style.backgroundColor;
        sp.style.backgroundColor = '';
        if (!(sp.getAttribute('style') || '').trim()) sp.removeAttribute('style');
        var limpio = /^(SPAN|FONT)$/.test(sp.tagName) && !sp.getAttribute('style');
        if (!bg || /transparent|rgba\(0, 0, 0, 0\)/.test(bg)) { if (limpio) desenvolver(sp); return; }
        var mk = document.createElement('mark');
        if (limpio) { while (sp.firstChild) mk.appendChild(sp.firstChild); sp.parentNode.replaceChild(mk, sp); }
        else { while (sp.firstChild) mk.appendChild(sp.firstChild); sp.appendChild(mk); }
        hecho.push(mk);
      });
      return hecho;
    }
    /** Mover nodos borra la selección: se vuelve a marcar lo mismo. */
    function seleccionar(a, z) {
      if (!a) return;
      var r = document.createRange();
      r.setStartBefore(a); r.setEndAfter(z || a);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }

    var aplicando = false;
    function aplicar(cmd) {
      aplicando = true;
      try { aplicar_(cmd); } finally { aplicando = false; }
      guardarRango(); estado(); cambio();
    }
    function aplicar_(cmd) {
      volverRango();
      try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
      if (cmd === 'resaltar') {
        var mks = marcasTocadas();
        if (mks.length) {
          var pri = mks[0].firstChild, ult = mks[mks.length - 1].lastChild;
          mks.forEach(desenvolver);
          seleccionar(pri, ult);
        }
        else {
          var s = window.getSelection();
          if (s && s.rangeCount && !s.isCollapsed) {
            try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
            document.execCommand('hiliteColor', false, '#fde68a') || document.execCommand('backColor', false, '#fde68a');
            try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
            var ms = aMark();
            if (ms.length) seleccionar(ms[0], ms[ms.length - 1]);
          } else K.aviso && K.aviso('Selecciona primero el texto que quieres resaltar.', 'aviso', 2500);
        }
      } else document.execCommand(cmd, false, null);
    }

    function estado() {
      [].slice.call(barra.children).forEach(function (x) {
        var c = x.dataset.cmd, on = false;
        try {
          if (c === 'resaltar') on = marcasTocadas().length > 0;
          else if (c === 'insertUnorderedList') on = !!cerca('UL');
          else on = document.queryCommandState(c);
        } catch (e) {}
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function cambio() {
      var n = valor().length;
      cuenta.textContent = K.numero ? K.numero(n) + ' / ' + K.numero(max) : n + ' / ' + max;
      cuenta.classList.toggle('kfmt-cuenta--mal', n > max);
      ed.classList.toggle('kfmt-ed--vacio', !ed.textContent.trim() && !ed.querySelector('li'));
      if (op.alCambiar) op.alCambiar(n);
    }

    function valor() { return aMarcas(ed); }

    ed.addEventListener('paste', function (e) {
      var d = e.clipboardData || window.clipboardData;
      if (!d) return;
      e.preventDefault();
      var t = (d.getData('text/plain') || '').replace(/\r/g, '');
      document.execCommand('insertText', false, t);
    });
    ed.addEventListener('drop', function (e) { e.preventDefault(); });
    ed.addEventListener('input', function () { if (aplicando) return; aMark(); cambio(); });
    ed.addEventListener('keyup', function () { guardarRango(); estado(); });
    ed.addEventListener('mouseup', function () { guardarRango(); estado(); });
    function alSel() { if (document.activeElement === ed) { guardarRango(); estado(); } }
    document.addEventListener('selectionchange', alSel);
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) {}

    if (op.valor) { ed.innerHTML = html(op.valor); }
    cambio();

    return {
      el: ed,
      valor: valor,
      largo: function () { return valor().length; },
      max: max,
      foco: function () { ed.focus(); },
      quitar: function () { document.removeEventListener('selectionchange', alSel); }
    };
  }

  K.piezas = K.piezas || {};
  K.piezas.formato = { html: html, plano: plano, editor: editor, _aMarcas: aMarcas };
}());
