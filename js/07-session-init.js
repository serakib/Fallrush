/* OverTake modular build: Session hydration, restore and boot. */
    function escapeHtmlClient(text) {
      return String(text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function hydrateCachedSession() {
      const token = localStorage.getItem('elem_session_token') || '';
      const authType = localStorage.getItem('elem_auth_type') || (token ? 'logged' : 'guest');
      backendState.token = token;
      if (token && authType === 'logged') {
        const cachedName = localStorage.getItem('elem_username');
        if (cachedName) {
          backendState.user = {
            username: cachedName,
            xp: Number(localStorage.getItem('elem_xp') || 0),
            level: Number(localStorage.getItem('elem_level') || 1),
            rank: localStorage.getItem('elem_rank') || 'Bronze I',
            rankPoints: Number(localStorage.getItem('elem_rank_points') || 0),
            dailyRankMatches: Number(localStorage.getItem('elem_daily_rank_matches') || 0),
            dailyRankLimit: getDailyRankMatchLimit(localStorage.getItem('elem_rank') || 'Bronze I'),
            highScore: Number(localStorage.getItem('elem_high_score') || 0),
            classicScore: Number(localStorage.getItem('elem_classic_score') || 0),
            rankScore: Number(localStorage.getItem('elem_rank_score') || 0),
            tournamentTrophy: Number(localStorage.getItem('elem_tournament_trophy') || 0),
            tournamentMonthlyTrophy: Number(localStorage.getItem('elem_tournament_monthly_trophy') || 0),
            tournamentMatches: Number(localStorage.getItem('elem_tournament_matches') || 0),
            tournamentHighScore: Number(localStorage.getItem('elem_tournament_high_score') || 0),
            isGuest: false
          };
          backendState.dailyRankMatches = Number(backendState.user.dailyRankMatches || 0);
          return backendState.user;
        }
      }
      if (!token) return ensureLocalGuestSession();
      return backendState.user;
    }

    async function restoreSession() {
      const savedUsername = localStorage.getItem('elem_username');
      const authType = localStorage.getItem('elem_auth_type') || (backendState.token ? 'logged' : 'guest');
      if (backendState.token && authType === 'logged') {
        try {
          const result = await apiRequest({ action: 'profile', token: backendState.token });
          if (result && result.success) {
            const safeTrophy = getSafeTournamentTrophy(result.tournamentTrophy, backendState.user?.tournamentTrophy || localStorage.getItem('elem_tournament_trophy'));
            backendState.user = Object.assign({}, result, {tournamentTrophy:safeTrophy, isGuest:false});
            backendState.dailyRankMatches = Number(result.dailyRankMatches || 0);
            backendState.user.dailyRankLimit = getDailyRankMatchLimit(backendState.user.rank || 'Bronze I');
            localStorage.setItem('elem_username', result.username || savedUsername || 'Player');
            localStorage.setItem('elem_xp', String(Number(result.xp || 0)));
            localStorage.setItem('elem_level', String(Number(result.level || 1)));
            localStorage.setItem('elem_rank', result.rank || 'Bronze I');
            localStorage.setItem('elem_rank_points', String(Number(result.rankPoints || 0)));
            localStorage.setItem('elem_daily_rank_matches', String(Number(result.dailyRankMatches || 0)));
            localStorage.setItem('elem_high_score', String(Number(result.highScore || 0)));
            localStorage.setItem('elem_classic_score', String(Number(result.classicScore || 0)));
            localStorage.setItem('elem_rank_score', String(Number(result.rankScore || 0)));
            localStorage.setItem('elem_tournament_trophy', String(getSafeTournamentTrophy(result.tournamentTrophy, backendState.user?.tournamentTrophy || localStorage.getItem('elem_tournament_trophy'))));
            localStorage.setItem('elem_tournament_monthly_trophy', String(Number(result.tournamentMonthlyTrophy || 0)));
            localStorage.setItem('elem_tournament_matches', String(Number(result.tournamentMatches || 0)));
            localStorage.setItem('elem_tournament_high_score', String(Number(result.tournamentHighScore || 0)));
            await claimDailyLoginReward();
          } else {
            // Never silently turn a still-authenticated cached player into Guest.
            backendState.user = {
              username: savedUsername || 'Player',
              xp: Number(localStorage.getItem('elem_xp') || 0),
              level: Number(localStorage.getItem('elem_level') || 1),
              rank: localStorage.getItem('elem_rank') || 'Bronze I',
              rankPoints: Number(localStorage.getItem('elem_rank_points') || 0),
              dailyRankMatches: Number(localStorage.getItem('elem_daily_rank_matches') || 0),
              dailyRankLimit: getDailyRankMatchLimit(localStorage.getItem('elem_rank') || 'Bronze I'),
              isGuest:false
            };
          }
        } catch (error) {
          // Preserve the cached logged identity during temporary API/network failures.
          backendState.user = {
            username: savedUsername || 'Player',
            xp: Number(localStorage.getItem('elem_xp') || 0),
            level: Number(localStorage.getItem('elem_level') || 1),
            rank: localStorage.getItem('elem_rank') || 'Bronze I',
            rankPoints: Number(localStorage.getItem('elem_rank_points') || 0),
            dailyRankMatches: Number(localStorage.getItem('elem_daily_rank_matches') || 0),
            dailyRankLimit: getDailyRankMatchLimit(localStorage.getItem('elem_rank') || 'Bronze I'),
            isGuest:false
          };
        }
      } else {
        backendState.token = '';
        localStorage.removeItem('elem_session_token');
        localStorage.setItem('elem_auth_type','guest');
        ensureLocalGuestSession();
      }
      backendState.sessionReady = true;
      updateBackendUI();
      renderProfileQuick();
      updateInfoContent();
    }

    hydrateCachedSession();
    restoreSession();

    function bootGame() {
      if (!backendState.token && !backendState.user) ensureLocalGuestSession();
      resizeCanvas();
      updateBackendUI();
      renderProfileQuick();
      updateInfoContent();
      requestAnimationFrame(gameLoop);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootGame, { once: true });
    } else {
      bootGame();
    }
