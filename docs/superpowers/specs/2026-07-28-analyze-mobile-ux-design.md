# Diseño — Experiencia móvil de /analyze (bottom nav, cámara, componentes ricos)

**Estado:** Aprobado por el usuario (2026-07-28).
**Tipo:** Mejora de UI/UX pura. No toca schema, API, ni el pipeline (`readMenu` → `groundMacrosBatch` → `scoreDish`). No forma parte del roadmap de producto en SPRINTS.md — es un spec de "pulido de interfaz" independiente.

## 1. Contexto y motivación

La UI actual de ORDR (Sprints 1-4) es funcional pero plana: header con links de texto, un solo botón de upload genérico, estado de carga como texto en un botón deshabilitado, y una lista de tarjetas sin agrupación visual. El usuario la percibe como "poco app" comparada con apps de referencia (Yuka, MyFitnessPal, apps de nutrición con cámara). El objetivo es que `/analyze` (la pantalla más usada — "sube foto → recibe veredicto") se sienta como una app móvil real, sin tocar el pipeline de análisis que ya está validado (Sprints 0-4).

Investigación de referencia (ver Sources al final de la conversación de brainstorming): Yuka usa cámara nativa + semáforo de color + score numérico + notas cortas por ingrediente/alérgeno — el mismo patrón que ya implementa `DishResultCard`. La brecha no es el modelo de datos, es la capa de interacción alrededor: cómo se toma la foto, cómo se comunica la espera, y cómo se navega/filtra el resultado.

## 2. Decisiones (via brainstorming, todas confirmadas por el usuario)

| Decisión | Elegido | Alternativa descartada y por qué |
|---|---|---|
| Captura de foto | `<input type="file" accept="image/*" capture="environment">` (cámara nativa del SO) | Visor de cámara custom (`getUserMedia`+canvas, estilo Yuka in-app): más "nativo" pero mucho más trabajo (permisos por navegador, fallback si se deniega, mantenimiento del stream). No justifica el coste para v1. |
| Alcance de "estructura móvil" | Solo `/analyze` (bottom tab bar es global, pero el rediseño de componentes ricos se concentra en analyze) | Rediseñar también `/profile` y `/history` a fondo en la misma pasada — más superficie, se pospone. |
| Recorte de imagen | Fuera de alcance (solo rotar 90°) | Crop manual con gestos táctiles (arrastrar esquinas): mucho más trabajo (librería de crop, gestos touch) para un problema que rotar ya cubre en la mayoría de casos reales (foto tomada en vertical/horizontal incorrecto). Anotado como v2 si hace falta. |
| Logout / badge "Modo invitado" | Se mueven a una sección "Cuenta" dentro de `/profile` | Mantener una barra superior fina con logout siempre visible — descartado porque con bottom tab bar el header ya no necesita llevar esa información. |

Componentes priorizados por el usuario (multi-select, los 4 entran en alcance):
1. Skeleton loader durante el análisis (~60s)
2. Chips de filtro por veredicto (Todos/Verde/Ámbar/Rojo)
3. Hero/summary card arriba de la lista de resultados
4. Preview de imagen(es) subida(s) con opción de rotar antes de enviar

## 3. Arquitectura

### 3.1 Bottom tab bar (`(app)/layout.tsx`)

- El header superior se reduce a: wordmark "ORDR" pequeño (texto, `text-brand`, sin nav links).
- Nueva bottom tab bar fija (`position: fixed; bottom: 0`), 3 tabs: Analizar / Perfil / Historial, con iconos SVG inline simples (sin librería de iconos — 3 SVGs de 24x24, trazo simple, coherente con el resto de la UI que no usa librería de iconos hoy).
- Padding inferior con `env(safe-area-inset-bottom)` para no chocar con el home indicator de iOS; el `<main>` de cada página necesita `padding-bottom` extra para que el contenido no quede tapado por la barra fija.
- Resaltado del tab activo requiere conocer la ruta actual → nuevo client component pequeño `BottomTabBar` (usa `usePathname()`), importado desde el layout (que sigue siendo Server Component — solo el tab bar en sí es cliente, igual que ya se hace con `AnonymousCta`).
- `(app)/layout.tsx` dejará de recibir/renderizar el bloque de `user`/`signOut` en el header — esa lógica se traslada a `/profile` (ver 3.5).

### 3.2 Cámara y selección de archivos (`analyze-client.tsx`)

Se reemplaza el único `<input type="file" multiple>` actual por dos controles:
- **"Hacer foto"**: `<input type="file" accept="image/*" capture="environment">` sin `multiple` (el atributo `capture` en combinación con `multiple` no es fiable entre navegadores — dispara una foto por interacción). Cada disparo añade **un** archivo al array de `files` en estado (hasta el máximo de 4 ya validado).
- **"Elegir archivos"**: el input ya existente (multi-select, admite imagen o PDF, sin `capture`), para el flujo de galería/PDF sin cambios.

Ambos alimentan el mismo estado `files: File[]` que ya existe en `AnalyzeClient`; no cambia la validación de tipo/cantidad ni el `FormData` que se envía a `/api/analyze`.

