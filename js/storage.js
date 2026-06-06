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
    const saveData = {
      ...data,
      timestamp: Date.now(),
      version: Game.version
    };
    localStorage.setItem(KEYS.SAVE_SLOT(slot), JSON.stringify(saveData));
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
    deletePhoto,
    replacePhoto,
    // 存档
    saveGame,
    loadGame,
    deleteGame,
    getAllSaves,
    // API
    saveApiKey,
    getApiKey,
    hasApiKey,
    // 设置
    saveSettings,
    loadSettings,
    // 其他
    clearAll,
    KEYS
  };
})();
