/* OverTake modular build: Guest progression, XP/rank calculations, profile customization and social data. */
    function getChallengeMetric(c, stats) {
      const t = c && c.type;
      const x = stats || {};
      if (t === 'login') return 1;
      if (t === 'catches') return Math.max(0, Number(x.correctCatches || 0));
      if (t === 'combo') return Math.max(0, Number(x.maxCombo || 0));
      if (t === 'score') return Math.max(0, Number(x.score || 0));
      if (t === 'survival') return Math.max(0, Number(x.survivalSeconds || 0));
      if (t === 'fever') return Math.max(0, Number(x.feverActivations || 0));
      return 0;
    }

    function ensureGuestDailyLoginReward() {
      const key = new Date().toISOString().slice(0,10);
      if (localStorage.getItem('guest_daily_login_reward_date') === key) return false;
      const progresses = (() => { try { return JSON.parse(localStorage.getItem('guest_daily_challenge_progresses') || '[]'); } catch(e) { return []; } })();
      const claims = (() => { try { return JSON.parse(localStorage.getItem('guest_daily_challenge_claims') || '[]'); } catch(e) { return []; } })();
      progresses[0] = 1;
      claims[0] = true;
      localStorage.setItem('guest_daily_challenge_date', key);
      localStorage.setItem('guest_daily_challenge_progresses', JSON.stringify(progresses));
      localStorage.setItem('guest_daily_challenge_claims', JSON.stringify(claims));
      const u = getGuestProgress();
      u.xp += 500;
      u.rankPoints += 50;
      u.level = getLevelFromXp(u.xp);
      saveGuestProgress(u);
      localStorage.setItem('guest_daily_login_reward_date', key);
      return true;
    }

    function getGuestDailyChallenges() {
      const key = new Date().toISOString().slice(0,10);
      const savedKey = localStorage.getItem('guest_daily_challenge_date');
      if (savedKey !== key) {
        localStorage.setItem('guest_daily_challenge_date', key);
        localStorage.setItem('guest_daily_challenge_progresses', JSON.stringify([]));
        localStorage.setItem('guest_daily_challenge_claims', JSON.stringify([]));
      }
      let progresses = [], claims = [];
      try { progresses = JSON.parse(localStorage.getItem('guest_daily_challenge_progresses') || '[]'); } catch(e) { progresses=[]; }
      try { claims = JSON.parse(localStorage.getItem('guest_daily_challenge_claims') || '[]'); } catch(e) { claims=[]; }
      if (!Array.isArray(progresses)) progresses=[];
      if (!Array.isArray(claims)) claims=[];
      const result = DAILY_CHALLENGE_LADDER.map(function(t,i){
        const previousComplete = i === 0 || Number(progresses[i-1] || 0) >= DAILY_CHALLENGE_LADDER[i-1].target;
        const progress = Math.min(t.target, Math.max(0, Number(progresses[i] || 0)));
        const completed = progress >= t.target;
        const claimed = claims[i] === true;
        return { date:key, index:i, title:t.title, description:t.description, type:t.type, target:t.target,
          progress:progress, xpReward:t.xpReward, rpReward:t.rpReward || 0, unlocked:previousComplete,
          completed:completed, claimed:claimed };
      });
      localStorage.setItem('guest_daily_challenge_progresses', JSON.stringify(result.map(function(c){return c.progress;})));
      localStorage.setItem('guest_daily_challenge_claims', JSON.stringify(result.map(function(c){return c.claimed;})));
      localStorage.setItem('guest_daily_challenge_done_count', String(result.filter(function(c){return c.completed;}).length));
      return result;
    }

    function getGuestDailyChallenge() {
      const list = getGuestDailyChallenges();
      const active = list.find(function(c){ return c.unlocked && !c.completed; }) || list[list.length-1];
      const doneCount = list.filter(function(c){ return c.completed; }).length;
      return Object.assign({}, active, { doneCount:doneCount, totalChallenges:list.length });
    }

    function saveGuestDailyChallenge(stats) {
      const list = getGuestDailyChallenges();
      const activeIndex = list.findIndex(function(c){ return c.unlocked && !c.completed; });
      if (activeIndex < 0) return list[list.length-1];
      const progresses = list.map(function(c){ return c.progress; });
      const c = list[activeIndex];
      const metric = getChallengeMetric(c, stats || {});
      if (c.type === 'combo' || c.type === 'survival' || c.type === 'fever') {
        progresses[activeIndex] = Math.max(progresses[activeIndex], Math.min(c.target, metric));
      } else {
        progresses[activeIndex] = Math.min(c.target, progresses[activeIndex] + metric);
      }
      localStorage.setItem('guest_daily_challenge_progresses', JSON.stringify(progresses));
      const updated = getGuestDailyChallenges();
      return updated.find(function(x){ return x.index===activeIndex; }) || updated[activeIndex];
    }

    function claimGuestDailyChallenge(index) {
      const list = getGuestDailyChallenges();
      const i = Math.max(0, Math.min(list.length-1, Number(index || 0)));
      const c = list[i];
      if (!c || !c.completed || c.claimed) return false;
      const claims = list.map(function(x){ return x.claimed; });
      claims[i] = true;
      localStorage.setItem('guest_daily_challenge_claims', JSON.stringify(claims));
      const u = getGuestProgress();
      const multiplier = getRewardMultiplier();
      const reward = Math.max(0, Math.round(Number(c.xpReward || 0) * multiplier));
      const rpReward = Math.max(0, Math.round(Number(c.rpReward || 0) * multiplier));
      u.xp += reward;
      u.rankPoints += rpReward;
      u.level = getLevelFromXp(u.xp);
      u.dailyChallenge = getGuestDailyChallenge();
      saveGuestProgress(u);
      updateBackendUI();
      renderProfileQuick();
      if (document.getElementById('accountModal')?.style.display === 'flex') openAccountTab('challenge');
      showBackendMessage('🎁 ' + c.title + ': +' + reward + ' XP' + (rpReward ? ' • +' + rpReward + ' RP' : ''), false);
      showXPToast(reward, u.level, 0);
      return true;
    }

    function calculateGuestXP(score, mode) {
      const n = Math.max(0, Number(score || 0));
      const base = mode === 'Rank' ? Math.max(20, Math.floor(n / 5)) : Math.max(10, Math.floor(n / 10));
      return base;
    }

    function calculateMatchXP(score, mode, stats) {
      const s = Math.max(0, Number(score || 0));
      let xp = Math.max(5, Math.floor(s / 25));
      if (mode === 'Rank') xp += 15;
      if (stats && Number(stats.maxCombo || 0) >= 10) xp += 10;
      if (stats && Number(stats.feverActivations || 0) > 0) xp += 10;
      return Math.round(xp * getRewardMultiplier());
    }

    function calculatePerformanceRankPoints(score, maxCombo, correctCatches, wrongCatches, mode) {
      if (mode !== 'Rank') return 0;
      const s = Math.max(0, Number(score || 0));
      const combo = Math.max(0, Number(maxCombo || 0));
      const good = Math.max(0, Number(correctCatches || 0));
      const bad = Math.max(0, Number(wrongCatches || 0));
      const accuracy = good + bad > 0 ? good / (good + bad) : 0;
      const rank = backendState.user?.rank || getGuestProgress().rank || 'Bronze I';
      const target = getRankPromotionTarget(rank);
      const raw = Math.floor(s / 80) + Math.floor(combo * 1.5) + Math.floor(good * 1.25) + Math.floor(accuracy * 20) - Math.floor(bad * 1.5);
      if (s >= target) return Math.max(1, raw);
      return -Math.max(1, Math.ceil((target - s) / 100) + Math.floor(bad / 2));
    }

    function applyGuestMatchProgress(score, mode, result) {
      const u = getGuestProgress();
      const xp = result && result.xpGained !== undefined ? Number(result.xpGained || 0) : Math.round(calculateGuestXP(score, mode) * getRewardMultiplier());
      u.xp += Math.max(0, xp);
      u.level = getLevelFromXp(u.xp);
      u.highScore = Math.max(Number(u.highScore || 0), Number(score || 0));
      if (mode === 'Classic') u.classicScore = Math.max(Number(u.classicScore || 0), Number(score || 0));
      if (mode === 'Rank') u.rankScore = Math.max(Number(u.rankScore || 0), Number(score || 0));
      if (mode === 'Tournament') {
        const trophyEarned = toNaturalNumber(Math.floor(Math.max(0, Number(score || 0)) * 0.5) * getRewardMultiplier(), 0);
        u.tournamentTrophy = Number(u.tournamentTrophy || 0) + trophyEarned;
        u.tournamentMonthlyTrophy = Number(u.tournamentMonthlyTrophy || 0) + trophyEarned;
        u.tournamentMatches = Number(u.tournamentMatches || 0) + 1;
        u.tournamentHighScore = Math.max(Number(u.tournamentHighScore || 0), Number(score || 0));
        return { xpGained: xp, challengeXP: 0, rankPointsDelta: 0, trophyEarned: trophyEarned, user: u, challenge: null };
      }
      let rpDelta = 0;
      if (mode === 'Rank') {
        const target = getRankPromotionTarget(u.rank);
        u.rankTarget = target;
        rpDelta = result && result.rankPointsDelta !== undefined ? Number(result.rankPointsDelta || 0) : calculatePerformanceRankPoints(score, state.maxCombo, state.correctCatches, state.wrongCatches, mode);
        if (rpDelta > 0) rpDelta = Math.round(rpDelta * getRewardMultiplier());
        u.rankPoints = Number(u.rankPoints || 0) + rpDelta;
        let idx = MATCH_RANKS.indexOf(u.rank);
        while (idx < MATCH_RANKS.length - 1 && u.rankPoints >= getRankPromotionTarget(MATCH_RANKS[idx])) {
          u.rankPoints -= getRankPromotionTarget(MATCH_RANKS[idx]);
          idx++;
          u.rank = MATCH_RANKS[idx];
          u.rankTarget = getRankPromotionTarget(u.rank);
        }
        while (idx > 0 && u.rankPoints < 0) {
          idx--;
          u.rankPoints = getRankPromotionTarget(MATCH_RANKS[idx]) + u.rankPoints;
          u.rank = MATCH_RANKS[idx];
          u.rankTarget = getRankPromotionTarget(u.rank);
        }
        u.rankPoints = Math.max(0, Number(u.rankPoints || 0));
        u.dailyRankMatches = Number(u.dailyRankMatches || 0) + 1;
        u.dailyRankLimit = getDailyRankMatchLimit(u.rank);
      }
      const challenge = saveGuestDailyChallenge({ score:Number(score||0), maxCombo:Number(state.maxCombo||0), correctCatches:Number(state.correctCatches||0), wrongCatches:Number(state.wrongCatches||0), feverActivations:Number(state.feverActivations||0), survivalSeconds:Math.max(0, Number(state.time||0)) });
      u.dailyChallenge = getGuestDailyChallenge();
      saveGuestProgress(u);
      return { xpGained: xp, challengeXP: 0, rankPointsDelta: rpDelta, user: u, challenge: challenge };
    }

    // Account Level XP progression: the first level-up requires 500 XP, then each
    // next level requires 50% more XP than the previous level-up requirement.
    // Requirements: 500, 750, 1125, 1688, ...
    function getLevelXpRequired(level) {
      const lv = Math.max(1, Number(level || 1));
      return Math.max(1, Math.ceil(500 * Math.pow(1.5, lv - 1)));
    }

    function getLevelFromXp(xp) {
      const n = Math.max(0, Number(xp || 0));
      let level = 1;
      let spent = 0;
      let needed = getLevelXpRequired(level);
      while (n >= spent + needed) {
        spent += needed;
        level += 1;
        needed = getLevelXpRequired(level);
        if (level > 1000) break;
      }
      return level;
    }

    function getLevelProgress(xp) {
      const n = Math.max(0, Number(xp || 0));
      const backendLevel = Number(backendState.user?.level || 0);
      const calculatedLevel = getLevelFromXp(n);
      const level = Math.max(1, backendLevel || calculatedLevel);
      let spent = 0;
      for (let i = 1; i < level; i++) spent += getLevelXpRequired(i);
      const needed = getLevelXpRequired(level);
      const current = Math.max(0, n - spent);
      return { current: current, needed: needed, percent: Math.min(100, (current / needed) * 100) };
    }

    function renderProfileQuick() {
      const el = document.getElementById('profileQuick');
      if (!el) return;
      const u = backendState.user || getGuestProgress();
      const xpRank = getXpRank(u.xp);
      el.innerHTML =
        '<button type="button" class="quick-badge" onclick="openAccount(\'profile\')" style="cursor:pointer;">👤 ' + escapeHtmlClient(u.username || 'Guest Player') + '</button>' +
        '<span class="quick-badge">⭐ XP ' + escapeHtmlClient(xpRank.name) + '</span>' +
        '<span class="quick-badge">⚔️ Match ' + escapeHtmlClient(u.rank || 'Bronze I') + '</span>' +
        '<span class="quick-badge">RP ' + Number(u.rankPoints || 0) + '</span>';
    }

    let publicProfileTarget = null;

    const DEFAULT_AVATARS = [
      '🧊','🔥','⚡','🌙','☄️','🪐','🌟','🦊','🐺','🐼','🐸','🐯',
      '🦁','🐲','👾','🤖','🧙','🧛','🥷','🏹','🛡️','🦅','🐉','🎃','🦂','🌌','🦄','💫'
    ];

    function avatarForPlayer(name) {
      const text = String(name || 'Player');
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      return DEFAULT_AVATARS[Math.abs(hash) % DEFAULT_AVATARS.length];
    }

    const AVATAR_CHANGE_COOLDOWN_MS = 5 * 60 * 60 * 1000;
    function getSelectedAvatar() {
      const u = backendState.user || getGuestProgress();
      const saved = localStorage.getItem('elem_selected_avatar_' + String(u.username || 'guest'));
      return (u.avatar && DEFAULT_AVATARS.includes(u.avatar)) ? u.avatar : (saved && DEFAULT_AVATARS.includes(saved) ? saved : avatarForPlayer(u.username || 'Guest Player'));
    }
    function getAvatarChangeAt() {
      const u = backendState.user || getGuestProgress();
      return Number(localStorage.getItem('elem_avatar_changed_at_' + String(u.username || 'guest')) || 0);
    }
    function getAvatarCooldownLeft() {
      return Math.max(0, AVATAR_CHANGE_COOLDOWN_MS - (Date.now() - getAvatarChangeAt()));
    }
    function formatAvatarCooldown(ms) {
      const total = Math.ceil(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const sec = total % 60;
      return h + 'h ' + String(m).padStart(2,'0') + 'm ' + String(sec).padStart(2,'0') + 's';
    }
async function chooseAvatar(index) {
      const u=backendState.user||getGuestProgress(), avatar=DEFAULT_AVATARS[Number(index)], cost=50;
      if(!avatar||avatar===getSelectedAvatar())return;
      const currentRp=Number(u.rankPoints||0);
      if(currentRp<cost){showBackendMessage('💠 You need '+cost+' RP to change your avatar. Current: '+currentRp+' RP.',true);return;}
      if(!(await showSensitiveConfirm({message:'Choose this avatar? Cost: '+cost+' RP',cancelText:'Cancel',confirmText:'Confirm'})))return;
      if(backendState.user&&backendState.token){
        apiRequest({action:'profileCustomize',token:backendState.token,type:'avatar',avatar:avatar,cost:cost}).then(function(res){
          if(!res||!res.success)throw new Error((res&&res.message)||'Avatar change failed.');
          backendState.user=Object.assign({},backendState.user,res.user||{},{avatar:(res.user&&res.user.avatar)||res.avatar||avatar,rankPoints:res.rankPoints!==undefined?Number(res.rankPoints):Math.max(0,currentRp-cost)});
          localStorage.setItem('elem_selected_avatar_'+String(u.username||'guest'),avatar);localStorage.setItem('elem_rank_points',String(backendState.user.rankPoints||0));
          updateBackendUI();renderAccountHeader();openAccountTab('profile');showBackendMessage('🖼️ Avatar updated • -'+cost+' RP',false);
        }).catch(function(e){showBackendMessage(e.message||'Avatar change failed.',true);});
        return;
      }
      u.rankPoints=Math.max(0,currentRp-cost);u.avatar=avatar;saveGuestProgress(u);localStorage.setItem('elem_selected_avatar_'+String(u.username||'guest'),avatar);
      renderAccountHeader();openAccountTab('profile');showBackendMessage('🖼️ Avatar updated • -'+cost+' RP',false);
    }

function getUsernameChangeKey(player){
      const u=player||backendState.user||getGuestProgress();
      const id=String((u&&u.userId)||'').trim().toLowerCase();
      if(id)return 'cfe_username_change_count_'+id;
      return 'cfe_username_change_count_'+String((u&&u.username)||'guest').trim().toLowerCase();
    }
    function getUsernameChangeCount(player){
      const n=Number(localStorage.getItem(getUsernameChangeKey(player))||0);
      return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
    }
    function setUsernameChangeCount(player,count){
      localStorage.setItem(getUsernameChangeKey(player),String(Math.max(0,Math.floor(Number(count)||0))));
    }

    async function changeUsernameFromProfile() {
      const current=backendState.user||getGuestProgress();
      const input=document.getElementById('profileNewUsername'),name=String(input&&input.value||'').trim();
      if(!/^[A-Za-z0-9_]{3,20}$/.test(name)){showBackendMessage('Username must be 3–20 characters: letters, numbers, underscore.',true);return;}
      if(name.toLowerCase()===String(current.username||'').toLowerCase())return;

      const used=getUsernameChangeCount(current);
      const freeLeft=Math.max(0,10-used);
      const cost=freeLeft>0?0:100;
      const rp=Number(current.rankPoints||0);
      if(cost>0&&rp<cost){showBackendMessage('💠 Your 10 free username changes are used. You need '+cost+' RP for the next change.',true);return;}
      const confirmText=cost===0
        ? 'Change username to "'+name+'"?\n\nFree username change • '+(freeLeft-1)+' free change'+((freeLeft-1)===1?'':'s')+' remaining.'
        : 'Change username to "'+name+'"?\n\nCost: '+cost+' RP';
      if(!(await showSensitiveConfirm({message:confirmText.replace(/\n+/g,' '),cancelText:'Cancel',confirmText:'Confirm'})))return;

      try{
        if(backendState.user&&backendState.token){
          const res=await apiRequest({action:'profileCustomize',token:backendState.token,type:'username',username:name,cost:cost,freeChange:cost===0,allowDuplicateUsername:true,usernameChangeCount:used});
          if(!res||!res.success)throw new Error((res&&res.message)||'Username change failed.');
          const nextName=(res.user&&res.user.username)||res.username||name;
          const nextRp=res.rankPoints!==undefined?Number(res.rankPoints):Math.max(0,rp-cost);
          backendState.user=Object.assign({},backendState.user,res.user||{},{username:nextName,rankPoints:nextRp});
          const nextCount=used+1;
          setUsernameChangeCount(backendState.user,nextCount);
          localStorage.setItem('elem_username',nextName);
          localStorage.setItem('elem_rank_points',String(nextRp));
          localStorage.setItem('elem_logged_user_cache',JSON.stringify(backendState.user));
          updateBackendUI();
          openAccountTab('profile');
          showBackendMessage(cost===0?'✏️ Username changed • FREE • '+Math.max(0,10-nextCount)+' free changes left.':'✏️ Username changed • -'+cost+' RP',false);
          return;
        }

        // Guest users have the same username-change feature. No uniqueness check is done.
        const next=Object.assign({},current,{username:name});
        saveGuestProgress(next);
        setUsernameChangeCount(next,used+1);
        localStorage.setItem('elem_username',name);
        updateBackendUI();
        renderAccountHeader();
        openAccountTab('profile');
        showBackendMessage(cost===0?'✏️ Username changed • FREE • '+Math.max(0,10-(used+1))+' free changes left.':'✏️ Username changed • -'+cost+' RP',false);
      }catch(e){showBackendMessage(e.message||'Username change failed.',true);}
    }

function renderAvatarPicker() {
      const u=backendState.user||getGuestProgress(),selected=getSelectedAvatar(),cost=50,canChange=Number(u.rankPoints||0)>=cost;
      return '<div class="customize-card"><div class="challenge-top"><div class="customize-title">🖼️ Avatar</div><div class="challenge-badge">-'+cost+' RP</div></div><div class="profile-avatar-preview">'+selected+'</div><div class="customize-note">Avatar change has no cooldown. Each change costs <b>'+cost+' RP</b>.</div><div class="avatar-picker-grid">'+DEFAULT_AVATARS.map(function(a,i){return '<button type="button" class="avatar-choice '+(a===selected?'selected':'')+'"'+(!canChange&&a!==selected?' disabled':'')+' onclick="chooseAvatar('+i+')">'+a+'</button>';}).join('')+'</div></div>';
    }

    function getPersistentUserId(player) {
      const u = player || backendState.user || getGuestProgress();
      if (u && u.userId) return String(u.userId);
      const key = 'cfe_user_id_' + String((u && u.username) || 'guest').toLowerCase();
      let id = localStorage.getItem(key);
      if (!id) {
        const bytes = new Uint32Array(3);
        if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
        else { bytes[0]=Date.now()>>>0; bytes[1]=Math.random()*0xffffffff>>>0; bytes[2]=(Date.now()*2654435761)>>>0; }
        id = 'CFE-' + Array.from(bytes).map(n => n.toString(36).toUpperCase().padStart(7,'0')).join('').slice(0,12);
        localStorage.setItem(key, id);
      }
      return id;
    }
async function copyPlayerId(id) {
      const value=String(id||'').trim();if(!value)return;
      const btn=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('player-id-copy')?document.activeElement:null;
      const mark=function(){if(btn){const old=btn.textContent;btn.textContent='COPIED';btn.classList.add('copy-ok');setTimeout(function(){btn.textContent=old||'COPY';btn.classList.remove('copy-ok');},1400);}showBackendMessage('📋 Player ID copied.',false);};
      try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);mark();return;}}catch(e){}
      try{const ta=document.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,value.length);const ok=document.execCommand('copy');document.body.removeChild(ta);if(ok){mark();return;}}catch(e){}
      try{window.prompt('Copy Player ID:',value);}catch(e){}
    }

    function fallbackCopyPlayerId(value, done) {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch(e) { copied = false; }
      ta.remove();
      if (copied) {
        if (done) done();
      } else {
        // Last-resort fallback for browsers that block clipboard access.
        window.prompt('Copy Player ID:', value);
      }
    }
    function playerIdLine(id) {
      const raw = String(id || '').trim();
      const value = escapeHtmlClient(raw);
      return '<div class="player-id-label">Player ID</div>' +
             '<div class="player-id-line"><span class="player-id-value">' + value + '</span>' +
             '<button type="button" class="player-id-copy" title="Copy Player ID" onclick="copyPlayerId(' + JSON.stringify(raw) + '); return false;">COPY</button></div>';
    }

    function getFriendList() {
      try { return JSON.parse(localStorage.getItem('cfe_friends') || '[]'); } catch(e) { return []; }
    }
    function saveFriendList(list) { localStorage.setItem('cfe_friends', JSON.stringify(list || [])); }
