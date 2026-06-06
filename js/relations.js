/**
 * 关系面板模块 — "关系"选项卡内容
 * 负责：展示每位爱豆的好感度进度条、关系阶段、基本信息
 */

Game.Relations = (() => {

  // 关系阶段显示配置
  const STAGE_CONFIG = {
    'pursuit': { label: '攻略中', color: '#7EC8E3', icon: '💫' },
    'dating':  { label: '恋爱中', color: '#F8A5C2', icon: '💕' },
    'married': { label: '已婚',   color: '#FFD700', icon: '💍' }
  };

  // ===== 刷新整个"关系"页面 =====

  function refresh() {
    if (!Game.state.initialized) return;

    const container = document.getElementById('relations-container');
    if (!container) return;

    const idols = Game.state.idols || [];

    if (idols.length === 0) {
      container.innerHTML = `
        <div class="placeholder-card">
          <div class="placeholder-icon">💜</div>
          <p class="placeholder-text">暂无爱豆数据</p>
          <p class="placeholder-hint">请先完成角色设定</p>
        </div>
      `;
      return;
    }

    container.innerHTML = idols.map((idol, i) => renderIdolCard(idol, i)).join('');

    // 异步加载头像预览
    idols.forEach((idol, i) => {
      if (idol.avatarId) {
        loadAvatarPreview(i, idol.avatarId);
      }
    });
  }

  /**
   * 渲染单个爱豆关系卡片
   */
  function renderIdolCard(idol, index) {
    const stage = STAGE_CONFIG[idol.relationshipStage] || STAGE_CONFIG['pursuit'];
    const affection = idol.stats.affection || 0;
    const genderIcon = idol.gender === 'male' ? '♂' : '♀';

    return `
      <div class="relation-card">
        <div class="relation-card-top">
          <!-- 头像区 -->
          <div class="relation-avatar" id="relation-avatar-${index}">
            <span class="relation-avatar-placeholder">${index + 1}</span>
          </div>
          <!-- 基本信息 -->
          <div class="relation-info">
            <div class="relation-name-row">
              <span class="relation-name">${escapeHtml(idol.name)}</span>
              <span class="relation-gender">${genderIcon}</span>
            </div>
            ${idol.nickname ? `<div class="relation-nickname">${escapeHtml(idol.nickname)}</div>` : ''}
            <div class="relation-group">🎵 ${escapeHtml(idol.group)}</div>
          </div>
          <!-- 阶段徽章 -->
          <div class="relation-stage" style="background:${stage.color}20; color:${stage.color}; border-color:${stage.color}">
            ${stage.icon} ${stage.label}
          </div>
        </div>

        <!-- 好感度条 -->
        <div class="relation-affection">
          <div class="relation-affection-header">
            <span class="relation-affection-label">💕 好感度</span>
            <span class="relation-affection-value">${affection}</span>
          </div>
          <div class="affection-bar-bg">
            <div class="affection-bar-fill" style="width:${affection}%;"></div>
          </div>
          <!-- 阶段标记线 -->
          <div class="affection-markers">
            <span class="affection-marker" style="left:33%;" title="恋爱门槛">💕</span>
            <span class="affection-marker" style="left:90%;" title="结婚门槛">💍</span>
          </div>
        </div>

        <!-- 性格标签 -->
        <div class="relation-tags">
          ${idol.personalityTags.map(t => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('')}
          ${idol.personalityCustom ? `<span class="mini-tag custom">${escapeHtml(idol.personalityCustom)}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 异步加载头像预览
   */
  async function loadAvatarPreview(index, avatarId) {
    const container = document.getElementById('relation-avatar-' + index);
    if (!container) return;

    try {
      const url = await Game.Storage.getPhotoURL(avatarId);
      if (url) {
        container.innerHTML = `<img src="${url}" alt="头像" class="relation-avatar-img">`;
      }
    } catch (e) {
      // 加载失败，保留占位符
    }
  }

  // ===== 工具函数 =====

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ===== 初始化 =====

  function init() {
    document.addEventListener('pageChanged', (e) => {
      if (e.detail && e.detail.to === 'relations') {
        refresh();
      }
    });
    console.log('[Relations] 关系面板初始化完成');
  }

  // ===== 公开API =====
  return {
    init,
    refresh
  };

})();
