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
});
