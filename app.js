
(() => {
  // ======= UTIL =======
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const fmt = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0);
  const uid = () => Math.random().toString(36).slice(2,9);

  // ======= STATE =======
  let PRODUCTS = [];
  const STORAGE = {
    cart: JSON.parse(localStorage.getItem('mh_cart')||'[]'),
    wishlist: JSON.parse(localStorage.getItem('mh_wish')||'[]'),
    coupon: localStorage.getItem('mh_coupon')||'',
    vendor: localStorage.getItem('mh_vendor')==='1',
  };

  // Restore from shared cart URL
  try{
    const url = new URL(location.href);
    const s = url.searchParams.get('c');
    if(s){ STORAGE.cart = JSON.parse(atob(s)); persist(); history.replaceState({}, document.title, location.pathname); }
  }catch(e){}

  // ======= DOM REFS =======
  const grid = $('#grid');
  const q = $('#q');
  const filterSet = $('#filterSet');
  const filterType = $('#filterType');
  const sortBy = $('#sortBy');
  const cCount = $('#cCount');
  const wCount = $('#wCount');
  const drawer = $('#drawer');
  const cartBody = $('#cartBody');
  const subtotalEl = $('#subtotal');
  const grandEl = $('#grand');
  const shipRegion = $('#shipRegion');
  const btnCart = $('#btnCart');
  const btnClose = $('#btnClose');
  const btnWA = $('#btnWA');
  const btnWebpay = $('#btnWebpay');
  const btnCopyOrder = $('#btnCopyOrder');
  const btnShareCart = $('#btnShareCart');
  const pm = $('#premiumModal');
  const btnPremium = $('#btnPremium');
  const pmClose = $('#pmClose');
  const couponInput = $('#coupon');
  const applyCoupon = $('#applyCoupon');
  const toggleVendor = $('#toggleVendor');
  const fileImport = $('#fileImport');
  const btnImport = $('#btnImport');
  const qv = $('#qv');
  const qvBox = $('#qvBox');

  const facetCats = $('#facetCats');
  const minPrice = $('#minPrice');
  const maxPrice = $('#maxPrice');

  const current = {page:1, perPage:24, cat:'', min:0, max:0};

  // ======= INIT =======
  async function loadCatalog(){
    try{
      const res = await fetch('/data/masterhit-products.json?_='+Date.now());
      const data = await res.json();
      PRODUCTS = data;
    }catch(e){ console.warn('Fallo carga catálogo.', e); PRODUCTS = PRODUCTS || []; }
  }
  function hydrateFilters(){
    const sets = [...new Set(PRODUCTS.map(p=>p.set))].sort();
    sets.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; filterSet.appendChild(o); });
    const cats = [...new Set(PRODUCTS.map(p=>p.category).filter(Boolean))].sort();
    facetCats.innerHTML = cats.map(c=>`<button class='btn' data-cat='${c}'>${c}</button>`).join('');
    facetCats.querySelectorAll('[data-cat]').forEach(b=> b.onclick=()=>{ current.cat = b.dataset.cat===current.cat ? '' : b.dataset.cat; current.page=1; render(); });
  }

  (async()=>{
    await loadCatalog(); hydrateFilters(); render(); updateBadges();
    document.getElementById('yy').textContent = new Date().getFullYear();
    if(STORAGE.coupon) couponInput && (couponInput.value = STORAGE.coupon);
    if(STORAGE.vendor) toggleVendor.textContent = 'Desactivar';
  })();

  // ======= FILTER =======
  function filtered(){
    const term = (q.value||'').toLowerCase();
    const fs = filterSet.value; const ft = filterType.value; const srt = sortBy.value;
    let list = PRODUCTS.filter(p=>{
      const okQ = !term || (p.name+p.set+(p.tags||[]).join(' ')).toLowerCase().includes(term);
      const okS = !fs || p.set===fs; const okT = !ft || p.type===ft;
      const okC = !current.cat || p.category===current.cat;
      const okMin = !current.min || (p.price||0) >= current.min;
      const okMax = !current.max || (p.price||0) <= current.max;
      return okQ && okS && okT && okC && okMin && okMax;
    });
    if(srt==='priceAsc') list.sort((a,b)=>a.price-b.price);
    if(srt==='priceDesc') list.sort((a,b)=>b.price-a.price);
    if(srt==='new') list.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    return list;
  }

  function render(){
    const list = filtered();
    const from = (current.page-1)*current.perPage; const to = from + current.perPage;
    const pageItems = list.slice(from,to);
    grid.innerHTML = pageItems.map(p=>{
      const wishOn = STORAGE.wishlist.includes(p.id);
      const low = p.stock>0 && p.stock<=3;
      const old = p.compareAtPrice && p.compareAtPrice>p.price ? `<div class='muted' style='text-decoration:line-through'>${fmt(p.compareAtPrice)}</div>`:'';
      return `
        <article class="card product">
          ${low?`<span class='badge'>Quedan ${p.stock}</span>`:''}
          <button class="btn wishlist" data-wish="${p.id}" title="Wishlist">${wishOn?'❤':'♡'}</button>
          <div class="imgbox"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
          <div class="pad">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
              <h3 style="margin:0;font-size:1rem">${p.name}</h3>
              <button class="btn" data-qv="${p.id}">Ver</button>
            </div>
            <div class="muted">${p.set} • ${p.type} ${p.category?`• ${p.category}`:''}</div>
            ${old}
            <div class="price">${fmt(p.price)}</div>
            <div class="qty">
              <button data-dec="${p.id}">−</button>
              <input class="input" style="width:60px;text-align:center" type="number" min="1" value="1" id="qty-${p.id}">
              <button data-inc="${p.id}">+</button>
            </div>
            <button class="btn primary" data-add="${p.id}" ${p.stock>0?'':'disabled'}>Añadir</button>
            ${STORAGE.vendor?`<div class='muted' style='margin-top:6px'>SKU: ${p.id} · Stock: <input data-stock='${p.id}' type='number' value='${p.stock}' style='width:64px'/> · $ <input data-price='${p.id}' type='number' value='${p.price}' style='width:100px'/></div>`:''}
          </div>
        </article>`
    }).join('') || '<p class="muted">Sin resultados.</p>';

    // pager
    const pages = Math.max(1, Math.ceil(list.length/current.perPage));
    const phtml = Array.from({length:pages}, (_,i)=>`<button class='btn ${i+1===current.page?'primary':''}' data-page='${i+1}'>${i+1}</button>`).join('');
    document.getElementById('pager').innerHTML = phtml;
    $$('[data-page]').forEach(b=> b.onclick=()=>{ current.page=+b.dataset.page; render(); window.scrollTo({top:0,behavior:'smooth'}); });

    // Binds
    $$("[data-inc]").forEach(b=>b.onclick=()=>{ const id=b.dataset.inc; const i=$(`#qty-${id}`); i.value= (+i.value||1)+1; });
    $$("[data-dec]").forEach(b=>b.onclick=()=>{ const id=b.dataset.dec; const i=$(`#qty-${id}`); i.value=Math.max(1,(+i.value||1)-1); });
    $$("[data-add]").forEach(b=>b.onclick=()=> addToCart(b.dataset.add, +$(`#qty-${b.dataset.add}`).value||1));
    $$("[data-wish]").forEach(b=>b.onclick=()=> toggleWish(b.dataset.wish));
    $$("[data-stock]").forEach(i=>i.onchange=(e)=> editStock(e.target.dataset.stock, +e.target.value||0));
    $$("[data-price]").forEach(i=>i.onchange=(e)=> editPrice(e.target.dataset.price, +e.target.value||0));
    $$("[data-qv]").forEach(b=>b.onclick=()=> openQuickView(b.dataset.qv));
  }

  function openQuickView(id){
    const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
    qvBox.innerHTML = `
      <div class='flex'>
        <div class='grow'><img src='${p.image}' alt='${p.name}' style='border-radius:12px;border:1px solid var(--line)'></div>
        <div class='grow'>
          <h3 style='margin:0 0 6px'>${p.name}</h3>
          <div class='muted'>${p.set} • ${p.type}</div>
          <div class='price' style='margin:8px 0'>${fmt(p.price)}</div>
          <p class='muted'>${(p.tags||[]).join(', ')}</p>
          <button class='btn primary' data-add='${p.id}'>Añadir al carrito</button>
        </div>
      </div>`;
    qv.classList.add('open');
    qv.setAttribute('aria-hidden','false');
    qvBox.querySelector('[data-add]').onclick=()=>{ addToCart(p.id,1); closeQuickView(); };
    qv.onclick=(e)=>{ if(e.target===qv) closeQuickView(); };
  }
  function closeQuickView(){ qv.classList.remove('open'); qv.setAttribute('aria-hidden','true'); }

  // ======= CART =======
  function persist(){
    localStorage.setItem('mh_cart', JSON.stringify(STORAGE.cart));
    localStorage.setItem('mh_wish', JSON.stringify(STORAGE.wishlist));
    localStorage.setItem('mh_coupon', STORAGE.coupon||'');
    localStorage.setItem('mh_vendor', STORAGE.vendor? '1':'0');
  }
  function addToCart(id, qty){
    const p = PRODUCTS.find(x=>x.id===id); if(!p || p.stock<=0) return alert('Sin stock');
    const line = STORAGE.cart.find(x=>x.id===id);
    if(line){ line.qty += qty; } else { STORAGE.cart.push({id, qty}); }
    if(line && line.qty>p.stock) line.qty = p.stock; // cap
    persist(); updateBadges(); openCart();
  }
  function removeFromCart(id){ STORAGE.cart = STORAGE.cart.filter(x=>x.id!==id); persist(); drawCart(); updateBadges(); }
  function setQty(id, qty){ const l=STORAGE.cart.find(x=>x.id===id); if(!l) return; l.qty=Math.max(1,qty|0); const p=PRODUCTS.find(x=>x.id===id); if(p) l.qty=Math.min(l.qty,p.stock); persist(); drawCart(); updateBadges(); }
  function cartLines(){ return STORAGE.cart.map(it=>{ const p=PRODUCTS.find(x=>x.id===it.id)||{}; return {...p, qty:it.qty, lineTotal:(p.price||0)*it.qty}; }); }

  function drawCart(){
    const lines = cartLines();
    cartBody.innerHTML = lines.map(l=>`
      <div class='row'>
        <img src='${l.image}' alt='${l.name}'>
        <div>
          <div style='display:flex;justify-content:space-between;gap:8px'><strong>${l.name}</strong><span>${fmt(l.price)}</span></div>
          <div class='qty' style='margin-top:6px'>
            <button data-m='${l.id}'>−</button>
            <input class='input' style='width:60px;text-align:center' type='number' min='1' value='${l.qty}' data-q='${l.id}'>
            <button data-p='${l.id}'>+</button>
            <button class='btn' style='margin-left:auto' data-del='${l.id}'>🗑️</button>
          </div>
        </div>
        <div><strong>${fmt(l.lineTotal)}</strong></div>
      </div>`).join('') || '<p class="muted">Tu carrito está vacío.</p>';

    // binds
    $$("[data-m]").forEach(b=>b.onclick=()=>{ const id=b.dataset.m; const i=$(`[data-q='${id}']`); i.value=Math.max(1,(+i.value||1)-1); setQty(id,+i.value); });
    $$("[data-p]").forEach(b=>b.onclick=()=>{ const id=b.dataset.p; const i=$(`[data-q='${id}']`); i.value=(+i.value||1)+1; setQty(id,+i.value); });
    $$("[data-q]").forEach(i=>i.onchange=()=> setQty(i.dataset.q, +i.value||1));
    $$("[data-del]").forEach(b=>b.onclick=()=> removeFromCart(b.dataset.del));

    const subtotal = lines.reduce((s,l)=>s+l.lineTotal,0);
    subtotalEl.textContent = fmt(subtotal);

    const ship = shipEstimate(subtotal, shipRegion.value);
    const desc = couponDiscount(subtotal);
    grandEl.textContent = fmt(subtotal + ship + desc);
  }
  function shipEstimate(subtotal, region){
    if(!region) return 0;
    const base = region==='RM' ? 3990 : 5990;
    return subtotal>80000 ? 0 : base; // envío gratis sobre 80k
  }
  function updateBadges(){
    cCount.textContent = STORAGE.cart.reduce((a,b)=>a+b.qty,0);
    wCount.textContent = STORAGE.wishlist.length;
  }
  function openCart(){ drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false'); drawCart(); }
  function closeCart(){ drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }

  // ======= WISHLIST =======
  function toggleWish(id){
    const i = STORAGE.wishlist.indexOf(id);
    if(i>=0) STORAGE.wishlist.splice(i,1); else STORAGE.wishlist.push(id);
    persist(); updateBadges(); render();
  }

  // ======= PREMIUM =======
  function openPremium(){ pm.classList.add('open'); pm.setAttribute('aria-hidden','false'); }
  function closePremium(){ pm.classList.remove('open'); pm.setAttribute('aria-hidden','true'); }
  function applyCouponCode(code){
    STORAGE.coupon = (code||'').trim().toUpperCase();
    persist();
    alert(STORAGE.coupon?`Cupón aplicado: ${STORAGE.coupon}`:'Cupón borrado');
    drawCart();
  }
  function couponDiscount(subtotal){
    const c = STORAGE.coupon;
    if(!c) return 0;
    if(c==='POKE10') return Math.round(subtotal*0.10)*-1; // descuento 10%
    if(c==='ENVIOGRATIS') return 0; // manejado al calcular envío
    return 0;
  }

  // ======= IMPORT =======
  async function importCatalog(file){
    const text = await file.text();
    try{
      let arr;
      if(file.name.endsWith('.json')){ arr = JSON.parse(text); }
      else{ // CSV id,name,set,type,category,price,compareAtPrice,stock,image,tags
        arr = text.split(/\n|\r/).filter(Boolean).slice(1).map(line=>{
          const [id,name,set,type,category,price,compareAtPrice,stock,image,tags] = line.split(',');
          return {id:id||uid(), name, set, type, category, price:+price||0, compareAtPrice:+compareAtPrice||0, stock:+stock||0, image, tags:(tags||'').split('|'), createdAt:Date.now()};
        });
      }
      if(Array.isArray(arr)){
        PRODUCTS = arr.map(x=>({createdAt:Date.now(), ...x}));
        filterSet.innerHTML = '<option value=\"\">Todos los sets</option>';
        hydrateFilters(); render(); alert('Catálogo importado.');
      }
    }catch(e){ alert('Archivo inválido.'); }
  }

  // ======= VENDOR MODE (local-only) =======
  function toggleVendorMode(){ STORAGE.vendor=!STORAGE.vendor; persist(); toggleVendor.textContent = STORAGE.vendor? 'Desactivar':'Activar'; render(); }
  function editStock(id, val){ const p=PRODUCTS.find(x=>x.id===id); if(p){ p.stock=val; render(); }}
  function editPrice(id, val){ const p=PRODUCTS.find(x=>x.id===id); if(p){ p.price=val; render(); drawCart(); }}

  // ======= EVENTS =======
  q.oninput = ()=>{ current.page=1; render(); };
  filterSet.oninput=()=>{ current.page=1; render(); };
  filterType.oninput=()=>{ current.page=1; render(); };
  sortBy.oninput=()=>{ current.page=1; render(); };
  minPrice.onchange=(e)=>{ current.min=+e.target.value||0; current.page=1; render(); };
  maxPrice.onchange=(e)=>{ current.max=+e.target.value||0; current.page=1; render(); };
  document.getElementById('clearFilters').onclick=()=>{ current.cat=''; current.min=0; current.max=0; filterSet.value=''; filterType.value=''; q.value=''; current.page=1; render(); };

  btnCart.onclick = openCart; btnClose.onclick=closeCart;
  shipRegion.oninput = drawCart;
  btnWA.onclick = () => {
    const lines = cartLines(); if(!lines.length) return alert('Tu carrito está vacío.');
    const subtotal = lines.reduce((s,l)=>s+l.lineTotal,0);
    const ship = shipEstimate(subtotal, shipRegion.value);
    const desc = couponDiscount(subtotal);
    const total = subtotal + ship + desc;
    const resumen = lines.map(l=>`• ${l.qty} x ${l.name} — ${fmt(l.price)} c/u`).join('%0A');
    const msg = `Hola, quiero comprar:%0A${resumen}%0A%0ASubtotal: ${fmt(subtotal)}%0AEnvío: ${ship?fmt(ship):'GRATIS'}%0ACupón: ${STORAGE.coupon||'-'}%0ATotal: ${fmt(total)}%0ARegión: ${shipRegion.value||'-'}%0AMétodo de pago: Webpay / Transferencia`;
    const phone = '56937168521';
    window.open(`https://wa.me/${phone}?text=${msg}`,'_blank');
  };
  btnWebpay.onclick = checkoutWebpay;
  btnCopyOrder.onclick = () => {
    const lines = cartLines();
    const subtotal = lines.reduce((s,l)=>s+l.lineTotal,0);
    const text = lines.map(l=>`- ${l.qty} x ${l.name} (${fmt(l.price)} c/u)`).join('\n') + `\nSubtotal: ${fmt(subtotal)}`;
    navigator.clipboard.writeText(text).then(()=>alert('Resumen copiado.'));
  };
  btnShareCart.onclick = () => {
    const payload = btoa(JSON.stringify(STORAGE.cart));
    const url = location.origin + location.pathname + '?c=' + payload;
    navigator.clipboard.writeText(url).then(()=>alert('Enlace de carrito copiado.'));
  };
  btnPremium.onclick = openPremium; pmClose.onclick = closePremium; pm.onclick=(e)=>{ if(e.target===pm) closePremium(); };
  applyCoupon.onclick = ()=> applyCouponCode(couponInput.value);
  toggleVendor.onclick = toggleVendorMode;
  btnImport.onclick = ()=>{ if(fileImport.files?.[0]) importCatalog(fileImport.files[0]); else alert('Selecciona un archivo CSV/JSON.'); };

  // Close with ESC
  window.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeQuickView(); closePremium(); closeCart(); }});

  // ======= WEBPAY READY (placeholder) =======
  async function checkoutWebpay(){
    const order = {
      id: 'MH-'+Date.now(),
      items: cartLines().map(l=>({id:l.id, name:l.name, qty:l.qty, price:l.price})),
      subtotal: cartLines().reduce((s,l)=>s+l.lineTotal,0),
      shippingRegion: shipRegion.value||'',
      coupon: STORAGE.coupon||''
    };
    try{
      const res = await fetch('/api/pay/webpay/create', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(order)});
      if(!res.ok) return alert('No se pudo iniciar el pago.');
      const data = await res.json();
      if(data?.redirect_url) location.href = data.redirect_url; else alert('Respuesta inválida del pago.');
    }catch(e){ alert('Error de red al iniciar pago.'); }
  }
})();
