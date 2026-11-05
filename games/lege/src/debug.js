// 调试 / 自动化测试钩子：window.__ANIME_STACK__.debug
// 只读取状态或调用与玩家点击完全相同的入口 (scene.tryPick)，不绕过游戏规则。
import { greedyPick, simulate } from './systems/Solver.js';
import { GameConfig } from './config/GameConfig.js';
import { SfxEngine, SFX_LIST } from './systems/SfxEngine.js';
import { AudioConfig } from './config/AudioConfig.js';

export function installDebug(game) {
  const scene = () => (game.scenes.currentName === 'game' ? game.scenes.current : null);
  const center = (c) => ({ x: c.x + GameConfig.card.size / 2, y: c.y + GameConfig.card.size / 2 });
  game.debug = {
    scene,
    state() {
      const s = scene();
      if (!s) return { scene: game.scenes.currentName };
      return {
        scene: 'game',
        level: s.levelId,
        fsm: s.fsm.name,
        remaining: s.board.remaining,
        total: s.board.total,
        slot: s.slot.types,
        slotCount: s.slot.count,
        free: s.board.freeCards.length,
        props: { ...s.props.uses },
        busy: s.tweens.count > 0 || s.match.busy,
        temp: s.board.cards.filter((c) => c.state === 'board' && c.zone === 'temp').length,
      };
    },
    /** 贪心策略的下一步：返回卡牌中心点 (逻辑坐标) */
    hint() {
      const s = scene();
      if (!s) return null;
      const free = s.board.freeCards.filter((c) => c.state === 'board' && !c.flying);
      const c = greedyPick(free, s.slot.types);
      return c ? { id: c.id, type: c.type, ...center(c) } : null;
    },
    /** 选一张"不会凑成三张"的可点击卡 (用于测试填满卡槽) */
    nonMatchingFree() {
      const s = scene();
      if (!s) return null;
      const free = s.board.freeCards.filter((c) => c.state === 'board' && !c.flying && c.zone !== 'temp');
      const types = s.slot.types;
      const c = free.find((f) => types.filter((t) => t === f.type).length === 0) || free.find((f) => types.filter((t) => t === f.type).length < 2);
      return c ? { id: c.id, type: c.type, ...center(c) } : null;
    },
    /** 找一张被压住的卡，以及它身上"没被别的卡挡住"的一个可见点 (若存在) */
    coveredCard() {
      const s = scene();
      if (!s) return null;
      const size = GameConfig.card.size;
      for (const c of s.board.cards) {
        if (c.state !== 'board' || c.free) continue;
        for (let dy = 4; dy < size; dy += 6) {
          for (let dx = 4; dx < size; dx += 6) {
            const p = { x: c.x + dx, y: c.y + dy };
            const top = s.board.topAt(p);
            if (top === c) return { id: c.id, x: p.x, y: p.y, coveredBy: s.board.cover.coveringOf(c, s.board.cards).length };
          }
        }
      }
      return null;
    },
    cardById(id) {
      const s = scene();
      const c = s && s.board.cards.find((x) => x.id === id);
      return c ? { id: c.id, state: c.state, free: c.free, type: c.type, zone: c.zone, ...center(c) } : null;
    },
    /** 直接调用点击入口 (与真实点击同一逻辑，含遮挡判定) */
    tryPick(id) {
      const s = scene();
      const c = s && s.board.cards.find((x) => x.id === id);
      return c ? s.tryPick(c) : false;
    },
    /** 校验当前关卡的参考解 */
    verifyReference() {
      const s = scene();
      return s ? simulate(s.generated.cards, s.generated.solution) : null;
    },
    generatedStats() {
      const s = scene();
      return s ? s.generated.stats : null;
    },
    /** 参考解中尚未取走的卡 id (按顺序) */
    referenceOrder() {
      const s = scene();
      if (!s) return [];
      // 洗过牌后，参考解换成洗牌时求出的那条路线
      const sol = s.props.lastShuffle && s.props.lastShuffle.order ? s.props.lastShuffle.order : s.generated.solution;
      return sol.filter((id) => s.board.cards[id].state === 'board');
    },
    lastShuffle() {
      const s = scene();
      return s && s.props.lastShuffle ? { ok: s.props.lastShuffle.ok, tries: s.props.lastShuffle.tries } : null;
    },
    /** 当前局面是否仍有解 (用参考解从当前状态继续模拟) */
    stillSolvable() {
      const s = scene();
      if (!s) return null;
      const live = s.board.onBoard;
      const ids = this.referenceOrder();
      const idx = new Map(live.map((c, i) => [c.id, i]));
      const cards = live.map((c) => ({ x: c.home.x, y: c.home.y, layer: c.home.layer, type: c.type }));
      return simulate(cards, ids.map((id) => idx.get(id)), GameConfig.card.size, s.slot.types).ok;
    },
    /** 当前可点的按钮 (弹窗 / 广告 / HUD / 菜单 / 结算) 的标签与位置 */
    buttons() {
      const cur = game.scenes.current;
      if (!cur) return [];
      return cur.activeButtons().filter((b) => b.visible !== false).map((b) => ({ label: b.label, x: b.x, y: b.y, w: b.w, key: b.key || null, badge: b.badge }));
    },
    /** 音频状态：最近播放的音效、当前 BGM、开关与音量、心跳紧张度 */
    audioState() {
      const a = game.audio;
      const m = game.mixer;
      return {
        ctx: a.ctx ? a.ctx.state : null, muted: m.muted, master: m.get('master'),
        sfxOn: m.isOn('sfx'), sfxVol: m.get('sfx'), bgmOn: m.isOn('bgm'), bgmVol: m.get('bgm'),
        voiceOn: m.isOn('voice'), voiceVol: m.get('voice'), voiceGain: m.gain('voice'), tension: a.tension,
        music: game.music.playing, musicWant: game.music.want, bgm: game.music.state(), log: a.playLog.slice(-30),
        sfxGain: a.bus ? a.bus.gain.value : null, sfxTarget: m.gain('sfx'), bgmGain: m.gain('bgm'),
        voice: { last: game.voice.lastPlay, history: game.voice.history.slice(-10), playing: game.voice.isPlaying() },
      };
    },
    /** 离线渲染一个音效 (OfflineAudioContext)，返回 base64 的 float32 双声道交错 PCM (tools/measure_audio.mjs 用) */
    async renderSfx(name, opts = {}, seconds = 2.5) {
      const off = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
      const eng = new SfxEngine(off, off.destination, { reverbSeconds: AudioConfig.reverb.seconds, reverbSend: AudioConfig.reverb.send });
      eng.play(name, opts);
      const buf = await off.startRendering();
      const L = buf.getChannelData(0); const R = buf.getChannelData(1);
      const inter = new Float32Array(L.length * 2);
      for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
      const bytes = new Uint8Array(inter.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    sfxNames() { return Object.keys(SFX_LIST); },
    save() { return JSON.parse(JSON.stringify(game.save.data)); },
    /** 测试/截图用：直接设置解锁进度与星级 */
    setProgress({ unlocked = 1, stars = {} } = {}) {
      game.save.data.unlocked = unlocked;
      game.save.data.seenUnlocked = unlocked;
      for (const [k, v] of Object.entries(stars)) { game.save.data.stars[k] = v; game.save.data.cleared[k] = true; }
      game.save.flush();
    },
    /** 选关地图节点位置 */
    levelNodes() {
      const cur = game.scenes.current;
      if (!cur || cur.name !== 'levels') return [];
      return cur.nodes.map((n) => ({ id: n.level.id, x: n.x, y: n.y, unlocked: cur.isUnlocked(n.level.id) }));
    },
    boardTypes() {
      const s = scene();
      return s ? s.board.cards.filter((c) => c.state === 'board').map((c) => c.type) : [];
    },
  };
}
