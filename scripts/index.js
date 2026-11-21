/* 원본 백업에는 애니메이션·통계 스크립트가 없어 확인 가능한 제목만 표시한다. */
(function () {
  'use strict';
  const toggle = document.getElementById('adminToggleBtn');
  const panel = document.getElementById('adminPanel');
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.getElementById('adminLoginForm').addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('adminMessage').textContent = '원본 관리자 서버가 연결되어 있지 않습니다.';
  });
})();
