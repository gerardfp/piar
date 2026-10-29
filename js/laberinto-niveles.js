/**
 * PIAR - Datos de los niveles del "Laberinto Mágico" (Proyecto 3)
 *
 * Cada laberinto se describe en una cuadrícula de 7 x 5 celdas con el formato
 * clásico de 15 x 11 caracteres:
 *   - Posiciones (impar, impar)  -> celdas por donde se camina (' ', 'S' salida, 'G' meta)
 *   - Resto de posiciones        -> paredes ('#') o pasos abiertos (' ')
 *
 * Al dibujarse sobre el escenario de Scratch (480 x 360 px) cada celda mide 40 px,
 * las paredes interiores 20 px y el borde exterior 40 px. Así, el centro de cada
 * celda cae en coordenadas "redondas" de Scratch:
 *   x = -180, -120, -60, 0, 60, 120, 180   (columnas 0..6)
 *   y =  120,   60,   0, -60, -120         (filas 0..4)
 *
 * Este archivo lo usan tanto el simulador (js/laberinto-sim.js) como el script
 * que genera los fondos SVG descargables, para que ambos sean idénticos.
 */
(function (root) {
  const LABERINTO = {
    colores: {
      pared: '#7c3aed',   // Morado mágico: el sensor de color detecta este tono
      meta: '#22c55e',    // Verde portal: llegar aquí envía el mensaje "nivel superado"
      suelo: '#1e1b4b'    // Azul noche: zona libre por donde se camina
    },
    salida: { x: -180, y: 120 },
    niveles: [
      {
        nombre: 'Nivel 1',
        titulo: 'El Bosque Encantado',
        mapa: [
          '###############',
          '#S        #   #',
          '######### # # #',
          '#         # # #',
          '# ########### #',
          '#             #',
          '### ######### #',
          '#   #       # #',
          '# ####### #####',
          '#            G#',
          '###############'
        ],
        fantasmas: []
      },
      {
        nombre: 'Nivel 2',
        titulo: 'Las Mazmorras del Castillo',
        mapa: [
          '###############',
          '#S  #     #   #',
          '### # ### # # #',
          '#   #   #   # #',
          '# ##### ##### #',
          '#             #',
          '# # ### # ### #',
          '# #   # #   # #',
          '# ### # ### # #',
          '#   #   #   #G#',
          '###############'
        ],
        fantasmas: [
          { nombre: 'Fantasma', x: 0, y: 0, direccion: 90, pasos: 2 }
        ]
      },
      {
        nombre: 'Nivel 3',
        titulo: 'La Torre del Hechicero',
        mapa: [
          '###############',
          '#S            #',
          '##### # ##### #',
          '#   # #     # #',
          '# # # ##### # #',
          '# #         # #',
          '# ######### # #',
          '#     #   # # #',
          '##### # # # # #',
          '#G      #   # #',
          '###############'
        ],
        fantasmas: [
          { nombre: 'Fantasma', x: 0, y: 0, direccion: -90, pasos: 2 },
          { nombre: 'Fantasma2', x: -180, y: 0, direccion: 180, pasos: 1.5 }
        ]
      }
    ]
  };

  /**
   * Convierte un mapa de 15 x 11 caracteres en una lista de rectángulos
   * (en píxeles del escenario 480 x 360, origen arriba a la izquierda).
   * Devuelve { paredes: [{x,y,w,h}], metas: [{x,y,w,h}] }
   */
  function mapaARectangulos(mapa) {
    // Columna de carácter -> [inicio, ancho] en unidades de 20 px
    function tramo(indice, total) {
      if (indice === 0) return [0, 2];                 // borde izquierdo/superior (40 px)
      if (indice === total - 1) return [((total - 1) / 2) * 3 + 1, 2]; // borde derecho/inferior
      if (indice % 2 === 1) return [2 + ((indice - 1) / 2) * 3, 2];   // celda (40 px)
      return [1 + (indice / 2) * 3, 1];                // pared interior (20 px)
    }
    const U = 20;
    const paredes = [];
    const metas = [];
    const filas = mapa.length;
    const cols = mapa[0].length;
    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = mapa[r][c];
        const [ux, uw] = tramo(c, cols);
        const [uy, uh] = tramo(r, filas);
        const rect = { x: ux * U, y: uy * U, w: uw * U, h: uh * U };
        if (ch === '#') paredes.push(rect);
        else if (ch === 'G') metas.push(rect);
      }
    }
    return { paredes, metas };
  }

  LABERINTO.mapaARectangulos = mapaARectangulos;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LABERINTO;
  } else {
    root.LABERINTO = LABERINTO;
  }
})(typeof window !== 'undefined' ? window : this);