function localFriendStatus(username,playerId){const name=String(username||'').toLowerCase(),id=String(playerId||'').toLowerCase();const item=getFriendList().find(function(f){const fid=String(f.userId||f.playerId||'').toLowerCase(),fname=String(f.username||'').toLowerCase();return (id&&fid===id)||(name&&fname===name);});return item?String(item.status||''):'';}
    async function getRemoteFriendStatus(username,playerId){if(!backendState.token||(!username&&!playerId))return '';try{const res=await apiRequest({action:'friendStatus',token:backendState.token,username:String(username||''),playerId:String(playerId||'')});return res&&res.success?String(res.status||''):'';}catch(e){return '';}}

async function invitePlayer(username,playerId){
  const name=String(username||'').trim(), pid=String(playerId||'').trim();
  const requestTargetKey=(pid||name).toLowerCase();
  window.__friendRequestInFlight=requestTargetKey;
  if(!name&&!pid)return;
  if(!backendState.user)ensureLocalGuestSession();
  const myId=String((backendState.user&&(backendState.user.userId||backendState.user.playerId))||'').toLowerCase();
  const myName=String((backendState.user&&backendState.user.username)||'').toLowerCase();
  if((pid&&String(pid).toLowerCase()===myId)||(!pid&&name.toLowerCase()===myName)){setPublicFriendMessage('This is your profile.',true);return;}
  if(!backendState.token){setPublicFriendMessage('🔐 Please log in to send a friend request.',true);return;}
  const btn=document.getElementById('publicFriendRequestBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Sending...';}
  setPublicFriendMessage('Sending friend request…',false);
  try{
    let status=localFriendStatus(name,pid);
    if(status!=='accepted'&&status!=='pending'&&status!=='requested')status=await getRemoteFriendStatus(name,pid);
    if(status==='accepted'){setPublicFriendMessage('🤝 You are already friends with '+name+'.',false);if(publicProfileTarget)await renderPublicProfilePanel(publicProfileTarget);return;}
    if(status==='pending'||status==='requested'){
      const list=getFriendList(); const existing=list.find(function(f){return (pid&&String(f.userId||f.playerId||'').toLowerCase()===pid.toLowerCase())||String(f.username||'').toLowerCase()===name.toLowerCase();});
      if(existing)existing.status='pending';else list.push({username:name,status:'pending',invitedAt:Date.now(),userId:pid}); saveFriendList(list);
      setPublicFriendMessage('⏳ Friend request already sent to '+name+'.',false);
      if(publicProfileTarget)await renderPublicProfilePanel(Object.assign({},publicProfileTarget,{username:name,playerId:pid||publicProfileTarget.playerId||publicProfileTarget.userId||''}));return;
    }
    const res=await apiRequest({action:'friendInvite',token:backendState.token,username:name,playerId:pid});
    if(!res||!res.success)throw new Error((res&&res.message)||'Could not send friend request.');
    const list=getFriendList(); const existing=list.find(function(f){return (pid&&String(f.userId||f.playerId||'').toLowerCase()===pid.toLowerCase())||String(f.username||'').toLowerCase()===name.toLowerCase();});
    if(existing){existing.status='pending';existing.invitedAt=Date.now();existing.userId=pid||existing.userId||((res&&res.userId)||'');}else list.push({username:name,status:'pending',invitedAt:Date.now(),userId:pid||((res&&res.userId)||'')});
    saveFriendList(list);
    setPublicFriendMessage('🤝 Friend request sent to '+name+'.',false);
    if(publicProfileTarget){
      publicProfileTarget=Object.assign({},publicProfileTarget,{username:name,playerId:pid||publicProfileTarget.playerId||publicProfileTarget.userId||'',friendStatus:'pending'});
      await renderPublicProfilePanel(publicProfileTarget);
    }
  }catch(e){setPublicFriendMessage('❌ '+(e.message||'Friend request failed.'),true);if(publicProfileTarget)await renderPublicProfilePanel(publicProfileTarget);}
}
function setPublicFriendMessage(message,error){const el=document.getElementById('publicFriendMessage');if(!el)return;el.textContent=String(message||'');el.style.display=message?'block':'none';el.style.color=error?'#fb7185':'#67e8f9';}
    async function loadFriendRequests() {
      if (!backendState.token) return [];
      const res = await apiRequest({action:'friendRequests', token:backendState.token});
      return (res && res.success && Array.isArray(res.requests)) ? res.requests : [];
    }
    async function loadFriends(username) {
      const res = await apiRequest({action:'friends', token:backendState.token || '', username:username || ''});
      return (res && res.success && Array.isArray(res.friends)) ? res.friends : [];
    }
    async function respondFriendRequest(requestId, decision) {
      if (!backendState.token) return;
      try {
        const res = await apiRequest({action:'friendRespond', token:backendState.token, requestId:String(requestId || ''), decision:String(decision || '')});
        if (!res || !res.success) throw new Error((res && res.message) || 'Could not update friend request.');
        showBackendMessage(decision === 'accept' ? '🤝 Friend request accepted.' : 'Friend request rejected.', false);
        openAccountTab('profile');
      } catch(e) { showBackendMessage(e.message || 'Friend request update failed.', true); }
    }
    function renderFriendListHtml(friends, emptyText) {
      if (!friends || !friends.length) return '<div class="public-profile-note">' + escapeHtmlClient(emptyText || 'No friends yet.') + '</div>';
      return friends.map(function(f){
        const name = f.username || f.name || 'Player';
        return '<div class="friend-list-row"><div class="friend-list-avatar">' + avatarForPlayer(name) + '</div><div class="leader-main"><div class="leader-name">' + escapeHtmlClient(name) + '</div><div class="leader-sub">' + escapeHtmlClient(f.userId || '') + '</div></div></div>';
      }).join('');
    }
    function renderFriendsPanel() {
      const friends = getFriendList().filter(f => f.status === 'accepted');
      return '<div class="challenge-card" style="margin-top:12px;" id="ownFriendsCard"><div class="challenge-top"><div class="challenge-title">🤝 Friends</div><div class="challenge-badge" id="ownFriendsCount">' + friends.length + '</div></div><div id="ownFriendsList">' + renderFriendListHtml(friends, 'No accepted friends yet.') + '</div></div>';
    }
    async function showOwnFriends() {
      const box = document.getElementById('ownFriendsList');
      if (!box) return;
      box.innerHTML = '<div class="public-profile-note">Loading friends…</div>';
      try {
        const friends = await loadFriends(backendState.user?.username || '');
        if (friends.length) {
          const normalized = friends.map(f => ({username:f.username || f.name, userId:f.userId || ''}));
          const current = getFriendList();
          normalized.forEach(function(f){
            const existing=current.find(function(x){return (f.userId&&String(x.userId||x.playerId||'').toLowerCase()===String(f.userId).toLowerCase())||String(x.username||'').toLowerCase()===String(f.username||'').toLowerCase();});
            if(existing)existing.status='accepted';else current.push({username:f.username,userId:f.userId,status:'accepted'});
          });
          saveFriendList(current);
          document.getElementById('ownFriendsCount').textContent = normalized.length;
          box.innerHTML = renderFriendListHtml(normalized, 'No accepted friends yet.');
        } else box.innerHTML = '<div class="public-profile-note">No accepted friends yet.</div>';
      } catch(e) { box.innerHTML = '<div class="public-profile-note">Could not load friends.</div>'; }
    }
    async function showFriendRequests() {
      const box = document.getElementById('friendRequestsList');
      if (!box) return;
      box.innerHTML = '<div class="public-profile-note">Loading requests…</div>';
      try {
        const requests = await loadFriendRequests();
        if (!requests.length) { box.innerHTML = '<div class="public-profile-note">No pending friend requests.</div>'; return; }
        box.innerHTML = requests.map(function(r){
          const name = r.fromUsername || r.username || 'Player';
          const id = String(r.requestId || r.id || '');
          return '<div class="friend-request-row"><div class="leader-main"><div class="leader-name">' + escapeHtmlClient(name) + '</div><div class="leader-sub">wants to be your friend</div></div><div class="friend-request-actions"><button class="friend-mini-btn accept" onclick="respondFriendRequest(' + JSON.stringify(id) + ',\'accept\')">ACCEPT</button><button class="friend-mini-btn reject" onclick="respondFriendRequest(' + JSON.stringify(id) + ',\'reject\')">REJECT</button></div></div>';
        }).join('');
      } catch(e) { box.innerHTML = '<div class="public-profile-note">Could not load friend requests.</div>'; }
    }
    function renderFriendControlsOwn() {
      return '<div class="friend-action-row"><button class="friend-action-btn" onclick="showOwnFriends()">🤝 Friends</button><button class="friend-action-btn" onclick="showFriendRequests()">📨 Friend Requests</button></div><div id="friendRequestsList"></div>';
    }
    async function togglePublicFriends() {
      const box = document.getElementById('publicFriendsList');
      if (!box || !publicProfileTarget) return;
      if (box.style.display === 'block') { box.style.display='none'; return; }
      box.style.display='block';
      try {
        const friends = await loadFriends(publicProfileTarget.username || '');
        box.innerHTML = renderFriendListHtml(friends, 'No accepted friends yet.');
      } catch(e) { box.innerHTML = '<div class="public-profile-note">Could not load friends.</div>'; }
    }

    function openAccount(tab) {
      publicProfileTarget = null;
      document.querySelectorAll('.account-tab').forEach(btn => btn.style.display = '');
      document.getElementById('accountModal').style.display = 'flex';
      renderAccountHeader();
      openAccountTab(tab || 'profile');
    }

    async function openPublicProfile(player) {
      publicProfileTarget = Object.assign({}, player || {});
      if (!publicProfileTarget) return;
      const modal = document.getElementById('accountModal');
      if (!modal) return;
      modal.style.display = 'flex';
      document.querySelectorAll('.account-tab').forEach(btn => {
        btn.classList.remove('active');
        btn.style.display = 'none';
      });
      const card = document.querySelector('#accountModal .account-card');
      if (card) card.scrollTop = 0;
      const pid = String(publicProfileTarget.playerId || publicProfileTarget.userId || '').trim();
      const name = String(publicProfileTarget.username || '').trim();
      try {
        const res = await apiRequest({action:'publicProfile', playerId:pid, username:name});
        if (res && res.success) publicProfileTarget = Object.assign({}, publicProfileTarget, res);
      } catch(e) { console.warn('Public profile refresh failed:', e); }
      renderPublicProfileHeader(publicProfileTarget);
      await renderPublicProfilePanel(publicProfileTarget);
    }

    function closeAccount() {
      document.getElementById('accountModal').style.display = 'none';
      publicProfileTarget = null;
      document.querySelectorAll('.account-tab').forEach(btn => { btn.style.display = ''; });
    }

    function renderPublicProfileHeader(p) {
      const xp = Number(p.xp || 0);
      const level = Number(p.level || getLevelFromXp(xp));
      const xpRank = getXpRank(xp);
      const rank = p.rank || 'Bronze I';
      const rp = Number(p.rankPoints || 0);
      const high = Number(p.highScore ?? p.score ?? 0);
      const emblem = document.getElementById('accountRankEmblem');
      emblem.className = 'public-avatar';
      emblem.textContent = p.avatar || avatarForPlayer(p.username);
      document.getElementById('accountName').textContent = p.username || 'Player';
      document.getElementById('accountMeta').innerHTML = playerIdLine(getPersistentUserId(p)) + '<div style="margin-top:3px;">Level ' + level + ' • XP ' + xp + '</div>';
      document.getElementById('accountXpRank').textContent = xpRank.name;
      document.getElementById('accountXpRankMeta').textContent = xp + ' XP';
      document.getElementById('accountMatchRank').textContent = rank;
      document.getElementById('accountMatchRankMeta').textContent = rp + ' RP';
      document.getElementById('accountXpFill').style.width = getLevelProgress({xp:xp,level:level}).percent + '%';
      const prog = getLevelProgress({xp:xp,level:level});
      document.getElementById('accountXpText').textContent = prog.current + ' / ' + prog.needed + ' XP';
      document.getElementById('accountRp').textContent = rp;
      document.getElementById('accountDaily').textContent = '—';
      document.getElementById('accountMatches').textContent = Number(p.matches || 0);
      document.getElementById('accountHigh').textContent = high;
      const publicTrophy=document.getElementById('accountTrophy'); if(publicTrophy) publicTrophy.textContent=Number(p.tournamentTrophy||0);
      document.getElementById('accountFooter').innerHTML = '';
    }

