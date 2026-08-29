(function(){
  "use strict";

  /* ---------------- static data ---------------- */
  var GAMES = ["Valorant","League of Legends","Dota 2","RoV","PUBG Mobile","Free Fire","Genshin Impact",
    "Honkai: Star Rail","Zenless Zone Zero","Wuthering Waves","Mobile Legends","Apex Legends","Overwatch 2",
    "Counter-Strike 2","Fortnite","Call of Duty: Mobile","Naraka: Bladepoint","Marvel Rivals",
    "EA Sports FC","Minecraft","Roblox","Grand Theft Auto V","Elden Ring","Stardew Valley","Teamfight Tactics"];

  var DAYS = [
    {id:"mon",label:"จ"},{id:"tue",label:"อ"},{id:"wed",label:"พ"},{id:"thu",label:"พฤ"},
    {id:"fri",label:"ศ"},{id:"sat",label:"ส"},{id:"sun",label:"อา"}
  ];

  var TIMES = [
    {id:"morning",label:"เช้า"},{id:"afternoon",label:"บ่าย"},
    {id:"evening",label:"เย็น"},{id:"night",label:"ดึก"}
  ];

  var GENDERS = [{id:"male",label:"ชาย"},{id:"female",label:"หญิง"},{id:"non_binary",label:"Non-binary"},{id:"unspecified",label:"ขอไม่เปิดเผย"}];
  var GENDER_LABELS = {male:"ชาย", female:"หญิง", non_binary:"Non-binary", unspecified:"ขอไม่เปิดเผย"};
  // ตัวเลือก "สนใจเพศไหน" — โชว์เฉพาะตอนเลือกเป้าหมาย "เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ"
  var INTERESTED_IN_OPTIONS = [{id:"male",label:"ชาย"},{id:"female",label:"หญิง"}];
  var INTERESTED_IN_LABELS = {male:"ชาย", female:"หญิง"};

  var GOALS = [{id:"friends",label:"หาเพื่อนเล่นเกมอย่างเดียว"},{id:"open",label:"เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ"}];
  var GOAL_LABELS = {friends:"หาเพื่อนเล่นเกมอย่างเดียว", open:"เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ"};

  var STYLES = ["สายชิล ไม่ซีเรียส","จริงจัง/ตั้งใจแข่ง","ชอบคุยระหว่างเกม","โฟกัสเงียบ ๆ",
    "มือใหม่โอเค ใจดี","สายฝึกหนัก อยากพัฒนา","ชอบวางแผน","สายฮา มีมทุกเกม",
    "ใช้วอยซ์แชทได้","พิมพ์แชทอย่างเดียว"];

  var GENRES = ["Survival","Cozy","Farming","Sandbox/Building","RPG","FPS/Shooter","MOBA",
    "Battle Royale","Simulation","Horror","Racing/Sports","Puzzle/Casual","Card/Strategy","Gacha/สะสม"];

  var EMOJIS = ["😀","😂","😅","🥹","😍","😘","😎","🤔","🙄","😭","😡","🥳","😱","😴","🤝","👀",
    "👍","👎","🙏","🔥","💯","❤️","💀","✨","🎮","🎉","☕","🌙","👋","😏"];

  var AVATAR_COLORS = ["#d85f22","#1f9d63","#3a6bd8","#a13fc9","#c9433f","#2aa3a3","#c98a1f","#6d5fd8"];

  function hashColor(str){
    var h=0; for(var i=0;i<str.length;i++){h=str.charCodeAt(i)+((h<<5)-h);}
    return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];
  }
  function initials(name){
    var parts = name.trim().split(/\s+/);
    var s = parts[0] ? parts[0].slice(0,2) : "??";
    return s.toUpperCase();
  }

  /* ---------------- theme toggle (per-device UI preference only) ---------------- */
  var THEME_KEY = "squadqueue_theme_v1";
  function getCurrentTheme(){
    var attr = document.documentElement.getAttribute("data-theme");
    if(attr === "dark" || attr === "light") return attr;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
  }
  function restoreTheme(){
    try{
      var saved = localStorage.getItem(THEME_KEY);
      if(saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
    }catch(e){}
  }
  restoreTheme();

  /* ---------------- utils ---------------- */
  function el(tag, attrs, children){
    var e = document.createElement(tag);
    attrs = attrs || {};
    for(var k in attrs){
      if(k==="class") e.className = attrs[k];
      else if(k==="html") e.innerHTML = attrs[k];
      else if(k.indexOf("on")===0 && typeof attrs[k]==="function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children||[]).forEach(function(c){
      if(typeof c === "string") e.appendChild(document.createTextNode(c));
      else if(c) e.appendChild(c);
    });
    return e;
  }
  function intersect(a,b){ return a.filter(function(x){ return b.indexOf(x)>-1; }); }
  function symDiff(a,b){
    var onlyA = a.filter(function(x){ return b.indexOf(x)===-1; });
    var onlyB = b.filter(function(x){ return a.indexOf(x)===-1; });
    return onlyA.concat(onlyB);
  }
  function dice(a,b){
    if(a.length===0 && b.length===0) return 0;
    return (2*intersect(a,b).length)/(a.length+b.length);
  }

  // ชื่อเกมพิมพ์เองได้อิสระ (ปุ่ม "เพิ่มเกมอื่น...") คนละคนอาจพิมพ์ตัวพิมพ์เล็ก/ใหญ่หรือเว้นวรรค
  // ไม่เหมือนกัน ทั้งที่หมายถึงเกมเดียวกัน — intersect/dice ปกติเทียบสตริงตรงตัวเป๊ะๆ
  // เลยพลาดจับคู่ ฟังก์ชันชุดนี้เทียบแบบ normalize (ตัดช่องว่างหัวท้าย/ยุบช่องว่างซ้ำ/ไม่สนตัวพิมพ์เล็กใหญ่)
  // แต่ยังคงชื่อที่โชว์ผลเป็นตัวสะกดจากรายการเกมมาตรฐานถ้ามี ไม่งั้นใช้ตัวสะกดของฝั่ง a
  function normGame(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g," "); }
  function canonicalGameName(name){
    var match = GAMES.filter(function(g){ return normGame(g) === normGame(name); })[0];
    return match || name;
  }
  function intersectGames(a,b){
    var bNorm = b.map(normGame);
    return a.filter(function(x){ return bNorm.indexOf(normGame(x))>-1; }).map(canonicalGameName);
  }
  function symDiffGames(a,b){
    var aNorm = a.map(normGame), bNorm = b.map(normGame);
    var onlyA = a.filter(function(x){ return bNorm.indexOf(normGame(x))===-1; });
    var onlyB = b.filter(function(x){ return aNorm.indexOf(normGame(x))===-1; });
    return onlyA.concat(onlyB);
  }
  function diceGames(a,b){
    if(a.length===0 && b.length===0) return 0;
    return (2*intersectGames(a,b).length)/(a.length+b.length);
  }
  var DAY_LABELS = DAYS.reduce(function(m,d){ m[d.id]=d.label; return m; }, {});
  var TIME_FULL_LABELS = TIMES.reduce(function(m,t){ m[t.id]=t.label; return m; }, {});
  function showToast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(function(){ t.hidden = true; }, 2200);
  }

  /* ---------------- notifications (in-app popup + browser desktop) ---------------- */
  var MATCH_NOTIFY_THRESHOLD = 30;

  // Whether the user has turned notifications ON in-app. This is separate
  // from window.Notification.permission: the browser permission, once
  // granted, cannot be revoked via JS, so we keep our own on/off preference
  // and gate every notification (in-app card + desktop) behind it. Defaults
  // to on so existing behavior doesn't change for people who never touch it.
  function notifPrefKey(){ return "squadqueue_notif_enabled_" + (state.user ? state.user.id : "anon"); }
  function isNotifEnabled(){
    try{
      var raw = localStorage.getItem(notifPrefKey());
      if(raw === null) return true;
      return raw === "1";
    }catch(e){ return true; }
  }
  function setNotifEnabled(on){
    try{ localStorage.setItem(notifPrefKey(), on ? "1" : "0"); }catch(e){}
  }

  function showNotification(title, text, onClick){
    if(!isNotifEnabled()) return;
    var stack = document.getElementById("notifStack");
    var card = el("div",{class:"notif-card"});
    card.appendChild(el("div",{class:"notif-icon"},["🔔"]));
    var body = el("div",{class:"notif-body"});
    body.appendChild(el("div",{class:"notif-title"},[title]));
    body.appendChild(el("div",{class:"notif-text"},[text]));
    card.appendChild(body);
    var closeBtn = el("button",{class:"notif-close", type:"button", "aria-label":"ปิด"},["✕"]);
    card.appendChild(closeBtn);

    function remove(){ if(card.parentNode) card.parentNode.removeChild(card); }
    closeBtn.addEventListener("click", function(e){ e.stopPropagation(); remove(); });
    if(onClick){ card.addEventListener("click", function(){ remove(); onClick(); }); }

    stack.appendChild(card);
    setTimeout(remove, 6500);

    if(window.Notification && Notification.permission === "granted" && document.hidden){
      try{
        var n = new Notification(title, {body:text});
        n.onclick = function(){
          window.focus();
          if(onClick) onClick();
          n.close();
        };
      }catch(e){}
    }
  }

  function updateNotifToggleBtn(){
    var btn = document.getElementById("notifToggleBtn");
    if(!btn) return;
    var on = isNotifEnabled();
    btn.classList.toggle("enabled", on);
    btn.title = on ? "แจ้งเตือนเปิดอยู่ (กดเพื่อปิด)" : "แจ้งเตือนปิดอยู่ (กดเพื่อเปิด)";
  }

  function toggleNotifPermission(){
    if(isNotifEnabled()){
      // Turning off never touches the browser's own Notification.permission
      // (it can't be revoked from JS anyway) — we just stop using it.
      setNotifEnabled(false);
      updateNotifToggleBtn();
      showToast("ปิดการแจ้งเตือนแล้ว");
      return;
    }

    if(!window.Notification){
      // No desktop notification API at all, but in-app notification cards
      // still work fine, so just flip the preference on.
      setNotifEnabled(true);
      updateNotifToggleBtn();
      showToast("เปิดการแจ้งเตือนแล้ว!");
      return;
    }
    if(Notification.permission === "denied"){
      // Can still enable in-app cards even if desktop notifications are
      // blocked at the browser level.
      setNotifEnabled(true);
      updateNotifToggleBtn();
      showToast("เปิดการแจ้งเตือนในแอปแล้ว (แจ้งเตือนเดสก์ท็อปถูกบล็อกไว้ที่เบราว์เซอร์)");
      return;
    }
    if(Notification.permission === "granted"){
      setNotifEnabled(true);
      updateNotifToggleBtn();
      showToast("เปิดการแจ้งเตือนแล้ว!");
      return;
    }
    Notification.requestPermission().then(function(perm){
      setNotifEnabled(true);
      updateNotifToggleBtn();
      showToast(perm === "granted" ? "เปิดการแจ้งเตือนแล้ว!" : "เปิดการแจ้งเตือนในแอปแล้ว");
    });
  }

  /* ---------------- per-user mute (client-side only, per browser) ---------------- */
  function mutedKey(){ return "squadqueue_muted_" + (state.user ? state.user.id : "anon"); }
  function loadMuted(){
    try{ var raw = localStorage.getItem(mutedKey()); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch(e){ return new Set(); }
  }
  function saveMuted(set){
    try{ localStorage.setItem(mutedKey(), JSON.stringify(Array.from(set))); }catch(e){}
  }
  function isMuted(candId){ return loadMuted().has(candId); }
  function toggleMute(candId){
    var muted = loadMuted();
    if(muted.has(candId)) muted.delete(candId); else muted.add(candId);
    saveMuted(muted);
    return muted.has(candId);
  }

  /* ---------------- pin candidates to top of lobby (client-side only, per browser) ---------------- */
  function pinnedKey(){ return "squadqueue_pinned_" + (state.user ? state.user.id : "anon"); }
  function loadPinned(){
    try{ var raw = localStorage.getItem(pinnedKey()); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch(e){ return new Set(); }
  }
  function savePinned(set){
    try{ localStorage.setItem(pinnedKey(), JSON.stringify(Array.from(set))); }catch(e){}
  }
  function isPinned(candId){ return loadPinned().has(candId); }
  function togglePinned(candId){
    var pinned = loadPinned();
    if(pinned.has(candId)) pinned.delete(candId); else pinned.add(candId);
    savePinned(pinned);
    return pinned.has(candId);
  }

  /* ---------------- ตั้งชื่อเล่นให้เพื่อนที่คุยด้วย (client-side only, เห็นเฉพาะเรา) ---------------- */
  function nicknameKey(){ return "squadqueue_nicknames_" + (state.user ? state.user.id : "anon"); }
  function loadNicknames(){
    try{ var raw = localStorage.getItem(nicknameKey()); return raw ? JSON.parse(raw) : {}; }
    catch(e){ return {}; }
  }
  function saveNicknames(map){
    try{ localStorage.setItem(nicknameKey(), JSON.stringify(map)); }catch(e){}
  }
  function getNickname(id){ return loadNicknames()[id] || ""; }
  function setNickname(id, name){
    var map = loadNicknames();
    name = String(name||"").trim().slice(0,24);
    if(name) map[id] = name; else delete map[id];
    saveNicknames(map);
  }
  // ชื่อที่ควรโชว์ให้เราเห็น: ชื่อเล่นที่เราตั้งเอง (ถ้ามี) ไม่งั้นใช้ชื่อจริงที่เขาตั้งในโปรไฟล์
  // — เฉพาะเบราว์เซอร์ของเราเท่านั้นที่เห็นชื่อเล่นนี้ อีกฝ่ายไม่รู้เรื่องด้วย
  function displayName(p){
    if(!p) return "";
    var nick = getNickname(p.id);
    return nick || p.name;
  }

  /* ---------------- show/hide mismatch details (per-viewer preference) ---------------- */
  function showMismatchKey(){ return "squadqueue_show_mismatch_" + (state.user ? state.user.id : "anon"); }
  function isShowMismatch(){
    try{
      var raw = localStorage.getItem(showMismatchKey());
      if(raw === null) return true;
      return raw === "1";
    }catch(e){ return true; }
  }
  function setShowMismatch(on){
    try{ localStorage.setItem(showMismatchKey(), on ? "1" : "0"); }catch(e){}
  }
  function updateMismatchToggleBtn(){
    var btn = document.getElementById("mismatchToggleBtn");
    if(!btn) return;
    var on = isShowMismatch();
    btn.classList.toggle("active", on);
    btn.textContent = on ? "🙈 ซ่อนจุดที่ไม่ตรงกัน" : "👁 แสดงจุดที่ไม่ตรงกัน";
  }

  function seenMatchesKey(){ return "squadqueue_seen_matches_" + (state.user ? state.user.id : "anon"); }
  function loadSeenMatches(){
    try{ var raw = localStorage.getItem(seenMatchesKey()); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch(e){ return new Set(); }
  }
  function saveSeenMatches(set){
    try{ localStorage.setItem(seenMatchesKey(), JSON.stringify(Array.from(set))); }catch(e){}
  }

  function checkNewMatches(){
    if(!state.profile) return;
    var seen = loadSeenMatches();
    var fresh = [];
    var muted = loadMuted();
    state.candidates.forEach(function(c){
      if(seen.has(c.id)) return;
      if(muted.has(c.id)) return;
      var score = matchScore(state.profile, c);
      if(score.total > MATCH_NOTIFY_THRESHOLD){
        seen.add(c.id);
        fresh.push({cand:c, score:score});
      }
    });
    saveSeenMatches(seen);
    if(fresh.length === 0) return;

    fresh.sort(function(a,b){ return b.score.total - a.score.total; });
    if(fresh.length === 1){
      var f = fresh[0];
      showNotification("เจอคู่ใหม่ที่เข้ากับคุณ! 🎮", displayName(f.cand) + " ตรงกับคุณ " + f.score.total + "%", function(){ openChat(f.cand); });
    } else {
      var top = fresh[0];
      showNotification("เจอคู่ใหม่ " + fresh.length + " คน! 🎮", "คะแนนสูงสุด: " + displayName(top.cand) + " (" + top.score.total + "%)", function(){
        var lobby = document.getElementById("viewLobby");
        if(!lobby.hidden) lobby.scrollIntoView({behavior:"smooth"});
      });
    }
  }

  var candidatePollTimer = null;
  function startCandidatePolling(){
    stopCandidatePolling();
    candidatePollTimer = setInterval(function(){
      loadCandidates().then(function(){
        checkNewMatches();
        if(!document.getElementById("viewLobby").hidden) renderGrid();
      }).catch(function(){});
      loadConversations();
    }, 45000);
  }
  function stopCandidatePolling(){
    if(candidatePollTimer){ clearInterval(candidatePollTimer); candidatePollTimer = null; }
  }

  /* ---------------- API helper ---------------- */
  function apiFetch(path, options){
    options = options || {};
    var opts = {
      method: options.method || "GET",
      credentials: "include",
      headers: {}
    };
    if(options.body !== undefined){
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(options.body);
    }
    return fetch("/api" + path, opts).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok){
          var err = new Error(data.error || "เกิดข้อผิดพลาด");
          err.status = res.status;
          err.needsVerification = data.needsVerification;
          err.email = data.email;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------- matching ---------------- */
  function matchScore(user, cand){
    var candGenres = cand.genres || [];
    var userGenres = user.genres || [];
    var gameScore = diceGames(user.games, cand.games);
    var timeScore = user.times.length ? intersect(user.times, cand.times).length/user.times.length : 0;
    var dayScore = user.days.length ? intersect(user.days, cand.days).length/user.days.length : 0;
    var styleScore = dice(user.styles, cand.styles);
    var genreScore = dice(userGenres, candGenres);
    var total = gameScore*0.35 + timeScore*0.2 + dayScore*0.15 + styleScore*0.15 + genreScore*0.15;
    return {
      total: Math.round(total*100),
      breakdown: {
        games: Math.round(gameScore*100),
        day: Math.round(dayScore*100),
        time: Math.round(timeScore*100),
        style: Math.round(styleScore*100),
        genre: Math.round(genreScore*100)
      },
      mismatch: {
        // เกม/สไตล์/แนวเกม ใช้คะแนนแบบ dice (สนใจทั้ง 2 ฝั่ง) จึงโชว์ส่วนต่างแบบสมมาตร
        games: symDiffGames(user.games, cand.games),
        styles: symDiff(user.styles, cand.styles),
        genres: symDiff(userGenres, candGenres),
        // วัน/เวลา ใช้คะแนนจาก "ความครอบคลุมความต้องการของคุณ" จึงโชว์เฉพาะสิ่งที่คุณอยากได้แต่เขาไม่มี
        days: user.days.filter(function(id){ return cand.days.indexOf(id)===-1; }).map(function(id){ return DAY_LABELS[id] || id; }),
        times: user.times.filter(function(id){ return cand.times.indexOf(id)===-1; }).map(function(id){ return TIME_FULL_LABELS[id] || id; })
      },
      // จุดที่ตรงกันจริง (สีเขียว) — โชว์เสมอไม่ว่าจะเปิด/ปิดปุ่มซ่อนจุดที่ไม่ตรงกัน
      matched: {
        games: intersectGames(user.games, cand.games),
        styles: intersect(user.styles, cand.styles),
        genres: intersect(userGenres, candGenres),
        days: intersect(user.days, cand.days).map(function(id){ return DAY_LABELS[id] || id; }),
        times: intersect(user.times, cand.times).map(function(id){ return TIME_FULL_LABELS[id] || id; })
      }
    };
  }

  /* ---------------- app state ---------------- */
  var state = {
    user: null,
    profile: null,
    candidates: [],
    conversations: [],
    onlineIds: new Set(),
    socket: null,
    activeChatId: null
  };

  /* ---------------- profile form (shared by onboarding + edit modal) ---------------- */
  function buildForm(mount, existing, onSave){
    mount.innerHTML = "";
    var data = {
      name: existing ? existing.name : "",
      gender: existing && existing.gender ? existing.gender : "unspecified",
      goal: existing && existing.goal ? (Array.isArray(existing.goal) ? existing.goal.slice() : [existing.goal]) : ["friends"],
      games: existing ? existing.games.slice() : [],
      days: existing ? existing.days.slice() : [],
      times: existing ? existing.times.slice() : [],
      styles: existing ? existing.styles.slice() : [],
      genres: existing && existing.genres ? existing.genres.slice() : [],
      goodToKnow: existing ? existing.goodToKnow : "",
      minMatchPct: existing && typeof existing.minMatchPct === "number" ? existing.minMatchPct : 0,
      interestedIn: existing && existing.interestedIn ? existing.interestedIn.slice() : []
    };

    var form = el("form", {});

    // name
    var nameField = el("div", {class:"field"});
    nameField.appendChild(el("label",{class:"field-label"},["ชื่อ / แท็กที่อยากให้คนอื่นเห็น"]));
    var nameInput = el("input",{class:"text-input", type:"text", maxlength:"24", placeholder:"เช่น ริว_ninja", value:data.name});
    nameField.appendChild(nameInput);
    form.appendChild(nameField);

    // gender
    var genderField = el("div",{class:"field"});
    genderField.appendChild(el("label",{class:"field-label"},["เพศ"]));
    var genderRow = el("div",{class:"select-row"});
    function renderGender(){
      genderRow.innerHTML = "";
      GENDERS.forEach(function(g){
        var pill = el("div",{class:"select-pill"+(data.gender===g.id?" active":"")},[g.label]);
        pill.addEventListener("click", function(){ data.gender = g.id; renderGender(); });
        genderRow.appendChild(pill);
      });
    }
    renderGender();
    genderField.appendChild(genderRow);
    form.appendChild(genderField);

    // goal
    var goalField = el("div",{class:"field"});
    goalField.appendChild(el("label",{class:"field-label"},["มาหาเพื่อนเล่นเกมแบบไหน (เลือกได้มากกว่า 1)"]));
    var goalRow = el("div",{class:"select-row"});
    function renderGoal(){
      goalRow.innerHTML = "";
      GOALS.forEach(function(g){
        var active = data.goal.indexOf(g.id) > -1;
        var pill = el("div",{class:"select-pill"+(active?" active":"")},[g.label]);
        pill.addEventListener("click", function(){
          var i = data.goal.indexOf(g.id);
          if(i>-1) data.goal.splice(i,1); else data.goal.push(g.id);
          renderGoal();
          updateInterestedInVisibility();
        });
        goalRow.appendChild(pill);
      });
    }
    renderGoal();
    goalField.appendChild(goalRow);
    form.appendChild(goalField);

    // สนใจเพศไหน — โชว์เฉพาะตอนเลือก "เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ" ด้านบน
    var interestedInField = el("div",{class:"field"});
    interestedInField.appendChild(el("label",{class:"field-label"},["สนใจเพศไหน (เลือกได้มากกว่า 1)"]));
    var interestedInRow = el("div",{class:"select-row"});
    function renderInterestedIn(){
      interestedInRow.innerHTML = "";
      INTERESTED_IN_OPTIONS.forEach(function(g){
        var active = data.interestedIn.indexOf(g.id) > -1;
        var pill = el("div",{class:"select-pill"+(active?" active":"")},[g.label]);
        pill.addEventListener("click", function(){
          var i = data.interestedIn.indexOf(g.id);
          if(i>-1) data.interestedIn.splice(i,1); else data.interestedIn.push(g.id);
          renderInterestedIn();
        });
        interestedInRow.appendChild(pill);
      });
    }
    function updateInterestedInVisibility(){
      interestedInField.hidden = data.goal.indexOf("open") === -1;
    }
    renderInterestedIn();
    interestedInField.appendChild(interestedInRow);
    updateInterestedInVisibility();
    form.appendChild(interestedInField);

    // games
    var gamesField = el("div",{class:"field"});
    gamesField.appendChild(el("label",{class:"field-label"},["เกมที่เล่นประจำ (เลือกได้หลายเกม)"]));
    var gamesRow = el("div",{class:"chip-row"});
    function renderGameChips(){
      gamesRow.innerHTML = "";
      GAMES.concat(data.games.filter(function(g){return GAMES.indexOf(g)===-1;})).forEach(function(g){
        var active = data.games.indexOf(g) > -1;
        var chip = el("div",{class:"chip"+(active?" active":"")},[g]);
        chip.addEventListener("click", function(){
          var i = data.games.indexOf(g);
          if(i>-1) data.games.splice(i,1); else data.games.push(g);
          renderGameChips();
        });
        gamesRow.appendChild(chip);
      });
      var addWrap = el("div",{class:"chip-add"});
      var addInput = el("input",{type:"text",placeholder:"เพิ่มเกมอื่น..."});
      var addBtn = el("button",{type:"button"},["+"]);
      function doAdd(){
        var v = addInput.value.trim();
        if(v && data.games.indexOf(v)===-1){ data.games.push(v); addInput.value=""; renderGameChips(); }
      }
      addBtn.addEventListener("click", doAdd);
      addInput.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); doAdd(); } });
      addWrap.appendChild(addInput); addWrap.appendChild(addBtn);
      gamesRow.appendChild(addWrap);
    }
    renderGameChips();
    gamesField.appendChild(gamesRow);
    form.appendChild(gamesField);

    // days
    var daysField = el("div",{class:"field"});
    daysField.appendChild(el("label",{class:"field-label"},["วันที่มักจะว่างเล่นเกม"]));
    var daysRow = el("div",{class:"chip-row"});
    function renderDays(){
      daysRow.innerHTML = "";
      DAYS.forEach(function(d){
        var active = data.days.indexOf(d.id)>-1;
        var chip = el("div",{class:"chip"+(active?" active":"")},[d.label]);
        chip.addEventListener("click", function(){
          var i = data.days.indexOf(d.id);
          if(i>-1) data.days.splice(i,1); else data.days.push(d.id);
          renderDays();
        });
        daysRow.appendChild(chip);
      });
    }
    renderDays();
    daysField.appendChild(daysRow);
    form.appendChild(daysField);

    // times
    var timesField = el("div",{class:"field"});
    timesField.appendChild(el("label",{class:"field-label"},["ช่วงเวลาที่ว่างเล่น"]));
    var timesRow = el("div",{class:"chip-row"});
    function renderTimes(){
      timesRow.innerHTML = "";
      TIMES.forEach(function(t){
        var active = data.times.indexOf(t.id)>-1;
        var chip = el("div",{class:"chip"+(active?" active":"")},[t.label]);
        chip.addEventListener("click", function(){
          var i = data.times.indexOf(t.id);
          if(i>-1) data.times.splice(i,1); else data.times.push(t.id);
          renderTimes();
        });
        timesRow.appendChild(chip);
      });
    }
    renderTimes();
    timesField.appendChild(timesRow);
    form.appendChild(timesField);

    // styles
    var stylesField = el("div",{class:"field"});
    stylesField.appendChild(el("label",{class:"field-label"},["สไตล์การเล่น / บุคลิก (เลือกได้สูงสุด 4)"]));
    var stylesRow = el("div",{class:"chip-row"});
    function renderStyles(){
      stylesRow.innerHTML = "";
      STYLES.forEach(function(s){
        var active = data.styles.indexOf(s)>-1;
        var chip = el("div",{class:"chip"+(active?" active":"")},[s]);
        chip.addEventListener("click", function(){
          var i = data.styles.indexOf(s);
          if(i>-1) data.styles.splice(i,1);
          else if(data.styles.length<4) data.styles.push(s);
          else showToast("เลือกได้สูงสุด 4 สไตล์");
          renderStyles();
        });
        stylesRow.appendChild(chip);
      });
    }
    renderStyles();
    stylesField.appendChild(stylesRow);
    form.appendChild(stylesField);

    // genres
    var genresField = el("div",{class:"field"});
    genresField.appendChild(el("label",{class:"field-label"},["แนวเกมที่ชอบ (เลือกได้สูงสุด 8)"]));
    var genresRow = el("div",{class:"chip-row"});
    function renderGenres(){
      genresRow.innerHTML = "";
      GENRES.forEach(function(g){
        var active = data.genres.indexOf(g)>-1;
        var chip = el("div",{class:"chip"+(active?" active":"")},[g]);
        chip.addEventListener("click", function(){
          var i = data.genres.indexOf(g);
          if(i>-1) data.genres.splice(i,1);
          else if(data.genres.length<8) data.genres.push(g);
          else showToast("เลือกได้สูงสุด 4 แนว");
          renderGenres();
        });
        genresRow.appendChild(chip);
      });
    }
    renderGenres();
    genresField.appendChild(genresRow);
    form.appendChild(genresField);

    // (ระดับ % match ขั้นต่ำ ย้ายไปอยู่เป็นตัวกรองด่วนที่หน้าล็อบบี้แล้ว แทนที่จะฝังในฟอร์มนี้
    // — ดู #minMatchFilter และ updateMinMatchPct() — data.minMatchPct ยังคงถูก carry
    // ผ่านฟอร์มนี้เฉยๆ ตอน submit เพื่อไม่ให้ค่าที่ตั้งไว้หายไปตอนแก้ไขโปรไฟล์ช่องอื่น)

    // good to know
    var gtkField = el("div",{class:"field"});
    gtkField.appendChild(el("label",{class:"field-label"},["อยากให้คนที่มาเล่นด้วยรู้ไว้ก่อน (Good to know)"]));
    var gtkTextarea = el("textarea",{class:"text-input", maxlength:"140", placeholder:"เช่น ชอบพากย์เสียงตลก ๆ ระหว่างเล่น, ต้องออกไอดึกสุดเที่ยงคืน..."});
    gtkTextarea.value = data.goodToKnow;
    var charCount = el("div",{class:"char-count"},[String(data.goodToKnow.length)+"/140"]);
    gtkTextarea.addEventListener("input", function(){ charCount.textContent = gtkTextarea.value.length+"/140"; });
    gtkField.appendChild(gtkTextarea);
    gtkField.appendChild(charCount);
    form.appendChild(gtkField);

    var errorBox = el("div",{class:"form-error"},["กรอกชื่อ และเลือกอย่างน้อย 1 เกม, 1 วัน, 1 ช่วงเวลา ก่อนนะ"]);
    form.appendChild(errorBox);

    var actions = el("div",{class:"form-actions"});
    var saveBtn = el("button",{class:"btn btn-primary", type:"submit"},[existing?"บันทึกการเปลี่ยนแปลง":"เริ่มหาเพื่อนเล่น"]);
    actions.appendChild(saveBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function(e){
      e.preventDefault();
      data.name = nameInput.value.trim();
      if(!data.name || data.games.length===0 || data.days.length===0 || data.times.length===0){
        errorBox.classList.add("show");
        return;
      }
      errorBox.classList.remove("show");
      data.goodToKnow = gtkTextarea.value.trim();
      saveBtn.disabled = true;
      Promise.resolve(onSave(data)).finally(function(){ saveBtn.disabled = false; });
    });

    mount.appendChild(form);
  }

  /* ---------------- rendering: card ---------------- */
  function makeAvatar(name, size){
    var a = el("div",{class:"avatar"},[initials(name)]);
    a.style.background = hashColor(name);
    if(size){ a.style.width=size+"px"; a.style.height=size+"px"; a.style.fontSize=(size*0.36)+"px"; }
    return a;
  }

  /* ---------------- reputation voting (thumbs up/down, one active vote per target) ---------------- */
  // The same candidate can have a reputation widget open in two places at
  // once (their lobby card, and their chat header) — each is a separate DOM
  // instance built from its own snapshot of the candidate. This registry
  // lets a vote cast in either place refresh every other widget currently
  // showing that same candidate, instead of only the one that was clicked.
  // Stale entries (their element no longer in the document) are swept out
  // lazily whenever a vote fires.
  var repWidgetRegistry = [];
  function notifyReputationChange(candId){
    repWidgetRegistry = repWidgetRegistry.filter(function(w){ return document.body.contains(w.el); });
    repWidgetRegistry.forEach(function(w){ if(w.candId === candId) w.refresh(); });
  }

  function buildReputationWidget(cand){
    var wrap = el("div",{class:"rep-widget"});
    var upBtn = el("button",{type:"button",class:"rep-btn rep-up",title:"เพิ่มคะแนนให้"},["👍"]);
    var scoreEl = el("span",{class:"rep-score"},[String(cand.reputation)]);
    var downBtn = el("button",{type:"button",class:"rep-btn rep-down",title:"ลดคะแนน"},["👎"]);

    function refresh(){
      var master = findCandidate(cand.id) || cand;
      scoreEl.textContent = String(master.reputation);
      upBtn.classList.toggle("active", master.myVote === 1);
      downBtn.classList.toggle("active", master.myVote === -1);
    }
    refresh();
    repWidgetRegistry.push({candId: cand.id, refresh: refresh, el: wrap});

    function vote(value){
      upBtn.disabled = true;
      downBtn.disabled = true;
      apiFetch("/users/"+cand.id+"/vote", {method:"POST", body:{value:value}}).then(function(data){
        cand.reputation = data.reputation;
        cand.myVote = data.myVote;
        // Keep the canonical entry in state.candidates in sync too, in case
        // this widget's cand is its own snapshot rather than that same object.
        var master = findCandidate(cand.id);
        if(master && master !== cand){
          master.reputation = cand.reputation;
          master.myVote = cand.myVote;
        }
        notifyReputationChange(cand.id);
      }).catch(function(err){
        showToast(err.message || "โหวตไม่สำเร็จ ลองใหม่อีกครั้ง");
      }).finally(function(){
        upBtn.disabled = false;
        downBtn.disabled = false;
      });
    }

    upBtn.addEventListener("click", function(e){ e.stopPropagation(); vote(1); });
    downBtn.addEventListener("click", function(e){ e.stopPropagation(); vote(-1); });

    wrap.appendChild(upBtn);
    wrap.appendChild(scoreEl);
    wrap.appendChild(downBtn);
    return wrap;
  }

  function renderCard(cand, score){
    var online = state.onlineIds.has(cand.id);
    var card = el("div",{class:"p-card"});

    var top = el("div",{class:"p-card-top"});
    top.appendChild(makeAvatar(cand.name));
    var idBox = el("div",{class:"p-card-id"});
    var nameRow = el("div",{class:"p-card-name"},[displayName(cand)]);
    if(online){
      var dot = el("span",{class:"online-dot live"});
      nameRow.insertBefore(dot, nameRow.firstChild);
    }
    if(state.profile && state.profile.minMatchPct > 0 && score.total < state.profile.minMatchPct){
      var warnMark = el("span",{class:"match-warn", title:"% ตรงกัน ("+score.total+"%) ต่ำกว่าระดับขั้นต่ำที่คุณตั้งไว้ ("+state.profile.minMatchPct+"%) — ยังทักไปคุยได้ปกติ"},["⚠️"]);
      nameRow.appendChild(warnMark);
    }
    idBox.appendChild(nameRow);
    idBox.appendChild(el("div",{class:"p-card-status"},[(online?"ออนไลน์ตอนนี้":"ออฟไลน์")+" · "+GENDER_LABELS[cand.gender]]));
    idBox.appendChild(buildReputationWidget(cand));
    top.appendChild(idBox);
    var dial = el("div",{class:"match-dial"});
    dial.style.setProperty("--pct", score.total);
    dial.appendChild(el("span",{},[score.total+"%"]));
    top.appendChild(dial);

    var pinned = isPinned(cand.id);
    var pinBtn = el("button",{
      type:"button", class:"icon-btn pin-btn" + (pinned ? " active" : ""),
      title: pinned ? "เลิกปักหมุด" : "ปักหมุดไว้บนสุด",
      "aria-label": pinned ? "เลิกปักหมุด" : "ปักหมุดไว้บนสุด"
    },["📌"]);
    pinBtn.addEventListener("click", function(e){
      e.stopPropagation();
      togglePinned(cand.id);
      renderGrid();
    });
    top.appendChild(pinBtn);
    card.appendChild(top);

    var gamesRow = el("div",{class:"p-card-games"});
    cand.games.forEach(function(g){ gamesRow.appendChild(el("span",{class:"tag"},[g])); });
    card.appendChild(gamesRow);

    var stylesRow = el("div",{class:"p-card-games"});
    cand.styles.forEach(function(s){ stylesRow.appendChild(el("span",{class:"tag style-tag"},[s])); });
    card.appendChild(stylesRow);

    if(cand.genres && cand.genres.length){
      var genresRow = el("div",{class:"p-card-games"});
      cand.genres.forEach(function(g){ genresRow.appendChild(el("span",{class:"tag genre-tag"},[g])); });
      card.appendChild(genresRow);
    }

    var metaRow = el("div",{class:"p-card-games"});
    (cand.goal||[]).forEach(function(gid){ metaRow.appendChild(el("span",{class:"tag goal-tag"},[GOAL_LABELS[gid]||gid])); });
    if((cand.goal||[]).indexOf("open")>-1 && cand.interestedIn && cand.interestedIn.length){
      var interestedLabel = cand.interestedIn.map(function(g){ return INTERESTED_IN_LABELS[g]||g; }).join("/");
      metaRow.appendChild(el("span",{class:"tag goal-tag"},["สนใจ: "+interestedLabel]));
    }
    card.appendChild(metaRow);

    var breakdown = el("div",{class:"breakdown"});
    var showMismatch = isShowMismatch();
    [
      {label:"เกม", pct:score.breakdown.games, diff:score.mismatch.games, matched:score.matched.games},
      {label:"วัน", pct:score.breakdown.day, diff:score.mismatch.days, matched:score.matched.days},
      {label:"เวลา", pct:score.breakdown.time, diff:score.mismatch.times, matched:score.matched.times},
      {label:"สไตล์", pct:score.breakdown.style, diff:score.mismatch.styles, matched:score.matched.styles},
      {label:"แนวเกม", pct:score.breakdown.genre, diff:score.mismatch.genres, matched:score.matched.genres}
    ].forEach(function(c){
      var row = el("div",{class:"breakdown-row"});
      row.appendChild(el("span",{class:"breakdown-label"},[c.label]));
      var bar = el("div",{class:"breakdown-bar"});
      var fill = el("div",{class:"breakdown-fill"});
      fill.style.width = Math.max(4,c.pct)+"%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span",{class:"breakdown-pct"},[c.pct+"%"]));
      breakdown.appendChild(row);

      // จุดที่ตรงกัน (สีเขียว) โชว์เสมอไม่ว่าปุ่มซ่อนจะเปิดหรือปิด
      if(!c.diff.length){
        breakdown.appendChild(el("div",{class:"breakdown-detail match-full"},["ตรงกันหมดทุกอย่าง ✓"]));
      } else if(c.matched.length){
        breakdown.appendChild(el("div",{class:"breakdown-detail match-full"},["ตรงกัน: ", el("b",{},[c.matched.join(", ")])]));
      }
      // จุดที่ไม่ตรงกัน ซ่อน/แสดงตามปุ่มที่ผู้ใช้ตั้งไว้
      if(showMismatch && c.diff.length){
        breakdown.appendChild(el("div",{class:"breakdown-detail"},["ไม่ตรงกัน: ", el("b",{},[c.diff.join(", ")])]));
      }
    });
    card.appendChild(breakdown);

    if(cand.goodToKnow && cand.goodToKnow.trim()){
      card.appendChild(el("div",{class:"good-to-know"},["“"+cand.goodToKnow+"”"]));
    }

    var cta = el("div",{class:"card-cta"},["ทักไปคุย"]);
    cta.addEventListener("click", function(){ openChat(cand); });
    card.appendChild(cta);

    return card;
  }

  /* ---------------- lobby rendering ---------------- */
  function renderLobby(){
    var profile = state.profile;
    document.getElementById("lobbySub").textContent = "สวัสดี " + profile.name + " กำลังจับคู่จากเกม เวลา และสไตล์ของคุณ";

    var gameFilter = document.getElementById("gameFilter");
    var currentFilterVal = gameFilter.value || "all";
    gameFilter.innerHTML = "";
    gameFilter.appendChild(el("option",{value:"all"},["ทุกเกม"]));
    // รวมเกมที่พิมพ์เองมาแบบไม่ซ้ำกับรายการมาตรฐาน โดยเทียบแบบไม่สนตัวพิมพ์เล็กใหญ่/ช่องว่าง
    // กันไม่ให้ dropdown มีตัวเลือกซ้ำ เช่น "Dota 2" กับ "dota 2" แยกกันคนละอัน
    var seenGameKeys = GAMES.map(normGame);
    var extraGames = [];
    state.candidates.forEach(function(c){
      c.games.forEach(function(g){
        var key = normGame(g);
        if(seenGameKeys.indexOf(key) === -1){ seenGameKeys.push(key); extraGames.push(g); }
      });
    });
    GAMES.concat(extraGames).forEach(function(g){ gameFilter.appendChild(el("option",{value:g},[g])); });
    gameFilter.value = currentFilterVal;

    var minMatchFilter = document.getElementById("minMatchFilter");
    // ปัดค่าที่เก็บไว้ให้เข้าขั้นที่ใกล้ที่สุด (ทีละ 10%) เผื่อเคยตั้งจากที่อื่นเป็นเลขคี่
    var savedMinMatch = Math.min(100, Math.max(0, Math.round((profile.minMatchPct || 0) / 10) * 10));
    minMatchFilter.value = String(savedMinMatch);
    updateMinMatchLabel(savedMinMatch);
    updateMinMatchTrackFill(minMatchFilter);

    renderGrid();
  }

  function updateMinMatchLabel(pct){
    var label = document.getElementById("minMatchValue");
    if(label) label.textContent = pct > 0 ? (pct + "%+") : "ไม่กำหนด";
  }

  // ทำให้เส้นหลอดเลื่อนมีสีไล่ตามค่า % ที่ตั้งไว้ ไม่ใช่แค่จุดกลมสีส้ม
  // (ต้องคำนวณด้วย JS เพราะ CSS ล้วนๆ ไม่รู้ค่าปัจจุบันของ input[type=range])
  function updateMinMatchTrackFill(el){
    var min = parseFloat(el.min) || 0, max = parseFloat(el.max) || 100, val = parseFloat(el.value) || 0;
    var pct = max > min ? Math.min(100, Math.max(0, (val - min) / (max - min) * 100)) : 0;
    el.style.background = "linear-gradient(to right, var(--accent) " + pct + "%, var(--border) " + pct + "%)";
  }

  function updateMinMatchPct(pct){
    if(!state.profile) return;
    var payload = Object.assign({}, state.profile, {minMatchPct: pct});
    apiFetch("/profile", {method:"PUT", body: payload}).then(function(){
      state.profile.minMatchPct = pct;
      renderGrid();
    }).catch(function(err){
      showToast(err.message || "อัปเดตไม่สำเร็จ ลองใหม่อีกครั้ง");
      renderLobby();
    });
  }

  function renderGrid(){
    var profile = state.profile;
    var search = document.getElementById("searchInput").value.trim().toLowerCase();
    var gameFilterVal = document.getElementById("gameFilter").value;
    var sortVal = document.getElementById("sortFilter").value;

    var scored = state.candidates.map(function(c){ return {cand:c, score:matchScore(profile,c)}; });

    scored = scored.filter(function(item){
      var c = item.cand;
      var matchesSearch = !search || c.name.toLowerCase().indexOf(search)>-1 ||
        c.games.some(function(g){ return g.toLowerCase().indexOf(search)>-1; });
      var matchesGame = gameFilterVal==="all" || c.games.some(function(g){ return normGame(g)===normGame(gameFilterVal); });
      return matchesSearch && matchesGame;
    });

    scored.sort(function(a,b){
      // ลำดับความสำคัญ: ปักหมุดไว้บนสุดเสมอ > เคยคุยกันแล้ว > (ถ้าเลือกเรียงออนไลน์ก่อน) ออนไลน์ > % ตรงกัน
      var aPin = isPinned(a.cand.id), bPin = isPinned(b.cand.id);
      if(aPin !== bPin) return aPin ? -1 : 1;

      var aChat = !!a.cand.hasChatted, bChat = !!b.cand.hasChatted;
      if(aChat !== bChat) return aChat ? -1 : 1;

      if(sortVal==="online"){
        var aOn = state.onlineIds.has(a.cand.id), bOn = state.onlineIds.has(b.cand.id);
        if(aOn !== bOn) return aOn ? -1 : 1;
      }
      return b.score.total - a.score.total;
    });

    document.getElementById("queueCount").textContent = scored.length + " คนในคิว";

    var grid = document.getElementById("cardGrid");
    grid.innerHTML = "";
    if(scored.length===0){
      grid.appendChild(el("div",{class:"empty-state"},["ไม่พบคนที่ตรงกับตัวกรองนี้ ลองเปลี่ยนคำค้นหรือเกมดูนะ"]));
      return;
    }
    scored.forEach(function(item){ grid.appendChild(renderCard(item.cand, item.score)); });
  }

  /* ---------------- me chip ---------------- */
  function renderMeChip(){
    var meChip = document.getElementById("meChip");
    meChip.innerHTML = "";
    meChip.appendChild(makeAvatar(state.profile.name, 26));
    meChip.appendChild(el("span",{class:"me-name"},[state.profile.name]));
    if(typeof state.profile.reputation === "number"){
      meChip.appendChild(el("span",{class:"me-reputation",title:"คะแนน reputation ของคุณ"},["★ "+state.profile.reputation]));
    }
  }

  /* ---------------- chat ---------------- */
  function findCandidate(id){
    return state.candidates.filter(function(c){ return c.id === id; })[0] || null;
  }

  function openChat(cand){
    state.activeChatId = cand.id;
    state.activeChatCand = cand;
    var av = document.getElementById("chatAvatar");
    av.style.background = hashColor(cand.name);
    av.textContent = initials(cand.name);
    document.getElementById("chatName").textContent = displayName(cand);
    document.getElementById("chatStatus").textContent = (state.onlineIds.has(cand.id) ? "ออนไลน์ตอนนี้" : "ออฟไลน์") + " · " + GENDER_LABELS[cand.gender];
    var chatGtk = document.getElementById("chatGoodToKnow");
    var hasGtk = cand.goodToKnow && cand.goodToKnow.trim();
    chatGtk.textContent = hasGtk ? "“"+cand.goodToKnow+"”" : "";
    chatGtk.hidden = !hasGtk;
    var chatRep = document.getElementById("chatReputation");
    chatRep.innerHTML = "";
    chatRep.appendChild(buildReputationWidget(cand));

    var muteBtn = document.getElementById("muteChatBtn");
    muteBtn.classList.toggle("active", isMuted(cand.id));
    muteBtn.title = isMuted(cand.id) ? "เปิดแจ้งเตือนคนนี้อีกครั้ง" : "ปิดแจ้งเตือนคนนี้";

    document.getElementById("chatPanel").hidden = false;
    document.getElementById("scrim").hidden = false;
    document.getElementById("chatInput").focus();

    var box = document.getElementById("chatMessages");
    box.innerHTML = "";
    box.appendChild(el("div",{class:"p-card-status",style:"text-align:center;padding:14px;"},["กำลังโหลดข้อความ..."]));

    apiFetch("/chat/" + cand.id + "/messages").then(function(data){
      if(state.activeChatId !== cand.id) return;
      renderMessages(data.messages || []);
    }).catch(function(err){
      if(state.activeChatId !== cand.id) return;
      box.innerHTML = "";
      showToast(err.message || "โหลดข้อความไม่สำเร็จ");
    });
  }

  function closeChat(){
    document.getElementById("chatPanel").hidden = true;
    document.getElementById("scrim").hidden = true;
    state.activeChatId = null;
    state.activeChatCand = null;
  }

  /* ---------------- แก้ไขชื่อเล่นแบบ inline ในหัวข้อแชท ---------------- */
  function startEditNickname(){
    var cand = state.activeChatCand;
    if(!cand) return;
    var nameEl = document.getElementById("chatName");
    if(nameEl.tagName === "INPUT") return; // กำลังแก้อยู่แล้ว ไม่ต้องเริ่มซ้ำ

    var input = el("input",{id:"chatName", class:"nickname-input", type:"text", maxlength:"24", placeholder:cand.name, value:getNickname(cand.id)});
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    function finish(save){
      if(done) return; // กัน blur ยิงซ้ำหลังจาก Enter/Escape ทำงานไปแล้ว (input ถูกถอดออกจาก DOM ก็ทำให้ blur ได้เหมือนกัน)
      done = true;
      if(save) setNickname(cand.id, input.value);
      var restored = el("div",{class:"name", id:"chatName"},[displayName(cand)]);
      input.replaceWith(restored);
      // เปลี่ยนชื่อที่โชว์ในที่อื่นๆ ให้ตรงกันทันที ไม่ต้องรอปิดเปิดใหม่
      if(!document.getElementById("viewLobby").hidden) renderGrid();
      if(!document.getElementById("conversationsPanel").hidden) renderConversationsList();
    }
    input.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); finish(true); }
      else if(e.key === "Escape"){ e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function(){ finish(true); });
  }

  function formatMsgTime(ts){
    if(!ts) return "";
    var d = new Date(ts);
    if(isNaN(d.getTime())) return "";
    try{
      return d.toLocaleTimeString("th-TH", {hour:"2-digit", minute:"2-digit", hour12:false});
    }catch(e){
      var h = String(d.getHours()).padStart(2,"0"), mi = String(d.getMinutes()).padStart(2,"0");
      return h+":"+mi;
    }
  }

  function buildMsgEl(m){
    var side = m.from==="me" ? "me" : "them";
    var row = el("div",{class:"msg-row "+side});
    row.appendChild(el("div",{class:"msg "+side},[m.text]));
    var timeStr = formatMsgTime(m.ts);
    if(timeStr) row.appendChild(el("span",{class:"msg-time"},[timeStr]));
    return row;
  }

  function renderMessages(messages){
    var box = document.getElementById("chatMessages");
    box.innerHTML = "";
    messages.forEach(function(m){
      box.appendChild(buildMsgEl(m));
    });
    box.scrollTop = box.scrollHeight;
  }

  function appendMessage(m){
    var box = document.getElementById("chatMessages");
    box.appendChild(buildMsgEl(m));
    box.scrollTop = box.scrollHeight;
  }

  function sendMessage(text){
    text = text.trim();
    if(!state.activeChatId || !text || !state.socket) return;
    var to = state.activeChatId;
    state.socket.emit("chat:send", {to: to, content: text}, function(ack){
      if(!ack || !ack.ok){ showToast((ack && ack.error) || "ส่งข้อความไม่สำเร็จ"); }
    });
  }

  /* ---------------- block / unblock ---------------- */
  function blockCurrentChatUser(){
    var candId = state.activeChatId;
    if(!candId) return;
    var cand = findCandidate(candId);
    var blockBtn = document.getElementById("blockChatBtn");
    blockBtn.disabled = true;
    apiFetch("/users/" + candId + "/block", {method:"POST"}).then(function(){
      closeChat();
      state.candidates = state.candidates.filter(function(c){ return c.id !== candId; });
      if(!document.getElementById("viewLobby").hidden) renderGrid();
      showToast((cand ? displayName(cand) : "ผู้ใช้นี้") + " ถูกบล็อกแล้ว");
    }).catch(function(err){
      showToast(err.message || "บล็อกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }).finally(function(){
      blockBtn.disabled = false;
    });
  }

  function renderBlockedList(){
    var mount = document.getElementById("blockedListMount");
    mount.innerHTML = "";
    mount.appendChild(el("div",{class:"p-card-status",style:"text-align:center;padding:14px;"},["กำลังโหลด..."]));

    apiFetch("/users/blocked").then(function(data){
      mount.innerHTML = "";
      var blocked = data.blocked || [];
      if(blocked.length === 0){
        mount.appendChild(el("div",{class:"blocked-empty"},["คุณยังไม่ได้บล็อกใครไว้"]));
        return;
      }
      var list = el("div",{class:"blocked-list"});
      blocked.forEach(function(b){
        var row = el("div",{class:"blocked-item"});
        row.appendChild(makeAvatar(b.name, 34));
        row.appendChild(el("div",{class:"name"},[displayName(b)]));
        var unblockBtn = el("button",{class:"btn btn-ghost btn-sm", type:"button"},["เลิกบล็อก"]);
        unblockBtn.addEventListener("click", function(){
          unblockBtn.disabled = true;
          apiFetch("/users/" + b.id + "/unblock", {method:"POST"}).then(function(){
            showToast(displayName(b) + " ถูกเลิกบล็อกแล้ว");
            renderBlockedList();
            loadCandidates().then(function(){
              if(!document.getElementById("viewLobby").hidden) renderGrid();
            }).catch(function(){});
          }).catch(function(err){
            showToast(err.message || "เลิกบล็อกไม่สำเร็จ ลองใหม่อีกครั้ง");
            unblockBtn.disabled = false;
          });
        });
        row.appendChild(unblockBtn);
        list.appendChild(row);
      });
      mount.appendChild(list);
    }).catch(function(err){
      mount.innerHTML = "";
      mount.appendChild(el("div",{class:"blocked-empty"},[err.message || "โหลดรายชื่อไม่สำเร็จ"]));
    });
  }

  /* ---------------- socket / presence ---------------- */
  function connectSocket(){
    if(state.socket || typeof io === "undefined") return;
    var socket = io();
    state.socket = socket;

    socket.on("presence:update", function(payload){
      if(!payload) return;
      if(payload.online) state.onlineIds.add(payload.userId);
      else state.onlineIds.delete(payload.userId);

      if(!document.getElementById("viewLobby").hidden) renderGrid();
      if(state.activeChatId === payload.userId){
        var cand = findCandidate(payload.userId);
        document.getElementById("chatStatus").textContent = (payload.online ? "ออนไลน์ตอนนี้" : "ออฟไลน์") + " · " + (cand ? GENDER_LABELS[cand.gender] : "");
      }
    });

    socket.on("chat:message", function(m){
      var otherId = m.from === "me" ? m.receiverId : m.senderId;
      var isOpenChat = state.activeChatId === otherId;
      if(isOpenChat){
        appendMessage(m);
      }
      if(m.from === "them" && (!isOpenChat || document.hidden) && !isMuted(otherId)){
        var cand = findCandidate(otherId);
        showNotification("ข้อความใหม่จาก " + (cand ? displayName(cand) : "เพื่อนใหม่"), m.text, function(){
          if(cand) openChat(cand);
        });
      }
      // ข้อความใหม่ไม่ว่าจะส่งเองหรือได้รับ ก็อัปเดตแท็บ "แชทล่าสุด" ให้ทันสมัยด้วย
      loadConversations();
    });
  }

  function disconnectSocket(){
    if(state.socket){
      state.socket.disconnect();
      state.socket = null;
    }
    state.onlineIds = new Set();
  }

  /* ---------------- candidates ---------------- */
  function loadCandidates(){
    return apiFetch("/candidates").then(function(data){
      state.candidates = data.candidates || [];
      state.onlineIds = new Set(state.candidates.filter(function(c){ return c.online; }).map(function(c){ return c.id; }));
    });
  }

  /* ---------------- แท็บ "แชทล่าสุด" (คนที่เคยคุยด้วยแล้ว) ---------------- */
  function loadConversations(){
    return apiFetch("/chat/conversations").then(function(data){
      state.conversations = data.conversations || [];
      renderConversationsList();
      var tabBtn = document.getElementById("conversationsTabBtn");
      tabBtn.hidden = state.conversations.length === 0;
    }).catch(function(){});
  }

  function renderConversationsList(){
    var list = document.getElementById("conversationsList");
    list.innerHTML = "";
    var conversations = state.conversations || [];
    if(conversations.length === 0){
      list.appendChild(el("div",{class:"conversations-empty"},["ยังไม่มีแชทกับใครเลย"]));
      return;
    }
    conversations.forEach(function(conv){
      var item = el("div",{class:"conversation-item"});
      item.appendChild(makeAvatar(conv.name, 36));
      var textCol = el("div",{class:"conv-text"});
      textCol.appendChild(el("div",{class:"conv-name"},[displayName(conv)]));
      var preview = (conv.lastMessageFromMe ? "คุณ: " : "") + (conv.lastMessage || "");
      textCol.appendChild(el("div",{class:"conv-last"},[preview]));
      item.appendChild(textCol);
      item.addEventListener("click", function(){
        // ปิดแท็บนี้ก่อนแล้วค่อยเปิดแชท ไม่งั้นจะไปเผลอซ่อน scrim ทับสถานะที่ openChat เพิ่งเปิดไว้
        closeConversationsPanel();
        openChatById(conv.id, conv.name);
      });
      list.appendChild(item);
    });
  }

  function openChatById(id, name){
    var cand = findCandidate(id);
    if(!cand){
      // คนคนนี้อาจไม่อยู่ใน state.candidates แล้ว (เช่นถูกกรองออกไปด้วยเหตุผลอื่น) —
      // สร้างข้อมูลสำรองขั้นต่ำไว้ให้เปิดแชทได้ ไม่ให้ทั้งหน้าค้าง
      cand = {id:id, name:name||"ผู้ใช้", gender:"unspecified", goodToKnow:"", reputation:100, myVote:0,
        games:[], styles:[], genres:[], days:[], times:[], goal:[]};
    }
    openChat(cand);
  }

  function openConversationsPanel(){
    renderConversationsList(); // โชว์ของที่มีอยู่ก่อน กันจอว่างวูบระหว่างรอโหลด
    document.getElementById("conversationsPanel").hidden = false;
    document.getElementById("scrim").hidden = false;
    loadConversations(); // แล้วค่อยรีเฟรชของจริงจากเซิร์ฟเวอร์
  }
  function closeConversationsPanel(){
    document.getElementById("conversationsPanel").hidden = true;
    document.getElementById("scrim").hidden = true;
  }

  /* ---------------- auth ---------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function renderAuthForm(mode){
    document.getElementById("tabLogin").classList.toggle("active", mode === "login");
    document.getElementById("tabSignup").classList.toggle("active", mode === "signup");

    var mount = document.getElementById("authFormMount");
    mount.innerHTML = "";

    var form = el("form", {});

    var emailField = el("div",{class:"field"});
    emailField.appendChild(el("label",{class:"field-label"},["อีเมล"]));
    var emailInput = el("input",{class:"text-input", type:"email", placeholder:"you@email.com", autocomplete:"email"});
    emailField.appendChild(emailInput);
    form.appendChild(emailField);

    var passField = el("div",{class:"field"});
    passField.appendChild(el("label",{class:"field-label"},["รหัสผ่าน"]));
    var passInput = el("input",{class:"text-input", type:"password", placeholder:"อย่างน้อย 6 ตัวอักษร",
      autocomplete: mode==="signup" ? "new-password" : "current-password"});
    passField.appendChild(passInput);
    form.appendChild(passField);

    var confirmInput = null;
    if(mode === "signup"){
      var confirmField = el("div",{class:"field"});
      confirmField.appendChild(el("label",{class:"field-label"},["ยืนยันรหัสผ่าน"]));
      confirmInput = el("input",{class:"text-input", type:"password", placeholder:"พิมพ์รหัสผ่านอีกครั้ง", autocomplete:"new-password"});
      confirmField.appendChild(confirmInput);
      form.appendChild(confirmField);
    } else {
      var forgotWrap = el("div",{style:"text-align:right;margin-bottom:22px;"});
      var forgotLink = el("button",{class:"auth-forgot-link", type:"button"},["ลืมรหัสผ่าน?"]);
      forgotLink.addEventListener("click", function(){ renderForgotPasswordForm(emailInput.value.trim()); });
      forgotWrap.appendChild(forgotLink);
      form.appendChild(forgotWrap);
    }

    var errorBox = el("div",{class:"form-error"},[""]);
    form.appendChild(errorBox);
    function showError(msg){ errorBox.textContent = msg; errorBox.classList.add("show"); }

    var actions = el("div",{class:"form-actions"});
    var submitBtn = el("button",{class:"btn btn-primary btn-block", type:"submit"},[mode==="signup"?"สมัครสมาชิก":"เข้าสู่ระบบ"]);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function(e){
      e.preventDefault();
      errorBox.classList.remove("show");
      var email = emailInput.value.trim().toLowerCase();
      var pass = passInput.value;

      if(!email || !EMAIL_RE.test(email)){ showError("กรอกอีเมลให้ถูกต้อง"); return; }
      if(!pass || pass.length < 6){ showError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
      if(mode === "signup" && pass !== confirmInput.value){ showError("รหัสผ่านยืนยันไม่ตรงกัน"); return; }

      submitBtn.disabled = true;
      var path = mode === "signup" ? "/auth/signup" : "/auth/login";
      apiFetch(path, {method:"POST", body:{email:email, password:pass}}).then(function(data){
        if(mode === "signup"){
          showVerificationPending(email);
        } else {
          showToast("เข้าสู่ระบบสำเร็จ!");
          afterLogin();
        }
      }).catch(function(err){
        if(err.needsVerification){
          showVerificationPending(err.email || email);
          return;
        }
        showError(err.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }).finally(function(){
        submitBtn.disabled = false;
      });
    });

    mount.appendChild(form);
  }

  function showVerificationPending(email){
    document.getElementById("tabLogin").classList.remove("active");
    document.getElementById("tabSignup").classList.remove("active");

    var mount = document.getElementById("authFormMount");
    mount.innerHTML = "";

    var box = el("div", {});
    box.appendChild(el("p", {style:"color:var(--text-muted);font-size:13.5px;line-height:1.6;margin-bottom:18px;"}, [
      "ส่งอีเมลยืนยันไปที่ ", el("b",{style:"color:var(--text);"},[email]), " แล้ว กรุณาเปิดกล่องจดหมายแล้วกดลิงก์ยืนยันก่อนเข้าสู่ระบบ (เช็คโฟลเดอร์สแปมด้วยถ้าไม่เจอ)"
    ]));

    var resendBtn = el("button", {class:"btn btn-ghost btn-block", type:"button"}, ["ส่งอีเมลยืนยันอีกครั้ง"]);
    resendBtn.addEventListener("click", function(){
      resendBtn.disabled = true;
      apiFetch("/auth/resend-verification", {method:"POST", body:{email:email}}).then(function(data){
        showToast(data.message || "ส่งอีเมลยืนยันใหม่แล้ว");
      }).catch(function(err){
        showToast(err.message || "ส่งอีเมลไม่สำเร็จ");
      }).finally(function(){
        resendBtn.disabled = false;
      });
    });
    box.appendChild(resendBtn);

    var backBtn = el("button", {class:"btn btn-ghost btn-block", type:"button", style:"margin-top:10px;"}, ["กลับไปหน้าเข้าสู่ระบบ"]);
    backBtn.addEventListener("click", function(){ renderAuthForm("login"); });
    box.appendChild(backBtn);

    mount.appendChild(box);
  }

  function renderForgotPasswordForm(prefillEmail){
    document.getElementById("tabLogin").classList.remove("active");
    document.getElementById("tabSignup").classList.remove("active");

    var mount = document.getElementById("authFormMount");
    mount.innerHTML = "";

    var form = el("form", {});
    form.appendChild(el("p", {style:"color:var(--text-muted);font-size:13.5px;line-height:1.6;margin-bottom:18px;"}, [
      "กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้"
    ]));

    var emailField = el("div",{class:"field"});
    emailField.appendChild(el("label",{class:"field-label"},["อีเมล"]));
    var emailInput = el("input",{class:"text-input", type:"email", placeholder:"you@email.com", autocomplete:"email", value: prefillEmail || ""});
    emailField.appendChild(emailInput);
    form.appendChild(emailField);

    var errorBox = el("div",{class:"form-error"},[""]);
    form.appendChild(errorBox);
    function showError(msg){ errorBox.textContent = msg; errorBox.classList.add("show"); }

    var actions = el("div",{class:"form-actions"});
    var submitBtn = el("button",{class:"btn btn-primary btn-block", type:"submit"},["ส่งลิงก์ตั้งรหัสผ่านใหม่"]);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function(e){
      e.preventDefault();
      errorBox.classList.remove("show");
      var email = emailInput.value.trim().toLowerCase();
      if(!email || !EMAIL_RE.test(email)){ showError("กรอกอีเมลให้ถูกต้อง"); return; }

      submitBtn.disabled = true;
      apiFetch("/auth/forgot-password", {method:"POST", body:{email:email}}).then(function(data){
        mount.innerHTML = "";
        var box = el("div", {});
        box.appendChild(el("p", {style:"color:var(--text-muted);font-size:13.5px;line-height:1.6;margin-bottom:18px;"}, [
          data.message || "ถ้าอีเมลนี้อยู่ในระบบ จะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว"
        ]));
        var backBtn = el("button", {class:"btn btn-ghost btn-block", type:"button"}, ["กลับไปหน้าเข้าสู่ระบบ"]);
        backBtn.addEventListener("click", function(){ renderAuthForm("login"); });
        box.appendChild(backBtn);
        mount.appendChild(box);
      }).catch(function(err){
        showError(err.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
        submitBtn.disabled = false;
      });
    });

    mount.appendChild(form);

    var backLink = el("button", {class:"btn btn-ghost btn-block", type:"button", style:"margin-top:10px;"}, ["กลับไปหน้าเข้าสู่ระบบ"]);
    backLink.addEventListener("click", function(){ renderAuthForm("login"); });
    mount.appendChild(backLink);
  }

  function renderResetPasswordForm(token){
    document.getElementById("tabLogin").classList.remove("active");
    document.getElementById("tabSignup").classList.remove("active");

    var mount = document.getElementById("authFormMount");
    mount.innerHTML = "";

    var form = el("form", {});
    form.appendChild(el("p", {style:"color:var(--text-muted);font-size:13.5px;line-height:1.6;margin-bottom:18px;"}, [
      "ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ"
    ]));

    var passField = el("div",{class:"field"});
    passField.appendChild(el("label",{class:"field-label"},["รหัสผ่านใหม่"]));
    var passInput = el("input",{class:"text-input", type:"password", placeholder:"อย่างน้อย 6 ตัวอักษร", autocomplete:"new-password"});
    passField.appendChild(passInput);
    form.appendChild(passField);

    var confirmField = el("div",{class:"field"});
    confirmField.appendChild(el("label",{class:"field-label"},["ยืนยันรหัสผ่านใหม่"]));
    var confirmInput = el("input",{class:"text-input", type:"password", placeholder:"พิมพ์รหัสผ่านอีกครั้ง", autocomplete:"new-password"});
    confirmField.appendChild(confirmInput);
    form.appendChild(confirmField);

    var errorBox = el("div",{class:"form-error"},[""]);
    form.appendChild(errorBox);
    function showError(msg){ errorBox.textContent = msg; errorBox.classList.add("show"); }

    var actions = el("div",{class:"form-actions"});
    var submitBtn = el("button",{class:"btn btn-primary btn-block", type:"submit"},["ตั้งรหัสผ่านใหม่"]);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function(e){
      e.preventDefault();
      errorBox.classList.remove("show");
      var pass = passInput.value;
      if(!pass || pass.length < 6){ showError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
      if(pass !== confirmInput.value){ showError("รหัสผ่านยืนยันไม่ตรงกัน"); return; }

      submitBtn.disabled = true;
      apiFetch("/auth/reset-password", {method:"POST", body:{token:token, password:pass}}).then(function(){
        showToast("ตั้งรหัสผ่านใหม่สำเร็จ! เข้าสู่ระบบให้อัตโนมัติแล้ว");
        afterLogin();
      }).catch(function(err){
        showError(err.message || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองขอลิงก์ใหม่อีกครั้ง");
        submitBtn.disabled = false;
      });
    });

    mount.appendChild(form);

    var backLink = el("button", {class:"btn btn-ghost btn-block", type:"button", style:"margin-top:10px;"}, ["กลับไปหน้าเข้าสู่ระบบ"]);
    backLink.addEventListener("click", function(){ renderAuthForm("login"); });
    mount.appendChild(backLink);
  }

  function loginWithProvider(provider){
    window.location.href = "/api/auth/" + provider;
  }

  function showAuthView(){
    document.getElementById("viewAuth").hidden = false;
    document.getElementById("viewOnboarding").hidden = true;
    document.getElementById("viewLobby").hidden = true;
    document.getElementById("topbarActions").hidden = true;
    renderAuthForm("login");
  }

  /* ---------------- boot / view switching ---------------- */
  function goToLobby(){
    document.getElementById("viewAuth").hidden = true;
    document.getElementById("viewOnboarding").hidden = true;
    document.getElementById("viewLobby").hidden = false;
    document.getElementById("topbarActions").hidden = false;
    renderMeChip();
    connectSocket();
    loadCandidates().then(function(){
      renderLobby();
      checkNewMatches();
      startCandidatePolling();
    }).catch(function(err){
      showToast(err.message || "โหลดรายชื่อไม่สำเร็จ");
    });
    loadConversations();
  }

  function afterLogin(){
    apiFetch("/auth/me").then(function(data){
      state.user = data.user;
      state.profile = data.profile;
      document.getElementById("viewAuth").hidden = true;
      document.getElementById("topbarActions").hidden = false;
      if(state.profile){
        goToLobby();
      } else {
        document.getElementById("viewOnboarding").hidden = false;
        buildForm(document.getElementById("onboardFormMount"), null, function(data){
          return apiFetch("/profile", {method:"PUT", body:data}).then(function(){
            state.profile = data;
            showToast("บันทึกโปรไฟล์แล้ว! กำลังหาคู่ให้...");
            goToLobby();
          }).catch(function(err){
            showToast(err.message || "บันทึกโปรไฟล์ไม่สำเร็จ");
          });
        });
      }
    }).catch(function(){
      showAuthView();
    });
  }

  function logout(){
    apiFetch("/auth/logout", {method:"POST"}).catch(function(){}).finally(function(){
      stopCandidatePolling();
      disconnectSocket();
      state.user = null;
      state.profile = null;
      state.candidates = [];
      state.conversations = [];
      document.getElementById("conversationsTabBtn").hidden = true;
      closeConversationsPanel();
      showAuthView();
    });
  }

  function handleOAuthRedirectParams(){
    var params = new URLSearchParams(window.location.search);
    var login = params.get("login");
    var loginError = params.get("loginError");
    var verified = params.get("verified");
    var verifyError = params.get("verifyError");
    if(login){
      showToast("เข้าสู่ระบบด้วย Discord สำเร็จ!");
    } else if(loginError){
      showToast(loginError);
    } else if(verified){
      showToast("ยืนยันอีเมลสำเร็จ! เข้าสู่ระบบให้อัตโนมัติแล้ว");
    } else if(verifyError){
      showToast(verifyError);
    }
    if(login || loginError || verified || verifyError){
      params.delete("login");
      params.delete("loginError");
      params.delete("verified");
      params.delete("verifyError");
      var qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?"+qs : ""));
    }
  }

  function consumeResetTokenParam(){
    var params = new URLSearchParams(window.location.search);
    var resetToken = params.get("resetToken");
    if(!resetToken) return null;
    params.delete("resetToken");
    var qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? "?"+qs : ""));
    return resetToken;
  }

  function boot(){
    handleOAuthRedirectParams();
    var resetToken = consumeResetTokenParam();
    if(resetToken){
      document.getElementById("viewAuth").hidden = false;
      document.getElementById("viewOnboarding").hidden = true;
      document.getElementById("viewLobby").hidden = true;
      document.getElementById("topbarActions").hidden = true;
      renderResetPasswordForm(resetToken);
      return;
    }
    apiFetch("/auth/me").then(function(data){
      state.user = data.user;
      state.profile = data.profile;
      document.getElementById("topbarActions").hidden = false;
      if(state.profile){
        goToLobby();
      } else {
        document.getElementById("viewAuth").hidden = true;
        document.getElementById("viewOnboarding").hidden = false;
        buildForm(document.getElementById("onboardFormMount"), null, function(data){
          return apiFetch("/profile", {method:"PUT", body:data}).then(function(){
            state.profile = data;
            showToast("บันทึกโปรไฟล์แล้ว! กำลังหาคู่ให้...");
            goToLobby();
          }).catch(function(err){
            showToast(err.message || "บันทึกโปรไฟล์ไม่สำเร็จ");
          });
        });
      }
    }).catch(function(){
      showAuthView();
    });
  }

  document.getElementById("tabLogin").addEventListener("click", function(){ renderAuthForm("login"); });
  document.getElementById("tabSignup").addEventListener("click", function(){ renderAuthForm("signup"); });
  document.getElementById("discordLoginBtn").addEventListener("click", function(){ loginWithProvider("discord"); });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("themeToggleBtn").addEventListener("click", function(){
    applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
  });
  document.getElementById("notifToggleBtn").addEventListener("click", toggleNotifPermission);
  document.getElementById("editProfileBtn").addEventListener("click", function(){
    buildForm(document.getElementById("modalFormMount"), state.profile, function(data){
      return apiFetch("/profile", {method:"PUT", body:data}).then(function(){
        state.profile = data;
        document.getElementById("profileModal").hidden = true;
        document.getElementById("scrim").hidden = true;
        showToast("อัปเดตโปรไฟล์แล้ว");
        renderMeChip();
        renderLobby();
        checkNewMatches();
      }).catch(function(err){
        showToast(err.message || "อัปเดตโปรไฟล์ไม่สำเร็จ");
      });
    });
    document.getElementById("profileModal").hidden = false;
    document.getElementById("scrim").hidden = false;
  });
  document.getElementById("meChip").addEventListener("click", function(){
    document.getElementById("editProfileBtn").click();
  });
  document.getElementById("closeModalBtn").addEventListener("click", function(){
    document.getElementById("profileModal").hidden = true;
    document.getElementById("scrim").hidden = true;
  });
  document.getElementById("closeChatBtn").addEventListener("click", closeChat);
  document.getElementById("nicknameEditBtn").addEventListener("click", startEditNickname);
  document.getElementById("muteChatBtn").addEventListener("click", function(){
    if(!state.activeChatId) return;
    var nowMuted = toggleMute(state.activeChatId);
    var btn = document.getElementById("muteChatBtn");
    btn.classList.toggle("active", nowMuted);
    btn.title = nowMuted ? "เปิดแจ้งเตือนคนนี้อีกครั้ง" : "ปิดแจ้งเตือนคนนี้";
    showToast(nowMuted ? "ปิดแจ้งเตือนจากคนนี้แล้ว" : "เปิดแจ้งเตือนจากคนนี้แล้ว");
  });
  document.getElementById("blockChatBtn").addEventListener("click", blockCurrentChatUser);
  document.getElementById("blockedListBtn").addEventListener("click", function(){
    renderBlockedList();
    document.getElementById("blockedModal").hidden = false;
    document.getElementById("scrim").hidden = false;
  });
  document.getElementById("closeBlockedModalBtn").addEventListener("click", function(){
    document.getElementById("blockedModal").hidden = true;
    document.getElementById("scrim").hidden = true;
  });
  document.getElementById("scrim").addEventListener("click", function(){
    if(!document.getElementById("chatPanel").hidden) closeChat();
    if(!document.getElementById("profileModal").hidden){
      document.getElementById("profileModal").hidden = true;
      document.getElementById("scrim").hidden = true;
    }
    if(!document.getElementById("blockedModal").hidden){
      document.getElementById("blockedModal").hidden = true;
      document.getElementById("scrim").hidden = true;
    }
    if(!document.getElementById("conversationsPanel").hidden) closeConversationsPanel();
  });
  document.getElementById("conversationsTabBtn").addEventListener("click", openConversationsPanel);
  document.getElementById("closeConversationsBtn").addEventListener("click", closeConversationsPanel);
  document.getElementById("chatForm").addEventListener("submit", function(e){
    e.preventDefault();
    var input = document.getElementById("chatInput");
    sendMessage(input.value);
    input.value = "";
  });
  document.getElementById("searchInput").addEventListener("input", renderGrid);
  document.getElementById("gameFilter").addEventListener("change", renderGrid);
  document.getElementById("sortFilter").addEventListener("change", renderGrid);
  document.getElementById("minMatchFilter").addEventListener("input", function(e){
    // อัปเดตตัวเลขที่โชว์และสีเส้นทันทีระหว่างลาก แต่ยังไม่ยิงไปเซิร์ฟเวอร์ (เหมือนปรับเสียง)
    updateMinMatchLabel(parseInt(e.target.value, 10) || 0);
    updateMinMatchTrackFill(e.target);
  });
  document.getElementById("minMatchFilter").addEventListener("change", function(e){
    // ยิงอัปเดตไปเซิร์ฟเวอร์เมื่อปล่อยมือ/เปลี่ยนค่าเสร็จแล้ว
    updateMinMatchPct(parseInt(e.target.value, 10) || 0);
  });
  document.getElementById("mismatchToggleBtn").addEventListener("click", function(){
    setShowMismatch(!isShowMismatch());
    updateMismatchToggleBtn();
    if(!document.getElementById("viewLobby").hidden) renderGrid();
  });

  /* ---------------- emoji picker (chat input) ---------------- */
  (function setupEmojiPicker(){
    var btn = document.getElementById("emojiBtn");
    var picker = document.getElementById("emojiPicker");
    if(!btn || !picker) return;

    function renderPicker(){
      picker.innerHTML = "";
      EMOJIS.forEach(function(em){
        var emBtn = el("button",{type:"button", class:"emoji-option"},[em]);
        emBtn.addEventListener("click", function(){
          var input = document.getElementById("chatInput");
          input.value += em;
          input.focus();
        });
        picker.appendChild(emBtn);
      });
    }
    renderPicker();

    btn.addEventListener("click", function(e){
      e.stopPropagation();
      picker.hidden = !picker.hidden;
    });
    document.addEventListener("click", function(e){
      if(!picker.hidden && !picker.contains(e.target) && e.target !== btn){
        picker.hidden = true;
      }
    });
  })();

  updateNotifToggleBtn();
  updateMismatchToggleBtn();
  boot();
})();
