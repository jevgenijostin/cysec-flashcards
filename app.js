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
  [[cards.length, 'cards'], [topics.size, 'topics']].forEach(([n, label]) => {
    const item = el('div'); item.append(el('strong', n), el('span', label)); summary.append(item);
  });
  const grid = el('div', undefined, 'topics');
  function topicButton(topic, count) {
    const btn = button('', 'topic' + (topic === null ? ' all' : ''), () => start(topic));
    const name = el('span', topic || 'All topics', 'topic-name');
    name.append(el('span', `Cards: ${count}`, 'count'));
    const arrow = el('span', '→', 'arrow'); arrow.setAttribute('aria-hidden', 'true');
    btn.append(name, arrow); return btn;
  }
  grid.append(topicButton(null, cards.length));
  topics.forEach((count, topic) => grid.append(topicButton(topic, count)));
  screen(el('h1', 'CySEC / CIF Flashcards'),
    el('p', 'Pick a topic and start practicing. Wrong answers go to the back of the queue, so every card gets another chance.', 'intro muted'),
    summary, grid, el('p', 'Progress is kept only in this browser tab for the current session - it is not saved anywhere, and resets on refresh or when you close the tab.', 'note'));
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
  toolbar.append(button('← Topics', 'back', home), el('span', 'Practice', 'badge'));
  const labels = el('div', undefined, 'progress-label');
  labels.append(el('span', `Mastered: ${mastered} of ${total}`), el('span', `Remaining: ${queue.length}`));
  const progress = el('progress'); progress.max = total; progress.value = mastered; progress.setAttribute('aria-label', 'Cards mastered');
  const panel = el('section', undefined, 'card');
  const question = el('h2', card.question);
  panel.append(el('p', `QUESTION #${card.id}`, 'card-number'), question);
  const options = el('div', undefined, 'options');
  const feedback = el('div'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  card.options.forEach((text, index) => {
    const btn = button('', 'option', () => answer(index));
    const optionText = el('span', text);
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
        const label = el('span', i === card.correctIndex ? 'Correct answer' : 'Your answer · incorrect', 'answer-tag');
        btn.lastChild.append(label);
      }
    });
    progress.value = mastered;
    labels.firstChild.textContent = `Mastered: ${mastered} of ${total}`;
    labels.lastChild.textContent = `Remaining: ${queue.length}`;
    feedback.className = 'feedback';
    const explanation = el('p', card.explanation, 'explanation');
    feedback.append(el('h3', correct ? 'Correct!' : "Let's try that again"),
      el('p', correct ? 'Card mastered.' : 'This card will come back at the end of the queue.', 'muted'),
      el('p', 'Explanation', 'eyebrow'), explanation);
    const next = button(queue.length ? 'Next card →' : 'Finish session →', 'primary', study);
    panel.append(next); next.focus({preventScroll:true});
  }
  panel.append(options, feedback);
  screen(toolbar, el('p', selectedTopic || 'All topics', 'session-topic'), labels, progress, panel);
}
function complete() {
  const section = el('section', undefined, 'done');
  const actions = el('div', undefined, 'actions');
  actions.append(button('Repeat this topic', 'primary', () => start(selectedTopic)), button('Back to topics', 'secondary', home));
  section.append(el('div', '✓', 'done-mark'), el('p', selectedTopic || 'All topics', 'eyebrow'), el('h1', 'Done!'),
    el('p', `All cards mastered: ${total}. Answers this session: ${attempts}.`, 'muted'),
    el('p', 'Want to reinforce it? Start again in a fresh order.', 'muted'), actions);
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
    screen(el('h1', 'Could not load the flashcards'), el('p', 'Check your connection and try again.', 'muted'), button('Try again', 'primary', load));
    console.error(error);
  }
}
load();
