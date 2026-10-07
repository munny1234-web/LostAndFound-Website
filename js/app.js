/* ============================================================
   Lost&Found — shared app core (Firebase + helpers + nav)
   Same backend as the LostAndFound Android app.
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyDySzu8fa-EJBUnWQ7Mleu9U6lKtRl49oQ",
  authDomain: "lostandfound-3771e.firebaseapp.com",
  databaseURL: "https://lostandfound-3771e-default-rtdb.firebaseio.com",
  projectId: "lostandfound-3771e",
  storageBucket: "lostandfound-3771e.firebasestorage.app",
  messagingSenderId: "755801541921",
  appId: "1:755801541921:android:806eb9a0d8667ee5700260"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const ADMIN_EMAIL = "cse2310042@adust.edu.bd";
const isAdmin = u => !!u && !!u.email && u.email.toLowerCase() === ADMIN_EMAIL;

const CATEGORIES = ["Electronics","Wallet/Purse","Keys","Phone","Documents","Jewelry","Bag","Clothing","Glasses","Bottle/Container","Umbrella","Toy","Sports Equipment","Musical Instrument","Pet","Other"];
const CAT_ICONS = {"Electronics":"💻","Wallet/Purse":"👛","Keys":"🔑","Phone":"📱","Documents":"📄","Jewelry":"💍","Bag":"🎒","Clothing":"👕","Glasses":"👓","Bottle/Container":"🍼","Umbrella":"☂️","Toy":"🧸","Sports Equipment":"⚽","Musical Instrument":"🎸","Pet":"🐾","Other":"📦"};

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const qs = k => new URLSearchParams(location.search).get(k);

function toast(msg){
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function timeAgo(ts){
  if(!ts) return "";
  const d = Date.now() - ts;
  const m = Math.floor(d/60000);
  if(m < 1) return "Just now";
  if(m < 60) return m + "m ago";
  const h = Math.floor(m/60);
  if(h < 24) return h + "h ago";
  const dy = Math.floor(h/24);
  if(dy < 7) return dy + "d ago";
  return new Date(ts).toLocaleDateString();
}
function fmtTime(ts){ return new Date(ts).toLocaleString([], {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }

/* ---------- image → compressed Base64 (mirrors ImageUtils.java) ---------- */
function compressImage(file, maxDim = 800, quality = 0.7){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let {width:w, height:h} = img;
      if(Math.max(w,h) > maxDim){
        const r = maxDim / Math.max(w,h);
        w = Math.round(w*r); h = Math.round(h*r);
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
/* app stores RAW Base64 (Base64.decode in ImageUtils.java) — strip the data-URI prefix before saving */
const toRawB64 = d => String(d || "").replace(/^data:image\/[a-z]+;base64,/, "");
const imgSrc = u => (u && (u.startsWith("data:") || u.startsWith("http"))) ? u : (u ? "data:image/jpeg;base64," + u : "");

/* ---------- in-app notification (mirrors FCMHelper.java) ---------- */
async function sendNotification(toUserId, title, message, icon, type, itemId, itemTitle){
  const me = auth.currentUser;
  if(!toUserId || (me && toUserId === me.uid)) return;
  let senderName = "";
  try{ senderName = (await db.ref("users").child(me.uid).child("name").once("value")).val() || ""; }catch(e){}
  return db.ref("notifications").child(toUserId).push({
    title, message,
    icon: icon || "🔔",
    timestamp: Date.now(),
    read: false,
    type: type || "",
    itemId: itemId || "",
    itemTitle: itemTitle || "",
    senderId: me ? me.uid : "",
    senderName
  });
}

/* ---------- text similarity (local fallback) ---------- */
function tokenize(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9ঀ-৿\s]/g," ").split(/\s+/).filter(w => w.length > 1); }
function jaccard(a, b){
  const A = new Set(tokenize(a)), B = new Set(tokenize(b));
  if(!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(w => { if(B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

/* ---------- Hugging Face sentence-similarity (mirrors FraudCheckHelper.java) ---------- */
/* The token is NOT stored here. It is read from js/secrets.js, which is listed in
   .gitignore so it never goes to GitHub. To set it up, copy js/secrets.example.js
   to js/secrets.js and paste your token there.
   If secrets.js is missing, the fraud check still works using the local estimate. */
let _hfToken = null;
function loadHfToken(){
  if(_hfToken !== null) return Promise.resolve(_hfToken);
  return new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "js/secrets.js";
    s.onload = () => { _hfToken = (window.LF_SECRETS && window.LF_SECRETS.HF_TOKEN) || ""; resolve(_hfToken); };
    s.onerror = () => { _hfToken = ""; resolve(""); };
    document.head.appendChild(s);
  });
}
const HF_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/sentence-similarity";
async function hfCheckMatch(claimAnswer, realAnswer){
  try{
    const token = await loadHfToken();
    if(!token) throw new Error("No HF token");
    const res = await fetch(HF_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: { source_sentence: claimAnswer, sentences: [realAnswer] } })
    });
    if(!res.ok) throw new Error("HF " + res.status);
    const arr = await res.json();
    const score = Array.isArray(arr) ? arr[0] : 0;
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }catch(e){
    // no token / model asleep / network issue → rough local estimate (same fallback idea as the app)
    return Math.round(jaccard(claimAnswer, realAnswer) * 100);
  }
}
function verdictFor(p){
  if(p >= 75) return "✅ Strong match — the details align closely with the item's hidden information.";
  if(p >= 45) return "🟡 Partial match — some details align, manual review recommended.";
  return "⚠️ Weak match — the answer does not closely match the item's hidden details.";
}

