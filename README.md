# ORDR

Elige qué pedir en cualquier carta según tu dieta y tu objetivo, en 10 segundos, con una foto.

Ver `PRD.md`, `SCHEMA.md` y `SPRINTS.md` para el diseño completo.

## Desarrollo

```bash
npm run dev      # http://localhost:3000
npm run build
npm run test     # vitest
npm run lint
```

Variables de entorno en `.env.local` (ver `.env.example`): `API_NINJAS_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Migraciones SQL en `supabase/migrations/` — aplicar en el SQL Editor de Supabase, en orden.
