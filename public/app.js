(function(){
  "use strict";

  /* ---------------- static data ---------------- */
  var GAMES = ["Valorant","League of Legends","RoV","PUBG Mobile","Free Fire","Genshin Impact",
    "Honkai: Star Rail","Mobile Legends","Apex Legends","Overwatch 2","EA Sports FC","Minecraft",
    "Elden Ring","Stardew Valley","Teamfight Tactics"];

  var DAYS = [
    {id:"mon",label:"จ"},{id:"tue",label:"อ"},{id:"wed",label:"พ"},{id:"thu",label:"พฤ"},
    {id:"fri",label:"ศ"},{id:"sat",label:"ส"},{id:"sun",label:"อา"}
  ];

  var TIMES = [
    {id:"morning",label:"เช้า"},{id:"afternoon",label:"บ่าย"},
    {id:"evening",label:"เย็น"},{id:"night",label:"ดึก"}
  ];

  var GENDERS = [{id:"male",label:"ชาย"},{id:"female",label:"หญิง"},{id:"unspecified",label:"ขอไม่เปิดเผย"}];
  var GENDER_LABELS = {male:"ชาย", female:"หญิง", unspecified:"ขอไม่เปิดเผย"};

  var GOALS = [{id:"friends",label:"หาเพื่อนเล่นเกมอย่างเดียว"},{id:"open",label:"เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ"}];
  var GOAL_LABELS = {friends:"หาเพื่อนเล่นเกมอย่างเดียว", open:"เป็นมากกว่าเพื่อนก็ได้ถ้าถูกใจ"};

  var STYLES = ["สายชิล ไม่ซีเรียส","จริงจัง/ตั้งใจแข่ง","ชอบคุยระหว่างเกม","โฟกัสเงียบ ๆ",
    "มือใหม่โอเค ใจดี","สายฝึกหนัก อยากพัฒนา","ชอบวางแผน","สายฮา มีมทุกเกม",
    "ใช้วอยซ์แชทได้","พิมพ์แชทอย่างเดียว"];

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
  function dice(a,b){
    if(a.length===0 && b.length===0) return 0;
    return (2*intersect(a,b).length)/(a.length+b.length);
  }
  function showToast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(function(){ t.hidden = true; }, 2200);
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
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------- matching ---------------- */
  function matchScore(user, cand){
    var gameScore = dice(user.games, cand.games);
    var timeScore = user.times.length ? intersect(user.times, cand.times).length/user.times.length : 0;
    var dayScore = user.days.length ? intersect(user.days, cand.days).length/user.days.length : 0;
    var styleScore = dice(user.styles, cand.styles);
    var total = gameScore*0.45 + timeScore*0.2 + dayScore*0.15 + styleScore*0.2;
    return {
      total: Math.round(total*100),
      breakdown: {
        games: Math.round(gameScore*100),
        time: Math.round(((timeScore+dayScore)/2)*100),
        style: Math.round(styleScore*100)
      }
    };
  }

  /* ---------------- app state ---------------- */
  var state = {
    user: null,
    profile: null,
    candidates: [],
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
      goodToKnow: existing ? existing.goodToKnow : ""
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
        });
        goalRow.appendChild(pill);
      });
    }
    renderGoal();
    goalField.appendChild(goalRow);
    form.appendChild(goalField);

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

  function renderCard(cand, score){
    var online = state.onlineIds.has(cand.id);
    var card = el("div",{class:"p-card"});

    var top = el("div",{class:"p-card-top"});
    top.appendChild(makeAvatar(cand.name));
    var idBox = el("div",{class:"p-card-id"});
    var nameRow = el("div",{class:"p-card-name"},[cand.name]);
    if(online){
      var dot = el("span",{class:"online-dot live"});
      nameRow.insertBefore(dot, nameRow.firstChild);
    }
    idBox.appendChild(nameRow);
    idBox.appendChild(el("div",{class:"p-card-status"},[(online?"ออนไลน์ตอนนี้":"ออฟไลน์")+" · "+GENDER_LABELS[cand.gender]]));
    top.appendChild(idBox);
    var dial = el("div",{class:"match-dial"});
    dial.style.setProperty("--pct", score.total);
    dial.appendChild(el("span",{},[score.total+"%"]));
    top.appendChild(dial);
    card.appendChild(top);

    var gamesRow = el("div",{class:"p-card-games"});
    cand.games.forEach(function(g){ gamesRow.appendChild(el("span",{class:"tag"},[g])); });
    card.appendChild(gamesRow);

    var stylesRow = el("div",{class:"p-card-games"});
    cand.styles.forEach(function(s){ stylesRow.appendChild(el("span",{class:"tag style-tag"},[s])); });
    card.appendChild(stylesRow);

    var metaRow = el("div",{class:"p-card-games"});
    (cand.goal||[]).forEach(function(gid){ metaRow.appendChild(el("span",{class:"tag goal-tag"},[GOAL_LABELS[gid]||gid])); });
    card.appendChild(metaRow);

    var breakdown = el("div",{class:"breakdown"});
    [["เกม",score.breakdown.games],["เวลา",score.breakdown.time],["สไตล์",score.breakdown.style]].forEach(function(pair){
      var row = el("div",{class:"breakdown-row"});
      row.appendChild(el("span",{class:"breakdown-label"},[pair[0]]));
      var bar = el("div",{class:"breakdown-bar"});
      var fill = el("div",{class:"breakdown-fill"});
      fill.style.width = Math.max(4,pair[1])+"%";
      bar.appendChild(fill);
      row.appendChild(bar);
      breakdown.appendChild(row);
    });
    card.appendChild(breakdown);

    card.appendChild(el("div",{class:"good-to-know"},["“"+(cand.goodToKnow||"")+"”"]));

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
    GAMES.concat(state.candidates.reduce(function(acc,c){ c.games.forEach(function(g){ if(GAMES.indexOf(g)===-1 && acc.indexOf(g)===-1) acc.push(g); }); return acc; },[]))
      .forEach(function(g){ gameFilter.appendChild(el("option",{value:g},[g])); });
    gameFilter.value = currentFilterVal;

    renderGrid();
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
      var matchesGame = gameFilterVal==="all" || c.games.indexOf(gameFilterVal)>-1;
      return matchesSearch && matchesGame;
    });

    scored.sort(function(a,b){
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
  }

  /* ---------------- chat ---------------- */
  function findCandidate(id){
    return state.candidates.filter(function(c){ return c.id === id; })[0] || null;
  }

  function openChat(cand){
    state.activeChatId = cand.id;
    var av = document.getElementById("chatAvatar");
    av.style.background = hashColor(cand.name);
    av.textContent = initials(cand.name);
    document.getElementById("chatName").textContent = cand.name;
    document.getElementById("chatStatus").textContent = (state.onlineIds.has(cand.id) ? "ออนไลน์ตอนนี้" : "ออฟไลน์") + " · " + GENDER_LABELS[cand.gender];
    document.getElementById("chatGoodToKnow").textContent = "“"+(cand.goodToKnow||"")+"”";

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
  }

  function renderMessages(messages){
    var box = document.getElementById("chatMessages");
    box.innerHTML = "";
    messages.forEach(function(m){
      box.appendChild(el("div",{class:"msg "+(m.from==="me"?"me":"them")},[m.text]));
    });
    box.scrollTop = box.scrollHeight;
  }

  function appendMessage(m){
    var box = document.getElementById("chatMessages");
    box.appendChild(el("div",{class:"msg "+(m.from==="me"?"me":"them")},[m.text]));
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
      if(state.activeChatId === otherId){
        appendMessage(m);
      } else if(m.from === "them"){
        var cand = findCandidate(otherId);
        showToast("ข้อความใหม่จาก " + (cand ? cand.name : "เพื่อนใหม่"));
      }
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
      apiFetch(path, {method:"POST", body:{email:email, password:pass}}).then(function(){
        showToast(mode === "signup" ? "สมัครสมาชิกสำเร็จ!" : "เข้าสู่ระบบสำเร็จ!");
        afterLogin();
      }).catch(function(err){
        showError(err.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }).finally(function(){
        submitBtn.disabled = false;
      });
    });

    mount.appendChild(form);
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
    loadCandidates().then(renderLobby).catch(function(err){
      showToast(err.message || "โหลดรายชื่อไม่สำเร็จ");
    });
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
      disconnectSocket();
      state.user = null;
      state.profile = null;
      state.candidates = [];
      showAuthView();
    });
  }

  function handleOAuthRedirectParams(){
    var params = new URLSearchParams(window.location.search);
    var login = params.get("login");
    var loginError = params.get("loginError");
    if(login){
      showToast("เข้าสู่ระบบด้วย " + (login === "discord" ? "Discord" : "Facebook") + " สำเร็จ!");
    } else if(loginError){
      showToast(loginError);
    }
    if(login || loginError){
      params.delete("login");
      params.delete("loginError");
      var qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?"+qs : ""));
    }
  }

  function boot(){
    handleOAuthRedirectParams();
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
  document.getElementById("fbLoginBtn").addEventListener("click", function(){ loginWithProvider("facebook"); });
  document.getElementById("discordLoginBtn").addEventListener("click", function(){ loginWithProvider("discord"); });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("themeToggleBtn").addEventListener("click", function(){
    applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
  });
  document.getElementById("editProfileBtn").addEventListener("click", function(){
    buildForm(document.getElementById("modalFormMount"), state.profile, function(data){
      return apiFetch("/profile", {method:"PUT", body:data}).then(function(){
        state.profile = data;
        document.getElementById("profileModal").hidden = true;
        document.getElementById("scrim").hidden = true;
        showToast("อัปเดตโปรไฟล์แล้ว");
        renderMeChip();
        renderLobby();
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
  document.getElementById("scrim").addEventListener("click", function(){
    if(!document.getElementById("chatPanel").hidden) closeChat();
    if(!document.getElementById("profileModal").hidden){
      document.getElementById("profileModal").hidden = true;
      document.getElementById("scrim").hidden = true;
    }
  });
  document.getElementById("chatForm").addEventListener("submit", function(e){
    e.preventDefault();
    var input = document.getElementById("chatInput");
    sendMessage(input.value);
    input.value = "";
  });
  document.getElementById("searchInput").addEventListener("input", renderGrid);
  document.getElementById("gameFilter").addEventListener("change", renderGrid);
  document.getElementById("sortFilter").addEventListener("change", renderGrid);

  boot();
})();
