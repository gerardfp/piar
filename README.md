# PIAR · Portal de Aprendizaje Digital
**Programación, Inteligencia Artificial y Robótica**

Portal web educativo moderno, estático y sin dependencias para el seguimiento didáctico de la asignatura de **PIAR**. Diseñado con metodología de Aprendizaje Basado en Proyectos (ABP) y pensamiento computacional para estudiantes de Secundaria (ESO) y Bachillerato.

---

## 🗂️ Estructura del Portal

```text
/home/gerard/piar/
├── index.html                           # Portada y visión general de PIAR
├── README.md                            # Guía del profesor y documentación
├── css/
│   ├── style.css                        # Estilos globales y responsive
│   ├── scratch-blocks.css               # Renderizador visual CSS de bloques Scratch 3.0
│   └── simulator.css                    # Estilos del simulador interactivo
├── js/
│   ├── main.js                          # Control de acordeones, navegación y quiz
│   ├── trampolin-sim.js                 # Motor del simulador de Proyecto 1 (Canvas)
│   └── atrapa-sim.js                    # Motor del videojuego jugable de Proyecto 2 (Canvas)
├── assets/
│   ├── img/
│   │   ├── scratch-coords.svg           # Diagrama del plano cartesiano en Scratch
│   │   ├── jump-physics.svg             # Esquema físico del salto y parábola
│   │   ├── scratch-variables.svg        # Diagrama de variables y memoria
│   │   └── game-loop.svg                # Diagrama del ciclo de videojuego
│   └── scratch/trampolin/
│       ├── cat1.svg / cat2.svg          # Disfraces del gato de Scratch
│       ├── trampoline.png               # Gráfico del trampolín
│       └── pop.wav / meow.wav           # Efectos de audio
└── temas/
│       ├── programacion/
│       │   ├── index.html               # Índice del Bloque 1: Programación
│       │   └── scratch/
│       │       ├── index.html           # Índice del Tema 1: Scratch Creativo
│       │       ├── trampolin.html       # TUTORIAL: Proyecto 1 "Acrobacias en el Trampolín"
│       │       └── atrapa-objetos.html  # TUTORIAL: Proyecto 2 "Robot Recolector (Atrapa Objetos)"
│       ├── ia/
│       │   └── index.html               # Bloque 2: Inteligencia Artificial
│       └── robotica/
│           └── index.html               # Bloque 3: Robótica y Computación Física
```

---

## 🚀 Cómo Visualizar el Portal

Al estar construido en **HTML5, CSS3 y JavaScript nativo**, el portal es 100% estático y no requiere `npm`, compilación ni bases de datos.

### Opción 1: Abrir directamente en el navegador
Haz doble clic sobre el archivo [index.html](file:///home/gerard/piar/index.html) o ábrelo con cualquier navegador web moderno (Chrome, Firefox, Safari, Edge).

### Opción 2: Servidor local ligero
En una terminal en la carpeta `/home/gerard/piar`:
```bash
python3 -m http.server 8000
```
Y abre en tu navegador `http://localhost:8000`.

---

## 🤸 Proyecto 1: Acrobacias en el Trampolín

Tutorial interactivo paso a paso:
- **Simulador Interactivo:** Permite ver la animación completa, ejecutar paso a paso, pausar, alternar el rastro de la parábola, activar el eje de coordenadas X/Y y escuchar el efecto de rebote.
- **Conceptos Clave Desglosados:**
  1. Sistema de coordenadas de Scratch (480x360 px, centro en 0,0) y la regla de oro de la inicialización con Bandera Verde.
  2. Animación fluida con `sumar a y` y `esperar 0.05 s` (evitando el teletransporte brusco).
  3. Bucles y bucles anidados (`repetir N veces`).
  4. Salto en parábola (combinación de avance en X y elevación en Y).
  5. Giros y rotación angular (las matemáticas de los 360° en una voltereta perfecta).
- **Misiones Guiadas:** 5 fases secuenciales para que el alumno monte el proyecto por su cuenta en [scratch.mit.edu](https://scratch.mit.edu).
- **Pistas y Solución Oculta:** Acordeones desplegables con explicaciones y renderizado visual hiperrealista de los bloques de Scratch.
- **Desafíos Pro de Ampliación:** Sonido al rebotar, disfraces dinámicos y control con teclado.
- **Test de Autocomprobación:** Preguntas interactivas con retroalimentación inmediata.

---

## 🤖 Proyecto 2: Robot Recolector (Atrapa Objetos con Marcador)

Tutorial interactivo de iniciación al desarrollo de videojuegos en Scratch:
- **Simulador Interactivo Jugable:** Videojuego integrado 100% jugable en el navegador con teclado (flechas ⬅️ y ➡️) o botones táctiles, detección de colisiones, sonido de sintetizador Web Audio, y HUD de telemetría en tiempo real.
- **Conceptos Clave Desglosados:**
  1. El ciclo principal del videojuego: bucle `por siempre` (Game Loop continuo).
  2. Control interactivo por teclado (`si <¿tecla presionada?> entonces`).
  3. Gravedad y caída continua (`sumar a y (-5)`).
  4. Azar y aleatoriedad: operador `número aleatorio entre (-200) y (200)` para columnas impredecibles.
  5. Variables en memoria: gestión de `Puntos` y `Vidas` (inicialización vs incremento relativo).
  6. Sensores de colisión (`<¿tocando [Robot]?>` y detección de límite de suelo `posición y < -160`).
- **Misiones Guiadas:** 5 fases de construcción paso a paso en Scratch.
- **Desafíos Pro:** Dificultad progresiva con variable de velocidad, objeto trampa (bomba) y modo contrarreloj.
- **Test de Autocomprobación:** 4 preguntas interactivas con evaluación pedagógica inmediata.
