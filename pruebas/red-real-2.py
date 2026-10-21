import sys, json, time, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
APPS=['contratista','contratacion','supervision','admin','contabilidad','tesoreria','comunicaciones']
PX={'server':'http://127.0.0.1:37241','bypass':'<-loopback>'}
res={}
def servir(d,port):
    h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=d)
    h.log_message=lambda *a:None
    s=socketserver.ThreadingTCPServer(('127.0.0.1',port),h); s.daemon_threads=True
    threading.Thread(target=s.serve_forever,daemon=True).start(); return s
def banner(pg):
    return pg.evaluate("()=>{var b=document.querySelector('.kit-conex');return b?{on:b.classList.contains('kit-conex--on'),lenta:b.classList.contains('kit-conex--lenta'),txt:b.innerText.trim()}:null}")
with sync_playwright() as p:
    b=p.chromium.launch(proxy=PX)
    for i,a in enumerate(APPS):
        srv=None; ctx=b.new_context(service_workers='block'); pg=ctx.new_page()
        base='https://botheart911.github.io/%s-flandes/'%a
        import os, mimetypes
        def hacer(a, base):
          def local(rt, *x):
              path=rt.request.url.split('?')[0].split('#')[0][len(base):] or 'index.html'
              f='/home/claude/%s-flandes/%s'%(a,path)
              if os.path.isfile(f): rt.fulfill(status=200, body=open(f,'rb').read(), headers={'Content-Type':(mimetypes.guess_type(f)[0] or 'application/octet-stream')+'; charset=utf-8'})
              else: print('404',rt.request.url); rt.fulfill(status=404, body='')
          return local
        ctx.route(base+'**', hacer(a, base))
        bodies=[]
        pg.on('request', lambda r: bodies.append(r.post_data) if 'script.google' in r.url and r.method=='POST' else None)
        pg.on('pageerror',lambda e:print('E',str(e)[:200])); pg.on('console',lambda m:print('C',m.text[:160]) if m.type=='error' else None)
        pg.goto(base, wait_until='domcontentloaded'); pg.wait_for_function('window.KIT && KIT.piezas.conexion',timeout=20000)
        print('kit cargado',flush=True); pg.wait_for_timeout(1500)
        r={}
        # A · corte en medio de una carga ya enviada
        bodies.clear(); estado={'n':0}
        def medio(rt):
            estado['n']+=1
            if estado['n']==1: time.sleep(1.5); rt.abort('internetdisconnected')
            else: rt.continue_()
        pg.route('https://script.google.com/**',medio)
        pg.evaluate("()=>{window.__r=null;KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>window.__r='ok',e=>window.__r=e.codigo)}")
        pg.wait_for_timeout(700); ctx.set_offline(True)
        pg.wait_for_function("document.querySelector('.kit-conex.kit-conex--on')",timeout=8000); r['banner_en_carga']=True
        pg.wait_for_timeout(1500); r['sigue_esperando']=pg.evaluate('window.__r')
        ctx.set_offline(False); pg.wait_for_function("window.__r!==null",timeout=60000); r['carga_completa']=pg.evaluate('window.__r')
        pg.unroute('https://script.google.com/**')
        rids=[json.loads(x).get('rid') for x in bodies if x]; r['envios']=len(rids); r['mismo_rid']=len(set(rids))==1
        pg.wait_for_timeout(500); r['banner_se_fue']=not banner(pg)['on']
        # B · internet lento: aviso ámbar mientras espera
        def lenta(rt): time.sleep(3); rt.fulfill(status=204,body='')
        def tarde(rt): time.sleep(12); rt.continue_()
        pg.route('https://www.gstatic.com/**',lenta); pg.route('https://script.google.com/**',tarde)
        pg.evaluate("()=>{window.__r=null;KIT.pedir('ping',{},{app:'CORE',sinToken:true}).then(()=>window.__r='ok',e=>window.__r=e.codigo)}")
        r['ambar']=pg.wait_for_function("(()=>{var b=document.querySelector('.kit-conex.kit-conex--lenta.kit-conex--on');return b?b.innerText.trim():null})()",timeout=15000).json_value()
        pg.wait_for_function("window.__r!==null",timeout=60000); pg.wait_for_timeout(300); r['ambar_se_fue']=not banner(pg)['on']; r['lenta_termina']=pg.evaluate('window.__r')
        pg.unroute('https://www.gstatic.com/**'); pg.unroute('https://script.google.com/**')
        res[a]=r; ctx.close()
        print(a, json.dumps(r,ensure_ascii=False), flush=True)
    b.close()
