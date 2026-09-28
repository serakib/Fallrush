/* OverTake modular build: Match result synchronization, offline queue and backend reconciliation. */
    function getPendingMatchQueue(){ try{return JSON.parse(localStorage.getItem('cfe_pending_match_queue')||'[]')}catch(e){return []} }
    function savePendingMatchQueue(q){ localStorage.setItem('cfe_pending_match_queue', JSON.stringify(q.slice(-50))); }
    function queuePendingMatch(payload, localState){
      const q=getPendingMatchQueue();
      if(!q.some(x=>String(x.gameId)===String(payload.gameId))){ q.push({payload:payload, localState:localState, queuedAt:Date.now()}); savePendingMatchQueue(q); }
    }
    async function flushPendingMatchQueue(){
      const q=getPendingMatchQueue(); if(!q.length || !navigator.onLine) return;
      const keep=[];
      let syncedLogged = false;
      for(const item of q){
        try{
          const r=await apiRequest(item.payload);
          if(!r || !r.success) throw new Error((r&&r.message)||'sync failed');
          if(item.payload && item.payload.token) syncedLogged = true;
        } catch(e){
          keep.push(item);
        }
      }
      savePendingMatchQueue(keep);
      if(syncedLogged && backendState.token){
        try {
          const profile = await apiRequest({action:'profile', token:backendState.token});
          if(profile && profile.success){
            const safeTrophy = getSafeTournamentTrophy(profile.tournamentTrophy);
            backendState.user = Object.assign({}, backendState.user || {}, profile, {tournamentTrophy:safeTrophy, isGuest:false});
            localStorage.setItem('elem_xp', String(Number(profile.xp || 0)));
            localStorage.setItem('elem_level', String(Number(profile.level || 1)));
            localStorage.setItem('elem_rank', profile.rank || 'Bronze I');
            localStorage.setItem('elem_rank_points', String(Number(profile.rankPoints || 0)));
            localStorage.setItem('elem_daily_rank_matches', String(Number(profile.dailyRankMatches || 0)));
            localStorage.setItem('elem_high_score', String(Number(profile.highScore || 0)));
            localStorage.setItem('elem_classic_score', String(Number(profile.classicScore || 0)));
            localStorage.setItem('elem_rank_score', String(Number(profile.rankScore || 0)));
            localStorage.setItem('elem_tournament_trophy', String(getSafeTournamentTrophy(profile.tournamentTrophy)));
            localStorage.setItem('elem_tournament_monthly_trophy', String(Number(profile.tournamentMonthlyTrophy || 0)));
            localStorage.setItem('elem_tournament_matches', String(Number(profile.tournamentMatches || 0)));
            localStorage.setItem('elem_tournament_high_score', String(Number(profile.tournamentHighScore || 0)));
            if (profile.userId || profile.playerId) localStorage.setItem('elem_player_id', String(profile.userId || profile.playerId));
            updateBackendUI();
            renderProfileQuick();
          }
        } catch(e) {}
      }
      if (typeof updateOfflineSyncStatus === 'function') updateOfflineSyncStatus();
    }
    function cacheLeaderboard(mode, entries){
      try{ localStorage.setItem('cfe_lb_cache_'+mode, JSON.stringify({savedAt:Date.now(),entries:Array.isArray(entries)?entries:[]})); }catch(e){}
    }
    function readCachedLeaderboard(mode){
      try{ const x=JSON.parse(localStorage.getItem('cfe_lb_cache_'+mode)||'null'); return x&&Array.isArray(x.entries)?x.entries:null; }catch(e){return null}
    }
    window.addEventListener('online', function(){
      window.__leaderboardSyncing = true;
      updateOfflineSyncStatus(true);
      flushPendingMatchQueue();
      if(typeof loadLeaderboardPanel==='function' && window.__activeLeaderboardMode) loadLeaderboardPanel(window.__activeLeaderboardMode,true);
    });
    window.addEventListener('offline', function(){
      window.__leaderboardSyncing = true;
      updateOfflineSyncStatus(true);
    });
    setInterval(function(){
      let pending = false;
      try {
        const q = JSON.parse(localStorage.getItem('cfe_pending_match_queue') || '[]');
        pending = Array.isArray(q) && q.length > 0;
      } catch(e) {}
      window.__leaderboardSyncing = navigator.onLine === false || pending;
      updateOfflineSyncStatus(window.__leaderboardSyncing);
    }, 3000);
    setInterval(flushPendingMatchQueue, 15000);
    window.__leaderboardSyncing = true;
    setTimeout(flushPendingMatchQueue, 2500);
    // Reconnect quietly after the page has loaded; never block the game on backend status.
    setTimeout(function(){
      updateOfflineSyncStatus();
      flushPendingMatchQueue();
      if (navigator.onLine && typeof loadLeaderboardPanel === 'function' && window.__activeLeaderboardMode) {
        loadLeaderboardPanel(window.__activeLeaderboardMode, true);
      }
    }, 3000);

    function applyLocalLoggedMatchFallback(score, mode) {
      const u = Object.assign({}, backendState.user || {});
      const xpDelta = calculateMatchXP(score, mode, state);
      const rpDelta = mode === 'Rank'
        ? Math.round(calculatePerformanceRankPoints(score, state.maxCombo, state.correctCatches, state.wrongCatches, mode) * getRewardMultiplier())
        : 0;
      u.xp = Number(u.xp || 0) + Math.max(0, xpDelta);
      u.level = getLevelFromXp(u.xp);
      u.highScore = Math.max(Number(u.highScore || 0), Number(score || 0));
      if (mode === 'Classic') u.classicScore = Math.max(Number(u.classicScore || 0), Number(score || 0));
      if (mode === 'Rank') {
        const rr = applyLocalRankDelta(u.rank || 'Bronze I', Number(u.rankPoints || 0), rpDelta);
        u.rank = rr.rank;
        u.rankPoints = rr.rankPoints;
        u.rankScore = Math.max(Number(u.rankScore || 0), Number(score || 0));
        u.dailyRankMatches = Number(u.dailyRankMatches || 0) + 1;
      }
      if (mode === 'Tournament') {
        const trophy = Math.round(Math.floor(Math.max(0, Number(score || 0)) * 0.5) * getRewardMultiplier());
        u.tournamentTrophy = Number(u.tournamentTrophy || 0) + trophy;
        u.tournamentMonthlyTrophy = Number(u.tournamentMonthlyTrophy || 0) + trophy;
        u.tournamentMatches = Number(u.tournamentMatches || 0) + 1;
        u.tournamentHighScore = Math.max(Number(u.tournamentHighScore || 0), Number(score || 0));
      }
      u.dailyRankLimit = getDailyRankMatchLimit(u.rank || 'Bronze I');
      backendState.user = Object.assign({}, u, {isGuest:false});
      localStorage.setItem('elem_xp', String(Number(u.xp || 0)));
      localStorage.setItem('elem_level', String(Number(u.level || 1)));
      localStorage.setItem('elem_rank', u.rank || 'Bronze I');
      localStorage.setItem('elem_rank_points', String(Number(u.rankPoints || 0)));
      localStorage.setItem('elem_daily_rank_matches', String(Number(u.dailyRankMatches || 0)));
      incrementLocalMatchCount();
      return {user:u, xpGained:xpDelta, rankPointsDelta:rpDelta};
    }

    async function syncGameResult() {
      window.__leaderboardSyncing = true;
      updateOfflineSyncStatus(true);
      const mode = backendState.mode;
      const score = toNaturalNumber(state.score, 0);
      const previousXp = Number(backendState.user?.xp || 0);
      const previousRp = Number(backendState.user?.rankPoints || 0);

      // Guest matches use the authoritative backend when available; local storage is fallback only.
      if (!backendState.user || !backendState.token) {
        try {
          const guestIdentity = getGuestIdentity();
          const serverResult = await apiRequest({action:'gameEnd',gameId:state.gameId,isGuest:true,playerId:guestIdentity.playerId,username:guestIdentity.playerId,score:score,mode:mode,maxCombo:Number(state.maxCombo||0),catches:Number(state.catches||0),correctCatches:Number(state.correctCatches||0),wrongCatches:Number(state.wrongCatches||0),feverActivations:Number(state.feverActivations||0),survivalSeconds:Math.max(0,Number(state.time||0))});
          if(serverResult && serverResult.success){
            const u=Object.assign({},getGuestProgress(),serverResult,{isGuest:true});
            saveGuestProgress(u); incrementLocalMatchCount();
            state.lastXpGained=Number(serverResult.xpGained||0); state.lastChallengeXP=0; state.lastRankPointsDelta=Number(serverResult.rankPointsDelta||0);
            state.lastRankWon=mode==='Rank' && state.lastRankPointsDelta>0;
            state.lastRankPromoted=!!(serverResult.rankChanged&&serverResult.rankChanged.promoted);
            if(mode==='Tournament'){state.lastTournamentTrophy=Number(serverResult.tournamentTrophyEarned||0);state.tournamentRewardSynced=true;}
            backendState.dailyRankMatches=Number(serverResult.dailyRankMatches||0); updateBackendUI(); updateLiveHud(); renderProfileQuick();
            let rewardText='✨ +'+state.lastXpGained+' XP';
            if(mode==='Rank') rewardText+=' • ⚔️ '+(state.lastRankPointsDelta>=0?'+':'')+state.lastRankPointsDelta+' RP';
            if(mode==='Tournament') rewardText='🏆 +'+Number(serverResult.tournamentTrophyEarned||0)+' Tournament Trophy';
            showBackendMessage(rewardText,false); showXPToast(state.lastXpGained,serverResult.level,0);
            window.__leaderboardSyncing = false;
            updateOfflineSyncStatus(false);
            render(); return;
          }
          throw new Error((serverResult&&serverResult.message)||'Guest backend save failed.');
        } catch(serverError) { console.warn('Guest backend sync unavailable; using local fallback.',serverError); }
        try {
          const guestResult = applyGuestMatchProgress(score, mode, null);
          incrementLocalMatchCount();
          queuePendingMatch({action:'gameEnd',gameId:state.gameId,isGuest:true,playerId:getGuestIdentity().playerId,username:getGuestIdentity().playerId,score:score,mode:mode,maxCombo:Number(state.maxCombo||0),catches:Number(state.catches||0),correctCatches:Number(state.correctCatches||0),wrongCatches:Number(state.wrongCatches||0),feverActivations:Number(state.feverActivations||0),survivalSeconds:Math.max(0,Number(state.time||0))},{xp:guestResult.user.xp,level:guestResult.user.level,rank:guestResult.user.rank,rankPoints:guestResult.user.rankPoints});

          // Keep anonymous/guest gameplay visible to the backend Activity sheet without
          // requiring a login. The guest identity is internal only; the UI does not need
          // to expose the guest name. This is intentionally fire-and-forget so gameplay
          // never waits for the API.
          try {
            const guestIdentity = getGuestIdentity();
            apiRequest({
              action: 'activity',
              username: guestIdentity.playerId,
              activity: 'GUEST_MATCH_END',
              score: score,
              mode: mode,
              playerId: guestIdentity.playerId,
              displayPlayerId: guestIdentity.playerId,
              isGuest: true,
              xp: Number(guestResult.user.xp || 0),
              level: Number(guestResult.user.level || 1),
              rank: guestResult.user.rank || 'Bronze I',
              rankPoints: Number(guestResult.user.rankPoints || 0),
              dailyRankMatches: Number(guestResult.user.dailyRankMatches || 0)
            }).catch(function(activityError) {
              console.warn('Guest activity sync failed:', activityError);
            });
          } catch (activityBuildError) {
            console.warn('Guest activity payload failed:', activityBuildError);
          }
          state.lastXpGained = guestResult.xpGained;
          state.lastChallengeXP = guestResult.challengeXP;
          state.lastRankPointsDelta = guestResult.rankPointsDelta;
          state.lastRankWon = mode === 'Rank' && guestResult.rankPointsDelta > 0;
          state.lastRankPromoted = guestResult.user.rank !== getGuestProgress().rank;
          if (guestResult.trophyEarned) {
            state.lastTournamentTrophy = Number(guestResult.trophyEarned||0);
            backendState.user.tournamentTrophy = Number(guestResult.user.tournamentTrophy||0);
            backendState.user.tournamentMonthlyTrophy = Number(guestResult.user.tournamentMonthlyTrophy||0);
            backendState.user.tournamentMatches = Number(guestResult.user.tournamentMatches||0);
            backendState.user.tournamentHighScore = Number(guestResult.user.tournamentHighScore||0);
            state.tournamentRewardSynced = mode === 'Tournament';
          }
          backendState.dailyRankMatches = guestResult.user.dailyRankMatches;

          updateBackendUI();
          updateLiveHud();
          renderProfileQuick();

          // Show the actual reward from this match immediately.
          let rewardText = '✨ +' + guestResult.xpGained + ' XP';
          if (mode === 'Rank') {
            const rp = Number(guestResult.rankPointsDelta || 0);
            rewardText += ' • ⚔️ ' + (rp >= 0 ? '+' : '') + rp + ' RP';
          }
          if (mode === 'Tournament') rewardText = '🏆 +' + Number(guestResult.trophyEarned||0) + ' Tournament Trophy';
          if (guestResult.challengeXP > 0) rewardText += ' • 🎁 Daily Bonus +' + guestResult.challengeXP + ' XP';
          showBackendMessage(rewardText, false);
          showXPToast(guestResult.xpGained, guestResult.user.level, guestResult.challengeXP);
          // Keep the indicator visible if this match is queued for backend auto-sync.
          const stillPending = getPendingMatchQueue().length > 0;
          window.__leaderboardSyncing = stillPending || navigator.onLine === false;
          updateOfflineSyncStatus(window.__leaderboardSyncing);
          render();
          return;
        } catch (error) {
          console.error('Guest progress error:', error);
          showBackendMessage('Match finished, but local progress could not be saved.', true);
          return;
        }
      }

      try {
        const result = await apiRequest({
          action: 'gameEnd',
          gameId: state.gameId,
          token: backendState.token,
          score: score,
          mode: mode,
          maxCombo: Number(state.maxCombo || 0),
          catches: Number(state.catches || 0),
          correctCatches: Number(state.correctCatches || 0),
          wrongCatches: Number(state.wrongCatches || 0),
          feverActivations: Number(state.feverActivations || 0),
          survivalSeconds: Math.max(0, Number(state.time || 0)),
          rewardMultiplier: getRewardMultiplier()
        });

        if (!result || !result.success) {
          throw new Error((result && result.message) || 'Could not save match.');
        }

        incrementLocalMatchCount();
        let profile = null;
        try {
          const profileResult = await apiRequest({ action: 'profile', token: backendState.token });
          if (profileResult && profileResult.success) profile = profileResult;
        } catch (e) {
          console.warn('Profile refresh after gameEnd failed:', e);
        }

        // gameEnd is the authoritative post-match write. The profile request is only a
        // refresh/compatibility check; it must never overwrite the just-saved reward with
        // an older cached/stale profile response.
        const source = result;
        const refreshed = profile || {};
        backendState.user = normalizeUserStats(Object.assign({}, backendState.user, result, {isGuest:false}));
        if (source.xp !== undefined) backendState.user.xp = Number(source.xp) || 0;
        if (source.level !== undefined) backendState.user.level = Number(source.level) || 1;
        if (source.rank) backendState.user.rank = source.rank;
        if (source.rankPoints !== undefined) backendState.user.rankPoints = Number(source.rankPoints) || 0;
        if (source.highScore !== undefined) backendState.user.highScore = Number(source.highScore)||0;
        if (source.classicScore !== undefined) backendState.user.classicScore = Number(source.classicScore)||0;
        if (source.rankScore !== undefined) backendState.user.rankScore = Number(source.rankScore)||0;
        if (source.tournamentTrophy !== undefined) backendState.user.tournamentTrophy = getSafeTournamentTrophy(source.tournamentTrophy, backendState.user.tournamentTrophy);
        if (source.tournamentMonthlyTrophy !== undefined) backendState.user.tournamentMonthlyTrophy = Number(source.tournamentMonthlyTrophy)||0;
        if (source.tournamentMatches !== undefined) backendState.user.tournamentMatches = Number(source.tournamentMatches)||0;
        if (source.tournamentHighScore !== undefined) backendState.user.tournamentHighScore = Number(source.tournamentHighScore)||0;
        // Only use profile for fields gameEnd does not return. Never replace XP/RP with it.
        if (backendState.user.avatar === undefined && refreshed.avatar !== undefined) backendState.user.avatar = refreshed.avatar;
        if (backendState.user.username === undefined && refreshed.username !== undefined) backendState.user.username = refreshed.username;
        backendState.user.rankTarget = getRankPromotionTarget(backendState.user.rank || 'Bronze I');
        if (source.dailyRankMatches !== undefined) backendState.user.dailyRankMatches = Number(source.dailyRankMatches) || 0;
        backendState.user.dailyRankLimit = getDailyRankMatchLimit(backendState.user.rank || 'Bronze I');
         persistLoggedUserStats(backendState.user);
        backendState.dailyRankMatches = Number(backendState.user.dailyRankMatches || 0);

        const backendXpDelta = Number(result.xpGained || 0);
        const localXpDelta = calculateMatchXP(score, mode, state);
        const xpDelta = backendXpDelta > 0 ? backendXpDelta : localXpDelta;
        const backendRpDelta = Number(result.rankPointsDelta || 0);
        const localRpDelta = mode === 'Rank'
          ? Math.round(calculatePerformanceRankPoints(score, state.maxCombo, state.correctCatches, state.wrongCatches, mode) * getRewardMultiplier())
          : 0;
        const rpDelta = mode === 'Rank' ? (backendRpDelta !== 0 ? backendRpDelta : localRpDelta) : 0;

        state.lastXpGained = xpDelta;
        state.lastChallengeXP = Number(result.challengeXP || 0);
        state.lastRankWon = mode === 'Rank' && (result.won === true || rpDelta > 0);
        state.lastRankPromoted = !!result.promoted;
        state.lastRankDemoted = !!result.demoted;
        state.lastRankPointsDelta = rpDelta;
        state.lastTournamentTrophy = mode === 'Tournament' ? toNaturalNumber(result.tournamentTrophyEarned, Math.floor(Math.max(0, Number(score || 0)) * 0.5)) : 0;
        state.tournamentRewardPending = false;
        state.tournamentRewardSynced = mode === 'Tournament';

        if (result.dailyChallenge) backendState.user.dailyChallenge = result.dailyChallenge;

        updateBackendUI();
        updateLiveHud();
        renderProfileQuick();
        if (document.getElementById('accountModal')?.style.display === 'flex') renderAccountHeader();

        let rewardText = '✨ +' + xpDelta + ' XP';
        if (mode === 'Rank') rewardText += ' • ⚔️ ' + (rpDelta >= 0 ? '+' : '') + rpDelta + ' RP';
        if (result.challengeXP) rewardText += ' • 🎁 Daily Bonus +' + Number(result.challengeXP) + ' XP';
        showBackendMessage(rewardText, false);
        if (xpDelta > 0) showXPToast(xpDelta, backendState.user.level, result.challengeXP || 0);
        if (mode === 'Tournament') showBackendMessage('🏆 +' + Number(result.tournamentTrophyEarned || 0) + ' Tournament Trophy earned.', false);
        window.__leaderboardSyncing = false;
        updateOfflineSyncStatus(false);
        render();

      } catch (error) {
        console.warn('Game sync deferred; keeping local progress and queueing for auto-sync.', error);
        try {
          const local = applyLocalLoggedMatchFallback(score, mode);
          queuePendingMatch({
            action: 'gameEnd',
            gameId: state.gameId,
            token: backendState.token,
            score: score,
            mode: mode,
            maxCombo: Number(state.maxCombo || 0),
            catches: Number(state.catches || 0),
            correctCatches: Number(state.correctCatches || 0),
            wrongCatches: Number(state.wrongCatches || 0),
            feverActivations: Number(state.feverActivations || 0),
            survivalSeconds: Math.max(0, Number(state.time || 0)),
            rewardMultiplier: getRewardMultiplier()
          }, {xp:local.user.xp, level:local.user.level, rank:local.user.rank, rankPoints:local.user.rankPoints});
          updateBackendUI();
          updateLiveHud();
          renderProfileQuick();
          state.lastXpGained = Number(local.xpGained || 0);
          state.lastRankPointsDelta = mode === 'Rank' ? Number(local.rankPointsDelta || 0) : 0;
          state.lastRankWon = mode === 'Rank' && state.lastRankPointsDelta > 0;
          showBackendMessage('Offline • Auto Syncing', false);
          render();
        } catch (fallbackError) {
          console.error('Local sync fallback failed:', fallbackError);
          showBackendMessage('Offline • Auto Syncing', false);
        }
      }
    }

    function showXPToast(xp, level, challengeXP) {
      const el=document.getElementById('xpToast'); if(!el) return;
      el.textContent='✨ +' + Number(xp||0) + ' XP' + (challengeXP ? ' • 🎁 Daily Challenge +' + Number(challengeXP) + ' XP' : '') + (level ? ' • Level ' + Number(level) : '');
      el.classList.add('show'); clearTimeout(window.__xpToastTimer);
      window.__xpToastTimer=setTimeout(()=>el.classList.remove('show'),3500);
    }

    function showBackendMessage(message, error) {
      const el = document.getElementById('profileStrip');
      el.style.display = 'block';
      el.textContent = message;
      el.style.borderColor = error ? 'rgba(244,63,94,.45)' : 'rgba(34,211,238,.35)';
      clearTimeout(window.__backendMsgTimer);
      window.__backendMsgTimer = setTimeout(updateBackendUI, 3500);
    }

