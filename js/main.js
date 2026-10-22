/**
 * PIAR - Script Principal del Portal Educativo
 * Interacciones: Acordeones, Test de autoevaluación y Navegación
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Acordeones Plegables (Pistas, Soluciones, Desafíos)
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.accordion');
      if (parent) {
        parent.classList.toggle('open');
        if (parent.classList.contains('open')) {
          renderScratchBlocks(parent);
        }
      }
    });
  });

  // 2. Sistema de Test / Quiz de Autoevaluación interactivo
  document.querySelectorAll('.quiz-option').forEach(optionBtn => {
    optionBtn.addEventListener('click', function () {
      const questionCard = this.closest('.quiz-question');
      if (!questionCard) return;

      // Desactivar botones de esta pregunta
      questionCard.querySelectorAll('.quiz-option').forEach(btn => {
        btn.disabled = true;
        btn.classList.remove('selected', 'correct', 'incorrect');
      });

      const isCorrect = this.dataset.correct === 'true';
      this.classList.add(isCorrect ? 'correct' : 'incorrect');

      const feedback = questionCard.querySelector('.quiz-feedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.className = `quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
        feedback.innerHTML = isCorrect
          ? `<strong>¡Correcto! 🎉</strong> ${this.dataset.explanation || 'Has comprendido perfectamente este concepto.'}`
          : `<strong>¡Casi! 🤔</strong> ${this.dataset.explanation || 'Revisa la explicación en la lección y vuelve a intentarlo.'}`;
      }
    });
  });

  // 3. Resaltar enlace activo en el índice lateral al hacer scroll
  const tocLinks = document.querySelectorAll('.toc-link');
  if (tocLinks.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          tocLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    document.querySelectorAll('section[id], h2[id], div[id^="paso-"], div[id^="concepto-"]').forEach(sec => {
      observer.observe(sec);
    });
  }

  // 4. Renderizado automático de bloques Scratch (scratchblocks)
  function renderScratchBlocks(scope) {
    if (!window.scratchblocks) return;

    const options = {
      style: 'scratch3',
      languages: ['es', 'en'],
      scale: 0.95
    };

    const root = scope || document;

    // Renderizar bloques de código (<pre class="blocks">)
    const pres = root.querySelectorAll('pre.blocks:not(.scratchblocks-rendered)');
    pres.forEach(el => {
      try {
        const text = window.scratchblocks.read(el, options);
        const doc = window.scratchblocks.parse(text, options);
        const svg = window.scratchblocks.render(doc, options);
        window.scratchblocks.replace(el, svg, doc, options);
        el.classList.add('scratchblocks-rendered');
      } catch (err) {
        console.error('Error al renderizar bloque Scratch:', err);
      }
    });

    // Renderizar bloques en línea (<code class="blocks">)
    const inlineOptions = Object.assign({}, options, { inline: true, scale: 0.85 });
    const codes = root.querySelectorAll('code.blocks:not(.scratchblocks-rendered)');
    codes.forEach(el => {
      try {
        const text = window.scratchblocks.read(el, inlineOptions);
        const doc = window.scratchblocks.parse(text, inlineOptions);
        const svg = window.scratchblocks.render(doc, inlineOptions);
        window.scratchblocks.replace(el, svg, doc, inlineOptions);
        el.classList.add('scratchblocks-rendered');
      } catch (err) {
        console.error('Error al renderizar bloque Scratch inline:', err);
      }
    });
  }

  // Ejecutar renderizado al cargar la página
  renderScratchBlocks();
});