/* ---------- item card renderer ---------- */
function itemCardHTML(id, it){
  const tagCls = it.type === "lost" ? "lost" : "";
  const resolved = it.status && (it.status.includes("Found") || it.status.includes("Returned"));
  const img = imgSrc(it.imageUrl);
  return `<div class="card item-card" onclick="location.href='item.html?id=${id}'">
    <div class="img-clip">${img ? `<img class="item-img" src="${img}" alt="" loading="lazy">` : `<div class="item-img">${CAT_ICONS[it.category] || "📦"}</div>`}</div>
    <div class="item-body">
      <span class="tag ${resolved ? "resolved" : tagCls}">${resolved ? "Resolved" : (it.type === "lost" ? "Lost" : "Found")}</span>
      <div class="item-title">${esc(it.title)}</div>
      <div class="item-meta">${CAT_ICONS[it.category] || "📦"} ${esc(it.category || "Other")} · 📍 ${esc(it.location || "—")}</div>
      <div class="item-meta">${timeAgo(it.timestamp)}${it.reward ? " · 🎁 " + esc(it.reward) : ""}</div>
    </div></div>`;
}

/* ---------- navbar ---------- */
function initNav(active){
  const el = document.getElementById("nav");
  if(!el) return;
  el.className = "nav";
  el.innerHTML = `<div class="nav-inner">
    <a class="brand" href="home.html"><span>🔎</span><span class="b-lost">Lost</span><span class="b-found">&amp;Found</span></a>
    <button class="hamburger" aria-label="Menu" onclick="this.nextElementSibling.classList.toggle('open')">☰</button>
    <div class="nav-links">
      <a href="home.html" data-k="home">Home</a>
      <a href="map.html" data-k="map">Map</a>
      <a href="photo-search.html" data-k="photo">Photo Search</a>
      <a href="chats.html" data-k="chats">Chats<span class="badge-dot" id="chatBadge" style="display:none"></span></a>
      <a href="notifications.html" data-k="notif">🔔<span class="badge-dot" id="notifBadge" style="display:none"></span></a>
      <a href="profile.html" data-k="profile">Profile</a>
      <a href="login.html" id="navAuth" data-k="auth">Login</a>
    </div></div>`;
  const a = el.querySelector(`[data-k="${active}"]`);
  if(a) a.classList.add("active");
  auth.onAuthStateChanged(u => {
    const na = document.getElementById("navAuth");
    if(!na) return;
    if(u){
      na.textContent = "Logout";
      na.href = "#";
      na.onclick = e => { e.preventDefault(); auth.signOut().then(() => location.href = "index.html"); };
      db.ref("notifications").child(u.uid).on("value", s => {
        let unread = 0;
        s.forEach(c => { const v = c.val(); if(v && v.read !== true) unread++; });
        const b = document.getElementById("notifBadge");
        if(b){ b.style.display = unread ? "flex" : "none"; b.textContent = unread > 9 ? "9+" : unread; }
      });
      /* Chats badge: how many conversations have something new for me */
      db.ref("userChats").child(u.uid).on("value", s => {
        let unread = 0;
        s.forEach(c => { const v = c.val(); if(v && (v.lastTimestamp||0) > (v.lastRead||0)) unread++; });
        const b = document.getElementById("chatBadge");
        if(b){ b.style.display = unread ? "flex" : "none"; b.textContent = unread > 9 ? "9+" : unread; }
      });
    } else { na.textContent = "Login"; na.href = "login.html"; na.onclick = null; }
  });
}
function requireAuth(cb){
  auth.onAuthStateChanged(u => {
    if(!u){ location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); return; }
    cb(u);
  });
}
function requireAdmin(cb){
  auth.onAuthStateChanged(u => {
    if(!u || !isAdmin(u)){ location.href = "admin-login.html"; return; }
    cb(u);
  });
}
/* chat id — same formula as ChatActivity.java */
const chatIdFor = (a, b, itemId) => (a < b ? a + "_" + b + "_" + itemId : b + "_" + a + "_" + itemId);

