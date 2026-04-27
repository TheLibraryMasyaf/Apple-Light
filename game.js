(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const levelText = document.getElementById('levelText');
  const lightText = document.getElementById('lightText');
  const levelTimerText = document.getElementById('levelTimerText');
  const totalTimerText = document.getElementById('totalTimerText');
  const tipText = document.getElementById('tipText');
  const resetBtn = document.getElementById('resetBtn');

  const WORLD = {
    width: 960,
    height: 540,
    gravity: 2200,
  };

  const PLAYER = {
    w: 28,
    h: 60,
    moveSpeed: 300,
    jumpSpeed: 920,
    climbSpeed: 220,
  };

  const TOTAL_NORMAL_LEVELS = 31;
  const TOTAL_LEVELS = 32;
  const morseTarget31 = '.- .--. .--. .-.. . .-.. .. --. .... -'.replace(/\s+/g, '') + '.-';

  const keys = {
    a: false,
    d: false,
    w: false,
    s: false,
    space: false,
    f: false,
  };

  const state = {
    currentLevelIndex: 0,
    levels: [],
    cameraX: 0,
    cameraY: 0,
    totalTime: 0,
    levelTime: 0,
    clearStates: Array(TOTAL_NORMAL_LEVELS).fill(null),
    hiddenUnlocked: false,
    gameEnded: false,
    rewardUnlocked: false,
    player: {
      x: 80,
      y: 0,
      vx: 0,
      vy: 0,
      onGround: false,
      onLadder: false,
      justJumped: false,
      facing: 1,
    },
    nearSwitch: null,
    shouldJump: false,
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rectIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function makeBaseLevel(i) {
    const levelNum = i + 1;
    const baseY = 1080;
    const fixed = [
      { x: 0, y: baseY, w: WORLD.width, h: 120 },
      { x: 260, y: 900, w: 170, h: 24 },
      { x: 640, y: 740, w: 180, h: 24 },
      { x: 1120, y: 560, w: 190, h: 24 },
      { x: 1650, y: 760, w: 190, h: 24 },
      { x: 2140, y: 560, w: 220, h: 24 },
      { x: 2490, y: 360, w: 220, h: 24 },
    ];

    const offset = (i % 5) * 18;
    const bright = [
      { x: 420, y: 860 - offset, w: 130, h: 20 },
      { x: 860, y: 680 + offset, w: 150, h: 20 },
      { x: 1400, y: 520 - offset, w: 160, h: 20 },
      { x: 1880, y: 640 + offset, w: 170, h: 20 },
      { x: 2360, y: 480 - offset, w: 150, h: 20 },
      // 明态终点前路径
      { x: 2590, y: 300, w: 95, h: 18 },
    ];

    const dark = [
      { x: 420, y: 940 + offset, w: 140, h: 20 },
      { x: 900, y: 820 - offset, w: 140, h: 20 },
      { x: 1380, y: 700 + offset, w: 170, h: 20 },
      { x: 1860, y: 520 - offset, w: 170, h: 20 },
      { x: 2330, y: 660 + offset, w: 140, h: 20 },
      // 暗态终点前路径
      { x: 2588, y: 430, w: 105, h: 18 },
    ];

    const switches = [
      { x: 320, y: 860, w: 20, h: 40 },
      { x: 700, y: 700, w: 20, h: 40 },
      { x: 1170, y: 520, w: 20, h: 40 },
      { x: 1700, y: 720, w: 20, h: 40 },
      { x: 2200, y: 520, w: 20, h: 40 },
    ];

    // 两条通路并行可达，保证可在明或暗结束关卡
    fixed.push({ x: 2460, y: 520, w: 80, h: 24 });
    fixed.push({ x: 2460, y: 300, w: 80, h: 24 });

    const ladders = [];
    if (levelNum >= 11) {
      ladders.push({ x: 1196, y: 560, w: 20, h: 340 });
      if (levelNum >= 16) {
        ladders.push({ x: 2175, y: 560, w: 20, h: 520 });
      }
    }

    const movingPlatforms = [];
    if (levelNum >= 21) {
      movingPlatforms.push({
        x: 1520,
        y: 640,
        w: 120,
        h: 20,
        minX: 1460,
        maxX: 1730,
        speed: 70 + (i % 3) * 18,
        dir: 1,
      });
      movingPlatforms.push({
        x: 2050,
        y: 450,
        w: 120,
        h: 20,
        minX: 1990,
        maxX: 2280,
        speed: 85 + (i % 4) * 15,
        dir: -1,
      });
    }

    // 逐步提高地形变化
    if (levelNum >= 6) {
      fixed.push({ x: 260, y: 320 + (i % 2) * 20, w: 80, h: 18 });
    }
    if (levelNum >= 14) {
      bright.push({ x: 450, y: 160, w: 85, h: 16 });
      dark.push({ x: 440, y: 380, w: 95, h: 16 });
    }
    if (levelNum >= 25) {
      bright.push({ x: 720, y: 140, w: 80, h: 16 });
      dark.push({ x: 710, y: 400, w: 90, h: 16 });
    }

    return {
      id: levelNum,
      name: `关卡 ${levelNum}`,
      start: { x: 60, y: 380 },
      lightState: i % 2 === 0 ? 'bright' : 'dark',
      fixed,
      bright,
      dark,
      switches,
      ladders,
      movingPlatforms,
      exit: { x: 900, y: 180, w: 36, h: 50 },
      hint: levelNum < 11
        ? 'A/D 移动，空格跳跃，F 键触发开关。'
        : levelNum < 21
          ? '本阶段加入梯子：W/S 可爬下梯子。'
          : '本阶段加入移动平台：注意时机与切换节奏。',
    };
  }

  function makeHiddenLevel() {
    return {
      id: 32,
      name: '隐藏关',
      start: { x: 60, y: 380 },
      lightState: 'dark',
      fixed: [{ x: 0, y: 450, w: WORLD.width, h: 90 }],
      bright: [],
      dark: [],
      switches: [],
      ladders: [],
      movingPlatforms: [],
      exit: { x: 900, y: 380, w: 36, h: 50 },
      hint: '隐藏关：沿底部平台前进至终点，获得最终奖励。',
      isHidden: true,
    };
  }

  function buildLevels() {
    state.levels = [];
    for (let i = 0; i < TOTAL_NORMAL_LEVELS; i += 1) {
      state.levels.push(makeBaseLevel(i));
    }
    state.levels.push(makeHiddenLevel());
  }

  function currentLevel() {
    return state.levels[state.currentLevelIndex];
  }

  function resetPlayer(level) {
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.onLadder = false;
    state.player.justJumped = false;
  }

  function resetLevel() {
    const level = currentLevel();
    state.levelTime = 0;
    level.lightState = level.id % 2 === 0 ? 'dark' : 'bright';
    if (level.isHidden) {
      level.lightState = 'dark';
    }
    resetPlayer(level);
    tipText.textContent = level.hint;
  }

  function onSwitchTouched() {
    const level = currentLevel();
    level.lightState = level.lightState === 'bright' ? 'dark' : 'bright';
  }

  function levelPlatforms(level) {
    const dynamic = level.lightState === 'bright' ? level.bright : level.dark;
    return [...level.fixed, ...dynamic, ...level.movingPlatforms];
  }

  function updateMovingPlatforms(level, dt) {
    for (const m of level.movingPlatforms) {
      m.x += m.speed * m.dir * dt;
      if (m.x <= m.minX) {
        m.x = m.minX;
        m.dir = 1;
      } else if (m.x >= m.maxX) {
        m.x = m.maxX;
        m.dir = -1;
      }
    }
  }

  function handleInput(dt) {
    const p = state.player;
    const move = (keys.a ? -1 : 0) + (keys.d ? 1 : 0);

    if (move !== 0) {
      p.facing = move;
    }

    p.vx = move * PLAYER.moveSpeed;

    if (p.onLadder) {
      p.vy = 0;
      if (keys.w) p.vy = -PLAYER.climbSpeed;
      if (keys.s) p.vy = PLAYER.climbSpeed;
    } else {
      p.vy += WORLD.gravity * dt;
      p.vy = Math.min(p.vy, 1400);
    }
  }

  function jump() {
    const p = state.player;
    if (state.gameEnded) return;
    // 跳跃现在在 onKey 中直接处理，此函数保留以备后用
  }

  function checkLadders(level) {
    const pRect = { x: state.player.x, y: state.player.y, w: PLAYER.w, h: PLAYER.h };
    let touchingLadder = false;
    for (const l of level.ladders) {
      if (rectIntersect(pRect, l)) {
        touchingLadder = true;
        break;
      }
    }
    const p = state.player;
    if (touchingLadder && (keys.w || keys.s)) {
      p.onLadder = true;
      p.vy = 0;
    }
    if (!touchingLadder) {
      p.onLadder = false;
    }
  }

  function moveAndCollide(level, dt) {
    const p = state.player;
    const solids = levelPlatforms(level);

    // X
    p.x += p.vx * dt;
    let pRect = { x: p.x, y: p.y, w: PLAYER.w, h: PLAYER.h };
    for (const s of solids) {
      if (rectIntersect(pRect, s)) {
        if (p.vx > 0) {
          p.x = s.x - PLAYER.w;
        } else if (p.vx < 0) {
          p.x = s.x + s.w;
        }
        pRect.x = p.x;
      }
    }

    // Y
    p.y += p.vy * dt;
    p.onGround = false;
    pRect = { x: p.x, y: p.y, w: PLAYER.w, h: PLAYER.h };

    for (const s of solids) {
      if (rectIntersect(pRect, s)) {
        if (p.vy > 0) {
          p.y = s.y - PLAYER.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = s.y + s.h;
          p.vy = 20;
        }
        pRect.y = p.y;
      }
    }

    p.x = clamp(p.x, 0, WORLD.width - PLAYER.w);
    p.y = clamp(p.y, 0, WORLD.height - PLAYER.h);
  }

  function updateSwitches(level) {
    const pRect = { x: state.player.x, y: state.player.y, w: PLAYER.w, h: PLAYER.h };
    let nearSwitch = null;
    for (const sw of level.switches) {
      if (rectIntersect(pRect, { x: sw.x - 20, y: sw.y - 20, w: sw.w + 40, h: sw.h + 40 })) {
        nearSwitch = sw;
        if (keys.f) {
          level.lightState = level.lightState === 'bright' ? 'dark' : 'bright';
          keys.f = false; // 消耗按键，不连续触发
        }
        break;
      }
    }
    state.nearSwitch = nearSwitch;
  }

  function checkExit(level) {
    const pRect = { x: state.player.x, y: state.player.y, w: PLAYER.w, h: PLAYER.h };
    if (!rectIntersect(pRect, level.exit)) return;

    const light = level.lightState;
    if (!level.isHidden) {
      state.clearStates[state.currentLevelIndex] = light;
    }

    if (!level.isHidden && state.currentLevelIndex < TOTAL_NORMAL_LEVELS - 1) {
      state.currentLevelIndex += 1;
      resetLevel();
      return;
    }

    if (!level.isHidden && state.currentLevelIndex === TOTAL_NORMAL_LEVELS - 1) {
      state.hiddenUnlocked = canUnlockHidden();
      if (state.hiddenUnlocked) {
        tipText.textContent = '已解锁隐藏关！继续前进至第 32 关。';
        state.currentLevelIndex = 31;
        resetLevel();
      } else {
        state.gameEnded = true;
        tipText.textContent = '普通结局：31 关完成。未满足隐藏关解锁条件，可重试追求隐藏关。';
      }
      return;
    }

    if (level.isHidden) {
      state.rewardUnlocked = true;
      state.gameEnded = true;
      tipText.textContent = '隐藏关完成！你获得了“背景中的灯”奖励。';
    }
  }

  function canUnlockHidden() {
    const all = state.clearStates;
    if (all.some((v) => v === null)) return false;
    const seq31 = all.map((s) => (s === 'bright' ? '.' : '-')).join('');
    return seq31 === morseTarget31;
  }

  function updateCamera() {
    // 单屏显示，不需要摄像头移动
    state.cameraX = 0;
    state.cameraY = 0;
  }

  function updateHud() {
    const level = currentLevel();
    const maxLevel = level.isHidden ? TOTAL_LEVELS : TOTAL_NORMAL_LEVELS;
    levelText.textContent = `${level.id}/${maxLevel}`;
    lightText.textContent = level.lightState === 'bright' ? '明' : '暗';
    levelTimerText.textContent = `${state.levelTime.toFixed(1)}s`;
    totalTimerText.textContent = `${state.totalTime.toFixed(1)}s`;
  }

  function drawRect(r, fill, stroke = null) {
    ctx.fillStyle = fill;
    ctx.fillRect(r.x - state.cameraX, r.y - state.cameraY, r.w, r.h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - state.cameraX, r.y - state.cameraY, r.w, r.h);
    }
  }

  function drawStickman() {
    const p = state.player;
    const level = currentLevel();
    const x = p.x - state.cameraX;
    const y = p.y - state.cameraY;
    const c = level.lightState === 'bright' ? '#000' : '#fff';

    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = 3;

    // 头
    ctx.beginPath();
    ctx.arc(x + PLAYER.w / 2, y + 12, 8, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.beginPath();
    ctx.moveTo(x + PLAYER.w / 2, y + 20);
    ctx.lineTo(x + PLAYER.w / 2, y + 42);
    ctx.stroke();

    // 手
    const handSwing = p.onGround ? (Math.sin(performance.now() * 0.02) * 5) : 0;
    ctx.beginPath();
    ctx.moveTo(x + PLAYER.w / 2, y + 28);
    ctx.lineTo(x + PLAYER.w / 2 - 10 - handSwing, y + 34);
    ctx.moveTo(x + PLAYER.w / 2, y + 28);
    ctx.lineTo(x + PLAYER.w / 2 + 10 + handSwing, y + 34);
    ctx.stroke();

    // 腿
    ctx.beginPath();
    ctx.moveTo(x + PLAYER.w / 2, y + 42);
    ctx.lineTo(x + PLAYER.w / 2 - 9, y + 58);
    ctx.moveTo(x + PLAYER.w / 2, y + 42);
    ctx.lineTo(x + PLAYER.w / 2 + 9, y + 58);
    ctx.stroke();
  }

  function drawLamp(level) {
    const lamp = { x: 400, y: 20, w: 100, h: 100 };
    const cx = lamp.x - state.cameraX + lamp.w / 2;
    const cy = lamp.y - state.cameraY + lamp.h / 2;
    const isBright = level.lightState === 'bright' || state.rewardUnlocked;

    ctx.save();
    if (isBright) {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 200, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = isBright ? '#000' : '#333';
    ctx.fillRect(lamp.x - state.cameraX, lamp.y - state.cameraY, lamp.w, lamp.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(lamp.x - state.cameraX, lamp.y - state.cameraY, lamp.w, lamp.h);

    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = isBright ? '#fff' : '#555';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }

  function drawExit(level) {
    const e = level.exit;
    const isBright = level.lightState === 'bright';
    drawRect(e, isBright ? '#000' : '#fff', '#fff');
    ctx.fillStyle = isBright ? '#fff' : '#000';
    ctx.font = '16px Consolas';
    ctx.fillText('EXIT', e.x - state.cameraX - 4, e.y - state.cameraY - 8);
  }

  function drawLevel() {
    const level = currentLevel();
    const isBright = level.lightState === 'bright';

    // 背景
    ctx.fillStyle = isBright ? '#fff' : '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawLamp(level);

    // 固定平台
    for (const f of level.fixed) {
      drawRect(f, isBright ? '#000' : '#fff', '#fff');
    }

    // 明暗平台
    for (const b of level.bright) {
      const active = isBright;
      if (active) {
        drawRect(b, '#000', '#fff');
      } else {
        drawRect(b, '#1a1a1a', '#555');
      }
    }
    for (const d of level.dark) {
      const active = !isBright;
      if (active) {
        drawRect(d, '#fff', '#fff');
      } else {
        drawRect(d, '#222', '#555');
      }
    }

    // 移动平台
    for (const m of level.movingPlatforms) {
      drawRect(m, isBright ? '#000' : '#fff', '#fff');
    }

    // 梯子
    for (const l of level.ladders) {
      drawRect(l, isBright ? '#000' : '#fff', '#fff');
      for (let y = l.y + 6; y < l.y + l.h; y += 16) {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(l.x - state.cameraX, y - state.cameraY);
        ctx.lineTo(l.x + l.w - state.cameraX, y - state.cameraY);
        ctx.stroke();
      }
    }

    // 开关
    for (const sw of level.switches) {
      drawRect(sw, isBright ? '#000' : '#fff', '#fff');
      ctx.fillStyle = isBright ? '#fff' : '#000';
      ctx.beginPath();
      ctx.arc(sw.x + sw.w / 2 - state.cameraX, sw.y + 10 - state.cameraY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    drawExit(level);
    drawStickman();

    if (state.gameEnded) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(120, 160, 720, 220);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.strokeRect(120, 160, 720, 220);
      ctx.fillStyle = '#fff';
      ctx.font = '26px Consolas';
      if (state.rewardUnlocked) {
        ctx.fillText('隐藏结局达成：获得背景中的灯', 150, 250);
      } else {
        ctx.fillText('普通结局：31关通关完成', 220, 250);
      }
      ctx.font = '18px Consolas';
      ctx.fillText('点击"重置本关"可继续尝试', 310, 300);
    }
  }

  function update(dt) {
    if (state.gameEnded) {
      updateHud();
      return;
    }

    const level = currentLevel();

    state.totalTime += dt;
    state.levelTime += dt;

    updateMovingPlatforms(level, dt);
    checkLadders(level);
    handleInput(dt);
    moveAndCollide(level, dt);
    jump();
    updateSwitches(level);
    checkExit(level);
    updateCamera();
    updateHud();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    update(dt);
    drawLevel();
    requestAnimationFrame(loop);
  }

  function onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'a') keys.a = down;
    if (k === 'd') keys.d = down;
    if (k === 'w') keys.w = down;
    if (k === 's') keys.s = down;
    if (k === ' ') {
      if (down) {
        // 直接在keydown时执行跳跃
        const p = state.player;
        if (!state.gameEnded && (p.onGround || p.onLadder)) {
          console.log('JUMP NOW');
          p.vy = -PLAYER.jumpSpeed;
          p.onGround = false;
          p.onLadder = false;
        }
      }
      e.preventDefault();
    }
    if (k === 'f') keys.f = down;
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  resetBtn.addEventListener('click', () => {
    state.gameEnded = false;
    if (!state.hiddenUnlocked && state.currentLevelIndex === 31) {
      state.currentLevelIndex = 0;
      state.clearStates = Array(TOTAL_NORMAL_LEVELS).fill(null);
      state.totalTime = 0;
    }
    resetLevel();
  });

  buildLevels();
  resetLevel();
  requestAnimationFrame(loop);
})();
