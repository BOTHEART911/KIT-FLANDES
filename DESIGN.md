# DESIGN.md · Ecosistema Flandes Core

Sistema visual de las 7 apps (Contratista, Supervisión, Contratación,
Contabilidad, Tesorería, Comunicaciones y Admin) y de este kit.
Lo lee quien diseñe o toque una pantalla, antes de escribir CSS.
Fuente de verdad de los valores: `kit/base.css`. Si algo aquí no
coincide con ese archivo, manda `base.css` y se corrige este documento.

Aprobado por Oscar Polania el 18/11/2026 (maqueta del nuevo inicio de
Contratista).

## 1. Carácter

Institucional, sereno y claro. Una herramienta de trabajo de la
Alcaldía, no una vitrina: lo importante para cada rol es lo primero que
se ve y lo más grande. El verde de la marca da identidad; el resto es
papel blanco, buena letra y aire.

## 2. Color (variables `--k-*`)

Nunca un color suelto en una vista: siempre la variable.

| Uso | Variable | Claro | Oscuro |
|---|---|---|---|
| Marca (barras, botón principal, tarjeta de la tarea en curso) | `--k-marca` | `#06402B` | `#2f9c6e` |
| Marca clara (hover, acentos) | `--k-marca-clara` | `#0a6644` | `#44c48c` |
| Fondo de la app | `--k-fondo` | `#eef2f0` | `#0d1512` |
| Papel (tarjetas, capas) | `--k-papel` | `#ffffff` | `#14201b` |
| Texto principal | `--k-tinta` | `#0f1f16` | `#e8f0eb` |
| Texto secundario | `--k-tinta-2` | `#3d5248` | `#b9ccc2` |
| Texto apagado (ayudas, fechas, versión) | `--k-apagado` | `#4b5c54` | `#8ba298` |
| Línea y borde de tarjeta | `--k-linea` | `rgba(6,64,43,.14)` | `rgba(255,255,255,.12)` |
| Bien / pagado | `--k-ok` sobre `--k-ok-fondo` | `#15803d` / `#dcfce7` | — / `#10331f` |
| Atención / pendiente | `--k-aviso` sobre `--k-aviso-fondo` | `#b45309` / `#ffedd5` | — / `#332414` |
| Error / devuelto | `--k-malo` sobre `--k-malo-fondo` | `#dc2626` / `#fee2e2` | — / `#3a1a1a` |
| «En curso» (dentro de la tarjeta de marca) | — | `#fde68a` con texto `#06402B` | igual |

Reglas:
- Contraste mínimo 4,5:1 en todo texto (3:1 solo a 24 px o más). La
  versión del pie también.
- Los estados se dicen con **fondo + borde suave + texto**, nunca con
  una franja de color a un lado.
- Lo que deba distinguirse por color también se distingue por texto o
  ícono (no solo verde contra rojo).

## 3. Tipografía

- Títulos: **Sora** 600 (`--k-fuente-titulo`). Cuerpo: **IBM Plex Sans**
  400/500/600 (`--k-fuente`). Ya se cargan en el `<head>` de cada app;
  no se agregan fuentes.
- Escala en celular: título de vista 22–26 px · título de tarjeta 15–17
  px · cuerpo 14–15 px · ayudas 12–13 px · etiquetas 11–12 px.
- Títulos en frase normal («Estado de cuenta»), no en MAYÚSCULAS
  sostenidas. Las mayúsculas quedan para etiquetas cortas de 11–13 px
  con espaciado (`CUENTA 10 DE 11`).

## 4. Forma, espacio y profundidad

- Radios: `--k-r-sm` 10 · `--k-r-md` 14 · `--k-r-lg` 20 · pastillas 999.
- Tarjeta: papel, borde de 1 px `--k-linea`, radio 18–20, sombra
  `--k-sombra-1` como mucho. Sin tarjetas dentro de tarjetas.
- Espaciado en múltiplos de 4: 8 / 12 / 16 / 20 / 24. Margen lateral
  en celular: 16 px.
- Sombras neutras (`--k-sombra-*`). Nada de resplandores de color.

## 5. Íconos

- Solo los de `kit/iconos.js` (`K.icono('nombre', tamaño)`): SVG de
  línea, `currentColor`. Nunca emoji.
- Cada acción con su ícono propio y con sentido; dos accesos distintos
  no comparten ícono. Si falta uno adecuado, se le pide a Oscar.

## 6. Movimiento

- 150–250 ms, salida suave `cubic-bezier(.2, .8, .2, 1)`. Solo
  `transform` y `opacity`.
- Sin rebotes, sin respiraciones de sombra, sin brillos que cruzan.
- Puntos que laten solo para estados en vivo de verdad: sin conexión,
  red lenta, «pensando» o «escribiendo» del asistente.
- **El cielo (aurora y globos, `kit/cielo.js`) va en la tarjeta verde de la
  tarea principal del inicio de cada app** (decisión de Oscar, 18/11/2026),
  con 4 globos. Es la misma animación de la portada de instalación: lenta,
  solo `transform` y `opacity`, y se detiene con `prefers-reduced-motion`.
  No se pone en listas, formularios ni barras con menús.
- Todo respeta `prefers-reduced-motion`.

## 7. Patrones de pantalla

**Inicio de cada rol (patrón aprobado el 18/11/2026):**
1. Saludo y datos del contrato o del rol, en una línea.
2. Tarjeta grande en marca con **la tarea en curso**: qué es, en qué
   paso va, cuánto falta y el botón para seguir. Lleva el cielo animado.
3. El resultado reciente más útil (por ejemplo, la última cuenta pagada).
4. Cuatro accesos rápidos en rejilla 2×2 (4×1 en PC).
5. Avisos que piden acción (franja de atención con texto claro).
6. Lo demás en listas compactas por sección, una fila por acción, con
   ícono, título, ayuda corta y flecha.

**En PC:** se aprovecha el ancho. Columna principal (tarea en curso y
accesos) y columna lateral (resultado reciente, avisos y listas). Nada
de una tira estrecha en el centro.

**Cargas:** esqueletos con la forma real de lo que llega; la cabecera
se pinta con lo que ya se sabe y los datos completan después.

**Elementos flotantes:** el robot del asistente se achica al deslizar
y se puede mover; nada flotante tapa un dato mientras se lee.

## 8. Prohibido

- Franja de color a un lado de tarjetas o avisos (`border-left` grueso
  o `::before` vertical).
- Texto con degradado, botones con degradado o brillo, fondos lavados
  con degradado.
- Losa de ícono encima de cada título.
- Listas largas de tarjetas iguales sin jerarquía.
- Pastillas que parecen botones y no hacen nada.

## 9. Antes de publicar

1. Detector de Impeccable sobre el repo (ver la skill
   `diseno-apps-oscar`) con lo prohibido en cero. Lo legítimo se marca
   con `impeccable-disable` y su motivo.
2. Captura en celular (390 px) y en PC (1280 px), modo claro y oscuro.
3. Tiempos dentro del presupuesto de las reglas de sesión.
4. `version.js` arriba en cada app tocada.
