/* OverTake modular build: Account UI, tournament/shop, leaderboard and profile tabs. */
    function renderFixedTournamentShop(containerId, trophy, canUseShop){
      const list=document.getElementById(containerId); if(!list)return;
      const safeTrophy=Math.max(0,Number(trophy||0));
      list.innerHTML='<div class="shop-balance" style="margin-bottom:14px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,rgba(131,24,80,.22),rgba(49,46,129,.22));border:1px solid rgba(244,114,182,.22);color:#cbd5e1;"><span>Available Trophy</span><b style="color:#f9a8d4;font-size:20px;float:right;">🏆 '+safeTrophy+'</b></div><div class="shop-offers-grid">'+FIXED_TOURNAMENT_SHOP_OFFERS.map(function(o){const can=safeTrophy>=o.trophyCost;return '<div class="shop-offer"><div class="shop-offer-top"><div class="shop-offer-title">'+escapeHtmlClient(o.title)+'</div><span class="shop-offer-tag">'+escapeHtmlClient(o.tag)+'</span></div><div class="shop-offer-desc">'+escapeHtmlClient(o.description)+'</div><div class="shop-offer-exchange"><span>🏆 '+o.trophyCost+' → '+(o.rewardType==='XP'?'⭐ '+o.rewardAmount+' XP':'💠 '+o.rewardAmount+' RP')+'</span><button class="shop-buy" '+(can?'':'disabled')+' onclick="purchaseTournamentOffer(&quot;'+o.id+'&quot;)">'+(can?'CLAIM OFFER':'NOT ENOUGH TROPHY')+'</button></div></div>';}).join('')+'</div>';
    }

    function getSafeTournamentTrophy(incoming, current) {
      const inc = Number(incoming || 0);
      const cur = Number(current !== undefined ? current : (backendState.user?.tournamentTrophy || localStorage.getItem('elem_tournament_trophy') || 0));
      // Tournament Trophy only increases from a completed match; a zero/stale profile
      // response must never erase a known non-zero local value. Shop purchases update the
      // value explicitly from their purchase response and are therefore unaffected.
      return (inc > 0 || cur <= 0) ? inc : cur;
    }

    async function openAccountTab(tab) {
      const modal = document.getElementById('accountModal');
      if (!modal) return;

      // Every tab click gets its own request id. Async profile/shop/leaderboard
      // refreshes from an older tab are not allowed to overwrite the newly selected tab.
      const tabRequestId = (window.__accountTabRequestId = Number(window.__accountTabRequestId || 0) + 1);
      // A public-profile view must never hijack a normal account-tab click.
      // Clear the old public target first so Leaderboards can never show Profile Rank.
      if (publicProfileTarget) publicProfileTarget = null;
      modal.style.display = 'flex';
      document.querySelectorAll('.account-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      const panel = document.getElementById('accountPanel');
      if (!panel) return;

      if (tab === 'profile') {
        if (backendState.token) {
          try {
            const fresh = await apiRequest({action:'profile', token:backendState.token});
            if (fresh && fresh.success) {
              const safeTrophy = getSafeTournamentTrophy(fresh.tournamentTrophy, backendState.user?.tournamentTrophy);
              backendState.user = Object.assign({}, backendState.user || {}, fresh, {tournamentTrophy:safeTrophy, isGuest:false});
              backendState.dailyRankMatches = Number(fresh.dailyRankMatches || 0);
              backendState.user.dailyRankLimit = Number(fresh.dailyRankLimit || getDailyRankMatchLimit(fresh.rank || 'Bronze I'));
              localStorage.setItem('elem_daily_rank_matches', String(backendState.dailyRankMatches));
              localStorage.setItem('elem_high_score', String(Number(fresh.highScore || 0)));
              localStorage.setItem('elem_classic_score', String(Number(fresh.classicScore || 0)));
              localStorage.setItem('elem_rank_score', String(Number(fresh.rankScore || 0)));
              localStorage.setItem('elem_tournament_trophy', String(getSafeTournamentTrophy(fresh.tournamentTrophy, backendState.user?.tournamentTrophy)));
              localStorage.setItem('elem_tournament_monthly_trophy', String(Number(fresh.tournamentMonthlyTrophy || 0)));
              localStorage.setItem('elem_tournament_matches', String(Number(fresh.tournamentMatches || 0)));
              localStorage.setItem('elem_tournament_high_score', String(Number(fresh.tournamentHighScore || 0)));
              if (fresh.userId || fresh.playerId) localStorage.setItem('elem_player_id', String(fresh.userId || fresh.playerId));
            }
          } catch(e) { console.warn('Profile refresh failed:', e); }
          // User may have clicked another tab while the profile request was pending.
          if (tabRequestId !== window.__accountTabRequestId) return;
        }
        if (tabRequestId !== window.__accountTabRequestId) return;
        const u = backendState.user || getGuestProgress();
        const prog = getLevelProgress(u.xp);
        const xpRank = getXpRank(u.xp);
        panel.innerHTML =
          '<div class="account-panel-title">👤 Profile Rank</div>' +
          '<div class="profile-rank-grid">' +
            '<div class="profile-rank-large xp-rank-large"><div class="profile-rank-kicker">⭐ XP BASED RANK</div><div class="profile-rank-name">' + escapeHtmlClient(xpRank.name) + '</div><div class="profile-rank-value">' + Number(u.xp || 0) + ' XP</div><div class="challenge-track"><div class="challenge-fill" style="width:' + prog.percent + '%"></div></div><div class="challenge-foot"><span>Level ' + Number(u.level || 1) + '</span><span>' + prog.current + ' / ' + prog.needed + ' XP</span></div></div>' +
            '<div class="profile-rank-large match-rank-large"><div class="profile-rank-kicker">⚔️ RANK MATCH BASED</div><div class="profile-rank-name">' + escapeHtmlClient(u.rank || 'Bronze I') + '</div><div class="profile-rank-value">' + getRankProgress(u).current + ' / ' + getRankProgress(u).target + ' RP</div><div class="challenge-track"><div class="challenge-fill" style="width:' + getRankProgress(u).percent + '%"></div></div><div class="challenge-foot"><span>' + getRankProgress(u).current + ' RP</span><span>' + getRankProgress(u).target + ' RP → Promotion</span></div></div>' +
          '</div>' +
          '<div class="profile-info-strip"><span>⚔️ Rank Matches Today</span><b>' + Number(u.dailyRankMatches || 0) + '/' + getDailyRankMatchLimit(u.rank || 'Bronze I') + '</b></div>' +
          '<div class="tournament-hero"><div class="tournament-hero-title">🏆 Tournament</div><div style="color:#cbd5e1;font-size:13px;margin-top:6px;">Unlimited matches • separate Trophy • monthly leaderboard</div><div class="tournament-stat-grid"><div class="tournament-stat"><span>🏆 Current Trophy</span><strong>'+Number(u.tournamentTrophy||0)+'</strong></div><div class="tournament-stat"><span>📅 This Month</span><strong>'+Number(u.tournamentMonthlyTrophy||0)+'</strong></div><div class="tournament-stat"><span>🎮 Matches</span><strong>'+Number(u.tournamentMatches||0)+'</strong></div></div><button class="challenge-play-btn" onclick="openAccountTab(\'tournament\')">🏆 OPEN TOURNAMENT</button></div>' +
          renderFriendControlsOwn() +
          renderFriendsPanel() +
          '<div class="customize-card"><div class="customize-title">✏️ Username</div><div class="customize-note">First <b>10 username changes are FREE</b> — no RP required. After 10 free changes, each change costs <b>100 RP</b>. Usernames do not need to be unique.</div><div class="name-change-row"><input id="profileNewUsername" maxlength="20" placeholder="New username"><button class="name-change-btn" onclick="changeUsernameFromProfile()">'+(getUsernameChangeCount(u)<10?'FREE':'100 RP')+'</button></div><div style="margin-top:7px;color:#67e8f9;font-size:11px;text-align:center;">'+(getUsernameChangeCount(u)<10?(10-getUsernameChangeCount(u))+' free username changes remaining.':'Free username changes used • Next change: 100 RP')+'</div></div>' +
          renderAvatarPicker();
        renderAccountFooter();
        return;
      }

      if (tab === 'rank') {
        const u = backendState.user || getGuestProgress();
        panel.innerHTML =
          '<div class="account-panel-title">⚔️ Rank Match</div>' +
          '<div class="challenge-card">' +
            '<div class="challenge-top"><div class="challenge-title">' + escapeHtmlClient(u.rank || 'Bronze I') + '</div><div class="challenge-badge">' + getRankProgress(u).current + ' / ' + getRankProgress(u).target + ' RP</div></div>' +
            '<div class="challenge-desc">Promotion target: <b>' + getRankProgress(u).target + ' RP</b>. Each promotion increases earned XP, RP and Trophy rewards by 20%.</div>' +
            '<div class="challenge-track"><div class="challenge-fill" style="width:' + getRankProgress(u).percent + '%"></div></div>' +
            '<div class="challenge-foot"><span>' + getRankProgress(u).current + ' RP</span><span>' + getRankProgress(u).target + ' RP → Promotion</span></div>' +
          '</div>' +
          '<div style="margin-top:12px;color:#94a3b8;font-size:13px;">Today: <b style="color:#67e8f9;">' + Number(u.dailyRankMatches||0) + '/' + Number(u.dailyRankLimit||10) + '</b> Rank Matches used.</div>';
        return;
      }

      if (tab === 'tournament') {
        const token=backendState.token||'';
        const u=backendState.user||getGuestProgress();
        panel.innerHTML='<div class="account-panel-title">🏆 Tournament</div><div class="tournament-hero"><div style="font-size:22px;font-weight:950;color:#f9a8d4;">'+(token?'Current Tournament':'Guest Tournament')+'</div><div style="margin-top:5px;color:#cbd5e1;font-size:12px;">Unlimited matches • monthly leaderboard • 50% Trophy deduction at month rollover</div><div class="tournament-stat-grid"><div class="tournament-stat"><span>🏆 Trophy</span><strong id="trophyPanelValue">'+Number(u.tournamentTrophy||0)+'</strong></div><div class="tournament-stat"><span>📅 Monthly</span><strong>'+Number(u.tournamentMonthlyTrophy||0)+'</strong></div><div class="tournament-stat"><span>🎮 Matches</span><strong>'+Number(u.tournamentMatches||0)+'</strong></div></div><button class="challenge-play-btn" onclick="selectMatchMode(\'Tournament\')">🏆 PLAY TOURNAMENT</button></div><div style="margin-top:14px;"><div class="account-panel-title">🛍️ Tournament Shop</div><div id="tournamentShopList"></div></div>';
        renderFixedTournamentShop('tournamentShopList', Number(u.tournamentTrophy||0), true);
        try {
          const identity=getGuestIdentity();
          const res=await apiRequest({action:'tournamentShop',token:token,playerId:identity.playerId});
          if (tabRequestId !== window.__accountTabRequestId) return;
          renderFixedTournamentShop('tournamentShopList', Number(res.trophy||0), true);
          const tv=document.getElementById('trophyPanelValue'); if(tv) tv.textContent=Number(res.trophy||0);
        } catch(e) { /* Fixed offers stay visible. */ }
        return;
      }

      if (tab === 'shop') {
        const token = backendState.token || '';
        panel.innerHTML = '<div class="account-panel-title">🛍️ Tournament Shop</div><div class="shop-section"><div id="standaloneShopList"></div></div>';
        renderFixedTournamentShop('standaloneShopList', Number((backendState.user||getGuestProgress()).tournamentTrophy||0), true);
        try {
          const identity=getGuestIdentity();
          const res = await apiRequest({action:'tournamentShop',token:token,playerId:identity.playerId});
          if (tabRequestId !== window.__accountTabRequestId) return;
          renderFixedTournamentShop('standaloneShopList', Number(res.trophy||0), true);
        } catch(e) { /* Fixed offer cards stay visible. */ }
        return;
      }

      if (tab === 'challenge') {
        const token = backendState.token || '';
        // Session restore is asynchronous on page load. If a token exists, never treat the
        // user as a guest just because the profile request has not completed yet.
        if (!backendState.user && token) {
          panel.innerHTML = '<div class="account-panel-title">🎯 Daily Challenge</div>' +
            '<div class="challenge-card"><div style="text-align:center;color:#94a3b8;padding:14px;">Checking your login session…</div></div>';
          let tries = 0;
          const waitForSession = setInterval(function() {
            tries++;
            if (backendState.user) {
              clearInterval(waitForSession);
              openAccountTab('challenge');
            } else if (!backendState.token || tries >= 30) {
              clearInterval(waitForSession);
              openAuth('challenge');
            }
          }, 100);
          return;
        }
        if (!backendState.user || !token) {
          const challenges = getGuestDailyChallenges();
          const doneCount = Number(localStorage.getItem('guest_daily_challenge_done_count') || 0);
          const cards = challenges.map(function(c, i) {
            const pct = Math.min(100, (Number(c.progress || 0) / c.target) * 100);
            const locked = !c.unlocked;
            const active = c.unlocked && !c.completed;
            const claim = c.completed && !c.claimed;
            return '<div class=\"challenge-card\" style=\"margin-bottom:10px;opacity:' + (locked ? '.58' : '1') + '\">' +
              '<div class=\"challenge-top\"><div class=\"challenge-title\">🎯 Daily Challenge ' + (i + 1) + '</div><div class=\"challenge-badge\">' + (c.completed ? (c.claimed ? '✓ Claimed' : '🎁 Reward Ready') : (locked ? '🔒 Locked' : 'In Progress')) + '</div></div>' +
              '<div class=\"challenge-desc\">' + escapeHtmlClient(c.description) + '</div>' +
              '<div class=\"challenge-track\"><div class=\"challenge-fill\" style=\"width:' + pct + '%\"></div></div>' +
              '<div class=\"challenge-foot\"><span>' + Math.min(c.progress, c.target) + '</span><span>' + c.target + '</span></div>' +
              '<div style=\"margin-top:10px;color:#94a3b8;font-size:12px;display:flex;justify-content:space-between;gap:8px;\"><span>📅 ' + c.date + '</span><b style=\"color:#fbbf24;\">🎁 +' + c.xpReward + ' XP</b></div>' +
              (claim ? '<button class=\"challenge-play-btn\" onclick=\"claimGuestDailyChallenge(' + i + ')\">🎁 CLAIM REWARD</button>' : (active ? '<button class=\"challenge-play-btn\" onclick=\"playDailyChallenge()\">🎮 PLAY CHALLENGE</button>' : (c.completed ? '<button class=\"challenge-play-btn\" disabled>✓ ' + (c.claimed ? 'CLAIMED' : 'COMPLETED') + '</button>' : '<button class=\"challenge-play-btn\" disabled>🔒 COMPLETE PREVIOUS</button>'))) +
              '</div>';
          }).join('');
          panel.innerHTML = '<div class=\"account-panel-title\">🎯 Daily Challenge <span style=\"font-size:11px;color:#94a3b8;\">(10 Challenges)</span></div>' +
            cards + '<div style=\"margin-top:9px;color:#64748b;font-size:11px;text-align:center;\">প্রতিদিন ১০টি challenge reset হবে। Difficulty ও prize ধাপে ধাপে বাড়বে।</div>';
          return;
        }
        panel.innerHTML =
          '<div class="account-panel-title">🎯 Daily Challenge</div>' +
          '<div class="challenge-card" id="dailyChallengeCard">' +
            '<div style="text-align:center;color:#94a3b8;padding:14px;">Loading today\'s challenge…</div>' +
          '</div>';
        apiRequest({ action: 'dailyChallenge', token: token, rewardMultiplier: getRewardMultiplier() })
          .then(function(result) {
            const card = document.getElementById('dailyChallengeCard');
            if (!card) return;
            if (!result.success) {
              card.innerHTML = '<div style="color:#fb7185;text-align:center;padding:14px;">' + escapeHtmlClient(result.message || 'Could not load Daily Challenge.') + '</div>';
              return;
            }
            const serverList = Array.isArray(result.challenges) ? result.challenges : [];
            const challengeList = DAILY_CHALLENGE_LADDER.map(function(def, i) {
              const c = serverList[i] || {};
              const target = Math.max(1, Number(c.target !== undefined ? c.target : def.target));
              const progress = Math.min(target, Number(c.progress !== undefined ? c.progress : (i === 0 ? 1 : 0)));
              return Object.assign({}, def, c, {
                index:i, title:def.title, description:def.description, target:target, progress:progress,
                xpReward:Number(def.xpReward || 0), rpReward:Number(def.rpReward || 0),
                completed:i === 0 ? true : !!c.completed,
                claimed:i === 0 ? (c.claimed === true || localStorage.getItem('logged_daily_login_reward_date') === new Date().toISOString().slice(0,10)) : !!c.claimed,
                unlocked:i === 0 ? true : (c.unlocked !== false)
              });
            });
            backendState.user.dailyChallenges = challengeList;
            card.innerHTML = challengeList.map(function(c, i) {
              const target = Math.max(1, Number(c.target || 1));
              const progress = Math.min(target, Number(c.progress || 0));
              const pct = Math.min(100, (progress / target) * 100);
              const completed = !!c.completed, claimed = !!c.claimed, unlocked = c.unlocked !== false;
              const reward = Math.round(Number(c.xpReward || 0) * getRewardMultiplier());
              const rpReward = Math.round(Number(c.rpReward || 0) * getRewardMultiplier());
              return '<div class="challenge-card" style="margin-bottom:10px;opacity:' + (unlocked ? '1' : '.58') + '">' +
                '<div class="challenge-top"><div class="challenge-title">🎯 ' + escapeHtmlClient(c.title || ('Daily Challenge ' + (i+1))) + '</div><div class="challenge-badge">' + (completed ? (claimed ? '✓ Claimed' : '🎁 Reward Ready') : (unlocked ? 'In Progress' : '🔒 Locked')) + '</div></div>' +
                '<div class="challenge-desc">' + escapeHtmlClient(c.description || '') + '</div>' +
                '<div class="challenge-track"><div class="challenge-fill" style="width:' + pct + '%"></div></div>' +
                '<div class="challenge-foot"><span>' + progress + '</span><span>' + target + '</span></div>' +
                '<div style="margin-top:10px;color:#94a3b8;font-size:12px;display:flex;justify-content:space-between;gap:8px;"><span>📅 Today</span><b style="color:#fbbf24;">🎁 +' + reward + ' XP' + (rpReward ? ' • +' + rpReward + ' RP' : '') + '</b></div>' +
                (completed && !claimed ? '<button class="challenge-play-btn" onclick="claimDailyChallenge(' + i + ')">🎁 CLAIM REWARD</button>' : (completed ? '<button class="challenge-play-btn" disabled>✓ CLAIMED</button>' : (unlocked ? '<button class="challenge-play-btn" onclick="playDailyChallenge()">🎮 PLAY CHALLENGE</button>' : '<button class="challenge-play-btn" disabled>🔒 COMPLETE PREVIOUS</button>'))) +
                '</div>';
            }).join('') + '<div style="margin-top:9px;color:#64748b;font-size:11px;text-align:center;">#01 Login Reward → তারপর Catch, Combo, Score, Survival ও Fever-এর মতো varied challenges unlock হবে।</div>';
            return;
            const c = result.dailyChallenge;
            if (!c) {
              card.innerHTML = '<div class="challenge-desc" style="text-align:center;">Login is required for today\'s Daily Challenge.</div>';
              return;
            }
            backendState.user.dailyChallenge = c;
            const target = Math.max(1, Number(c.target || 1));
            const progress = Math.min(target, Number(c.progress || 0));
            const pct = Math.min(100, (progress / target) * 100);
            const completed = !!c.completed;
            const claimed = !!c.claimed;
            card.innerHTML =
              '<div class="challenge-top"><div class="challenge-title">' + escapeHtmlClient(c.title || 'Daily Challenge') + '</div><div class="challenge-badge">' + (completed ? '✓ Completed' : 'In Progress') + '</div></div>' +
              '<div class="challenge-desc">' + escapeHtmlClient(c.description || 'Complete today\'s challenge to earn bonus XP.') + '</div>' +
              '<div class="challenge-track"><div class="challenge-fill" style="width:' + pct + '%"></div></div>' +
              '<div class="challenge-foot"><span>' + progress + '</span><span>' + target + '</span></div>' +
              '<div style="margin-top:10px;color:#94a3b8;font-size:12px;display:flex;justify-content:space-between;gap:8px;"><span>📅 ' + escapeHtmlClient(c.date || 'Today') + '</span><b style="color:#fbbf24;">🎁 +' + Number(c.xpReward || 0) + ' XP</b></div>' +
              (completed ? '<button class="challenge-play-btn" disabled>✓ ' + (claimed ? 'CHALLENGE COMPLETED — BONUS CLAIMED' : 'CHALLENGE COMPLETED') + '</button>' : '<button class="challenge-play-btn" onclick="playDailyChallenge()">🎮 PLAY CHALLENGE</button>') +
              '<div style="margin-top:9px;color:#64748b;font-size:11px;text-align:center;">Play it through Classic Match. Your progress is saved automatically.</div>';
          })
          .catch(function(error) {
            console.error('Daily Challenge load error:', error);
            const card = document.getElementById('dailyChallengeCard');
            if (card) card.innerHTML = '<div style="color:#fb7185;text-align:center;padding:14px;">Failed to load today\'s challenge.</div>';
          });
        return;
      }

      if (tab === 'leaderboard') {
        window.__leaderboardTabRequestId = tabRequestId;
        panel.innerHTML =
          '<div class="account-panel-title">🏆 Leaderboards</div>' +
          '<div class="mode-pills"><button class="mode-pill active" id="rankLbPill" onclick="loadLeaderboardPanel(\'Rank\')">⚔️ Rank</button><button class="mode-pill" id="classicLbPill" onclick="loadLeaderboardPanel(\'Classic\')">🎮 Classic</button><button class="mode-pill" id="tournamentLbPill" onclick="loadLeaderboardPanel(\'Tournament\')">🏆 Tournament</button></div>' +
          '<div id="leaderboardContent" class="leaderboard-list"></div>';
        loadLeaderboardPanel('Rank', false, tabRequestId);
      }
    }

    function playDailyChallenge() {
      const challenge = backendState.user ? backendState.user.dailyChallenge : getGuestDailyChallenge();
      if (challenge && challenge.completed) {
        showBackendMessage('🎁 Today\'s Daily Challenge is already complete.', false);
        return;
      }
      closeAccount();
      backendState.mode = 'Classic';
      localStorage.setItem('elem_game_mode', 'Classic');
      updateBackendUI();
      setTimeout(function() {
        startGame();
        showBackendMessage('🎯 Daily Challenge: ' + (challenge?.description || 'Complete today\'s challenge to earn bonus XP.'), false);
      }, 120);
    }

    function getLocalLeaderboardSelf() {
      const authType = localStorage.getItem('elem_auth_type') || (backendState.token ? 'logged' : 'guest');
      if (backendState.user) {
        const u = backendState.user;
        return {
          username: u.username || localStorage.getItem('elem_username') || u.playerId || u.userId || 'Guest Player',
          userId: u.userId || u.playerId || (authType === 'logged' ? localStorage.getItem('elem_player_id') || '' : ''),
          playerId: u.playerId || u.userId || (authType === 'logged' ? localStorage.getItem('elem_player_id') || '' : ''),
          isGuest: !!u.isGuest,
          score: Number(u.classicScore || u.highScore || 0),
          highScore: Number(u.highScore || 0),
          classicScore: Number(u.classicScore || 0),
          rankScore: Number(u.rankScore || 0),
          rank: u.rank || 'Bronze I',
          rankPoints: Number(u.rankPoints || 0),
          xp: Number(u.xp || 0),
          level: Number(u.level || 1),
          matches: Number(u.matches || getLocalMatchCount()),
          monthlyTrophy: Number(u.tournamentMonthlyTrophy || u.monthlyTrophy || 0),
          tournamentTrophy: Number(u.tournamentTrophy || 0),
          tournamentMatches: Number(u.tournamentMatches || 0),
          tournamentHighScore: Number(u.tournamentHighScore || 0),
          avatar: u.avatar || getSelectedAvatar()
        };
      }
      if (authType === 'guest') {
        const u = getGuestProgress();
        const identity = getGuestIdentity();
        return {
          username: identity.playerId || identity.username || 'Guest Player',
          userId: identity.playerId || '',
          playerId: identity.playerId || '',
          isGuest: true,
          score: Number(u.classicScore || u.highScore || 0),
          highScore: Number(u.highScore || 0),
          classicScore: Number(u.classicScore || 0),
          rankScore: Number(u.rankScore || 0),
          rank: u.rank || 'Bronze I',
          rankPoints: Number(u.rankPoints || 0),
          xp: Number(u.xp || 0),
          level: Number(u.level || 1),
          matches: Number(u.matches || getLocalMatchCount()),
          monthlyTrophy: Number(u.tournamentMonthlyTrophy || 0),
          tournamentTrophy: Number(u.tournamentTrophy || 0),
          tournamentMatches: Number(u.tournamentMatches || 0),
          tournamentHighScore: Number(u.tournamentHighScore || 0),
          avatar: u.avatar || getSelectedAvatar()
        };
      }
      return null;
    }

    function mergeLeaderboardSelf(entries, self) {
      const list = Array.isArray(entries) ? entries.slice() : [];
      if (!self || !self.username) return list;
      const selfName = String(self.username).toLowerCase();
      const selfId = String(self.userId || self.playerId || '').toLowerCase();
      let found = false;
      for (let i = 0; i < list.length; i++) {
        const e = list[i] || {};
        const eid = String(e.userId || e.playerId || '').toLowerCase();
        const ename = String(e.username || e.name || e.player || '').toLowerCase();
        if ((selfId && eid && selfId === eid) || (selfName && ename === selfName)) {
          list[i] = Object.assign({}, e, {
            username: self.username, userId: self.userId || e.userId || '', playerId: self.playerId || e.playerId || '',
            isGuest: self.isGuest, highScore: Number(self.highScore || e.highScore || 0),
            classicScore: Number(self.classicScore || e.classicScore || 0), score: Number(self.classicScore || e.score || 0),
            rankScore: Number(self.rankScore || e.rankScore || 0), rank: self.rank || e.rank || 'Bronze I',
            rankPoints: Number(self.rankPoints || e.rankPoints || 0), xp: Number(self.xp || e.xp || 0),
            level: Number(self.level || e.level || 1), matches: Number(self.matches || e.matches || 0),
            monthlyTrophy: Number(self.monthlyTrophy || e.monthlyTrophy || 0), tournamentTrophy: Number(self.tournamentTrophy || e.tournamentTrophy || 0),
            avatar: self.avatar || e.avatar || getSelectedAvatar()
          });
          found = true;
          break;
        }
      }
      if (!found) list.push(Object.assign({}, self));
      return list;
    }

    function updateOfflineSyncStatus(syncing) {
      const offline = navigator.onLine === false;
      const text = offline ? 'Offline • Auto Syncing...' : 'Auto Syncing...';
      const els = [
        document.getElementById('offlineSyncStatus'),
        document.getElementById('gameSyncStatus')
      ].filter(Boolean);

      // Both leaderboard and game-over screens use a fixed status slot.
      // It never changes layout position and disappears immediately when syncing is done.
      els.forEach(function(el) {
        if (syncing) {
          el.textContent = text;
          el.style.visibility = 'visible';
        } else {
          el.textContent = '';
          el.style.visibility = 'hidden';
        }
        el.style.display = 'block';
      });
    }

    // Global leaderboard uses live backend players only. No demo/NPC players.
    function renderLeaderboardEntries(mode, entries, liveReady) {
      const box = document.getElementById('leaderboardContent');
      if (!box) return;

      const self = getLocalLeaderboardSelf();
      entries = mergeLeaderboardSelf(entries, self).map(function(e) {
        return {
          username: (e.isGuest || e.guest) ? (e.playerId || e.userId || e.username || 'Guest Player') : (e.username || e.name || e.player || 'Player'),
          score: Number(e.score ?? e.highScore ?? e.points ?? 0),
          highScore: Number(e.highScore ?? e.score ?? 0),
          classicScore: Number(e.classicScore ?? e.score ?? e.highScore ?? 0),
          rankScore: Number(e.rankScore ?? e.score ?? 0),
          rank: e.rank || 'Bronze I',
          rankPoints: Number(e.rankPoints ?? e.rp ?? 0),
          xp: Number(e.xp || 0), level: Number(e.level || 1),
          matches: Number(e.matches || 0),
          monthlyTrophy: Number(e.monthlyTrophy ?? e.tournamentMonthlyTrophy ?? 0),
          tournamentTrophy: Number(e.tournamentTrophy || 0),
          userId: e.userId || e.playerId || '', playerId: e.playerId || e.userId || '',
          isGuest: !!(e.isGuest || e.guest), deleted: !!e.deleted, npc: !!e.npc,
          avatar: e.avatar || avatarForPlayer(e.username || e.playerId || e.userId)
        };
      });

      const myId = String(self && (self.userId || self.playerId) || '').toLowerCase();
      const myName = String(self && self.username || '').toLowerCase();
      const isSamePlayer = function(e) {
        const eid = String(e.userId || e.playerId || '').toLowerCase();
        const ename = String(e.username || '').toLowerCase();
        return (myId && eid && eid === myId) || (myName && ename === myName);
      };

      if (mode === 'Rank') entries.sort(function(a,b) { return b.rankPoints - a.rankPoints || b.rankScore - a.rankScore || a.username.localeCompare(b.username); });
      else if (mode === 'Tournament') entries.sort(function(a,b) { return b.monthlyTrophy - a.monthlyTrophy || b.highScore - a.highScore || a.username.localeCompare(b.username); });
      else entries.sort(function(a,b) { return b.xp - a.xp || b.classicScore - a.classicScore || a.username.localeCompare(b.username); });

      const myIndex = entries.findIndex(isSamePlayer);
      const myEntry = myIndex >= 0 ? entries[myIndex] : null;
      const visible = entries.slice();
      window.__leaderboardEntries = visible;

      let html = '';
      if (!visible.length) {
        html = '<div style="color:#94a3b8;text-align:center;padding:20px;">No leaderboard players yet.</div>';
      } else {
        html = visible.map(function(e, visibleIndex) {
          const position = entries.indexOf(e) + 1;
          const isMe = isSamePlayer(e);
          const mainValue = mode === 'Rank' ? Number(e.rankPoints || 0) + ' RP' : (mode === 'Tournament' ? Number(e.monthlyTrophy || 0) + ' 🏆' : Number(e.xp || 0) + ' XP');
          return '<div class="leader-row' + (isMe ? ' is-me' : '') + '" onclick="openPublicProfileFromLeaderboard(' + visibleIndex + ')" title="View ' + escapeHtmlClient(e.username) + ' profile">' +
            '<div class="leader-rank">#' + position + '</div>' +
            '<div class="leader-avatar" aria-hidden="true">' + (isMe ? getSelectedAvatar() : (e.avatar || avatarForPlayer(e.username))) + '</div>' +
            '<div class="leader-main"><div class="leader-name-line"><div class="leader-name">' + escapeHtmlClient(e.username) + '</div>' + (e.isGuest ? '<span class="leader-you">GUEST</span>' : '') + (e.deleted ? '<span class="leader-you">HISTORY</span>' : '') + (isMe ? '<span class="leader-you">YOU</span>' : '') + '</div>' +
            '<div class="leader-meta-grid"><span>⭐ XP ' + Number(e.xp || 0) + '</span><span>🏅 ' + escapeHtmlClient(e.rank || 'Bronze I') + '</span><span>💠 ' + Number(e.rankPoints || 0) + ' RP</span>' + (mode === 'Tournament' ? '<span>🏆 ' + Number(e.monthlyTrophy || 0) + '</span>' : (mode === 'Rank' ? '<span>🎮 ' + Number(e.rankScore || 0) + '</span>' : '')) + '</div></div>' +
            '<div class="leader-score">' + mainValue + '</div></div>';
        }).join('');
      }

      // Deliberately render the current player twice visually: once at the real rank and once pinned.
      let pinned = '';
      if (myEntry || self) {
        const pin = myEntry || self;
        pinned = '<div class="my-profile-bar" onclick="openAccountTab(\'profile\')" title="Open your profile"><div class="my-profile-head"><div class="my-profile-avatar">' + getSelectedAvatar() + '</div><div class="my-profile-main"><div class="my-profile-title"><span>MY PROFILE</span><span class="my-profile-badge">YOU</span></div><div class="my-profile-meta"><span>' + escapeHtmlClient(pin.username) + '</span><span>⭐ XP ' + Number(pin.xp||0) + '</span><span>🏅 ' + escapeHtmlClient(pin.rank||'Bronze I') + '</span><span>💠 ' + Number(pin.rankPoints||0) + ' RP</span></div></div><div class="my-profile-score">' + (mode === 'Rank' ? Number(pin.rankPoints||0) + ' RP' : (mode === 'Tournament' ? Number(pin.monthlyTrophy||0) + ' 🏆' : Number(pin.xp||0) + ' XP')) + '</div></div></div><div class="leaderboard-position" style="margin-top:7px;color:#67e8f9;font-size:10px;text-align:center;">Your leaderboard position: <b>#' + (myIndex >= 0 ? (myIndex + 1) : '-') + '</b></div>';
      }
      box.innerHTML = '<div class="leaderboard-scroll-frame"><div class="leaderboard-vertical"><div class="leaderboard-rows">' + html + '</div></div>' + pinned + '</div><div id="offlineSyncStatus" style="display:block;height:16px;margin-top:7px;text-align:center;color:#94a3b8;font-size:10px;line-height:16px;visibility:hidden;position:relative;"></div>';
      updateOfflineSyncStatus(!!window.__leaderboardSyncing);
    }

    async function purchaseTournamentOffer(offerId){
      try{
        const identity=getGuestIdentity();
        const res=await apiRequest({action:'tournamentPurchase',token:backendState.token||'',playerId:identity.playerId,offerId:offerId});
        if(!res||!res.success)throw new Error((res&&res.message)||'Offer purchase failed.');
        const current=backendState.user||getGuestProgress();
        const updated=Object.assign({},current,{tournamentTrophy:Number(res.trophy||0),xp:Number(res.xp!==undefined?res.xp:current.xp||0),level:Number(res.level||current.level||1),rankPoints:Number(res.rankPoints!==undefined?res.rankPoints:current.rankPoints||0)});
        if(backendState.token){ backendState.user=Object.assign({},backendState.user,updated,{isGuest:false}); }
        else { saveGuestProgress(updated); localStorage.setItem('guest_tournament_trophy',String(updated.tournamentTrophy)); backendState.user=Object.assign({},updated,identity,{isGuest:true,userId:identity.playerId}); }
        renderAccountHeader();renderProfileQuick();openAccountTab('tournament');
        showBackendMessage('🛍️ Offer claimed successfully.',false);
      }catch(e){showBackendMessage(e.message||'Offer purchase failed.',true);}
    }

    async function loadLeaderboardPanel(mode, silentRefresh, ownerRequestId) {
      const box = document.getElementById('leaderboardContent');
      if (!box) return;
      const requestId = Number(ownerRequestId || window.__accountTabRequestId || 0);
      if (ownerRequestId && requestId !== Number(window.__accountTabRequestId || 0)) return;
      window.__activeLeaderboardMode = mode;
      document.getElementById('rankLbPill')?.classList.toggle('active', mode === 'Rank');
      document.getElementById('classicLbPill')?.classList.toggle('active', mode === 'Classic');
      document.getElementById('tournamentLbPill')?.classList.toggle('active', mode === 'Tournament');
      const cached=readCachedLeaderboard(mode);
      if(cached){
        // Cached data is shown immediately. Fresh data is always fetched in the background.
        renderLeaderboardEntries(mode,cached,true);
      } else {
        // Never show a loading/error screen. Render the current local player immediately;
        // the real global leaderboard replaces this in the background when available.
        const localMe = backendState.user || ensureLocalGuestSession();
        const localEntry = localMe ? [{
          username: localMe.username || localMe.playerId || localMe.userId || 'Guest Player',
          userId: localMe.userId || localMe.playerId || '',
          playerId: localMe.playerId || localMe.userId || '',
          isGuest: !!localMe.isGuest,
          score: Number(localMe.classicScore || localMe.highScore || 0),
          highScore: Number(localMe.highScore || 0),
          classicScore: Number(localMe.classicScore || 0),
          rankScore: Number(localMe.rankScore || 0),
          rank: localMe.rank || 'Bronze I',
          rankPoints: Number(localMe.rankPoints || 0),
          xp: Number(localMe.xp || 0),
          level: Number(localMe.level || 1),
          matches: Number(localMe.matches || getLocalMatchCount()),
          monthlyTrophy: Number(localMe.tournamentMonthlyTrophy || localMe.monthlyTrophy || 0),
          tournamentTrophy: Number(localMe.tournamentTrophy || 0),
          avatar: localMe.avatar || getSelectedAvatar()
        }] : [];
        renderLeaderboardEntries(mode, localEntry, true);
      }
      try {
        let res;
        try { res = await apiRequest(mode === 'Tournament' ? {action:'tournamentLeaderboard',month:undefined} : {action:'leaderboard',mode:mode,username:backendState.user?.username || ''}); }
        catch(postError){
          const qs=mode==='Tournament'?'?action=tournamentLeaderboard':'?action=leaderboard&mode='+encodeURIComponent(mode)+'&username='+encodeURIComponent(backendState.user?.username||'');
          const gr=await fetch(API_URL+qs,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Accept':'application/json,text/plain,*/*'}});
          const gt=await gr.text();
          if(!gr.ok) throw postError;
          try { res=JSON.parse(String(gt||'').trim()); }
          catch(getParseError) { throw postError; }
        }
        if(!res || res.success===false) throw new Error((res&&res.message)||'Could not load leaderboard.');
        const entries=Array.isArray(res.entries)?res.entries:(Array.isArray(res.leaderboard)?res.leaderboard:(Array.isArray(res.results)?res.results:[]));
        if (ownerRequestId && requestId !== Number(window.__accountTabRequestId || 0)) return;
        if (window.__activeLeaderboardMode !== mode) return;
        cacheLeaderboard(mode,entries);
        renderLeaderboardEntries(mode,entries,true);
        // Keep the Profile Tournament Trophy in sync with the fresh Tournament leaderboard value.
        if (mode === 'Tournament' && backendState.user) {
          const meId = String(backendState.user.userId || backendState.user.playerId || '').toLowerCase();
          const meName = String(backendState.user.username || '').toLowerCase();
          const meEntry = entries.find(function(e) {
            const eid = String(e.userId || e.playerId || '').toLowerCase();
            const ename = String(e.username || e.name || '').toLowerCase();
            return (meId && eid && eid === meId) || (meName && ename === meName);
          });
          if (meEntry && (meEntry.tournamentTrophy !== undefined || meEntry.monthlyTrophy !== undefined)) {
            const trophy = getSafeTournamentTrophy(meEntry.tournamentTrophy !== undefined ? meEntry.tournamentTrophy : meEntry.monthlyTrophy, backendState.user.tournamentTrophy);
            backendState.user.tournamentTrophy = trophy;
            localStorage.setItem('elem_tournament_trophy', String(trophy));
            if (backendState.user.isGuest) localStorage.setItem('guest_tournament_trophy', String(trophy));
            renderAccountHeader();
            renderProfileQuick();
          }
        }
      } catch(err){
        // Background failure stays invisible to the player. Keep the currently rendered data.
        console.warn('Leaderboard background refresh unavailable.',err);
      }
    }

    function openPublicProfileFromLeaderboard(index) {
      const list = window.__leaderboardEntries || [];
      const player = list[Number(index)];
      if (player) openPublicProfile(player);
    }

    let sensitiveConfirmResolver = null;

    function showSensitiveConfirm(options) {
      options = options || {};
      return new Promise(function(resolve) {
        sensitiveConfirmResolver = resolve;
        const modal = document.getElementById('sensitiveConfirmModal');
        const title = document.getElementById('sensitiveConfirmTitle');
        const ok = document.getElementById('sensitiveConfirmOk');
        const cancel = document.getElementById('sensitiveConfirmCancel');
        if (!modal || !title || !ok || !cancel) { resolve(false); return; }
        title.textContent = options.message || 'Are you sure?';
        cancel.textContent = options.cancelText || 'Cancel';
        ok.textContent = options.confirmText || 'Continue';
        ok.classList.toggle('danger', !!options.danger);
        modal.style.display = 'flex';
        setTimeout(function(){ ok.focus(); }, 0);
      });
    }

    function closeSensitiveConfirm(confirmed) {
      const modal = document.getElementById('sensitiveConfirmModal');
      if (modal) modal.style.display = 'none';
      const resolver = sensitiveConfirmResolver;
      sensitiveConfirmResolver = null;
      if (resolver) resolver(!!confirmed);
    }

    function clearGuestLocalAccount() {
      const identity = getGuestIdentity();
      const avatarKey = 'elem_selected_avatar_' + String(identity.username || 'guest');
      const usernameCountKey = 'cfe_username_change_count_' + String(identity.playerId || identity.username || 'guest').toLowerCase();
      [
        'cfe_guest_display_name','cfe_guest_player_id_local',
        'guest_xp','guest_level','guest_rank','guest_rank_points','guest_daily_rank_matches','guest_rank_target',
        'guest_daily_login_reward_date','guest_daily_challenge_date','guest_daily_challenge_progresses',
        'guest_daily_challenge_claims','guest_daily_challenge_done_count',
        'elem_username','elem_xp','elem_level','elem_rank','elem_rank_points','elem_daily_rank_matches',
        'elem_high_score','cfe_match_count','guest_high_score','guest_classic_score','guest_rank_score','guest_tournament_trophy','guest_tournament_monthly_trophy','guest_tournament_matches','guest_tournament_high_score','guest_tournament_month','cfe_weekly_rank_demotion_guest',avatarKey,usernameCountKey
      ].forEach(function(key){ localStorage.removeItem(key); });
    }

    function renderAccountFooter() {
      let footer = document.getElementById('accountFooter');
      if (!footer) return;
      const isGuest = !backendState.user || backendState.user.isGuest;
      if (isGuest) {
        footer.innerHTML =
          '<button class="delete-account-btn" style="margin:0;flex:1;" onclick="logoutGuestAccount()">🗑️ Delete Guest Account</button>' +
          '<button class="logout-footer" onclick="openAuth()">👤 Login / Register</button>';
        return;
      }
      footer.innerHTML =
        '<button class="delete-account-btn" style="margin:0;flex:1;" onclick="deleteAccount()">🗑️ Delete Account</button>' +
        '<button class="logout-footer" onclick="logoutAccount()">↪ Log out</button>';
    }

    async function deleteAccount() {
      if (!backendState.user || backendState.user.isGuest || !backendState.token) {
        showBackendMessage('You are not logged in.', true);
        return;
      }

      const username = backendState.user.username || 'this account';
      const approved = await showSensitiveConfirm({
        message: 'Do you want to permanently delete the account "' + username + '"?',
        cancelText: 'Cancel',
        confirmText: 'Delete Account',
        danger: true
      });
      if (!approved) return;

      try {
        const res = await apiRequest({
          action: 'deleteAccount',
          token: backendState.token,
          preserveLeaderboard: true,
          keepLeaderboardHistory: true
        });

        if (!res || !res.success) {
          throw new Error((res && res.message) || 'Account deletion failed.');
        }

        backendState.user = null;
        backendState.token = '';
        localStorage.removeItem('elem_session_token');
        localStorage.setItem('elem_auth_type','guest');
        ensureLocalGuestSession();
        closeAccount();
        updateBackendUI();
        showBackendMessage('Account deleted. Your leaderboard history remains visible globally.', false);
      } catch (error) {
        showBackendMessage(error.message || 'Account deletion failed.', true);
      }
    }

    async function logoutGuestAccount() {
      const guest = ensureLocalGuestSession();
      const guestId = guest.playerId || guest.userId || getGuestIdentity().playerId;
      const approved = await showSensitiveConfirm({
        message: 'Log out and permanently delete this Guest Account from this device? Your leaderboard record will remain visible globally.',
        cancelText: 'Cancel',
        confirmText: 'Delete & Log out',
        danger: true
      });
      if (!approved) return;

      try {
        await apiRequest({
          action: 'guestDelete',
          playerId: guestId,
          username: guest.username || '',
          isGuest: true,
          preserveLeaderboard: true,
          keepLeaderboardHistory: true,
          xp: Number(guest.xp || 0),
          level: Number(guest.level || 1),
          rank: guest.rank || 'Bronze I',
          rankPoints: Number(guest.rankPoints || 0)
        });
      } catch (e) {
        // The local guest account can still be cleared; the backend can reconcile the
        // guest tombstone/activity record when its API action is enabled.
        console.warn('Guest account delete sync failed:', e);
      }

      clearGuestLocalAccount();
      backendState.user = null;
      backendState.token = '';
      localStorage.setItem('elem_auth_type','guest');
      ensureLocalGuestSession();
      closeAccount();
      updateBackendUI();
      renderAccountFooter();
      showBackendMessage('Guest account deleted. A new Guest Player ID was created. Your old leaderboard record remains.', false);
    }

    async function logoutAccount() {
      const token = backendState.token || '';
      const username = backendState.user && backendState.user.username ? backendState.user.username : 'your account';
      const approved = await showSensitiveConfirm({
        message: 'Do you want to log out of "' + username + '"? Your account, XP, RP and leaderboard history will stay safe.',
        cancelText: 'Cancel',
        confirmText: 'Log out'
      });
      if (!approved) return;

      try { if (token) await apiRequest({action:'logout',token:token}); } catch(e) {}
      backendState.user = null;
      backendState.token = '';
      localStorage.removeItem('elem_session_token');
      localStorage.setItem('elem_auth_type','guest');
      ensureLocalGuestSession();
      closeAccount();
      updateBackendUI();
      renderAccountFooter();
      showBackendMessage('Logged out. Your account remains safe and can be used again by logging in.', false);
    }

