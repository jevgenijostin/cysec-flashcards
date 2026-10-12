'use strict';
const app = document.querySelector('#app');
let cards = [], queue = [], selectedTopic = null, total = 0, mastered = 0, attempts = 0, answered = false;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, className, action) {
  const node = el('button', text, className);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
function screen(...nodes) {
  app.replaceChildren(...nodes);
  app.setAttribute('aria-busy', 'false');
  window.scrollTo(0, 0);
  const heading = app.querySelector('h1, h2');
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}
function home() {
  queue = [];
  const topics = new Map();
  cards.forEach(card => topics.set(card.topic, (topics.get(card.topic) || 0) + 1));
  const summary = el('div', undefined, 'summary');
  [[cards.length, 'карточек'], [topics.size, 'тем'], ['∞', 'повторений']].forEach(([n, label]) => {
    const item = el('div'); item.append(el('strong', n), el('span', label)); summary.append(item);
  });
  const grid = el('div', undefined, 'topics');
  function topicButton(topic, count) {
    const btn = button('', 'topic' + (topic === null ? ' all' : ''), () => start(topic));
    const name = el('span', topic || 'Все темы', 'topic-name');
    name.append(el('span', `Карточек: ${count}`, 'count'));
    const arrow = el('span', '→', 'arrow'); arrow.setAttribute('aria-hidden', 'true');
    btn.append(name, arrow); return btn;
  }
  grid.append(topicButton(null, cards.length));
  topics.forEach((count, topic) => grid.append(topicButton(topic, count)));
  screen(el('p', 'ВАЛЕРИЯ / CYSEC · CIF', 'eyebrow'), el('h1', 'Шаг за шагом.\nК экзамену.'),
    el('p', 'Выберите тему и начните практику. Ошибки вернутся в конце очереди — у каждой карточки будет ещё один шанс.', 'intro muted'),
    summary, grid, el('p', 'Вопросы и объяснения — на английском, как в исходном PDF. Прогресс сохраняется только до выхода из текущего занятия.', 'note'));
}
function start(topic) {
  selectedTopic = topic;
  queue = cards.filter(c => topic === null || c.topic === topic).slice();
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  total = queue.length; mastered = 0; attempts = 0; study();
}
function study() {
  if (!queue.length) return complete();
  answered = false;
  const card = queue[0];
  const toolbar = el('div', undefined, 'toolbar');
  toolbar.append(button('← К темам', 'back', home), el('span', 'Практика', 'badge'));
  const labels = el('div', undefined, 'progress-label');
  labels.append(el('span', `Выучено: ${mastered} из ${total}`), el('span', `Осталось: ${queue.length}`));
  const progress = el('progress'); progress.max = total; progress.value = mastered; progress.setAttribute('aria-label', 'Выученные карточки');
  const panel = el('section', undefined, 'card');
  const question = el('h2', card.question); question.lang = 'en';
  panel.append(el('p', `ВОПРОС № ${card.id}`, 'card-number'), question);
  const options = el('div', undefined, 'options');
  const feedback = el('div'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  card.options.forEach((text, index) => {
    const btn = button('', 'option', () => answer(index));
    const optionText = el('span', text); optionText.lang = 'en';
    btn.append(el('span', 'ABCD'[index], 'letter'), optionText); options.append(btn);
  });
  function answer(index) {
    if (answered) return;
    answered = true; attempts++;
    const correct = index === card.correctIndex;
    queue.shift();
    if (correct) mastered++; else queue.push(card);
    [...options.children].forEach((btn, i) => {
      btn.disabled = true;
      if (i === card.correctIndex || i === index) {
        btn.classList.add(i === card.correctIndex ? 'correct' : 'wrong');
        const label = el('span', i === card.correctIndex ? 'Правильный ответ' : 'Ваш ответ · неверно', 'answer-tag');
        label.lang = 'ru'; btn.lastChild.append(label);
      }
    });
    progress.value = mastered;
    labels.firstChild.textContent = `Выучено: ${mastered} из ${total}`;
    labels.lastChild.textContent = `Осталось: ${queue.length}`;
    feedback.className = 'feedback';
    const explanation = el('p', card.explanation, 'explanation'); explanation.lang = 'en';
    feedback.append(el('h3', correct ? 'Верно!' : 'Повторим ещё раз'),
      el('p', correct ? 'Карточка выучена.' : 'Карточка вернётся в конце очереди.', 'muted'),
      el('p', 'Объяснение', 'eyebrow'), explanation);
    const next = button(queue.length ? 'Следующая карточка →' : 'Завершить занятие →', 'primary', study);
    panel.append(next); next.focus({preventScroll:true});
  }
  panel.append(options, feedback);
  screen(toolbar, el('p', selectedTopic || 'Все темы', 'session-topic'), labels, progress, panel);
}
function complete() {
  const section = el('section', undefined, 'done');
  const actions = el('div', undefined, 'actions');
  actions.append(button('Повторить тему', 'primary', () => start(selectedTopic)), button('Вернуться к темам', 'secondary', home));
  section.append(el('div', '✓', 'done-mark'), el('p', selectedTopic || 'Все темы', 'eyebrow'), el('h1', 'Готово!'),
    el('p', `Все карточки выучены: ${total}. Ответов за занятие: ${attempts}.`, 'muted'),
    el('p', 'Можно закрепить результат — начните заново в новом порядке.', 'muted'), actions);
  screen(section);
}
async function load() {
  try {
    const response = await fetch('./data/cards.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const ids = new Set();
    if (!Array.isArray(data) || !data.length) throw new Error('Empty deck');
    for (const c of data) {
      if (!Number.isInteger(c.id) || c.id < 1 || ids.has(c.id) || typeof c.topic !== 'string' || !c.topic.trim() ||
          typeof c.question !== 'string' || !c.question.trim() || typeof c.explanation !== 'string' || !c.explanation.trim() ||
          !Array.isArray(c.options) || c.options.length !== 4 || !c.options.every(o => typeof o === 'string' && o.trim()) ||
          !Number.isInteger(c.correctIndex) || c.correctIndex < 0 || c.correctIndex > 3) throw new Error('Invalid card');
      ids.add(c.id);
    }
    cards = data; home();
  } catch (error) {
    screen(el('h1', 'Не удалось загрузить карточки'), el('p', 'Проверьте соединение и попробуйте ещё раз.', 'muted'), button('Попробовать снова', 'primary', load));
    console.error(error);
  }
}
load();
