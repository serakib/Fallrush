/* OverTake modular build: Game engine, canvas state, HUD and match flow. */
class SoundEffects {
      constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('cfe_sound_enabled') !== '0';
      }
      init() {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.ctx = new AudioContextClass();
        }
      }
      playCatch(isIce) {
        if (!this.enabled || !this.ctx) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = isIce ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(isIce ? 650 : 320, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(isIce ? 1300 : 650, this.ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
      }
      playHurt() {
        if (!this.enabled || !this.ctx) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, this.ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) {}
      }
      playFever() {
        if (!this.enabled || !this.ctx) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(450, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.35);
          gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.35);
        } catch (e) {}
      }
    }

    const sound = new SoundEffects();

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const state = {
      gameState: 'START', // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
      score: 0,
      lives: 5,
      maxLives: 5,
      lifeRegenMs: 30000,
      lifeRegenNextAt: Number(localStorage.getItem('cfe_life_regen_next_at') || 0),
      combo: 0,
      maxCombo: 0,
      catches: 0,
      correctCatches: 0,
      wrongCatches: 0,
      feverActivations: 0,
      feverGauge: 0,
      maxFeverGauge: 100,
      feverActive: false,
      feverTimer: 0,
      time: 0,
      tournamentTimeScoreTick: 0,
      isPausedForModal: false,
      highScore: parseInt(localStorage.getItem('elem_high_score') || '0'),
      lastXpGained: 0,
      lastChallengeXP: 0,
      lastRankPointsDelta: 0,
      lastRankWon: false,
      lastRankPromoted: false,
      lastRankDemoted: false,
      lastTournamentTrophy: 0,
      tournamentRewardPending: false,
      tournamentRewardSynced: false,
      gameId: ''
    };

    const player = {
      x: 400,
      y: 500,
      r: 28,
      bob: 0,
      mode: 'ice', // 'ice' or 'fire'
      mouthAngle: -Math.PI / 2,
      mouthOpen: 0.25,
      mouthSpeed: 0.08,
      speed: 9
    };

    let elements = [];
    let particles = [];
    let keys = {};
    let spawnTimer = 0;

    let infoModalView = 'info';

    function toggleHowToPlayModal(show) {
      const modal = document.getElementById('howToPlayModal');
      if (show) {
        infoModalView = 'info';
        updateInfoContent();
        modal.classList.remove('hidden');
        state.isPausedForModal = true;
      } else {
        modal.classList.add('hidden');
        state.isPausedForModal = false;
      }
    }

    function openInfoModal() {
      infoModalView = 'info';
      updateInfoContent();
      const modal = document.getElementById('howToPlayModal');
      modal.classList.remove('hidden');
      state.isPausedForModal = true;
    }

    function openHowToPlayGuide() {
      infoModalView = 'howToPlay';
      updateInfoContent();
      const modal = document.getElementById('howToPlayModal');
      modal.classList.remove('hidden');
      state.isPausedForModal = true;
    }

    function resizeCanvas() {
      const container = canvas.parentElement;
      const width = Math.max(300, Math.floor(container.clientWidth || window.innerWidth - 16));
      const availableHeight = Math.max(360, window.innerHeight - 185);
      const height = Math.max(360, Math.min(820, Math.floor(container.clientHeight || availableHeight)));
      canvas.width = width;
      canvas.height = height;
      player.y = canvas.height - Math.max(62, Math.min(85, canvas.height * 0.13));
      player.r = width < 430 ? 24 : 28;
      player.speed = width < 430 ? 7.5 : 9;
      if (state.gameState === 'START') {
        player.x = canvas.width / 2;
      }
    }

    function syncLifeRegenState() {
      if (state.lives >= state.maxLives) {
        state.lifeRegenNextAt = 0;
        localStorage.removeItem('cfe_life_regen_next_at');
        return;
      }
      if (!state.lifeRegenNextAt || state.lifeRegenNextAt < Date.now() - state.lifeRegenMs) {
        state.lifeRegenNextAt = Date.now() + state.lifeRegenMs;
        localStorage.setItem('cfe_life_regen_next_at', String(state.lifeRegenNextAt));
      }
    }

    function updateLifeRenewal() {
      if (state.lives >= state.maxLives) {
        syncLifeRegenState();
        return;
      }

      syncLifeRegenState();
      const now = Date.now();
      if (state.lifeRegenNextAt && now >= state.lifeRegenNextAt) {
        const recovered = Math.max(1, Math.floor((now - state.lifeRegenNextAt) / state.lifeRegenMs) + 1);
        state.lives = Math.min(state.maxLives, state.lives + recovered);

        if (state.lives < state.maxLives) {
          state.lifeRegenNextAt += recovered * state.lifeRegenMs;
          localStorage.setItem('cfe_life_regen_next_at', String(state.lifeRegenNextAt));
        } else {
          state.lifeRegenNextAt = 0;
          localStorage.removeItem('cfe_life_regen_next_at');
        }
        showBackendMessage('❤️ +'+recovered+' Life renewed!', false);
      }
    }

    function getLifeRegenText() {
      if (state.lives >= state.maxLives) return 'FULL';
      syncLifeRegenState();
      const remaining = Math.max(0, Math.ceil((state.lifeRegenNextAt - Date.now()) / 1000));
      return '+1 in ' + remaining + 's';
    }

    function getDifficultyStage(score){
      // Difficulty ramps with score, but 2500 is the permanent difficulty cap.
      const x=Math.min(2500, Math.max(0, Number(score||0)));
      if(x<500)return{speed:1,spawn:1,skull:0};
      if(x<1000)return{speed:1.10,spawn:1.08,skull:.01};
      if(x<1600)return{speed:1.20,spawn:1.16,skull:.02};
      if(x<2400)return{speed:1.30,spawn:1.24,skull:.03};
      return{speed:1.38,spawn:1.30,skull:.04};
    }

