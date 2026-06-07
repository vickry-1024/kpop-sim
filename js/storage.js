/**
 * 存储模块 — 管理本地数据持久化
 * - localStorage：游戏存档、设置、API Key
 * - IndexedDB：照片、聊天记录、事件日志
 */

Game.Storage = (() => {
  // ===== localStorage Key命名 =====
  const KEYS = {
    SAVE_SLOT: (n) => `kpop-sim:save:slot${n}`,
    SETTINGS: 'kpop-sim:settings',
    API_KEY: 'kpop-sim:api-key',
  };

  // ===== IndexedDB =====
  const DB_NAME = 'kpop-sim-db';
  const DB_VERSION = 1;

  let _db = null;

  /**
   * 打开/初始化 IndexedDB
   */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // 照片存储（头像/壁纸）
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
        // 聊天记录
        if (!db.objectStoreNames.contains('chatHistory')) {
          db.createObjectStore('chatHistory', { keyPath: 'id' });
        }
        // 事件日志
        if (!db.objectStoreNames.contains('eventLog')) {
          db.createObjectStore('eventLog', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ===== 照片存储（IndexedDB） =====

  /**
   * 保存照片（返回照片ID）
   * @param {File|Blob} file - 图片文件
   * @param {string} photoId - 照片ID（如 idol-0-avatar）
   */
  async function savePhoto(file, photoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      store.put({ id: photoId, blob: file, timestamp: Date.now() });
      tx.oncomplete = () => resolve(photoId);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 读取照片
   * @param {string} photoId
   * @returns {Promise<Object|null>} { id, blob, timestamp } 或 null
   */
  async function getPhoto(photoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const store = tx.objectStore('photos');
      const request = store.get(photoId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取照片URL（用于img标签显示）
   */
  async function getPhotoURL(photoId) {
    const photo = await getPhoto(photoId);
    if (!photo) return null;
    return URL.createObjectURL(photo.blob);
  }

  /**
   * 释放照片URL（阶段12：防止blob URL内存泄漏）
   * @param {string} url - 由 getPhotoURL 或 URL.createObjectURL 创建的blob URL
   */
  function revokePhotoURL(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * 删除照片
   */
  async function deletePhoto(photoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').delete(photoId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 用新照片替换旧照片（先删后存）
   */
  async function replacePhoto(file, photoId) {
    await deletePhoto(photoId);
    return savePhoto(file, photoId);
  }

  // ===== 游戏存档（localStorage） =====

  /**
   * 保存游戏
   * @param {number} slot - 存档槽 1/2/3
   * @param {Object} data - 存档数据
   */
  function saveGame(slot, data) {
    var saveData = {
      ...data,
      timestamp: Date.now(),
      version: Game.version
    };
    try {
      localStorage.setItem(KEYS.SAVE_SLOT(slot), JSON.stringify(saveData));
    } catch (e) {
      // QuotaExceededError：存储空间不足（阶段12）
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error('[Storage] 存储空间不足！请清理浏览器数据或删除旧存档。当前数据未保存。');
        // 尝试清理最旧存档槽位后重试一次
        try {
          var oldestSlot = _findOldestSaveSlot(slot);
          if (oldestSlot) {
            localStorage.removeItem(KEYS.SAVE_SLOT(oldestSlot));
            localStorage.setItem(KEYS.SAVE_SLOT(slot), JSON.stringify(saveData));
            console.warn('[Storage] 已清理槽' + oldestSlot + '，当前数据已紧急保存到槽' + slot);
          }
        } catch (e2) {
          console.error('[Storage] 紧急保存也失败，数据可能丢失');
        }
      } else {
        throw e;
      }
    }
  }

  /**
   * 找到最旧的存档槽（排除当前槽），用于紧急清理
   */
  function _findOldestSaveSlot(currentSlot) {
    var oldestSlot = null;
    var oldestTime = Infinity;
    for (var s = 1; s <= 3; s++) {
      if (s === currentSlot) continue;
      var raw = localStorage.getItem(KEYS.SAVE_SLOT(s));
      if (!raw) return s; // 空槽直接返回
      try {
        var data = JSON.parse(raw);
        if (data.timestamp && data.timestamp < oldestTime) {
          oldestTime = data.timestamp;
          oldestSlot = s;
        }
      } catch (e) { /* 损坏的存档，可以覆盖 */ return s; }
    }
    return oldestSlot;
  }

  /**
   * 读取游戏
   * @param {number} slot
   * @returns {Object|null}
   */
  function loadGame(slot) {
    const raw = localStorage.getItem(KEYS.SAVE_SLOT(slot));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Storage] 存档损坏：' + slot, e);
      return null;
    }
  }

  /**
   * 删除存档
   */
  function deleteGame(slot) {
    localStorage.removeItem(KEYS.SAVE_SLOT(slot));
  }

  /**
   * 获取所有存档槽信息
   * @returns {Array<{slot: number, data: Object|null}>}
   */
  function getAllSaves() {
    return [1, 2, 3].map(slot => ({
      slot,
      data: loadGame(slot)
    }));
  }

  // ===== API Key管理 =====

  /**
   * 保存API Key（简单base64编码，防明文暴露）
   */
  function saveApiKey(key) {
    const encoded = btoa(key);
    localStorage.setItem(KEYS.API_KEY, encoded);
  }

  /**
   * 获取API Key
   */
  function getApiKey() {
    const encoded = localStorage.getItem(KEYS.API_KEY);
    if (!encoded) return null;
    try {
      return atob(encoded);
    } catch {
      return null;
    }
  }

  /**
   * 检查是否有API Key
   */
  function hasApiKey() {
    return !!localStorage.getItem(KEYS.API_KEY);
  }

  // ===== 设置管理 =====

  function saveSettings(settings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }

  function loadSettings() {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  // ===== 聊天历史存储（IndexedDB） =====

  /**
   * 保存聊天历史
   * @param {string} key - 聊天记录ID（如 'chat-main-0'）
   * @param {Array} messages - 消息数组
   */
  async function saveChatHistory(key, messages) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chatHistory', 'readwrite');
      const store = tx.objectStore('chatHistory');
      store.put({ id: key, messages });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 加载聊天历史
   * @param {string} key - 聊天记录ID
   * @returns {Promise<Array>}
   */
  async function loadChatHistory(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chatHistory', 'readonly');
      const store = tx.objectStore('chatHistory');
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.messages || [] : []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 估算localStorage使用量（阶段12：存储诊断）
   * @returns {number} 大约字节数
   */
  function getStorageUsage() {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('kpop-sim:') === 0) {
        total += (localStorage.getItem(key) || '').length * 2; // UTF-16 → 字节估算
      }
    }
    return total;
  }

  /**
   * 清除所有游戏数据
   */
  async function clearAll() {
    // 清除localStorage
    Object.values(KEYS).forEach(key => {
      if (typeof key === 'function') {
        [1, 2, 3].forEach(n => localStorage.removeItem(key(n)));
      } else {
        localStorage.removeItem(key);
      }
    });

    // 清除IndexedDB
    _db = null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 公开API
  return {
    // 照片
    savePhoto,
    getPhoto,
    getPhotoURL,
    revokePhotoURL,
    deletePhoto,
    replacePhoto,
    // 存档
    saveGame,
    loadGame,
    deleteGame,
    getAllSaves,
    // 聊天历史
    saveChatHistory,
    loadChatHistory,
    // API
    saveApiKey,
    getApiKey,
    hasApiKey,
    // 设置
    saveSettings,
    loadSettings,
    // 诊断
    getStorageUsage,
    // 其他
    clearAll,
    KEYS
  };
})();