/* ---------- map tiles ----------
   OpenStreetMap's own volunteer tile servers now reject requests that carry no
   website address (which is exactly what happens when a page is opened straight
   from a file:// path) and answer 403 "Access blocked". CARTO's free basemap CDN
   serves the same OpenStreetMap map data without that restriction, and Esri is
   kept as an automatic backup if CARTO ever fails too. Every page that shows a
   map calls this one function, so there is a single place to change providers. */
const TILE_PRIMARY  = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_FALLBACK = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

function addBaseTiles(map){
  const base = L.tileLayer(TILE_PRIMARY, {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors © CARTO"
  }).addTo(map);

  let swapped = false;
  base.on("tileerror", () => {
    if(swapped) return;
    swapped = true;
    map.removeLayer(base);
    L.tileLayer(TILE_FALLBACK, {
      maxZoom: 19,
      attribution: "Tiles © Esri — Source: Esri, HERE, Garmin, © OpenStreetMap contributors"
    }).addTo(map);
  });
  return base;
}

/* ---------- reverse geocoding (OpenStreetMap Nominatim — free, no key) ---------- */
async function reverseGeocode(lat, lng){
  try{
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
      { headers: { "Accept": "application/json" } });
    const d = await r.json();
    if(d && d.display_name){
      // keep it readable: first 4 parts of the address
      return d.display_name.split(",").slice(0, 4).map(s => s.trim()).join(", ");
    }
  }catch(e){ console.warn("reverse geocode failed", e); }
  return "";
}

/* ---------- forward geocoding: address text -> coordinates ---------- */
async function geocodeAddress(q){
  try{
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=" + encodeURIComponent(q),
      { headers: { "Accept": "application/json" } });
    const d = await r.json();
    if(d && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  }catch(e){ console.warn("geocode failed", e); }
  return null;
}

/* ---------- cached profile-photo lookup (for chat / notifications avatars) ---------- */
const _photoCache = {};
async function fetchUserPhoto(uid){
  if(!uid) return "";
  if(uid in _photoCache) return _photoCache[uid];
  try{
    const v = (await db.ref("users").child(uid).child("photoUrl").once("value")).val();
    _photoCache[uid] = v || "";
    return _photoCache[uid];
  }catch(e){ return ""; }
}

/* ---------- reusable multi-photo picker: file input -> thumbnail strip with add/remove ----------
   Renders into `stripId`. Call .getAll() to read compressed base64 strings (data URIs),
   or .setAll() to preload existing photos (e.g. when editing a post). */
function initPhotoPicker({ inputId, stripId, max = 4, maxDim = 800, quality = 0.7, onChange }){
  const input = document.getElementById(inputId);
  let items = [];

  function render(){
    const strip = document.getElementById(stripId);
    if(items.length === 0){
      strip.innerHTML = `<label for="${inputId}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;height:110px;border:1.5px dashed var(--line);border-radius:12px;cursor:pointer;color:var(--ink-soft);font-size:.85rem">
        <span style="font-size:1.6rem">📷</span>Tap to add photos (up to ${max})</label>`;
      return;
    }
    strip.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap">` +
      items.map((it,i) => `
        <div style="position:relative;width:76px;height:76px;flex-shrink:0">
          <img src="${it.b64}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;border:1px solid var(--line)">
          ${i === 0 ? `<span style="position:absolute;bottom:3px;left:3px;background:rgba(20,20,43,.75);color:#fff;font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:5px">COVER</span>` : ""}
          <button type="button" data-i="${i}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:var(--danger);color:#fff;border:none;font-size:.7rem;cursor:pointer;line-height:1">×</button>
        </div>`).join("") +
      (items.length < max ? `<label for="${inputId}" style="width:76px;height:76px;flex-shrink:0;border:1.5px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.6rem;color:var(--ink-soft)">+</label>` : "") +
      `</div>`;
    strip.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
      items.splice(parseInt(b.dataset.i), 1);
      render();
      if(onChange) onChange(items);
    });
  }

  async function handleFiles(fileList){
    const room = max - items.length;
    const files = [...fileList].slice(0, room);
    if([...fileList].length > files.length) toast(`Only ${max} photos allowed — extra ones skipped.`);
    for(const f of files){
      const b64 = await compressImage(f, maxDim, quality);
      items.push({ b64 });
    }
    render();
    if(onChange) onChange(items);
  }

  input.addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
  render();

  return {
    getAll: () => items.map(it => it.b64),
    setAll: (b64Array) => { items = (b64Array||[]).map(b64 => ({ b64 })); render(); },
    count: () => items.length
  };
}
