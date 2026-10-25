// Bibluno · bibluno.com.br. Dois comportamentos, sem dependências:
// 1. medição (Himetrica): só o clique na chamada da loja, quando ela virar link;
// 2. a demonstração de uma lição na home.
(() => {
  'use strict';

  // Chamada segura ao Himetrica: o tracker carrega com defer e pode ainda não existir
  // (padrão da instalação do Himetrica). Sem identify: o site não tem login.
  const himetrica = (method, ...args) => {
    const run = () => window.himetrica?.[method]?.(...args);
    if (window.himetrica || document.readyState === 'complete') return run();
    window.addEventListener('load', run, { once: true });
  };

  // Selo da loja: <a data-store="google_play" href="…">. Só a loja e a página, nenhum
  // dado pessoal.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-store]');
    if (!link) return;
    himetrica('track', 'store_click', {
      store: link.dataset.store,
      page: window.location.pathname,
    });
  });

  // Sumário das páginas de texto: aberto no computador (coluna fixa ao lado do texto) e
  // fechado no celular, para o texto começar logo. Sem JS, fica aberto.
  const wide = window.matchMedia('(min-width: 1024px)');
  const tocs = document.querySelectorAll('.toc details');
  const syncToc = () =>
    tocs.forEach((toc) => {
      toc.open = wide.matches;
    });
  if (tocs.length) {
    syncToc();
    wide.addEventListener('change', syncToc);
  }

  // ---------- Demonstração: explicação → pergunta → resultado → conclusão ----------

  const demo = document.querySelector('[data-demo]');
  if (!demo) return;

  const form = demo.querySelector('[data-form]');
  const check = demo.querySelector('[data-action="check"]');
  const scrim = demo.querySelector('[data-scrim]');
  const sheets = {
    help: demo.querySelector('[data-sheet="help"]'),
    feedback: demo.querySelector('[data-sheet="feedback"]'),
  };
  const segments = demo.querySelectorAll('.progress i');
  const feedbackTitle = demo.querySelector('[data-feedback-title]');
  const options = demo.querySelectorAll('[data-option]');
  const CORRECT = 'a';
  let opener = null;

  // As etapas fora da vista ficam fora do foco e do leitor de tela.
  const steps = {
    explain: demo.querySelector('.step-explain'),
    choose: demo.querySelector('.step-choose'),
    done: demo.querySelector('.step-done'),
  };

  const setInert = (element, value) => {
    element.inert = value;
    if (value) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  };

  const go = (step, { focus = true } = {}) => {
    demo.dataset.step = step;
    Object.entries(steps).forEach(([name, element]) =>
      setInert(element, name !== step),
    );
    segments.forEach((segment, index) => {
      segment.classList.toggle(
        'on',
        step === 'done' || index <= (step === 'choose' ? 1 : 0),
      );
    });
    if (focus) steps[step].querySelector('h3')?.focus({ preventScroll: true });
  };

  const openSheet = (name) => {
    opener = document.activeElement;
    Object.values(steps).forEach((element) => setInert(element, true));
    scrim.classList.add('is-open');
    sheets[name].classList.add('is-open');
    setInert(sheets[name], false);
    sheets[name].querySelector('.sheet-title').focus({ preventScroll: true });
  };

  const closeSheets = () => {
    scrim.classList.remove('is-open');
    Object.values(sheets).forEach((sheet) => {
      sheet.classList.remove('is-open');
      setInert(sheet, true);
    });
    setInert(steps[demo.dataset.step], false);
  };

  const reset = () => {
    form.reset();
    steps.choose.querySelector('.step-body').scrollTop = 0;
    delete demo.dataset.result;
    check.disabled = true;
    options.forEach((option) => {
      option.classList.remove('is-correct', 'is-incorrect');
      option.querySelector('input').disabled = false;
    });
    sheets.feedback.classList.remove('is-correct', 'is-incorrect');
  };

  form.addEventListener('change', () => {
    if (!demo.dataset.result) check.disabled = false;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = new FormData(form).get('resposta');
    if (!answer || demo.dataset.result) return;
    const right = answer === CORRECT;
    demo.dataset.result = right ? 'correct' : 'incorrect';
    options.forEach((option) => {
      const id = option.dataset.option;
      if (id === CORRECT) option.classList.add('is-correct');
      else if (id === answer) option.classList.add('is-incorrect');
      option.querySelector('input').disabled = true;
    });
    sheets.feedback.classList.add(right ? 'is-correct' : 'is-incorrect');
    feedbackTitle.textContent = right ? 'Isso mesmo!' : 'Resposta certa: a luz';
    check.disabled = true;
    openSheet('feedback');
    revealAnswers();
  });

  // Como no app: a folha do resultado nunca esconde as alternativas marcadas. A etapa
  // rola só o necessário para o fim delas ficar logo acima da folha.
  const revealAnswers = () => {
    const body = steps.choose.querySelector('.step-body');
    const last = options[options.length - 1].getBoundingClientRect();
    // A folha ainda está subindo: o topo final vem da altura dela, não da posição.
    const sheetTop =
      demo.getBoundingClientRect().bottom - sheets.feedback.offsetHeight;
    const overlap = last.bottom + 16 - sheetTop;
    if (overlap > 0) {
      const smooth = window.matchMedia(
        '(prefers-reduced-motion: no-preference)',
      ).matches;
      body.scrollBy({ top: overlap, behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  demo.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'practice') go('choose');
    else if (action === 'help') openSheet('help');
    else if (action === 'close') {
      closeSheets();
      opener?.focus({ preventScroll: true });
    } else if (action === 'continue') {
      closeSheets();
      go('done');
    } else if (action === 'restart') {
      reset();
      go('explain');
    }
  });

  scrim.addEventListener('click', () => {
    if (sheets.help.classList.contains('is-open')) {
      closeSheets();
      opener?.focus({ preventScroll: true });
    }
  });

  demo.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheets.help.classList.contains('is-open')) {
      closeSheets();
      opener?.focus({ preventScroll: true });
    }
  });

  Object.values(sheets).forEach((sheet) => setInert(sheet, true));
  go('explain', { focus: false });
})();
