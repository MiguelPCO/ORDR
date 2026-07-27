# SPRINTS — ORDR

Roadmap ejecutable derivado de PRD.md + SCHEMA.md (D1–D4 cerrados). Cada sprint referencia secciones concretas de esos docs — no repite el diseño, lo secuencia.

---

## Sprint 0 — Validar R1 (parseabilidad API Ninjas/CalorieNinjas) + R4 (cuota free tier) ✅ DONE

**Por qué primero:** si la API no parsea bien las `nutrition_query` que generará Claude, toda la arquitectura del pipeline (PRD §7) se cae. Media hora de coste, cero coste si se descubre tarde.

**Nota:** Nutritionix cerró su acceso self-serve para uso no-comercial (jul 2026) — sustituido por **CalorieNinjas** (`api.calorieninjas.com`, marca hermana de API Ninjas): self-serve, sin tarjeta, `GET /v1/nutrition?query=` con texto libre multi-ingrediente en una sola llamada (mismo patrón que Nutritionix).

- **Acción:** `scripts/validate-api-ninjas.mjs` contra `GET https://api.calorieninjas.com/v1/nutrition` con 3 queries representativas.
- **Resultado (jul 2026): 3/3 parseables, gate ≥90% pasado.**
- **Hallazgo:** con nombre de plato genérico + sus ingredientes en la misma query (ej. "paella with chicken, shrimp, and saffron rice"), la API devuelve **ambos** — el plato agregado y los ingredientes sueltos — lo que duplicaría macros si se suma todo el `breakdown`. **Acción para Sprint 2:** el prompt de Claude debe producir `nutrition_query` como lista de ingredientes puros con cantidad, nunca mezclado con el nombre genérico del plato.
- **R4 (cuota free tier):** pendiente de confirmar límite exacto en dashboard antes del MVP — no bloqueante para seguir.

---

## Sprint 1 — Scaffold + Auth + Perfil ✅ DONE (código; falta aplicar migraciones SQL)

- Next.js 16 App Router, TS strict, Tailwind v4 (`@theme`, OKLCH), Zustand v5, TanStack Query v5, RHF+Zod. Estructura de carpetas: SCHEMA §9.
- Supabase: migraciones `profiles`/`analyses`/`dishes` + RLS: SCHEMA §1.
- Auth Supabase + "probar sin cuenta" en memoria (D1).
- `ProfileSchema` (SCHEMA §3) + página `/profile`.
- `lib/nutrition/targets.ts`: portar `bmr`/`targets` (SCHEMA §6) + tests unitarios.

## Sprint 2 — Pipeline lectura+descomposición (Claude visión) ✅ DONE

- `lib/llm/read-menu.ts`: prompt + llamada Claude visión (`claude-sonnet-5`, streaming), extracción JSON (primera `{` → última `}`), validación `LlmResponseSchema` (SCHEMA §4).
- Soporte 1–4 imágenes y/o PDF.

**Validado contra 3 cartas reales:**
- Carta "Ezequiel" (screenshot, 154KB): 18/18 platos, JSON válido, `nutrition_query` bien descompuesto (ingredientes puros, sin doble conteo).
- Web hamburguesería (screenshot viewport, 1.6MB): solo 3 platos — captura parcial (viewport, no página completa), no bug del pipeline. Ver R3.
- Carta "Ezequiel" completa (PDF, 12.8MB, tríptico 2 caras): **89/89 platos**, JSON válido; el LLM excluyó correctamente los "menús especiales" combinados (evita doble conteo) y separó el listado de alérgenos como referencia, no como plato.

**Hallazgos técnicos (aplicados al código):**
- Claude Vision rechaza imágenes >10MB (`400 invalid_request_error`) — screenshot de página completa de 24.8MB falló. **R6 nuevo en PRD.**
- Anthropic SDK exige `messages.stream()` en vez de `.create()` para respuestas largas (menús con 80+ platos superan el timeout heurístico de streaming no-activado) — implementado.
- `max_tokens: 32000` necesario para cartas grandes (16384 truncaba el PDF de 89 platos).

## Sprint 3 — API Ninjas + Scoring + `/api/analyze`

- `lib/nutrition/api-ninjas.ts` cliente real (aprendizajes Sprint 0), `GroundedMacrosSchema` (SCHEMA §5).
- `lib/nutrition/scoring.ts`: portar `scoreDish` (SCHEMA §7).
- `hardRed` = alergia + conflicto dieta (guardarraíl PRD §9).
- `/api/analyze/route.ts`: orquestación completa (SCHEMA §8), fallback `llm_draft_verdict` si API Ninjas falla por plato, persistencia condicional si autenticado.

## Sprint 4 — UI resultados + historial

- `/analyze`: upload multi-imagen/PDF, loading states, semáforo + `fit_score` + detalle bajo demanda.
- `/history` + `GET /api/analyses`, `/api/analyses/:id`.
- Motion (GSAP) en transición de veredicto.

## Sprint 5 — Recalibración + telemetría

- Test set propio: veredicto motor vs juicio humano (PRD §10).
- Recalibrar constantes de scoring (0.40/0.45, umbrales 70/45).
- Eventos PostHog clave.
- Resolver R2 (comunicar supuesto de porción en UI) y revisar R3 (cartas densas).

---

*Sprint 0 bloquea todo lo demás. En cuanto haya credenciales API Ninjas, correr `node --env-file=.env.local scripts/validate-api-ninjas.mjs` y evaluar el gate antes de tocar Sprint 1.*
