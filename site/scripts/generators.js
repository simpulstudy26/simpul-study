/* 무한 문제 생성기: 서버나 인터넷 없이 브라우저에서 매번 새 문제를 만든다.
   AI가 만든 문제 은행을 다 풀었거나 배포된 사이트(서버 없음)에서도 문제가 끊기지 않게 하는 바닥 장치. */
(function () {
  'use strict';
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const choicesFor = (answer, wrong) => {
    const set = [String(answer)];
    wrong.map(String).forEach(w => { if (!set.includes(w) && set.length < 5) set.push(w); });
    let k = 1;
    while (set.length < 5 && Number.isFinite(Number(answer)) && k < 50) { const w = String(Number(answer) + k * (k % 2 ? 1 : -1)); k++; if (!set.includes(w)) set.push(w); }
    return set.sort(() => Math.random() - 0.5);
  };
  const INFO = [
    { unit: '정보 · 진법 변환', d: 'easy', make() {
      const n = R(5, 250), to2 = Math.random() < 0.5;
      return to2
        ? { q: `10진수 ${n}을 2진수로 나타내시오.`, a: n.toString(2), e: `${n}을 2로 계속 나눈 나머지를 거꾸로 읽으면 ${n.toString(2)}(2)이다.` }
        : { q: `2진수 ${n.toString(2)}(2)를 10진수로 나타내시오.`, a: String(n), c: choicesFor(n, [n + 1, n - 2, n * 2]),
          e: `각 자리의 값(2의 거듭제곱)을 더하면 ${n.toString(2).split('').reverse().map((b, i) => (b === '1' ? 2 ** i : 0)).filter(Boolean).reverse().join(' + ')} = ${n}.` };
    } },
    { unit: '정보 · 논리 연산', d: 'easy', make() {
      const a = R(0, 1), b = R(0, 1), op = pick(['AND', 'OR', 'XOR']);
      const v = op === 'AND' ? a & b : op === 'OR' ? a | b : a ^ b;
      return { q: `A = ${a}, B = ${b}일 때 A ${op} B의 값은?`, a: String(v), c: ['0', '1'],
        e: { AND: 'AND는 둘 다 1일 때만 1', OR: 'OR는 하나라도 1이면 1', XOR: 'XOR는 두 값이 다를 때 1' }[op] + `이므로 ${v}.` };
    } },
    { unit: '정보 · 데이터 단위', d: 'easy', make() {
      const k = R(2, 64), unit = pick([['KB', 'B', 1024], ['MB', 'KB', 1024], ['byte', 'bit', 8]]);
      return { q: `${k}${unit[0]}는 몇 ${unit[1]}인가?`, a: String(k * unit[2]), c: choicesFor(k * unit[2], [k * 1000, k * 8, k * 100]), e: `1${unit[0]} = ${unit[2]}${unit[1]}이므로 ${k} × ${unit[2]} = ${k * unit[2]}.` };
    } }
  ];

  const KANA = 'あa い i う u え e お o か ka き ki く ku け ke こ ko さ sa し shi す su せ se そ so た ta ち chi つ tsu て te と to な na に ni ぬ nu ね ne の no は ha ひ hi ふ fu へ he ほ ho ま ma み mi む mu め me も mo や ya ゆ yu よ yo ら ra り ri る ru れ re ろ ro わ wa を wo ん n'
    .replace('あa', 'あ a').split(' ').reduce((acc, x, i, arr) => (i % 2 ? acc : acc.concat([[x, arr[i + 1]]])), []);
  const toKata = ch => String.fromCharCode(ch.charCodeAt(0) + 0x60);
  const JAPANESE = [
    { unit: '일본어 · 히라가나 읽기', d: 'easy', make() {
      const [kana, roma] = pick(KANA), wrong = [0, 1, 2, 3].map(() => pick(KANA)[1]);
      return { q: `히라가나 「${kana}」의 발음을 고르시오.`, a: roma, c: choicesFor(roma, wrong).filter(Boolean), e: `「${kana}」는 '${roma}'로 읽는다.` };
    } },
    { unit: '일본어 · 가타카나 읽기', d: 'easy', make() {
      const [kana, roma] = pick(KANA), wrong = [0, 1, 2, 3].map(() => pick(KANA)[1]);
      return { q: `가타카나 「${toKata(kana)}」의 발음을 고르시오.`, a: roma, c: choicesFor(roma, wrong).filter(Boolean), e: `「${toKata(kana)}」는 히라가나 「${kana}」와 같은 소리 '${roma}'이다.` };
    } },
    { unit: '일본어 · 히라가나↔가타카나', d: 'medium', make() {
      const [kana] = pick(KANA), wrong = [0, 1, 2, 3].map(() => toKata(pick(KANA)[0]));
      return { q: `히라가나 「${kana}」와 같은 소리의 가타카나를 고르시오.`, a: toKata(kana), c: choicesFor(toKata(kana), wrong), e: `「${kana}」의 가타카나는 「${toKata(kana)}」이다.` };
    } }
  ];

  /* 2학기 기말고사: 수학은 범위(명제·함수) 문제가 준비될 때까지 비워 둔다 */
  const ALL = { info: INFO, japanese: JAPANESE };
  let serial = 0;
  function generate(subject, unit) {
    const list = (ALL[subject] || []).filter(g => !unit || g.unit === unit);
    if (!list.length) return null;
    const g = pick(list), x = g.make();
    // choicesFor가 숫자가 아닌 정답에 숫자 보기를 섞지 않도록 정리
    if (x.c) x.c = [...new Set(x.c.filter(c => c && c !== 'NaN'))];
    if (x.c && (x.c.length < 2 || !x.c.includes(x.a))) delete x.c;
    return { id: 'gen-' + subject + '-' + (++serial) + '-' + Date.now(), u: g.unit, d: g.d, q: x.q, c: x.c || [], a: x.a, e: x.e, gen: true };
  }
  const units = subject => [...new Set((ALL[subject] || []).map(g => g.unit))];

  if (typeof module !== "undefined") { module.exports = { generate, units }; return; }
  window.Simpul = window.Simpul || {};
  window.Simpul.generators = { generate, units, subjects: Object.keys(ALL) };
})();
