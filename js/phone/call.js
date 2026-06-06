/**
 * 通话APP模块 — 手机内的通话应用
 * 负责：联系人快捷拨号、通话历史、来电模拟
 */

Game.PhoneCall = (() => {

  // 通话历史记录（内存中，后续可持久化）
  let _callHistory = [];

  // ===== 渲染 =====

  /**
   * 渲染联系人 + 通话历史
   */
  function renderContacts(container) {
    const idols = Game.state.idols || [];

    container.innerHTML = `
      <div class="call-contacts">
        ${idols.map((idol, i) => `
          <div class="call-contact-item">
            <div class="call-contact-avatar">💜</div>
            <div class="call-contact-info">
              <span class="call-contact-name">${escapeHtml(idol.nickname || idol.name)}</span>
              <span class="call-contact-phone">📱 010-${String(1000 + i).slice(-4)}-XXXX</span>
            </div>
            <button class="call-btn" onclick="Game.PhoneCall.startCall(${i})">
              📞
            </button>
          </div>
        `).join('')}
      </div>

      <div class="call-history-section">
        <div class="call-history-header">📞 最近通话</div>
        <div id="call-history-list">
          ${renderHistoryHTML()}
        </div>
      </div>
    `;

    // 异步加载头像
    loadCallAvatars(container);
  }

  /**
   * 异步加载通话联系人头像
   */
  async function loadCallAvatars(container) {
    const idols = Game.state.idols || [];
    const avatars = container.querySelectorAll('.call-contact-avatar');
    for (let i = 0; i < idols.length; i++) {
      try {
        const url = await Game.Storage.getPhotoURL(idols[i].avatarId);
        if (url && avatars[i]) {
          avatars[i].innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
      } catch (e) { /* 使用占位符 */ }
    }
  }

  /**
   * 渲染通话历史
   */
  function renderHistoryHTML() {
    if (_callHistory.length === 0) {
      return '<div style="padding:20px;text-align:center;color:var(--text-hint);font-size:13px;">暂无通话记录</div>';
    }

    return _callHistory.slice(0, 20).map(call => {
      const idol = Game.state.idols[call.idolIndex];
      const name = idol ? (idol.nickname || idol.name) : '未知';
      const icon = call.type === 'outgoing' ? '📤' : call.type === 'incoming' ? '📥' : '❌';
      const cls = call.type === 'outgoing' ? 'outgoing' : call.type === 'incoming' ? 'incoming' : 'missed';
      const typeLabel = call.type === 'outgoing' ? '拨出' : call.type === 'incoming' ? '接听' : '未接';

      return `
        <div class="call-history-item">
          <span class="call-history-icon ${cls}">${icon}</span>
          <div class="call-history-info">
            <span class="call-history-name">${escapeHtml(name)}</span>
            <span class="call-history-type">${typeLabel} · ${formatDuration(call.duration)}</span>
          </div>
          <span class="call-history-time">${formatCallTime(call.time)}</span>
        </div>
      `;
    }).join('');
  }

  // ===== 通话功能 =====

  /**
   * 发起通话
   */
  function startCall(idolIndex) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    // 记录通话
    const duration = 10 + Math.floor(Math.random() * 120); // 10-130秒
    _callHistory.unshift({
      idolIndex,
      type: 'outgoing',
      duration,
      time: Date.now()
    });

    // 显示来电界面模拟
    showCallScreen(idol, 'outgoing', () => {
      // 通话结束后的回调
      refreshUI();

      // 通话效果：减压、微涨好感
      Game.State.addStress(-2);
      Game.State.addAffection(idolIndex, 1);
      Game.State.autoSave();
      if (Game.Profile) Game.Profile.refresh();
    });
  }

  /**
   * 显示通话界面
   */
  function showCallScreen(idol, callType, onEnd) {
    const overlay = document.createElement('div');
    overlay.className = 'call-incoming-overlay';
    overlay.id = 'call-overlay';

    const name = idol.nickname || idol.name;

    overlay.innerHTML = `
      <div class="call-contact-avatar" style="width:80px;height:80px;font-size:36px;background:var(--color-primary-light);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--color-primary-dark);">
        💜
      </div>
      <div class="call-incoming-name">${escapeHtml(name)}</div>
      <div class="call-incoming-label">
        ${callType === 'outgoing' ? '正在拨出...' : '来电中...'}
      </div>
      <div class="call-incoming-actions">
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <button class="call-incoming-btn decline" id="call-end-btn">
            📞
          </button>
          <span class="call-incoming-btn-label">挂断</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 异步加载头像
    if (idol.avatarId) {
      Game.Storage.getPhotoURL(idol.avatarId).then(url => {
        if (url) {
          const avatar = overlay.querySelector('.call-contact-avatar');
          if (avatar) avatar.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
      }).catch(() => {});
    }

    // 挂断按钮
    const endBtn = document.getElementById('call-end-btn');
    if (endBtn) {
      endBtn.addEventListener('click', () => {
        overlay.remove();
        if (onEnd) onEnd();
      });
    }

    // 自动挂断（模拟通话时长）
    const autoEnd = setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
        if (onEnd) onEnd();
      }
    }, 3000);

    // 点击背景也可挂断
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        clearTimeout(autoEnd);
        overlay.remove();
        if (onEnd) onEnd();
      }
    });
  }

  /**
   * 刷新通话页面UI
   */
  function refreshUI() {
    const historyList = document.getElementById('call-history-list');
    if (historyList) {
      historyList.innerHTML = renderHistoryHTML();
    }
  }

  // ===== 工具 =====

  function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (min > 0) return min + '分' + sec + '秒';
    return sec + '秒';
  }

  function formatCallTime(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    if (isToday) return hours + ':' + minutes;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hours + ':' + minutes;
  }

  // ===== 公开API =====

  return {
    renderContacts,
    startCall
  };

})();
