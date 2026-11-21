/* 작은 공부 타이머 (공부 타이머를 켠 채 심풀스터디의 다른 페이지를 쓸 때)
   오른쪽 위에 ‘● 영어 01:12:03 ⏸’를 띄운다. 누르면 공부 타이머로, ⏸를 누르면 기록하고 멈춘다.
   딴짓 방지로 멈췄으면 여기서 알려 준다. 레슨 화면(전체 화면)에서는 표시하지 않고 기록만 계속된다. */
(function () {
  'use strict';
  const S = window.Simpul || {}, T = S.study;
  if (!T) return;
  const hideBar = document.body.classList.contains('ls-body'); // 레슨 화면
  const COLOR = { korean: '#DF732C', english: '#F2AB46', math: '#4994EC', science: '#67AD5B', social: '#A357D7',
    history: '#C2675A', japanese: '#E0698E', info: '#3BA7A0', etc: '#9E9E9E' };
  const nameOf = id => (S.findSubject && S.findSubject(id) ? S.findSubject(id).name : id === 'etc' ? '기타' : id);
  const pad = n => String(n).padStart(2, '0');
  const clock2 = s => pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);

  const bar = document.createElement('div');
  bar.className = 'tbar';
  bar.hidden = true;
  bar.innerHTML =
    '<a class="tbar-main" href="./timer.html?run=1"><span class="tbar-dot" aria-hidden="true"></span>' +
    '<span class="tbar-name"></span><span class="tbar-time"></span></a>' +
    '<button class="tbar-pause" type="button"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg></button>';
  const toast = document.createElement('p');
  toast.className = 'tbar-toast';
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  document.body.append(bar, toast);
  if (document.querySelector('.viewer-bar')) bar.classList.add('is-viewer');

  function say(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(say.t);
    say.t = setTimeout(() => { toast.hidden = true; }, 7000);
  }

  function draw() {
    const run = T.get().run;
    if (!run || hideBar) { bar.hidden = true; return; }
    const sec = T.secondsOn(T.today())[run.s] || 0;
    bar.hidden = false;
    bar.querySelector('.tbar-dot').style.background = COLOR[run.s] || '#9E9E9E';
    bar.querySelector('.tbar-name').textContent = nameOf(run.s);
    bar.querySelector('.tbar-time').textContent = clock2(sec);
    bar.querySelector('.tbar-main').setAttribute('aria-label', nameOf(run.s) + ' 공부 중 ' + clock2(sec) + ', 공부 타이머 열기');
    bar.querySelector('.tbar-pause').setAttribute('aria-label', nameOf(run.s) + ' 타이머 일시정지');
  }
  bar.querySelector('.tbar-pause').addEventListener('click', () => {
    const r = T.stop();
    if (r) say(nameOf(r.s) + ' ' + T.words(Math.round(r.ms / 1000)) + ' 기록했어요.');
    draw();
  });
  T.onGuardStop(r => {
    say('심풀스터디 밖으로 나가서 타이머를 멈췄어요. (' + nameOf(r.s) + ' ' + T.words(Math.round(r.ms / 1000)) + ' 기록)');
    draw();
  });
  T.onChange(draw);
  draw();
  setInterval(draw, 1000);
})();
