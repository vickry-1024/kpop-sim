/**
 * 视觉氛围模块 — 根据游戏状态动态调整CSS类
 * 负责：body级主题类切换、数值联动氛围效果
 * 阶段11：视觉打磨
 */

Game.Visual = (function() {

  // 缓存的阈值状态，避免每个操作都遍历
  var _cachedState = {
    secretMode: false,
    suspicionHigh: false,
    suspicionCritical: false,
    stressHigh: false,
    stressCritical: false,
    affectionWarm: false
  };

  // 是否偏好减少动画
  var _prefersReducedMotion = false;

  // 阈值常量
  var THRESHOLDS = {
    AFFECTION_WARM: 80,
    SUSPICION_HIGH: 60,
    SUSPICION_CRITICAL: 80,
    STRESS_HIGH: 70,
    STRESS_CRITICAL: 90
  };

  /**
   * 初始化：检测motion偏好，挂载事件监听
   */
  function init() {
    // 检测 prefers-reduced-motion
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    _prefersReducedMotion = mq.matches;
    mq.addEventListener('change', function(e) {
      _prefersReducedMotion = e.matches;
    });

    // 简单的性能检测：老旧设备关闭复杂特效
    _detectLowPerformance();

    console.log('[Visual] 视觉氛围模块初始化完成');
  }

  /**
   * 核心方法：读取当前游戏状态，同步设置body类
   * 在所有数值变化后调用（行动执行、回合结束、存档读取后）
   */
  function refreshAtmosphere() {
    if (!Game.state || !Game.state.initialized) return;

    var player = Game.state.player;
    if (!player || !player.stats) return;

    var stats = player.stats;
    var idols = Game.state.idols || [];

    // 1. 检查最佳好感度（任意一个爱豆好感度>80即触发）
    var bestAffection = 0;
    for (var i = 0; i < idols.length; i++) {
      var aff = idols[i].stats ? (idols[i].stats.affection || 0) : 0;
      if (aff > bestAffection) bestAffection = aff;
    }
    var affectionWarm = bestAffection > THRESHOLDS.AFFECTION_WARM;

    // 2. 检查嫌疑度
    var suspicion = stats.suspicion || 0;
    var suspicionHigh = suspicion > THRESHOLDS.SUSPICION_HIGH;
    var suspicionCritical = suspicion > THRESHOLDS.SUSPICION_CRITICAL;

    // 3. 检查压力值
    var stress = stats.stress || 0;
    var stressHigh = stress > THRESHOLDS.STRESS_HIGH;
    var stressCritical = stress > THRESHOLDS.STRESS_CRITICAL;

    // 4. 检查秘密模式（仅当在手机页面时应用）
    var currentPage = '';
    if (Game.Router && typeof Game.Router.getCurrentPage === 'function') {
      currentPage = Game.Router.getCurrentPage();
    }

    var secretMode = false;
    if (currentPage === 'phone') {
      if (Game.Phone && typeof Game.Phone.getPhoneType === 'function') {
        secretMode = Game.Phone.getPhoneType() === 'secret';
      }
    }

    // 只更新发生变化的class（避免不必要的repaint）
    _toggleClass('affection-warm', affectionWarm, _cachedState.affectionWarm);
    _toggleClass('suspicion-high', suspicionHigh, _cachedState.suspicionHigh);
    _toggleClass('suspicion-critical', suspicionCritical, _cachedState.suspicionCritical);
    _toggleClass('stress-high', stressHigh, _cachedState.stressHigh);
    _toggleClass('stress-critical', stressCritical, _cachedState.stressCritical);
    _toggleClass('secret-mode', secretMode, _cachedState.secretMode);

    // 更新缓存
    _cachedState.affectionWarm = affectionWarm;
    _cachedState.suspicionHigh = suspicionHigh;
    _cachedState.suspicionCritical = suspicionCritical;
    _cachedState.stressHigh = stressHigh;
    _cachedState.stressCritical = stressCritical;
    _cachedState.secretMode = secretMode;

    // 5. 更新 theme-color meta 标签
    _updateThemeColor(secretMode, suspicionHigh, suspicionCritical);
  }

  /**
   * 切换body上的CSS类（仅在状态变化时操作DOM）
   */
  function _toggleClass(className, newState, oldState) {
    if (newState === oldState) return;
    if (newState) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
  }

  /**
   * 更新 theme-color meta 标签（浏览器顶部状态栏颜色）
   */
  function _updateThemeColor(secretMode, suspicionHigh, suspicionCritical) {
    var el = document.getElementById('meta-theme-color');
    if (!el) return;

    if (suspicionCritical) {
      el.setAttribute('content', '#FF4757');  // 极危 — 红色
    } else if (suspicionHigh) {
      el.setAttribute('content', '#FFA502');  // 警告 — 橙色
    } else if (secretMode) {
      el.setAttribute('content', '#1A1A2E');  // 秘密模式 — 深色
    } else {
      el.setAttribute('content', '#FFFAFA');  // 默认 — 奶油白
    }
  }

  /**
   * 压力>90时触发一次性屏幕抖动效果
   * 在回合结束时调用
   */
  function triggerStressShake() {
    if (_prefersReducedMotion) return;
    var appEl = document.getElementById('app');
    if (!appEl) return;

    // 强制重启动画
    appEl.style.animation = 'none';
    appEl.offsetHeight; // force reflow
    appEl.style.animation = 'stressShake 0.5s ease-in-out';
  }

  /**
   * 获取 motion 偏好
   */
  function prefersReducedMotion() {
    return _prefersReducedMotion;
  }

  /**
   * 简单性能检测：如果设备太老旧，关闭复杂特效
   */
  function _detectLowPerformance() {
    // 仅在支持 performance.now 的环境下检测
    if (typeof performance === 'undefined' || !performance.now) return;

    var start = performance.now();
    var sum = 0;
    for (var i = 0; i < 50000; i++) {
      sum += i;
    }
    var duration = performance.now() - start;
    // 超过10ms视为低性能设备
    if (duration > 10) {
      document.body.classList.add('low-performance');
      console.log('[Visual] 检测到低性能设备，已启用降级模式（耗时' + duration.toFixed(1) + 'ms）');
    }
  }

  // 公开API
  return {
    init: init,
    refreshAtmosphere: refreshAtmosphere,
    triggerStressShake: triggerStressShake,
    prefersReducedMotion: prefersReducedMotion
  };

})();