class ElementItem {
      constructor() {
        this.r = 18;
        this.x = Math.random() * (canvas.width - 80) + 40;
        this.y = -25;
        const diff=getDifficultyStage(state.score);
        const difficultyScore = Math.min(2500, Math.max(0, Number(state.score || 0)));
        this.speed=(2.5+Math.random()*2.5+(difficultyScore/400))*diff.speed;
        
        const rand=Math.random(),skullChance=getDifficultyStage(state.score).skull;
        if(rand<skullChance)this.type='skull';
        else if(rand<skullChance+.42)this.type='ice';
        else if(rand<skullChance+.84)this.type='fire';
        else this.type='skull';
        
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.06;
      }

      update() {
        this.y += this.speed;
        this.rotation += this.rotSpeed;
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'ice') {
          // Ice Snowflake / Diamond
          const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, this.r * 1.5);
          aura.addColorStop(0, 'rgba(186, 230, 253, 0.9)');
          aura.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#7dd3fc';
          ctx.fillStyle = '#bae6fd';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -this.r);
            ctx.lineTo(4, -this.r * 0.55);
          }
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, this.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.type === 'fire') {
          // Fire Orb / Flame
          const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, this.r * 1.6);
          aura.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
          aura.addColorStop(0.5, 'rgba(249, 115, 22, 0.7)');
          aura.addColorStop(1, 'rgba(225, 29, 72, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, this.r * 1.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(0, 0, this.r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.type === 'skull') {
          // Green Toxic Hazard Orb
          const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, this.r * 1.5);
          aura.addColorStop(0, 'rgba(74, 222, 128, 0.8)');
          aura.addColorStop(1, 'rgba(22, 101, 52, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(0, -2, this.r * 0.75, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#052e16';
          ctx.beginPath();
          ctx.arc(-4, -3, 3, 0, Math.PI * 2);
          ctx.arc(4, -3, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    class Particle {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 7;
        this.vy = (Math.random() - 0.5) * 7;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.r = 3 + Math.random() * 4;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function createParticles(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
      }
    }

    function drawBackground() {
      const w = canvas.width;
      const h = canvas.height;

      const leftGrad = ctx.createLinearGradient(0, 0, w / 2, h);
      leftGrad.addColorStop(0, '#0a1d33');
      leftGrad.addColorStop(1, '#030d18');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, w / 2, h);

      const rightGrad = ctx.createLinearGradient(w / 2, 0, w, h);
      rightGrad.addColorStop(0, '#33120a');
      rightGrad.addColorStop(1, '#180503');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(w / 2, 0, w / 2, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(8, 14, 26, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h - 90);
      ctx.lineTo(w * 0.25, h - 150);
      ctx.lineTo(w * 0.5, h - 80);
      ctx.lineTo(w * 0.75, h - 160);
      ctx.lineTo(w, h);
      ctx.lineTo(w, h);
      ctx.fill();
    }

    function drawPlayer() {
      const x = player.x;
      const y = player.y + Math.sin(player.bob) * 5;
      const r = player.r;
      const isIce = player.mode === 'ice';
      const primary = isIce ? '#bae6fd' : '#fdeda8';
      const secondary = isIce ? '#0284c7' : '#ea580c';
      const dark = isIce ? '#0c4a6e' : '#7c2d12';
      const mouthAngle = player.mouthAngle;
      
      player.mouthOpen += player.mouthSpeed;
      if (player.mouthOpen > 0.45 || player.mouthOpen < 0.1) {
        player.mouthSpeed = -player.mouthSpeed;
      }
      const mouthHalf = player.mouthOpen;

      ctx.save();

      if (state.feverActive) {
        const pulse = 1 + Math.sin(state.time * 20) * 0.2;
        const auraR = r * 1.6 * pulse;
        const aura = ctx.createRadialGradient(x, y, r, x, y, auraR + 25);
        aura.addColorStop(0, primary);
        aura.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.beginPath();
        ctx.arc(x, y, auraR + 25, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();
      } else {
        const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.9);
        glow.addColorStop(0, isIce ? 'rgba(56, 189, 248, 0.6)' : 'rgba(249, 115, 22, 0.6)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, mouthAngle + mouthHalf, mouthAngle + Math.PI * 2 - mouthHalf);
      ctx.lineTo(x, y);
      ctx.fillStyle = primary;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = secondary;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x + Math.cos(mouthAngle - Math.PI / 2) * (r * 0.45), y + Math.sin(mouthAngle - Math.PI / 2) * (r * 0.45), r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = dark;
      ctx.fill();

      ctx.restore();
    }

    function formatLiveTime(seconds){
      const total=Math.max(0,Math.floor(Number(seconds||0)));
      const m=Math.floor(total/60), sec=total%60;
      return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
    }
    function getLiveDifficultyLabel(score){
      const x=Math.min(2500,Math.max(0,Number(score||0)));
      const level=x<500?1:x<1000?2:x<1600?3:x<2400?4:5;
      return 'LEVEL '+level+'/5';
    }
    function updateLiveHud(){
      const score=Number(state.score||0), mode=backendState.mode||'Classic';
      const scoreEl=document.getElementById('liveScoreValue'); if(scoreEl) scoreEl.textContent=String(score);
      const timeEl=document.getElementById('liveTimeValue'); if(timeEl) timeEl.textContent=formatLiveTime(state.time);
      const diffEl=document.getElementById('liveDifficultyValue'); if(diffEl) diffEl.textContent=getLiveDifficultyLabel(score);
      let liveXp=0;
      if(score>0){
        liveXp=calculateMatchXP(score, mode, state);
      }
      const xpEl=document.getElementById('liveXpValue'); if(xpEl) xpEl.textContent='+'+liveXp;
      let liveRp=0;
      if(mode==='Rank'){
        liveRp=Math.round(calculatePerformanceRankPoints(score, state.maxCombo, state.correctCatches, state.wrongCatches, mode) * getRewardMultiplier());
      }
      const rpEl=document.getElementById('liveRankPointsValue'); if(rpEl) rpEl.textContent='+'+Math.max(0,Number(liveRp||0))+' RP';
      const trophy=Math.floor(Math.max(0,score)*0.5);
      const trophyEl=document.getElementById('liveTrophyValue'); if(trophyEl) trophyEl.textContent='+'+(mode==='Tournament'?trophy:0);
      const livesEl=document.getElementById('liveLivesValue');
      if(livesEl){let hearts='';for(let i=0;i<state.lives;i++)hearts+='❤️';livesEl.textContent=hearts||'💀';}
      const regenEl=document.getElementById('liveLivesRegen'); if(regenEl) regenEl.textContent=getLifeRegenText();
      const modeEl=document.getElementById('liveModeValue');
      if(modeEl){const ice=player.mode==='ice';modeEl.textContent=ice?'❄️ ICE':'🔥 FIRE';modeEl.style.color=ice?'#38bdf8':'#fb923c';}
    }

    function drawHUD() {
      ctx.save();
      updateLiveHud();
      const compact = canvas.width < 560;
      const tiny = canvas.width < 400;
      const isIce = player.mode === 'ice';

      const barW = Math.min(compact ? 220 : 260, canvas.width - 36);
      const barH = compact ? 12 : 14;
      const barX = canvas.width / 2 - barW / 2;
      const barY = canvas.height - (compact ? 28 : 35);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 7);
      ctx.fill();

      const fillW = (state.feverGauge / state.maxFeverGauge) * barW;
      ctx.fillStyle = state.feverActive ? '#f59e0b' : (isIce ? '#0284c7' : '#ea580c');
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 7);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = (tiny ? '6px' : '9px') + ' "Press Start 2P"';
      ctx.fillText(state.feverActive ? '🔥 FEVER MODE ACTIVE! 🔥' : `COMBO x${state.combo} (SPACE/CLICK SWITCH)`, canvas.width / 2, barY - 8);

      ctx.restore();
    }

    function drawOverlayScreens() {
      ctx.save();
      ctx.textAlign = 'center';

      if (state.gameState === 'START') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '18px "Press Start 2P"';
        ctx.fillText('ELEMENTAL FURY', canvas.width / 2, canvas.height / 2 - 80);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillText('CATCH MATCHING ICE & FIRE!', canvas.width / 2, canvas.height / 2 - 40);

        const pulse = 1 + Math.sin(state.time * 8) * 0.05;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2 + 30);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-160, -25, 320, 50, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillText('CLICK PLAY MATCH', 0, -3);
        ctx.fillText('TO START GAME', 0, 15);
        ctx.restore();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('CONTROLS: MOVE MOUSE / ARROWS', canvas.width / 2, canvas.height / 2 + 100);
        ctx.fillText('SPACE OR CLICK TO SWITCH MODE', canvas.width / 2, canvas.height / 2 + 120);

      } else if (state.gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ef4444';
        ctx.font = '24px "Press Start 2P"';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(`FINAL SCORE: ${toNaturalNumber(state.score, 0)}`, canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillText(`BEST COMBO: ${state.maxCombo}x`, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`HIGH SCORE: ${toNaturalNumber(state.highScore, 0)}`, canvas.width / 2, canvas.height / 2 + 30);

        // Rewards are shown for both Guest and logged-in players.
        ctx.fillStyle = '#22d3ee';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText(`XP EARNED: +${Number(state.lastXpGained || 0)}`, canvas.width / 2, canvas.height / 2 + 52);
        if (backendState.mode === 'Rank') {
          const rp = Number(state.lastRankPointsDelta || 0);
          ctx.fillStyle = rp >= 0 ? '#4ade80' : '#fb7185';
          ctx.fillText(`RANK POINTS: ${rp >= 0 ? '+' : ''}${rp}`, canvas.width / 2, canvas.height / 2 + 70);
          if (Number(state.lastChallengeXP || 0) > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(`DAILY BONUS: +${Number(state.lastChallengeXP)} XP`, canvas.width / 2, canvas.height / 2 + 88);
          }
        } else if (backendState.mode === 'Tournament') {
          ctx.fillStyle = '#f9a8d4';
          const trophyLabel = `TOURNAMENT TROPHY: +${Number(state.lastTournamentTrophy || 0)}`;
          ctx.fillText(trophyLabel, canvas.width / 2, canvas.height / 2 + 72);
          ctx.fillStyle = '#f9a8d4';
          ctx.font = '10px "Press Start 2P"';
          const shownTotalTrophy = state.tournamentRewardSynced
            ? Number(backendState.user?.tournamentTrophy || 0)
            : Number(backendState.user?.tournamentTrophy || 0) + Number(state.lastTournamentTrophy || 0);
          ctx.fillText(`TOTAL TROPHY: ${shownTotalTrophy}`, canvas.width / 2, canvas.height / 2 + 90);
        } else if (Number(state.lastChallengeXP || 0) > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`DAILY BONUS: +${Number(state.lastChallengeXP)} XP`, canvas.width / 2, canvas.height / 2 + 70);
        }

        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 120, canvas.height / 2 + (backendState.mode === 'Tournament' ? 126 : 112), 240, 45, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillText('CLICK PLAY MATCH TO RESTART', canvas.width / 2, canvas.height / 2 + (backendState.mode === 'Tournament' ? 153 : 139));
      }

      ctx.restore();
    }

    function updateGame() {
      if (state.isPausedForModal) return;

      if (state.gameState === 'PLAYING') state.time += 0.016;
      updateLiveHud();

      // Tournament score also grows with survival time.
      // This is additive to catch-based scoring; it does not replace gameplay scoring.
      if (backendState.mode === 'Tournament' && state.gameState === 'PLAYING') {
        const elapsedWholeSeconds = Math.floor(state.time);
        if (elapsedWholeSeconds > state.tournamentTimeScoreTick) {
          state.score += elapsedWholeSeconds - state.tournamentTimeScoreTick;
          state.tournamentTimeScoreTick = elapsedWholeSeconds;
        }
      }

      player.bob += 0.06;

      if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        player.x -= player.speed;
      }
      if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        player.x += player.speed;
      }
      player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x));

      if (state.feverActive) {
        state.feverTimer -= 0.016;
        state.feverGauge = (state.feverTimer / 6) * 100;
        if (state.feverTimer <= 0) {
          state.feverActive = false;
          state.feverGauge = 0;
        }
      }

      spawnTimer++;
      const difficultyScore = Math.min(2500, Math.max(0, Number(state.score || 0)));
      const diff=getDifficultyStage(difficultyScore);
      const currentSpawnRate=Math.max(18,Math.floor((55-Math.floor(difficultyScore/250))/diff.spawn));
      if (spawnTimer >= currentSpawnRate) {
        elements.push(new ElementItem());
        spawnTimer = 0;
      }

      for (let i = elements.length - 1; i >= 0; i--) {
        const item = elements[i];
        item.update();

        const dist = Math.hypot(item.x - player.x, item.y - player.y);
        if (dist < player.r + item.r) {
          if (state.gameState === 'PLAYING') {
            handleCatch(item);
          } else {
            createParticles(item.x, item.y, item.type === 'ice' ? '#38bdf8' : '#fb923c', 8);
          }
          elements.splice(i, 1);
          continue;
        }

        if (item.y > canvas.height + 40) {
          if (state.gameState === 'PLAYING' && item.type === player.mode && !state.feverActive) {
            state.combo = 0;
            state.feverGauge = Math.max(0, state.feverGauge - 10);
          }
          elements.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
      }
    }

    function handleCatch(item) {
      state.catches++;
      if (item.type === 'skull') {
        sound.playHurt();
        createParticles(item.x, item.y, '#22c55e', 18);
        state.wrongCatches++;
        state.lives--;
        syncLifeRegenState();
        state.combo = 0;
        state.feverGauge = 0;
        state.feverActive = false;

        if (state.lives <= 0) {
          endGame();
        }
        return;
      }

      const isMatch = item.type === player.mode;

      if (isMatch || state.feverActive) {
        state.correctCatches++;
        sound.playCatch(item.type === 'ice');
        const points = (state.feverActive ? 60 : 25) * (1 + Math.floor(state.combo / 5));
        state.score += points;
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;

        if (!state.feverActive) {
          state.feverGauge += 15;
          if (state.feverGauge >= state.maxFeverGauge) {
            state.feverActive = true;
            state.feverActivations++;
            state.feverTimer = 6;
            sound.playFever();
          }
        }

        createParticles(item.x, item.y, item.type === 'ice' ? '#38bdf8' : '#fb923c', 15);
      } else {
        state.wrongCatches++;
        sound.playHurt();
        createParticles(item.x, item.y, '#ef4444', 15);
        state.combo = 0;
        state.feverGauge = Math.max(0, state.feverGauge - 20);
        state.lives--;
        syncLifeRegenState();

        if (state.lives <= 0) {
          endGame();
        }
      }
    }

    function toggleElementMode() {
      player.mode = player.mode === 'ice' ? 'fire' : 'ice';
      createParticles(player.x, player.y, player.mode === 'ice' ? '#38bdf8' : '#fb923c', 12);
    }

    function showPauseUI() {
      const btn = document.getElementById('pauseBtn');
      if (btn) { btn.style.display = 'block'; btn.textContent = '⏸ Pause'; }
    }

    function hidePauseUI() {
      const btn = document.getElementById('pauseBtn');
      if (btn) btn.style.display = 'none';
    }

    function openPauseModal() {
      const modal = document.getElementById('pauseModal');
      if (modal) modal.style.display = 'flex';
    }

    function closePauseModal() {
      const modal = document.getElementById('pauseModal');
      if (modal) modal.style.display = 'none';
    }

    // When any normal UI button is clicked during a live match, freeze the game
    // in the background but let the clicked UI open immediately on top. When that
    // UI is closed/cancelled, the pause screen is restored so the player can Resume.
    let pauseBackgroundForOverlay = false;

    function pauseGameBehindOverlay() {
      if (state.gameState !== 'PLAYING') return;
      state.gameState = 'PAUSED';
      state.isPausedForModal = true;
      pauseBackgroundForOverlay = true;
      closePauseModal();
      showPauseUI();
      const btn = document.getElementById('pauseBtn');
      if (btn) btn.textContent = '▶ Resume';
    }

    function isVisibleOverlay(id) {
      const el = document.getElementById(id);
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.classList.contains('hidden');
    }

    function restoreBackgroundPauseScreenIfClosed() {
      if (!pauseBackgroundForOverlay || state.gameState !== 'PAUSED') return;
      const overlayOpen = ['matchSelector','settingsModal','howToPlayModal','accountModal','authModal']
        .some(isVisibleOverlay);
      if (!overlayOpen) {
        pauseBackgroundForOverlay = false;
        openPauseModal();
      }
    }

    document.addEventListener('click', function(e) {
      const btn = e.target.closest && e.target.closest('button,[role="button"]');
      if (!btn) return;
      if (btn.id === 'pauseBtn' || btn.id === 'fixedBackBtn') return;
      if (btn.closest('#pauseModal')) return;

      if (state.gameState === 'PLAYING') {
        pauseGameBehindOverlay();
      }

      // Let the button's own handler open its UI first. If it was a Cancel/Close
      // action, the check below will restore the Pause screen after the UI closes.
      setTimeout(restoreBackgroundPauseScreenIfClosed, 80);
    }, true);

    function togglePause() {
      if (state.gameState === 'PLAYING') {
        pauseBackgroundForOverlay = false;
        state.gameState = 'PAUSED';
        state.isPausedForModal = true;
        showPauseUI();
        const btn = document.getElementById('pauseBtn');
        if (btn) btn.textContent = '▶ Resume';
        openPauseModal();
      } else if (state.gameState === 'PAUSED') {
        resumeGame();
      }
    }

    function resumeGame() {
      if (state.gameState !== 'PAUSED') return;
      pauseBackgroundForOverlay = false;
      state.gameState = 'PLAYING';
      state.gameId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
      state.isPausedForModal = false;
      closePauseModal();
      showPauseUI();
      const btn = document.getElementById('pauseBtn');
      if (btn) btn.textContent = '⏸ Pause';
    }

    function restartPausedGame() {
      pauseBackgroundForOverlay = false;
      closePauseModal();
      state.isPausedForModal = false;
      startGame();
    }

    function openSettingsFromPause() {
      closePauseModal();
      openSettings();
    }

    function openInfoFromPause() {
      closePauseModal();
      toggleHowToPlayModal(true);
    }

    function openAccountFromPause() {
      closePauseModal();
      if (backendState.user) openAccount('profile');
      else openAuth();
    }

    function quitToMenu() {
      pauseBackgroundForOverlay = false;
      closePauseModal();
      state.gameState = 'START';
      state.isPausedForModal = false;
      elements = [];
      particles = [];
      state.score = 0;
      state.time = 0;
      state.lives = state.maxLives;
      syncLifeRegenState();
      state.combo = 0;
      state.maxCombo = 0;
      state.catches = 0;
      state.correctCatches = 0;
      state.wrongCatches = 0;
      state.feverActivations = 0;
      state.feverGauge = 0;
      state.feverActive = false;
      updateLiveHud();
      hidePauseUI();
      goHome();
    }

    function startGame() {
      if (backendState.mode === 'Rank') {
        const rankMatches = backendState.user ? Number(backendState.dailyRankMatches || 0) : getGuestProgress().dailyRankMatches;
        const rankLimit = backendState.user ? getDailyRankMatchLimit(backendState.user.rank || 'Bronze I') : getDailyRankMatchLimit(getGuestProgress().rank || 'Bronze I');
        if (rankMatches >= rankLimit) {
          showBackendMessage(t('dailyLimit'), true);
          return;
        }
      }

      sound.init();
      state.gameState = 'PLAYING';
      state.isPausedForModal = false;
      hidePauseUI();
      state.score = 0;
      state.tournamentTimeScoreTick = 0;
      state.lives = state.maxLives;
      syncLifeRegenState();
      state.combo = 0;
      state.maxCombo = 0;
      state.catches = 0;
      state.correctCatches = 0;
      state.wrongCatches = 0;
      state.feverActivations = 0;
      state.feverGauge = 0;
      state.feverActive = false;
      state.lastXpGained = 0;
      state.lastChallengeXP = 0;
      state.lastRankPointsDelta = 0;
      state.lastRankWon = false;
      state.lastRankPromoted = false;
      state.lastRankDemoted = false;
      state.lastTournamentTrophy = 0;
      state.tournamentRewardPending = false;
      elements = [];
      particles = [];
      player.x = canvas.width / 2;
      showPauseUI();
    }

    function endGame() {
      state.gameState = 'GAMEOVER';
      state.isPausedForModal = false;
      // Capture the exact match reward before the backend/profile refresh can replace any state.
      state.lastXpGained = calculateMatchXP(Number(state.score || 0), backendState.mode, state);
      state.lastRankPointsDelta = backendState.mode === 'Rank'
        ? Math.round(calculatePerformanceRankPoints(Number(state.score || 0), Number(state.maxCombo || 0), Number(state.correctCatches || 0), Number(state.wrongCatches || 0), 'Rank') * getRewardMultiplier())
        : 0;
      state.lastTournamentTrophy = backendState.mode === 'Tournament' ? toNaturalNumber(Math.floor(Math.max(0, Number(state.score || 0)) * 0.5), 0) : 0;
      state.tournamentRewardPending = false;
      state.tournamentRewardSynced = false;
      hidePauseUI();
      closePauseModal();
      if (state.score > state.highScore) {
       highScore = Math.max(0, Math.floor(Number(highScore) || 0));
       localStorage.setItem("highScore", highScore);
      }
      updateLiveHud();
      syncGameResult();
    }

    // Any game-interface button click while playing acts like Pause.
    // The current game frame stays visible in the background.
    document.addEventListener('click', function(e) {
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      if (state.gameState !== 'PLAYING') return;
      if (btn.id === 'pauseBtn' || btn.id === 'fixedBackBtn') return;
      if (btn.closest('#pauseModal')) return;
      togglePause();
    }, true);

    function gameLoop() {
      updateLifeRenewal();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawBackground();

      elements.forEach(item => item.draw());
      particles.forEach(p => p.draw());

      drawPlayer();
      drawHUD();

      if (state.gameState === 'PLAYING') updateGame();

      drawOverlayScreens();

      requestAnimationFrame(gameLoop);
    }

    window.addEventListener('resize', resizeCanvas);

    window.addEventListener('keydown', (e) => {
      if (state.isPausedForModal) return;
      keys[e.key] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.gameState === 'START' || state.gameState === 'GAMEOVER') {
          // Treat Space as clicking Play Match: open the match selector, but do not start a game directly.
          openMatchSelector();
        } else if (state.gameState === 'PLAYING') {
          toggleElementMode();
        }
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (state.gameState === 'PLAYING' || state.gameState === 'PAUSED') togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (state.isPausedForModal) return;
      const rect = canvas.getBoundingClientRect();
      player.x = e.clientX - rect.left;
    });

    canvas.addEventListener('touchmove', (e) => {
      if (state.isPausedForModal || !e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      player.x = e.touches[0].clientX - rect.left;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('click', () => {
      if (state.isPausedForModal) return;
      if (state.gameState === 'PLAYING') toggleElementMode();
    });


