/* OverTake modular build: Backend/session state, i18n and shared stat normalization. */
    /* ================= BACKEND / ACCOUNT SYSTEM ================= */
    const API_URL = "https://script.google.com/macros/s/AKfycbx6jVE6Of6Fh0YVx-HIVf6CLxztS52wt1QWSKDfIcMthRbl1RtFbfAnOoQo327ZEgI/exec";

    const backendState = {
      mode: localStorage.getItem('elem_game_mode') || 'Classic',
      lang: localStorage.getItem('elem_game_lang') || 'bn',
      user: null,
      token: localStorage.getItem('elem_session_token') || '',
      authMode: 'login',
      authAfter: '',
      sessionReady: false
    };


    /* ================= DATA CONSISTENCY / NORMALIZATION ================= */
    function toNaturalNumber(value, fallback) {
      const n = Number(value);
      if (!Number.isFinite(n)) return Math.max(0, Math.floor(Number(fallback || 0)));
      return Math.max(0, Math.floor(n));
    }

    function normalizeUserStats(user) {
      if (!user) return user;
      const u = user;
      u.xp = toNaturalNumber(u.xp, 0);
      u.level = Math.max(1, toNaturalNumber(u.level, 1));
      u.rankPoints = toNaturalNumber(u.rankPoints, 0);
      u.dailyRankMatches = toNaturalNumber(u.dailyRankMatches, 0);
      u.highScore = Math.max(0, Math.floor(Number(highScore) || 0));
      u.classicScore = toNaturalNumber(u.classicScore, 0);
      u.rankScore = toNaturalNumber(u.rankScore, 0);
      u.tournamentTrophy = toNaturalNumber(u.tournamentTrophy, 0);
      u.tournamentMonthlyTrophy = toNaturalNumber(u.tournamentMonthlyTrophy, 0);
      u.tournamentMatches = toNaturalNumber(u.tournamentMatches, 0);
      u.tournamentHighScore = toNaturalNumber(u.tournamentHighScore, 0);
      u.matches = toNaturalNumber(u.matches, 0);
      return u;
    }

    function persistLoggedUserStats(user) {
      const u = normalizeUserStats(user);
      if (!u) return;
      if (u.username !== undefined) localStorage.setItem('elem_username', String(u.username || 'Player'));
      localStorage.setItem('elem_xp', String(u.xp));
      localStorage.setItem('elem_level', String(u.level));
      localStorage.setItem('elem_rank', String(u.rank || 'Bronze I'));
      localStorage.setItem('elem_rank_points', String(u.rankPoints));
      localStorage.setItem('elem_daily_rank_matches', String(u.dailyRankMatches));
      localStorage.setItem('elem_high_score', String(u.highScore));
      localStorage.setItem('elem_classic_score', String(u.classicScore));
      localStorage.setItem('elem_rank_score', String(u.rankScore));
      localStorage.setItem('elem_tournament_trophy', String(u.tournamentTrophy));
      localStorage.setItem('elem_tournament_monthly_trophy', String(u.tournamentMonthlyTrophy));
      localStorage.setItem('elem_tournament_matches', String(u.tournamentMatches));
      localStorage.setItem('elem_tournament_high_score', String(u.tournamentHighScore));
      if (u.userId || u.playerId) localStorage.setItem('elem_player_id', String(u.userId || u.playerId));
      localStorage.setItem('elem_logged_user_cache', JSON.stringify(u));
    }

    function setGuestDisplayName(name) {
      const clean = String(name || '').trim();
      if (!clean) return;
      localStorage.setItem('cfe_guest_display_name', clean);
      localStorage.setItem('elem_username', clean);
    }


    const I18N = {
      en: {
        infoTitle: 'ⓘ Game Info',
        howToPlayTitle: '🎮 How to Play',
        close: 'Close',
        classic: '🎮 Classic',
        rank: '⚔️ Rank',
        guest: '👤 Guest',
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        dailyLimit: 'You have used all 10 Rank Matches for today.',
        loginRank: 'Rank Match is available to Guest and logged-in players.',
        loginSuccess: 'Login successful.',
        registerSuccess: 'Registration successful.',
        invalid: 'Invalid username or password.',
        saved: 'Match result saved.',
        rules: [
          '<b>Classic Match:</b> Play freely as a Guest or while logged in. Your score is recorded after Game Over.',
          '<b>Rank Match:</b> Available to Guest and logged-in players. The weekly daily limit starts at <b>30 matches</b>, decreases by <b>2 per day</b>, and stops at <b>10</b>. At the start of the next week it resets to 30.',
          '<b>Target:</b> Each rank has a score target. Reach the target to gain Rank Points; miss it to lose Rank Points.',
          '<b>Promotion & Rewards:</b> Promotion uses the current rank target of <b>300 RP</b>. After each promotion, earned <b>XP, RP and Tournament Trophy rewards increase by 20%</b> (multiplicatively). Logged-in players receive <b>+200% reward</b> on top of that.',
          '<b>Weekly Demotion:</b> Every week, your rank is automatically demoted by 5 ranks.',
          '<b>XP / Level:</b> Classic gives XP and Rank Match gives more XP. The first level-up requires 500 XP; each next level requires 50% more XP than the previous level-up requirement.',
          '<b>Daily Challenge:</b> A new challenge appears every day. Complete it to receive bonus XP.',
          '<b>Tournament:</b> Play unlimited Tournament matches. Earn separate Tournament Trophy and compete on the monthly Tournament leaderboard.',
          '<b>Tournament Shop:</b> Trophy is a separate currency. Shop offers can exchange fixed Trophy costs for fixed XP or RP rewards.'
        ],
        howToPlay: [
          '<b>Move:</b> Use the mouse/touch to move the catcher. Keyboard arrow keys can also be used.',
          '<b>Switch Element:</b> Press <b>Space</b> or click/tap while playing to switch between ❄️ Ice and 🔥 Fire mode.',
          '<b>Catch:</b> Match the catcher mode with the falling element to score. Catching the wrong element costs a Life.',
          '<b>Lives:</b> You start with 5 Lives. When a Life is lost, the next Life can renew after 30 seconds; Lives cannot exceed 5.',
          '<b>Fever:</b> Successful catches build the Fever Gauge. Fill it to activate Fever mode for bonus gameplay effects.',
          '<b>Pause:</b> Press <b>P</b>, <b>Esc</b>, or the Pause button to pause/resume a match.',
          '<b>Match Flow:</b> Press <b>Play Match</b>, choose Classic or Rank, then start the match. Space from the menu only opens the match selector.',
          '<b>Progress:</b> Game Over saves the match result. XP, Level, Rank Points and challenge progress are updated from the match result.'
        ]
      },
      bn: {
        infoTitle: 'ⓘ গেম তথ্য',
        howToPlayTitle: '🎮 কীভাবে খেলবেন',
        close: 'বন্ধ করুন',
        classic: '🎮 Classic',
        rank: '⚔️ Rank',
        guest: '👤 Guest',
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        dailyLimit: 'আজকের ১০টি Rank Match শেষ হয়ে গেছে।',
        loginRank: 'Rank Match খেলতে Login/Register করতে হবে।',
        loginSuccess: 'Login সফল হয়েছে।',
        registerSuccess: 'Registration সফল হয়েছে।',
        invalid: 'Username অথবা password ভুল।',
        saved: 'Match result সংরক্ষণ হয়েছে।',
        rules: [
          '<b>Classic Match:</b> Guest হিসেবেও খেলা যাবে এবং Login করাও বাধ্যতামূলক নয়। Game Over-এর পর score সংরক্ষণ হবে।',
          '<b>Rank Match:</b> Guest ও logged-in player—দুজনেই খেলতে পারে। সপ্তাহের শুরুতে daily limit <b>30</b>; প্রতিদিন <b>2 করে কমে</b> এবং <b>10</b>-এ আটকে যায়। পরের সপ্তাহে আবার 30 থেকে শুরু হয়।',
          '<b>Target:</b> প্রতিটি rank-এর নির্দিষ্ট score target আছে। Target পূরণ করলে Rank Point বাড়বে, না হলে কমবে।',
          '<b>Promotion & Reward:</b> Promotion target <b>300 RP</b>। Promotion হলে পরবর্তী ম্যাচগুলোতে earned <b>XP, RP ও Tournament Trophy 20% করে বৃদ্ধি পায়</b> (compound)। Logged-in player-এর reward-এ অতিরিক্ত <b>+200%</b> bonus থাকে।',
          '<b>Weekly Demotion:</b> প্রতি সপ্তাহে rank auto 5 ধাপ demote হবে।',
          '<b>XP / Level:</b> Classic ও Rank Match থেকে XP পাওয়া যাবে। প্রথম Level-up-এর জন্য 500 XP লাগে; এরপর প্রতিটি Level-up-এর প্রয়োজনীয় XP আগেরটির চেয়ে 50% করে বাড়ে।',
          '<b>Daily Challenge:</b> প্রতিদিন ১০টি Daily Challenge থাকে; একটির পর একটি unlock হয় এবং prize ধাপে ধাপে বাড়ে।'
        ],
        howToPlay: [
          '<b>Move:</b> Mouse/touch দিয়ে catcher সরাও। Keyboard-এর arrow key-ও ব্যবহার করা যায়।',
          '<b>Element Switch:</b> খেলতে থাকা অবস্থায় <b>Space</b> বা click/tap করে ❄️ Ice এবং 🔥 Fire mode বদলাও।',
          '<b>Catch:</b> Falling element-এর সঙ্গে একই mode মিলিয়ে catch করলে score হবে। ভুল element catch করলে ১টি Life কমবে।',
          '<b>Lives:</b> শুরুতে ৫টি Life থাকে। Life হারালে ৩০ সেকেন্ড পর +১ Life renew হয়; সর্বোচ্চ ৫টি Life রাখা যায়।',
          '<b>Fever:</b> সফল catch করলে Fever Gauge বাড়ে। Gauge পূর্ণ হলে Fever mode activate হয়।',
          '<b>Pause:</b> <b>P</b>, <b>Esc</b>, অথবা Pause button দিয়ে match pause/resume করো।',
          '<b>Match Flow:</b> <b>Play Match</b> চাপো, তারপর Classic বা Rank বেছে match শুরু করো। Menu থেকে Space চাপলে সরাসরি game শুরু হবে না; match selector খুলবে।',
          '<b>Progress:</b> Game Over-এর পর match result save হয় এবং XP, Level, Rank Point ও challenge progress update হয়।'
        ]
      }
    };

    function t(key) {
      return I18N[backendState.lang][key] || I18N.en[key] || key;
    }

    function toggleLanguage() {
      backendState.lang = backendState.lang === 'bn' ? 'en' : 'bn';
      localStorage.setItem('elem_game_lang', backendState.lang);
      updateBackendUI();
      updateInfoContent();
    }

    function openMatchSelector() {
      const el=document.getElementById('matchSelector');
      if(el) el.style.display='flex';
    }
    function closeMatchSelector() {
      const el=document.getElementById('matchSelector');
      if(el) el.style.display='none';
    }
    function selectMatchMode(mode) {
      closeMatchSelector();
      setGameMode(mode);
      setTimeout(function(){ startGame(); }, 60);
    }

    function setGameMode(mode) {
      const rankUser = backendState.user || getGuestProgress();
      const rankMatches = Number(backendState.dailyRankMatches || rankUser.dailyRankMatches || 0);
      const rankLimit = getDailyRankMatchLimit(rankUser.rank || 'Bronze I');
      if (mode === 'Rank' && rankMatches >= rankLimit) {
        showBackendMessage((backendState.lang === 'bn' ? 'আজকের ' + rankLimit + 'টি Rank Match শেষ হয়ে গেছে।' : 'You have used all ' + rankLimit + ' Rank Matches for today.'), true);
        return;
      }
      backendState.mode = mode;
      localStorage.setItem('elem_game_mode', mode);
      updateBackendUI();
    }

    function updateBackendUI() {
      document.getElementById('classicModeBtn').classList.toggle('active', backendState.mode === 'Classic');
      document.getElementById('classicModeBtn').textContent = backendState.mode === 'Tournament' ? '🏆 Tournament Match' : (backendState.mode === 'Rank' ? '⚔️ Rank Match' : '🎮 Play Match');

      const accountBtn = document.getElementById('accountBtn');
      if (backendState.user) {
        accountBtn.textContent = '👤 ' + backendState.user.username;
      } else {
        accountBtn.textContent = '👤 Guest';
      }

      document.getElementById('langBtn').textContent = backendState.lang === 'bn' ? 'English' : 'বাংলা';

      const strip = document.getElementById('profileStrip');
      if (backendState.user) {
        const u = backendState.user;
        strip.style.display = 'block';
        strip.innerHTML =
          '<b>' + escapeHtmlClient(u.username) + '</b> · ' +
          'Lv.' + (u.level || 1) + ' · ' +
          escapeHtmlClient(u.rank || 'Bronze I') + ' · ' +
          'RP ' + (u.rankPoints || 0) + '/' + getRankPromotionTarget(u.rank || 'Bronze I') + ' · ' +
          'Rank today ' + (u.dailyRankMatches || 0) + '/' + getDailyRankMatchLimit(u.rank || 'Bronze I');
      } else {
        const g = getGuestProgress();
        strip.style.display = 'block';
        strip.innerHTML = '<b>Guest</b> · Lv.' + g.level + ' · ' + escapeHtmlClient(g.rank) + ' · RP ' + g.rankPoints + '/' + getRankPromotionTarget(g.rank || 'Bronze I') + ' · Rank today ' + g.dailyRankMatches + '/' + getDailyRankMatchLimit(g.rank || 'Bronze I');
      }
      renderAccountFooter();
    }

    function updateInfoContent() {
      const langData = I18N[backendState.lang];
      document.getElementById('infoTitle').textContent =
        infoModalView === 'howToPlay' ? langData.howToPlayTitle : langData.infoTitle;
      const items = infoModalView === 'howToPlay' ? langData.howToPlay : langData.rules;
      document.getElementById('infoContent').innerHTML = items.map(function(item) {
        return '<div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">' + item + '</div>';
      }).join('');
      const closeBtn = document.querySelector('#howToPlayModal [data-i18n="close"]');
      if (closeBtn) closeBtn.textContent = t('close');
    }



    function fixedBackButton(){
      try {
        if (state.gameState === 'PLAYING' || state.gameState === 'PAUSED') { quitToMenu(); return; }
        closePauseModal();
        if (typeof closeAccount === 'function') closeAccount();
        if (typeof closeSettings === 'function') closeSettings();
        if (typeof closeAuth === 'function') closeAuth();
        if (typeof toggleHowToPlayModal === 'function') toggleHowToPlayModal(false);
        if (typeof closeMatchSelector === 'function') closeMatchSelector();
        goHome();
      } catch(e) { console.warn('Back button:',e); }
    }

    function goHome() {
      if (typeof closeAccount === 'function') closeAccount();
      if (typeof closeSettings === 'function') closeSettings();
      if (typeof closeAuth === 'function') closeAuth();
      if (typeof toggleHowToPlayModal === 'function') toggleHowToPlayModal(false);
      window.scrollTo({top:0, behavior:'smooth'});
      const game = document.getElementById('gameCanvas');
      if (game) game.scrollIntoView({behavior:'smooth', block:'center'});
    }

    function openSettings() {
      const modal = document.getElementById('settingsModal');
      if (!modal) return;
      modal.style.display = 'flex';
      syncSettingsUI();
    }

    function closeSettings() {
      const modal = document.getElementById('settingsModal');
      if (modal) modal.style.display = 'none';
    }

    function toggleSound(enabled) {
      localStorage.setItem('cfe_sound_enabled', enabled ? '1' : '0');
      if (typeof sound !== 'undefined') sound.enabled = enabled;
    }

    function syncSettingsUI() {
      const enabled = localStorage.getItem('cfe_sound_enabled') !== '0';
      const toggle = document.getElementById('soundToggle');
      if (toggle) toggle.checked = enabled;
      if (typeof sound !== 'undefined') sound.enabled = enabled;
    }

    // Safe settings initialization: sound is already initialized here.
    syncSettingsUI();

    function handleDailyChallengeButton() {
      // Open the account modal directly on the Daily Challenge tab.
      // Reset the account card scroll so the challenge list is immediately visible.
      openAccount('challenge');
      setTimeout(function() {
        const card = document.querySelector('#accountModal .account-card');
        const panel = document.getElementById('accountPanel');
        if (card) card.scrollTop = 0;
        if (panel) panel.scrollTop = 0;
      }, 0);
    }

    function handleAccountButton() {
      if (backendState.user) openAccount('profile');
      else openAuth();
    }

    function rankShortName(rank) {
      const map = {'Bronze I':'BRZ I','Bronze II':'BRZ II','Bronze III':'BRZ III',
        'Silver I':'SIL I','Silver II':'SIL II','Silver III':'SIL III',
        'Gold I':'GLD I','Gold II':'GLD II','Gold III':'GLD III',
        'Platinum I':'PLT I','Platinum II':'PLT II','Platinum III':'PLT III',
        'Diamond I':'DIA I','Diamond II':'DIA II','Diamond III':'DIA III',
        'Master':'MST','Grandmaster':'GM','Legend':'LEG'};
      return map[rank] || String(rank || 'Bronze I').toUpperCase().slice(0,8);
    }

    function getXpRank(xp) {
      const n = Math.max(0, Number(xp || 0));
      if (n >= 5000) return { name:'Legendary', short:'LEG', tier:'5000+ XP' };
      if (n >= 3000) return { name:'Master', short:'MST', tier:'3000+ XP' };
      if (n >= 1800) return { name:'Elite', short:'ELT', tier:'1800+ XP' };
      if (n >= 1000) return { name:'Expert', short:'EXP', tier:'1000+ XP' };
      if (n >= 500) return { name:'Skilled', short:'SKL', tier:'500+ XP' };
      if (n >= 200) return { name:'Apprentice', short:'APR', tier:'200+ XP' };
      return { name:'Novice', short:'NOV', tier:'0+ XP' };
    }

    function getLocalHighScore() {
      return Number(localStorage.getItem('elem_high_score') || 0);
    }

    function getLocalMatchCount() {
      return Number(localStorage.getItem('cfe_match_count') || 0);
    }

    function incrementLocalMatchCount() {
      const next = getLocalMatchCount() + 1;
      localStorage.setItem('cfe_match_count', String(next));
      return next;
    }

    const MATCH_RANKS = ['Bronze I','Bronze II','Bronze III','Silver I','Silver II','Silver III','Gold I','Gold II','Gold III','Platinum I','Platinum II','Platinum III','Diamond I','Diamond II','Diamond III','Master','Grandmaster','Legend'];

    function getRankPromotionTarget(rank) {
      const idx = Math.max(0, MATCH_RANKS.indexOf(rank || 'Bronze I'));
      // Promotion threshold is fixed at 300 RP. Reward multiplier, not the threshold,
      // grows by 20% after each promotion.
      return 300;
    }

    // Rank Match daily limit resets each Monday and decreases by 2 per day,
    // never going below 10: 30 → 28 → 26 → 24 → 22 → 20 → 18.
    function getDailyRankMatchLimit(rank) {
      const now = new Date();
      const day = now.getDay() || 7;
      const dayIndex = Math.max(0, Math.min(6, day - 1));
      return Math.max(10, 30 - dayIndex * 2);
    }

    function getRankProgress(user) {
      const u = user || {};
      const rank = u.rank || 'Bronze I';
      const target = getRankPromotionTarget(rank);
      const current = Math.max(0, Number(u.rankPoints || 0));
      return { rank, current, target, percent: Math.min(100, (current / target) * 100) };
    }

    // Weekly rank demotion: once every 7 days, move the player down 5 rank tiers.
    function applyWeeklyRankDemotion(user, storageKey) {
      const u = user || {};
      const safeKey = String(storageKey || u.username || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
      const key = 'cfe_weekly_rank_demotion_' + safeKey;
      const now = Date.now();
      const last = Number(localStorage.getItem(key) || 0);
      const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      if (!last) {
        localStorage.setItem(key, String(now));
        return { demoted:false, steps:0 };
      }
      if (now - last < WEEK_MS) return { demoted:false, steps:0 };
      const currentIndex = Math.max(0, MATCH_RANKS.indexOf(u.rank || 'Bronze I'));
      const newIndex = Math.max(0, currentIndex - 5);
      const steps = currentIndex - newIndex;
      if (steps > 0) {
        u.rank = MATCH_RANKS[newIndex];
        u.rankPoints = 0;
        u.rankTarget = getRankPromotionTarget(u.rank);
      }
      localStorage.setItem(key, String(now));
      return { demoted:steps > 0, steps:steps };
    }

    function getGuestIdentity() {
      let username = localStorage.getItem('cfe_guest_display_name');
      let playerId = localStorage.getItem('cfe_guest_player_id_local');
      if (!username) {
        const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
        username = 'Player-' + raw.slice(-6);
        localStorage.setItem('cfe_guest_display_name', username);
      }
      if (!playerId) {
        const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
        playerId = 'G-' + raw.slice(-10);
        localStorage.setItem('cfe_guest_player_id_local', playerId);
      }
      return { username: username, playerId: playerId, isGuest: true };
    }

    function buildLocalGuestUser() {
      const identity = getGuestIdentity();
      const progress = getGuestProgress();
      progress.dailyRankLimit = getDailyRankMatchLimit(progress.rank || 'Bronze I');
      return Object.assign({}, progress, identity, {
        userId: identity.playerId,
        dailyRankLimit: getDailyRankMatchLimit(identity.rank || progress.rank || 'Bronze I'),
        avatar: localStorage.getItem('elem_selected_avatar_' + identity.playerId) || localStorage.getItem('elem_selected_avatar_' + identity.username) || ''
      });
    }

    function ensureLocalGuestSession() {
      if (backendState.user && !backendState.user.isGuest) return backendState.user;
      const guest = buildLocalGuestUser();
      backendState.user = guest;
      backendState.token = '';
      backendState.dailyRankMatches = Number(guest.dailyRankMatches || 0);
      ensureGuestDailyLoginReward();
      const refreshed = buildLocalGuestUser();
      backendState.user = refreshed;
      refreshed.dailyRankLimit = getDailyRankMatchLimit(refreshed.rank || 'Bronze I');
      backendState.dailyRankMatches = Number(refreshed.dailyRankMatches || 0);
      return refreshed;
    }

    function getGuestProgress() {
      const todayKey = new Date().toISOString().slice(0,10);
      if (localStorage.getItem('guest_daily_rank_date') !== todayKey) {
        localStorage.setItem('guest_daily_rank_date', todayKey);
        localStorage.setItem('guest_daily_rank_matches', '0');
      }
      const u = {
        username: getGuestIdentity().username,
        xp: Number(localStorage.getItem('guest_xp') || 0),
        level: Number(localStorage.getItem('guest_level') || 1),
        rank: localStorage.getItem('guest_rank') || 'Bronze I',
        rankPoints: Number(localStorage.getItem('guest_rank_points') || 0),
        dailyRankMatches: Number(localStorage.getItem('guest_daily_rank_matches') || 0),
        dailyRankLimit: getDailyRankMatchLimit(localStorage.getItem('guest_rank') || 'Bronze I'),
        rankTarget: getRankPromotionTarget(localStorage.getItem('guest_rank') || 'Bronze I'),
        dailyChallenge: getGuestDailyChallenge(),
        highScore: Number(localStorage.getItem('guest_high_score') || localStorage.getItem('elem_high_score') || 0),
        classicScore: Number(localStorage.getItem('guest_classic_score') || 0),
        rankScore: Number(localStorage.getItem('guest_rank_score') || 0),
        tournamentTrophy: Number(localStorage.getItem('guest_tournament_trophy') || 0),
        tournamentMonthlyTrophy: Number(localStorage.getItem('guest_tournament_monthly_trophy') || 0),
        tournamentMatches: Number(localStorage.getItem('guest_tournament_matches') || 0),
        tournamentHighScore: Number(localStorage.getItem('guest_tournament_high_score') || 0),
        tournamentMonth: localStorage.getItem('guest_tournament_month') || ''
      };
      return normalizeUserStats(u);
    }

    function saveGuestProgress(u) {
      const n = normalizeUserStats(Object.assign({}, u));
      localStorage.setItem('guest_xp', String(n.xp));
      localStorage.setItem('guest_level', String(n.level));
      localStorage.setItem('guest_rank', n.rank || 'Bronze I');
      localStorage.setItem('guest_rank_points', String(n.rankPoints));
      localStorage.setItem('guest_daily_rank_matches', String(n.dailyRankMatches));
      localStorage.setItem('guest_rank_target', String(getRankPromotionTarget(n.rank || 'Bronze I')));
      localStorage.setItem('guest_high_score', String(n.highScore));
      localStorage.setItem('guest_classic_score', String(n.classicScore));
      localStorage.setItem('guest_rank_score', String(n.rankScore));
      localStorage.setItem('guest_tournament_trophy', String(n.tournamentTrophy));
      localStorage.setItem('guest_tournament_monthly_trophy', String(n.tournamentMonthlyTrophy));
      localStorage.setItem('guest_tournament_matches', String(n.tournamentMatches));
      localStorage.setItem('guest_tournament_high_score', String(n.tournamentHighScore));
      localStorage.setItem('guest_tournament_month', String(n.tournamentMonth || ''));
    }

    // Ten varied Daily Challenges are generated every day. Challenge #01 is the
    // daily login reward; the remaining challenges use different gameplay metrics
    // so the player is not forced to grind Classic score only.
    const DAILY_CHALLENGE_LADDER = [
      { type:'login', target:1, xpReward:500, rpReward:50, title:'Daily Login Reward', description:'Login today and receive the Daily Login Reward: 500 XP + 50 RP.' },
      { type:'catches', target:10, xpReward:80, rpReward:0, title:'Catch 10 Elements', description:'Catch 10 matching falling elements.' },
      { type:'combo', target:10, xpReward:110, rpReward:0, title:'Combo Hunter', description:'Reach a 10x combo in a match.' },
      { type:'score', target:800, xpReward:150, rpReward:0, title:'Score Sprint', description:'Earn 800 score across your matches.' },
      { type:'survival', target:30, xpReward:190, rpReward:0, title:'Survivor', description:'Stay alive for 30 seconds in a match.' },
      { type:'fever', target:2, xpReward:230, rpReward:0, title:'Fever Chaser', description:'Activate Fever Mode 2 times.' },
      { type:'catches', target:25, xpReward:280, rpReward:0, title:'Element Collector', description:'Catch 25 matching elements.' },
      { type:'score', target:1600, xpReward:350, rpReward:0, title:'High Score Rush', description:'Earn 1,600 score across your matches.' },
      { type:'combo', target:20, xpReward:450, rpReward:0, title:'Combo Master', description:'Reach a 20x combo in a match.' },
      { type:'score', target:3000, xpReward:600, rpReward:0, title:'Final Challenge', description:'Earn 3,000 score across your matches.' }
    ];

