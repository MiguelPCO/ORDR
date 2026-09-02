# ORDR

**Elige qué pedir en cualquier carta según tu dieta y tu objetivo, en 10 segundos, con una foto.**

Sube una foto o PDF de una carta de restaurante. ORDR lee todos los platos, los descompone en ingredientes, funda sus macros en una base de datos nutricional real, y los rankea contra tu perfil (dieta, alergias, objetivo) con un semáforo: **come esto · con matices · evita**.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-118%20passing-brightgreen)](#testing)

---

## Por qué existe

Cuando entrenas con un objetivo (definición, volumen, mantenimiento) y estás fuera de casa, la carta no te dice nada útil: no hay macros, no hay porciones, y los nombres esconden aceites, salsas y guarniciones. ORDR convierte "no sé qué pedir" en una decisión de 10 segundos.

**No calcula calorías con precisión absoluta** — eso es imposible desde una carta. El valor es decidir rápido y bien entre las opciones que tienes delante, con macros etiquetados como estimación honesta, nunca como verdad.

## Cómo funciona

```
Perfil (una vez) → Objetivo de la sesión → Foto(s) o PDF de la carta
        │
        ▼
┌─────────────────────┐   ┌──────────────────┐   ┌───────────────────────┐
│  Claude (visión)     │──▶│  API Ninjas       │──▶│  Motor de scoring      │
│  lee + descompone    │   │  funda macros por  │   │  determinista (código) │
│  cada plato          │   │  ingrediente       │   │  → veredicto + score   │
└─────────────────────┘   └──────────────────┘   └───────────────────────┘
                                                              │
                                                              ▼
                                          Platos rankeados con semáforo
```

**Regla de oro: el LLM propone, el código dispone.** Claude solo lee y descompone la carta — el veredicto final (verde/ámbar/rojo) y el `fit_score` numérico siempre los calcula un motor determinista y testeado, nunca el LLM. Esto lo hace auditable: mismo input, mismo output, siempre.

- **Guardarraíles duros** (antes de puntuar): alérgeno declarado → rojo siempre; conflicto de dieta (vegano/vegetariano incumplido, keto con carbos altos) → rojo siempre.
- **Personalización real**: el ranking cambia de forma sensata según tu objetivo — el mismo plato puede salir verde en volumen y rojo en definición.
- **Honestidad sobre falsa precisión**: cada macro mostrado indica su fuente (fundado en base de datos nutricional vs. estimado por el LLM) y el supuesto de porción usado.

## Funcionalidades

- 📸 **Análisis de carta** — 1 a 4 imágenes y/o un PDF, cualquier idioma.
- 🚦 **Semáforo por plato** con `fit_score`, razón, conflictos y detalle expandible (macros estimadas vs. fundadas).
- 👤 **Perfil persistente** — antropometría → TDEE (Mifflin–St Jeor) → target de kcal/proteína por comida, dieta, alergias, límites de grasa/carbos.
- 🎭 **Modo invitado** — analiza sin cuenta, con perfil temporal en memoria (nada se guarda).
- 📖 **Historial** de análisis pasados, con el mismo detalle que el resultado original.
- ✅ **Registro de comidas** — marca qué plato pediste y compara tu semana/mes contra tu objetivo diario de kcal y proteína.
- 🌓 Tema claro/oscuro, UI mobile-first con animaciones (GSAP).

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Estilos | Tailwind CSS v4 (`@theme`, OKLCH) |
| Estado / datos | Zustand v5 · TanStack Query v5 · React Hook Form + Zod |
| Backend | Supabase (Postgres, Auth, Row Level Security) |
| IA / visión | Claude (Anthropic) — lectura y descomposición de cartas |
| Nutrición | API Ninjas (`/v1/nutrition`) — fundamentado de macros |
| Animación | GSAP vía `useGSAP` |
| Analítica | PostHog |
| Testing | Vitest |

## Arquitectura del motor de scoring

El scoring vive enteramente en `src/lib/nutrition/scoring.ts` — funciones puras, sin dependencias de red ni de la IA. Pondera macros distinto según el objetivo:

- **Definición**: densidad proteica alta, kcal ≤ target, poca grasa.
- **Volumen**: kcal hacia/por encima del target, proteína suficiente, carbos bienvenidos.
- **Mantenimiento**: kcal cerca del target (penaliza desviarse en ambas direcciones), proteína decente.

Los umbrales (verde ≥70, ámbar ≥45) son v1 y están pensados para recalibrarse contra un test set de juicios humanos reales (ver `SPRINTS.md`, Sprint 5).

## Empezar

```bash
git clone https://github.com/MiguelPCO/ORDR.git
cd ORDR
npm install
cp .env.example .env.local   # rellena las claves, ver abajo
npm run dev                  # http://localhost:3000
```

### Variables de entorno

```bash
API_NINJAS_KEY=                    # api.calorieninjas.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
```

### Base de datos

Las migraciones SQL viven en `supabase/migrations/` — aplícalas en orden en el SQL Editor de Supabase (o vía CLI). Definen `profiles`, `analyses`, `dishes` con Row Level Security: cada usuario solo puede leer/escribir sus propias filas.

## Testing

```bash
npm run test     # vitest — 118 tests
npm run lint
npx tsc --noEmit
```

Cobertura centrada en la lógica de negocio pura (motor de scoring, cálculo de TDEE, agregación de macros) y en los route handlers de la API (mockeando Supabase/Claude/API Ninjas) — los componentes de UI se validan manualmente en navegador.

## Estructura del proyecto

```
src/
├── app/
│   ├── (app)/analyze/    # subir carta y ver resultados
│   ├── (app)/history/    # análisis pasados
│   ├── (app)/log/        # registro de comidas vs. objetivo diario
│   ├── (app)/profile/    # perfil y targets
│   └── api/              # route handlers (analyze, dishes, analyses)
├── components/features/  # componentes de dominio (DishResultCard, AnalyzeClient...)
├── lib/
│   ├── llm/               # prompt + llamada a Claude visión
│   ├── nutrition/         # fundamentado de macros, scoring, targets (TDEE)
│   ├── log/                # agregación de macros por día
│   └── supabase/          # clientes + mapeo fila↔dominio
└── schemas/               # contratos Zod compartidos
```

Documentación de diseño completa en [`PRD.md`](PRD.md), [`SCHEMA.md`](SCHEMA.md) y [`SPRINTS.md`](SPRINTS.md).

## Roadmap

- [x] Perfil, auth y guardado
- [x] Pipeline de lectura + fundamentado + scoring
- [x] Historial de análisis
- [x] Registro de comidas y resumen semanal/mensual
- [ ] Recalibración del motor de scoring contra juicios humanos reales
- [ ] Eventos de telemetría (PostHog)
- [ ] Troceado de cartas densas a alta resolución
- [ ] App móvil (Expo)

---

Construido por [Miguel](https://github.com/MiguelPCO).
