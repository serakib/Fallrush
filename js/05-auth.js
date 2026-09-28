/* OverTake modular build: Login/register modal and authentication actions. */
    function openAuth(after) {
      backendState.authAfter = after || '';
      document.getElementById('authModal').style.display = 'flex';
      document.getElementById('authMessage').textContent = '';
      updateAuthUI();
    }

    function closeAuth() {
      document.getElementById('authModal').style.display = 'none';
      backendState.authAfter = '';
    }

    function switchAuthMode() {
      backendState.authMode = backendState.authMode === 'login' ? 'register' : 'login';
      updateAuthUI();
    }

    function updateAuthUI() {
      const register = backendState.authMode === 'register';
      document.getElementById('authTitle').textContent = register ? t('register') : t('login');
      document.getElementById('authSubtitle').textContent = register
        ? 'Create your player account.'
        : 'Sign in to save progression and play Rank Match.';
      document.getElementById('authSubmit').textContent = register ? t('register') : t('login');
      document.getElementById('authSwitch').textContent = register ? t('login') : t('register');
      const bonusNote = document.getElementById('authBonusNote');
      if (bonusNote) bonusNote.style.display = register ? 'none' : 'block';
    }

    async function continueAsGuest() {
      // Guest is a full local player session. No registration step is required.
      // The backend can later map this same identity/session to a server account.
      const guest = ensureLocalGuestSession();
      localStorage.setItem('elem_auth_type', 'guest');
      localStorage.setItem('elem_username', guest.username);
      localStorage.setItem('elem_xp', String(Number(guest.xp || 0)));
      localStorage.setItem('elem_level', String(Number(guest.level || 1)));
      localStorage.setItem('elem_rank', guest.rank || 'Bronze I');
      localStorage.setItem('elem_rank_points', String(Number(guest.rankPoints || 0)));
      localStorage.setItem('elem_daily_rank_matches', String(Number(guest.dailyRankMatches || 0)));
      closeAuth();
      updateBackendUI();
      renderProfileQuick();
      if (backendState.authAfter === 'challenge') setTimeout(function(){ openAccountTab('challenge'); }, 0);
    }

    async function logoutUser() {
      const token = backendState.token || '';
      try { if (token) await apiRequest({action:'logout', token:token}); } catch (e) {}
      backendState.token = '';
      localStorage.removeItem('elem_session_token');
      localStorage.setItem('elem_auth_type','guest');
      ensureLocalGuestSession();
      closeAccount();
      updateBackendUI();
      renderAccountFooter();
      showBackendMessage('Logged out.', false);
    }

    function getRewardMultiplier() {
      // Must match backend progression exactly: logged-in matches receive 2x,
      // guests receive 1x. No client-only rank multiplier is applied.
      return (backendState.user && !backendState.user.isGuest) ? 2 : 1;
    }

    async function claimDailyLoginReward() {
      if (!backendState.token || !backendState.user || backendState.user.isGuest) return null;
      const key = new Date().toISOString().slice(0,10);
      const rewardKey = 'logged_daily_login_reward_date_' + String(backendState.user.username || 'player').toLowerCase().replace(/[^a-z0-9_-]/g,'_');
      if (localStorage.getItem(rewardKey) === key) return null;
      try {
        const result = await apiRequest({ action:'dailyLoginReward', token:backendState.token, rewardMultiplier:getRewardMultiplier() });
        if (result && result.success) {
          localStorage.setItem(rewardKey, key);
          if (result.xp !== undefined) backendState.user.xp = Number(result.xp || 0);
          if (result.level !== undefined) backendState.user.level = Number(result.level || 1);
          if (result.rankPoints !== undefined) backendState.user.rankPoints = Number(result.rankPoints || 0);
          localStorage.setItem('elem_xp', String(Number(backendState.user.xp || 0)));
          localStorage.setItem('elem_level', String(Number(backendState.user.level || 1)));
          localStorage.setItem('elem_rank_points', String(Number(backendState.user.rankPoints || 0)));
          return result;
        }
      } catch(e) { console.warn('Daily login reward failed:', e); }
      return null;
    }

    function submitAuth() {
      const username = document.getElementById('authUsername').value.trim();
      const password = document.getElementById('authPassword').value;
      const message = document.getElementById('authMessage');

      if (!username || !password) {
        message.className = 'text-sm min-h-5 text-rose-400';
        message.textContent = 'Username and password are required.';
        return;
      }
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        message.className = 'text-sm min-h-5 text-rose-400';
        message.textContent = 'Username must be 3–20 characters: letters, numbers, or underscore only.';
        return;
      }

      message.className = 'text-sm min-h-5 text-cyan-300';
      message.textContent = 'Connecting...';

      apiRequest({
        action: backendState.authMode,
        username: username,
        password: password
      }).then(async function(result) {
        if (!result.success) {
          message.className = 'text-sm min-h-5 text-rose-400';
          message.textContent = result.message || t('invalid');
          return;
        }

        backendState.token = result.token || '';
        localStorage.setItem('elem_session_token', backendState.token);

        // Login/Register can return only identity/token. Fetch the authoritative profile
        // immediately so XP, RP, Level and Daily Match count are shown in the profile.
        let profile = result;
        try {
          if (backendState.token) {
            const profileResult = await apiRequest({ action: 'profile', token: backendState.token });
            if (profileResult && profileResult.success) profile = Object.assign({}, result, profileResult);
          }
        } catch (profileError) {
          console.warn('Profile refresh after login failed:', profileError);
        }

        backendState.user = normalizeUserStats(Object.assign({}, profile, {isGuest:false}));
        localStorage.setItem('elem_auth_type', 'logged');
        await claimDailyLoginReward();
         persistLoggedUserStats(backendState.user);
        backendState.dailyRankMatches = Number(backendState.user.dailyRankMatches || 0);
        backendState.mode = backendState.authAfter === 'rank' ? 'Rank' : backendState.mode;
        localStorage.setItem('elem_game_mode', backendState.mode);

        const authDestination = backendState.authAfter;
        closeAuth();
        updateBackendUI();
        renderProfileQuick();
        renderAccountHeader();

        if (authDestination === 'rank') {
          openMatchSelector();
        } else if (authDestination === 'challenge') {
          // Let the authenticated state settle before loading the challenge from the API.
          setTimeout(function() { openAccountTab('challenge'); }, 0);
        } else {
          // Normal login: open the refreshed profile immediately.
          setTimeout(function() { openAccount('profile'); }, 0);
        }
      }).catch(function(error) {
        message.className = 'text-sm min-h-5 text-rose-400';
        message.textContent = 'Backend connection failed.';
        console.error(error);
      });
    }

    function apiRequest(payload) {
      // GitHub Pages serves the game from HTTPS while the backend is a Google Apps Script
      // endpoint. Keep requests simple (text/plain avoids a CORS preflight), add a timeout,
      // and parse the response defensively so a temporary/non-JSON backend response never
      // breaks the game UI.
      if (!API_URL) return Promise.reject(new Error('Backend URL is not configured.'));
      var controller = window.AbortController ? new AbortController() : null;
      var timer = controller ? setTimeout(function(){ try { controller.abort(); } catch(e) {} }, 15000) : null;
      return fetch(API_URL, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'application/json,text/plain,*/*'
        },
        body: JSON.stringify(payload || {}),
        signal: controller ? controller.signal : undefined
      }).then(function(response) {
        return response.text().then(function(text) {
          if (!response.ok) throw new Error('Backend HTTP ' + response.status + '.');
          var clean = String(text || '').trim();
          if (!clean) throw new Error('Backend returned an empty response.');
          try { return JSON.parse(clean); }
          catch (parseError) { throw new Error('Backend returned an invalid response.'); }
        });
      }).catch(function(error) {
        if (error && error.name === 'AbortError') throw new Error('Backend request timed out.');
        throw error;
      }).finally(function(){ if (timer) clearTimeout(timer); });
    }

    function applyLocalRankDelta(rank,rp,delta){ let idx=MATCH_RANKS.indexOf(rank); if(idx<0)idx=0; let p=Math.max(0,Number(rp||0)+Number(delta||0)); while(idx<MATCH_RANKS.length-1&&p>=getRankPromotionTarget(MATCH_RANKS[idx])){p-=getRankPromotionTarget(MATCH_RANKS[idx]);idx++;} while(idx>0&&p<0){idx--;p=Math.max(0,getRankPromotionTarget(MATCH_RANKS[idx])+p);} return {rank:MATCH_RANKS[idx],rankPoints:p}; }

