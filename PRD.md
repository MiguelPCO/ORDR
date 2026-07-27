# PRD — ORDR

> Elige qué pedir en cualquier carta según tu dieta y tu objetivo, en 10 segundos, con una foto.

**Estado:** Discover/Define cerrado · núcleo validado (lectura + descomposición) · Nutritionix cerró acceso self-serve → sustituido por **API Ninjas/CalorieNinjas**, **validado** (Sprint 0, 3/3 casos — ver Riesgos para matiz de doble conteo).
**Autor:** Miguel · **Fase Double Diamond:** cierre de Define → Develop.

---

## 1. Problema

Cuando entrenas con un objetivo (definición, volumen, mantenimiento) y estás fuera de casa —viaje, sitio nuevo, comida que no conoces— la carta no te dice nada útil: no hay macros, no hay porciones, y los nombres esconden aceites, salsas y guarniciones. Acabas eligiendo a ojo o comiendo peor de lo que querías.

## 2. Solución

Subes una **foto o PDF** de la carta. La app:
1. Lee todos los platos (cualquier idioma).
2. Descompone cada uno en ingredientes con porciones estimadas.
3. Funda esos ingredientes en macros reales vía API de nutrición.
4. Los rankea contra **tu perfil y tu objetivo** con un semáforo: come esto / con matices / evita.

El valor no es "calcular calorías" (eso es aproximado por naturaleza). El valor es **decidir rápido y bien** entre las opciones que tienes delante.

## 3. Usuario objetivo

Persona que **entrena con intención** y controla su alimentación: sabe qué es proteína/kcal/superávit, quiere adherencia sin fricción. Vocabulario deportivo (estilo Nippard), no "comer sano" genérico.

**No es para:** usuario casual que solo quiere "opciones healthy". Ese lenguaje diluiría el producto.

## 4. Principios de producto (no negociables)

1. **Honestidad sobre falsa precisión.** El protagonista es el *ranking relativo* (semáforo), no un número absoluto. Los macros se muestran como estimación etiquetada, nunca como verdad.
2. **La incertidumbre residual es la porción, y se comunica.** Los macros por ingrediente están fundados en base de datos; lo que estimamos es la cantidad. Se muestra el supuesto ("asume ración media").
3. **El veredicto lo calcula el código, no el LLM.** Determinista, auditable, testeable.
4. **Decisión en 10 segundos.** Todo lo demás (detalle, ajustes) es secundario y bajo demanda.

## 5. Scope

### MVP (Develop → Deliver)
- Input: **1–4 imágenes** y/o **PDF** (validado en el harness).
- **Perfil completo** persistente: datos antropométricos → TDEE → objetivo → target kcal/proteína por comida.
- Dieta y alergias como **guardarraíl duro** (alérgeno = rojo siempre).
- Pipeline híbrido: lectura+descomposición (Claude) → macros fundados (API Ninjas) → **motor de ranking determinista**.
- Resultados: platos rankeados, semáforo, macros fundados (etiquetados), supuestos, conflictos, nota combinatoria.
- Auth + guardado de perfil e historial de análisis.

### v2
- **Scraping de URL** de carta (frágil: muchas cartas web son imágenes/PDF; requiere fallback a captura). Deliberadamente fuera del MVP.
- Ajuste de porción por el usuario (recalcula macros y veredicto en vivo).
- "Construir la comida": combinar N platos hacia el target y ver el total.

### Más adelante
- App móvil (Expo) — el caso de uso "estoy en el restaurante" pide móvil, pero se valida en web primero.
- Troceado de carta a alta resolución (columnas/secciones) para cartas densas o con letra pequeña.
- Compartir/guardar restaurantes favoritos.

### Fuera de scope
- Base de datos propia de restaurantes. Registro de comidas diario (no somos MyFitnessPal). Recomendación médica.

## 6. Flujo principal

```
Perfil (una vez) ──> Elegir objetivo del momento ──> Subir foto/PDF ──>
  [Claude lee + descompone] ──> [API Ninjas funde macros] ──>
  [motor calcula veredicto + fit_score] ──> Platos rankeados con semáforo
```

## 7. El núcleo: pipeline híbrido

| Etapa | Responsable | Entrada | Salida |
|---|---|---|---|
| Lectura + descomposición | **Claude (visión)** | imágenes/PDF + perfil | por plato: `nutrition_query`, `reason`, `assumptions`, `conflicts`, macros aprox |
| Fundamentado de macros | **API Ninjas** (`/v1/nutrition`, texto libre) | `nutrition_query` | macros reales por ingrediente → agregado |
| Ranking | **Motor determinista (código)** | macros fundados + target del perfil | `final_verdict`, `fit_score`, orden |
| Presentación | UI | resultado | semáforo + detalle bajo demanda |