### 3.3 Preview + rotar (nuevo componente `FilePreviewStrip`)

- Tira horizontal de miniaturas (`<img>` con `URL.createObjectURL(file)`, revocado en cleanup) por cada archivo en `files`.
- Cada miniatura: botón "rotar 90°" y botón "quitar" (✕).
- Rotar: función pura `rotateImageFile(file: File, degrees: 90 | 180 | 270): Promise<File>` — dibuja la imagen en un `<canvas>` rotado (ancho/alto intercambiados si es 90/270), exporta vía `canvas.toBlob()`, reconstruye un `File` con el mismo nombre/tipo. Sustituye el `File` en el array de estado. Los PDF no son rotables (el botón de rotar no se muestra para `application/pdf`).
- Sin librería nueva — Canvas API nativa del navegador.

### 3.4 Skeleton loader (nuevo componente `AnalyzeSkeleton`)

- Cuando `status === "loading"`, en vez de solo deshabilitar el botón con texto, se renderiza en el área de resultados una lista de 4 tarjetas fantasma (mismo tamaño/forma que `DishResultCard`, con bloques grises `animate-pulse` de Tailwind en vez de contenido). El botón sigue existiendo arriba pero ya no es la única señal de progreso.

### 3.5 Hero card + chips de filtro (dentro de `AnalyzeResults`)

- **Hero card**: nuevo bloque al principio de `AnalyzeResults`, antes de la lista — muestra "{N} platos analizados", "{M} en verde", y una barra horizontal de 3 segmentos (verde/ámbar/rojo) con ancho proporcional al recuento de cada veredicto. CSS puro (flex + `width` calculado), sin librería de gráficos.
- **Chips de filtro**: fila de 4 chips (Todos/Verde/Ámbar/Rojo) justo debajo del hero card. Estado nuevo `filter: Verdict | "all"` en `AnalyzeResults`. La lista renderizada es `result.dishes.filter(...)` sobre el estado ya cargado — **cero llamadas nuevas al backend**, el filtrado es puramente client-side sobre datos que ya llegaron en la respuesta de `/api/analyze`.
- Cada chip muestra su propio recuento (ej. "Verde (5)").

### 3.6 Sección "Cuenta" en `/profile`

- Nuevo bloque al principio de `(app)/profile/page.tsx`: si `user` existe, muestra el email y el botón "Salir" (reutiliza el server action `signOut` ya existente en `(app)/actions.ts`, sin cambios — hoy vive en `(app)/layout.tsx` y se traslada tal cual). Si es anónimo, muestra el mensaje/badge "Modo invitado" que hoy vive en el header, más un link a `/login`/`/signup` para "convertir" la sesión anónima en cuenta.

## 4. Flujo de datos

Sin cambios en el pipeline. Todo lo anterior consume/deriva de estado que ya existe en el cliente (`files: File[]`, `result: AnalyzeResponse`) o de rutas/acciones ya existentes (`signOut`). No se toca `src/lib/llm`, `src/lib/nutrition`, `src/schemas`, ni `src/app/api`.

## 5. Manejo de errores

- `capture="environment"` es solo un atributo de sugerencia: si el navegador/dispositivo no lo soporta, degrada automáticamente a un file picker normal — no requiere código de fallback.
- `rotateImageFile`: si `canvas.getContext("2d")` devuelve `null` (entorno sin soporte, caso extremadamente raro) o `toBlob` falla, se deja el archivo original sin rotar y se muestra un aviso corto inline ("No se pudo rotar esta imagen"); no bloquea el envío.
- Filtro de chips: si el filtro seleccionado no tiene resultados (ej. "Rojo" y no hay ningún plato rojo), se muestra un mensaje corto ("Ningún plato en esta categoría") en vez de una lista vacía muda.

## 6. Testing

- `npx tsc --noEmit` y `npm run build` deben quedar limpios (igual que en sprints anteriores).
- Verificación manual con Playwright en viewport móvil (ej. 390×844, iPhone-like) cubriendo: bottom tab bar visible y con tab activo resaltado, flujo "Hacer foto" (input capture presente en el DOM), preview+rotar con una imagen de prueba, skeleton visible durante una llamada real a `/api/analyze`, chips de filtro funcionando sobre un resultado real, y sección "Cuenta" en `/profile` para ambos casos (autenticado y anónimo).
- No se añaden tests unitarios nuevos (Vitest) porque no hay lógica de negocio nueva — es interacción de UI. Única función pura candidata a test (`rotateImageFile`) depende de Canvas API, no disponible de forma sencilla en el entorno Node de Vitest; se valida manualmente en navegador.

## 7. Fuera de alcance (explícito)

- Recorte manual de imagen (crop con gestos).
- Rediseño de `/history` y `/profile` más allá de la sección "Cuenta" añadida en 3.6.
- Cualquier cambio a `/api/analyze`, schemas, o el motor de scoring.
- PWA completa (manifest, service worker, instalación) — no se pidió y es un salto de alcance mayor; si se quiere más adelante, es un spec propio.
