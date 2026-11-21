/* simpul_conditions.py의 조건식, 정답 및 반례 규칙을 브라우저에서 실행한다. */
(function () {
  'use strict';
  const kinds = ['necessary', 'sufficient', 'both', 'neither'];
  function makeQuestion(kind, low, high) {
    let p, q, answer, explanation;
    if (kind === 'necessary') {
      p = `x > ${low}`; q = `x > ${high}`;
      answer = 'p는 q의 필요조건이지만 충분조건은 아니다.';
      explanation = `${high} > ${low}이므로 q가 참이면 p도 참이다(q ⇒ p). 반대로 x = ${high}이면 p는 참이고 q는 거짓이므로 p ⇒ q는 성립하지 않는다.`;
    } else if (kind === 'sufficient') {
      p = `x > ${high}`; q = `x > ${low}`;
      answer = 'p는 q의 충분조건이지만 필요조건은 아니다.';
      explanation = `${high} > ${low}이므로 p가 참이면 q도 참이다(p ⇒ q). 반대로 x = ${high}이면 q는 참이고 p는 거짓이므로 q ⇒ p는 성립하지 않는다.`;
    } else if (kind === 'both') {
      const offset = high - low;
      p = `x + ${offset} > ${high}`; q = `x > ${low}`;
      answer = 'p는 q의 필요충분조건이다.';
      explanation = `p의 부등식 양변에서 ${offset}을 빼면 q가 되고, q의 양변에 ${offset}을 더하면 p가 된다. 따라서 p ⇒ q와 q ⇒ p가 모두 성립한다. 성립하지 않는 방향이 없으므로 반례도 없다.`;
    } else {
      p = `x > ${high}`; q = `x < ${low}`;
      answer = 'p는 q의 필요조건도 충분조건도 아니다.';
      explanation = `x = ${high + 1}이면 p는 참이고 q는 거짓이므로 p ⇒ q는 성립하지 않는다. x = ${low - 1}이면 q는 참이고 p는 거짓이므로 q ⇒ p도 성립하지 않는다.`;
    }
    return { kind, low, high, p, q, answer, explanation };
  }
  const bank = kinds.flatMap(kind => {
    const cases = [];
    for (let low = 1; low < 12; low++) {
      for (let high = low + 1; high <= 12; high++) {
        if (kind !== 'both' || low === 1) cases.push(makeQuestion(kind, low, high));
      }
    }
    return cases;
  });
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function generateQuestions() {
    const selected = kinds.map(kind => shuffle(bank.filter(q => q.kind === kind))[0]);
    selected.push(shuffle(bank.filter(q => !selected.includes(q)))[0]);
    return shuffle(selected);
  }
  if (typeof module !== 'undefined') module.exports = { makeQuestion, generateQuestions, bank };
  if (typeof document === 'undefined') return;
  const container = document.getElementById('questions');
  document.getElementById('generate').addEventListener('click', () => {
    container.replaceChildren();
    generateQuestions().forEach((q, index) => {
      const card = document.createElement('article');
      card.className = 'question-card';
      const title = document.createElement('h3');
      title.textContent = `문항 ${index + 1}`;
      const prompt = document.createElement('p');
      prompt.textContent = '실수 x에 대해 두 조건 p와 q를 생각하자.';
      const conditions = document.createElement('p');
      conditions.className = 'conditions';
      conditions.textContent = `p: ${q.p}　 /　 q: ${q.q}`;
      const instruction = document.createElement('p');
      instruction.textContent = 'p가 q의 필요조건인지, 충분조건인지 각각 판단하고 근거를 서술하시오. 성립하지 않는 방향에는 반례를 제시하시오.';
      const label = document.createElement('label');
      label.htmlFor = `response-${index}`;
      label.textContent = '나의 풀이';
      const response = document.createElement('textarea');
      response.id = label.htmlFor;
      response.rows = 3;
      response.placeholder = '조건 관계와 근거, 반례를 적어 보세요.';
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '정답 보기';
      details.addEventListener('toggle', () => { summary.textContent = details.open ? '정답 접기' : '정답 보기'; });
      const answer = document.createElement('p');
      answer.textContent = `정답: ${q.answer}`;
      const explanation = document.createElement('p');
      explanation.textContent = `해설: ${q.explanation}`;
      details.append(summary, answer, explanation);
      card.append(title, prompt, conditions, instruction, label, response, details);
      container.append(card);
    });
    document.getElementById('generation-status').textContent = '새 문제 5개를 만들었어요. 다시 누르면 문제가 바뀌고 적어 둔 풀이는 지워져요.';
  });
})();
