/**
 * 页面路由 — 管理五个选项卡的切换
 * 依赖：Game.app 命名空间（由 app.js 初始化）
 */

const Game = window.Game || {};

/**
 * 页面路由模块
 * 负责底部导航栏点击 → 页面切换
 */
Game.Router = (() => {
  // 当前激活的页面名称
  let _currentPage = 'schedule';

  // 所有页面名称列表
  const PAGES = ['schedule', 'phone', 'profile', 'relations', 'events'];

  /**
   * 初始化路由
   * 绑定导航栏点击事件
   */
  function init() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const pageName = item.getAttribute('data-page');
        if (pageName) {
          navigateTo(pageName);
        }
      });
    });

    // 默认显示日程页（已在HTML中预设为active）
    console.log('[Router] 路由初始化完成，当前页面：' + _currentPage);
  }

  /**
   * 切换到指定页面
   * @param {string} pageName - 页面名称（schedule/phone/profile/relations/events）
   */
  function navigateTo(pageName) {
    // 校验页面名称
    if (!PAGES.includes(pageName)) {
      console.warn('[Router] 未知页面：' + pageName);
      return;
    }

    // 如果已经在目标页面，不重复切换
    if (_currentPage === pageName) return;

    // 切换导航栏高亮
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const target = item.getAttribute('data-page');
      if (target === pageName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 切换页面显示
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      if (page.id === 'page-' + pageName) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });

    // 更新当前页面
    const previousPage = _currentPage;
    _currentPage = pageName;

    // 触发页面切换事件（供其他模块监听）
    _onPageChanged(previousPage, pageName);

    console.log('[Router] 页面切换：' + previousPage + ' → ' + pageName);
  }

  /**
   * 获取当前页面名称
   * @returns {string}
   */
  function getCurrentPage() {
    return _currentPage;
  }

  /**
   * 页面切换回调
   * 当页面切换时，通知其他模块
   */
  function _onPageChanged(from, to) {
    // 滚动到顶部
    const pagesContainer = document.getElementById('pages');
    if (pagesContainer) {
      pagesContainer.scrollTop = 0;
    }

    // 派发自定义事件，供其他模块（如Profile）监听
    document.dispatchEvent(new CustomEvent('pageChanged', {
      detail: { from, to },
      bubbles: true
    }));
  }

  // 公开API
  return {
    init,
    navigateTo,
    getCurrentPage,
    PAGES
  };
})();
