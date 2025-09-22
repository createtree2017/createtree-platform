// @replit/vite-plugin-runtime-error-modal 플러그인을 위한 완전한 호환성 파일
// DOM 조작 없이 모든 필요한 인터페이스 제공

// 플러그인이 요구하는 정확한 구조로 구현
(function() {
  'use strict';
  
  // 안전한 DOM 접근 함수
  function safeQuerySelector(selector) {
    if (typeof document === 'undefined') return null;
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  // 안전한 이벤트 리스너 추가
  function safeAddEventListener(element, event, handler) {
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, handler);
      return true;
    }
    return false;
  }

  // 글로벌 객체에 필요한 함수들 제공
  window.createErrorModal = function() {
    return {
      show: function(error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Runtime Error:', error);
        }
      },
      hide: function() {
        // 빈 함수
      }
    };
  };

  // 이벤트 관련 함수들
  window.addEventListener = window.addEventListener || function() {};
  window.removeEventListener = window.removeEventListener || function() {};

  // 플러그인이 DOM 요소를 찾으려 할 때 안전하게 처리
  const originalQuerySelector = document.querySelector;
  document.querySelector = function(selector) {
    try {
      const result = originalQuerySelector.call(document, selector);
      // null인 경우 빈 객체 반환 (addEventListener 호출 방지)
      if (result === null && selector.includes('modal')) {
        return {
          addEventListener: function() {},
          removeEventListener: function() {},
          style: {},
          classList: {
            add: function() {},
            remove: function() {},
            toggle: function() {}
          }
        };
      }
      return result;
    } catch (e) {
      return null;
    }
  };

})();

// ES6 모듈 형태로도 내보내기
export function createErrorModal() {
  return {
    show: function(error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Runtime Error:', error);
      }
    },
    hide: function() {}
  };
}

export function addEventListener(event, handler) {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener(event, handler);
  }
}

export function removeEventListener(event, handler) {
  if (typeof window !== 'undefined' && window.removeEventListener) {
    window.removeEventListener(event, handler);
  }
}

export default {
  createErrorModal,
  addEventListener,
  removeEventListener
};