async function renderPublicProfilePanel(p){const panel=document.getElementById('accountPanel');if(!panel)return;const xp=Number(p.xp||0),level=Number(p.level||getLevelFromXp(xp)),prog=getLevelProgress({xp:xp,level:level}),xpRank=getXpRank(xp),rank=p.rank||'Bronze I',rp=Number(p.rankPoints||0),high=Number(p.highScore??p.score??0);let status=String(p.friendStatus||'');if(!status)status=localFriendStatus(p.username||'',p.playerId||p.userId||'');if(!status&&backendState.token)status=await getRemoteFriendStatus(p.username||'',p.playerId||p.userId||'');let action='';if(!backendState.user)ensureLocalGuestSession();if(String(p.username||'').toLowerCase()===String(backendState.user.username||'').toLowerCase())action='<button class="friend-action-btn" onclick="closeAccount();openAccountTab(\'profile\')">👤 My Profile</button>';else if(status==='accepted')action='<button class="friend-action-btn" disabled style="opacity:.8;cursor:default;">🤝 Friends</button>';else if(status==='pending'||status==='requested')action='<button class="friend-action-btn" disabled style="opacity:.8;cursor:default;">✓ Friend Requested</button>';else if(status==='incoming')action='<button class="friend-action-btn" onclick="openAccountTab(\'profile\');showFriendRequests()">📨 Friend Request</button>';else action='<button id="publicFriendRequestBtn" class="friend-action-btn" onclick="invitePlayer('+JSON.stringify(String(p.username||''))+','+JSON.stringify(String(p.playerId||p.userId||''))+')">📨 Friend Request</button>';panel.innerHTML='<div class="account-panel-title">👤 Player Profile</div><div class="profile-rank-grid"><div class="profile-rank-large xp-rank-large"><div class="profile-rank-kicker">⭐ XP BASED RANK</div><div class="profile-rank-name">'+escapeHtmlClient(xpRank.name)+'</div><div class="profile-rank-value">'+xp+' XP • Level '+level+'</div><div class="challenge-track"><div class="challenge-fill" style="width:'+prog.percent+'%"></div></div><div class="challenge-foot"><span>'+prog.current+' XP</span><span>'+prog.needed+' XP</span></div></div><div class="profile-rank-large match-rank-card"><div class="profile-rank-kicker">⚔️ MATCH RANK</div><div class="profile-rank-name">'+escapeHtmlClient(rank)+'</div><div class="profile-rank-value">'+rp+' RP</div><div class="challenge-track"><div class="challenge-fill" style="width:'+getRankProgress({rank:rank,rankPoints:rp}).percent+'%"></div></div><div class="challenge-foot"><span>Rank Points</span><span>'+rp+' RP</span></div></div></div><div class="account-stats" style="margin-top:12px;grid-template-columns:repeat(2,1fr);"><div class="account-stat"><span>🏆 High Score</span><strong>'+high+'</strong></div><div class="account-stat"><span>⭐ XP</span><strong>'+xp+'</strong></div></div><div class="friend-action-row"><button class="friend-action-btn" onclick="togglePublicFriends()">🤝 Friends</button>'+action+'</div><div id="publicFriendMessage" class="public-profile-note" style="display:none;margin-top:8px;"></div><div id="publicFriendsList" style="display:none;"><div class="public-profile-note">Loading friends…</div></div><div class="public-profile-note">🎯 Daily Challenge is not available on other players\' profiles.</div>';}

    function renderAccountHeader() {
      const emblem = document.getElementById('accountRankEmblem');
      emblem.className = 'rank-emblem';
      const u = backendState.user || getGuestProgress();
      const prog = getLevelProgress(u.xp);
      const xpRank = getXpRank(u.xp);
      document.getElementById('accountRankEmblem').textContent = getSelectedAvatar();
      document.getElementById('accountRankEmblem').className = 'public-avatar';
      document.getElementById('accountName').textContent = u.isGuest ? 'Guest' : (u.username || 'Player');
      document.getElementById('accountMeta').innerHTML = playerIdLine(getPersistentUserId(u)) + '<div style="margin-top:3px;">Level ' + Number(u.level || 1) + ' • XP ' + Number(u.xp || 0) + '</div>';
      document.getElementById('accountXpRank').textContent = xpRank.name;
      document.getElementById('accountXpRankMeta').textContent = Number(u.xp || 0) + ' XP';
      document.getElementById('accountMatchRank').textContent = u.rank || 'Bronze I';
      const rankProg = getRankProgress(u);
      document.getElementById('accountMatchRankMeta').textContent = rankProg.current + ' / ' + rankProg.target + ' RP';
      document.getElementById('accountXpFill').style.width = prog.percent + '%';
      document.getElementById('accountXpText').textContent = prog.current + ' / ' + prog.needed + ' XP';
      document.getElementById('accountRp').textContent = Number(u.rankPoints || 0);
      document.getElementById('accountDaily').textContent = Number(u.dailyRankMatches || 0) + ' / ' + getDailyRankMatchLimit(u.rank || 'Bronze I');
      document.getElementById('accountMatches').textContent = getLocalMatchCount();
      document.getElementById('accountHigh').textContent = Number(u.highScore !== undefined ? u.highScore : getLocalHighScore());
      const trophyEl=document.getElementById('accountTrophy'); if(trophyEl) trophyEl.textContent=Number(u.tournamentTrophy||0);
    }

    async function claimDailyChallenge(index) {
      if (!backendState.token) return openAuth('challenge');
      try {
        const result = await apiRequest({action:'dailyChallengeClaim', token:backendState.token, index:Number(index||0), rewardMultiplier:getRewardMultiplier()});
        if (!result || !result.success) throw new Error((result && result.message) || 'Could not claim Daily Challenge reward.');
        if (result.dailyChallenge) backendState.user.dailyChallenge = result.dailyChallenge;
        if (result.xp !== undefined) backendState.user.xp = Number(result.xp||0);
        updateBackendUI();
        renderProfileQuick();
        openAccountTab('challenge');
        showBackendMessage('🎁 Daily Challenge claimed.', false);
      } catch (e) {
        showBackendMessage(e.message || 'Could not claim Daily Challenge reward.', true);
      }
    }

    const FIXED_TOURNAMENT_SHOP_OFFERS = [
      {id:'xp_20',title:'XP Starter Offer',tag:'STARTER',description:'Pay 100 Trophy and receive 20 XP.',trophyCost:100,rewardType:'XP',rewardAmount:20},
      {id:'xp_100',title:'XP Booster Offer',tag:'BOOST',description:'Pay 500 Trophy and receive 100 XP.',trophyCost:500,rewardType:'XP',rewardAmount:100},
      {id:'rp_50',title:'Rank Point Offer',tag:'RANK',description:'Pay 1,000 Trophy and receive 50 RP.',trophyCost:1000,rewardType:'RP',rewardAmount:50},
      {id:'rp_300',title:'Rank Booster Offer',tag:'BOOST',description:'Pay 5,000 Trophy and receive 300 RP.',trophyCost:5000,rewardType:'RP',rewardAmount:300},
      {id:'rp_750',title:'Elite Rank Offer',tag:'ELITE',description:'Pay 10,000 Trophy and receive 750 RP.',trophyCost:10000,rewardType:'RP',rewardAmount:750}
    ];