Regla de oro: **el LLM propone, el código dispone.** El `llm_draft_verdict` solo sirve de fallback si API Ninjas falla para un plato; el veredicto canónico siempre sale del motor.

## 8. Personalización → target (TDEE)

El "perfil completo" existe para calcular un **target de kcal y proteína por comida**, que es lo que el motor de ranking usa.

1. **BMR (Mifflin–St Jeor):**
   `BMR = 10·peso(kg) + 6.25·altura(cm) − 5·edad + s` (s = +5 hombre / −161 mujer)
2. **TDEE:** `TDEE = BMR · factor_actividad` (1.2 sedentario … 1.725 muy activo). Override manual disponible.
3. **Target diario según objetivo:** definición `TDEE·0.80`, volumen `TDEE·1.12`, mantenimiento `TDEE`.
4. **Proteína diaria:** `peso(kg) · g_por_kg` (default 2.0).
5. **Por comida:** target diario / nº de comidas (default 3). Este `meal_target_kcal` y `meal_protein_g` alimentan el ranking.

## 9. Lógica de ranking (la "cabeza")

Qué macro importa según objetivo:

- **Definición:** densidad proteica alta, kcal ≤ target, poca grasa. Premia saciedad por caloría.
- **Volumen:** kcal hacia/por encima del target, proteína suficiente, carbos bienvenidos.
- **Mantenimiento:** kcal cerca del target (penaliza desviarse por arriba y por abajo), proteína decente.

**Guardarraíles duros (antes de puntuar):**
- Alérgeno presente → **rojo**, siempre.
- Conflicto de dieta (vegano/vegetariano incumplido; keto con carbos altos) → **rojo**.

La fórmula concreta (constantes tuneables) vive en `SCHEMA.md → módulo de scoring`. Es v1 y debe recalibrarse comparándola con juicios reales.

## 10. Éxito

- **Cualitativo (portfolio):** "en una foto sé qué pedir" se entiende y funciona en <10s.
- **Técnico:** ≥90% de platos leídos correctamente en cartas nítidas; `nutrition_query` parseable por la API ≥90%; veredicto coherente con juicio humano en test set propio.
- **Producto:** el ranking cambia de forma sensata al cambiar de objetivo (personalización real, no decorativa).

## 11. Stack

Next.js 16 (App Router, `create-next-app@latest` instaló 16 — actualizado desde el 15 original) · React 19 · TypeScript strict · Tailwind v4 (`@theme`, OKLCH) · Zustand v5 · TanStack Query v5 · React Hook Form v7 + Zod · Supabase (auth, Postgres, RLS) · GSAP vía `useGSAP` · PostHog (EU) · Vercel. Claude (visión) + API Ninjas (nutrición).

## 12. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Estado | Recomendación |
|---|---|---|---|
| R1 | **Parseabilidad API Ninjas** de las `nutrition_query` | **Validado** (jul 2026, 3/3 casos) | Ver hallazgo abajo: doble conteo si la query mezcla nombre genérico de plato + sus ingredientes |
| R2 | Estimación de porción (incertidumbre residual) | Conocido | Comunicar supuesto; v2: ajuste manual |
| R3 | Cartas densas / letra pequeña a 1568px | Conocido | v2: troceado a alta resolución |
| R4 | Límites/coste free tier API Ninjas | Abierto | Verificar cuota antes del MVP |
| R5 | Scraping de URL frágil | Mitigado | Fuera del MVP (v2) |
| D1 | **Auth: perfil guardado (Supabase) vs sesión anónima** | **Cerrado** | Auth + perfil persistente; "probar sin cuenta" ejecuta en memoria |
| D2 | ¿Calcular TDEE (antropometría) o pedir target kcal directo? | **Cerrado** | Calcular TDEE con override manual |
| D3 | Nutritionix vs Edamam vs API Ninjas | **Cerrado** (revisado) | Nutritionix cerró self-serve no-comercial (jul 2026) → **API Ninjas** (ex-CalorieNinjas): `/v1/nutrition`, texto libre multi-ingrediente, self-serve sin tarjeta |
| D4 | Guardar historial de análisis | **Cerrado** | Sí (barato, buen UX y superficie de portfolio) |

**Hallazgo Sprint 0 (R1):** con `"1 serving paella with chicken, shrimp, and saffron rice"`, API Ninjas devolvió 4 ítems: `paella` (447 kcal, ya incluye pollo/gamba/arroz) **más** `chicken`, `shrimp`, `saffron rice` por separado → sumar el breakdown entero duplicaría macros. Implicación para Sprint 2: el prompt de Claude debe generar `nutrition_query` como **lista de ingredientes puros con cantidad** (nunca mezclando el nombre del plato genérico junto a sus componentes).

---

*D1–D4 cerrados. R1 validado contra API Ninjas (era Nutritionix; sustituido tras perder acceso self-serve) — con el matiz de arriba, a incorporar en el prompt de Sprint 2.*
