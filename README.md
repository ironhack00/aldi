# Gestión inteligente de desvíos

MVP para el registro y análisis de desvíos de calidad operativa en un insectario.
Reemplaza al prototipo de una sola pantalla: ahora hay base de datos, backend,
autenticación por roles y un panel de administración desde el que se configura
**todo** el dominio sin tocar código.

---

## La idea central: nada hardcodeado

En el prototipo original las especies, actividades, problemas, causas e impactos
vivían en constantes de JavaScript. Para agregar una especie había que editar el
código y volver a desplegar.

Acá esas listas viven en la base, en dos tablas genéricas:

| Tabla | Qué guarda |
|---|---|
| `catalogs` / `catalog_items` | Las listas de valores y sus jerarquías (Problema → Especificación) |
| `field_definitions` | Qué campos tiene el formulario de desvío, de qué tipo y en qué orden |

Un desvío solo tiene como columnas propias lo que **siempre** existe: código,
fecha de ocurrencia, fecha de levantamiento y autor. Todo lo demás se guarda en
`deviation_values`, una fila por campo.

Consecuencia práctica: un administrador entra a **Administración → Campos**,
crea "Turno de trabajo", y el campo aparece en el formulario de registro y como
columna en la tabla de registros al instante. Sin migración y sin deploy.

### El rol semántico de los campos

Si todo es renombrable, ¿cómo sabe el sistema cuál es la actividad de origen
para calcular la distancia entre etapas? Cada campo tiene un `role`
(`ACTIVITY_ORIGIN`, `ACTIVITY_DETECTION`, `IMPACT`, …) que declara su
significado para los cálculos. Renombrar el campo no rompe las métricas; lo que
las define es el rol, no la etiqueta.

De la misma forma, los ítems del catálogo de actividades tienen `flowPosition`,
que es la posición en el flujo productivo. Un ítem con `flowPosition` en `null`
(por ejemplo "Stock cocina") existe pero queda fuera de la secuencia, así que no
se le calcula distancia.

---

## Stack

**Frontend** — React 18 + TypeScript + Vite, Tailwind, TanStack Query, React
Router, lucide-react.

**Backend** — Node + Fastify + TypeScript, Prisma, PostgreSQL, Zod para validar,
JWT + bcrypt para la sesión.

Se eligió Postgres y no SQLite porque la búsqueda insensible a mayúsculas
(`mode: 'insensitive'`) es específica de Postgres, y porque el MVP ya tiene que
ser la arquitectura productiva: no hay migración de motor pendiente.

---

## Estructura

```
desvios/
├── apps/
│   ├── api/                       Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma      Modelo de datos (comentado)
│   │   │   ├── migrations/        Migraciones versionadas
│   │   │   └── seed.ts            Carga inicial: catálogos, campos, usuarios
│   │   └── src/
│   │       ├── config/env.ts      Validación de variables de entorno
│   │       ├── db/prisma.ts       Cliente Prisma único
│   │       ├── plugins/           Seguridad, autenticación, manejo de errores
│   │       ├── shared/            Errores, hash de passwords, fechas
│   │       ├── modules/           Un módulo por dominio
│   │       │   ├── auth/          Login, refresh, logout
│   │       │   ├── users/         ABM de usuarios (solo admin)
│   │       │   ├── catalogs/      Listas de valores
│   │       │   ├── fields/        Campos del formulario
│   │       │   ├── deviations/    Desvíos + validación dinámica
│   │       │   ├── metrics/       Cálculo de indicadores
│   │       │   └── analysis/      Consultas en lenguaje natural
│   │       ├── app.ts             Construcción de la app (testeable)
│   │       └── server.ts          Arranque y apagado prolijo
│   └── web/                       Frontend
│       └── src/
│           ├── lib/               Cliente HTTP, sesión, hooks de datos
│           ├── components/        Primitivas de UI y campo dinámico
│           └── features/          Una carpeta por pantalla
└── scripts/smoke-test.sh          Prueba de humo end-to-end
```

Cada módulo del backend sigue el mismo patrón de tres archivos:

- `*.schemas.ts` — qué entra (validado con Zod)
- `*.service.ts` — las reglas de negocio, sin conocer Fastify
- `*.routes.ts` — los endpoints y quién puede llamarlos

---

## Correr en local

Requisitos: Node ≥ 20 y una base PostgreSQL.

```bash
# 1. Dependencias
npm install

# 2. Configuración del backend
cp apps/api/.env.example apps/api/.env
#    editar DATABASE_URL con la cadena de conexión

# 3. Base de datos: esquema + datos iniciales
npm run db:push --workspace=apps/api
npm run db:seed --workspace=apps/api

# 4. Levantar todo
npm run dev
```

Frontend en http://localhost:5173, API en http://localhost:3001.
En desarrollo Vite proxea `/api` a la API, así que no hace falta configurar CORS.

Si no tenés Postgres instalado, con Docker:

```bash
docker run -d --name desvios-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=desvios \
  -p 5432:5432 postgres:16-alpine
```

El `docker run` **crea** la base; el `DATABASE_URL` del `.env` le dice a la API
**dónde encontrarla**. Los valores tienen que coincidir:

```
docker run ... -e POSTGRES_PASSWORD=dev  -e POSTGRES_DB=desvios  -p 5432:5432
                                    |                      |         |
DATABASE_URL="postgresql://postgres:dev@localhost:5432/desvios"
                           |
                           usuario: "postgres" por defecto, no se configura
```

Si el puerto 5432 ya está ocupado (por un Postgres instalado en la máquina),
publicalo en otro y cambiá el `DATABASE_URL` igual. Por ejemplo con
`-p 55432:5432`, el `DATABASE_URL` pasa a ser `...@localhost:55432/desvios`.
Lo de la izquierda es el puerto de tu máquina; lo de la derecha, el de adentro
del contenedor, que siempre es 5432.

Arrancar y parar la base sin perder datos:

```bash
docker stop desvios-db      # los datos quedan en el contenedor
docker start desvios-db
```

### Usuarios de prueba

| Usuario | Rol | Puede |
|---|---|---|
| `admin@demo.com` | ADMIN | Todo: catálogos, campos, usuarios |
| `supervisor@demo.com` | SUPERVISOR | Registrar, editar y consultar desvíos |
| `operador@demo.com` | OPERADOR | Registrar y consultar |

Contraseña: `Demo1234!` (se cambia con `SEED_PASSWORD` en el `.env`).

> **Antes de producción**: eliminar el panel de credenciales de la pantalla de
> login (está marcado con un `TODO(produccion)` en
> `apps/web/src/features/auth/LoginPage.tsx`) y cambiar las contraseñas.

### Prueba de humo

```bash
./scripts/smoke-test.sh
```

Recorre el flujo completo contra la API en ejecución: login, permisos por rol,
alta con campos dinámicos, validaciones, métricas, administración y ciclo de
sesión. Es idempotente: borra todo lo que crea, así que se puede correr sobre la
base de la demo sin ensuciarla.

---

## Deploy

### Base de datos — Neon (gratis)

1. Crear un proyecto en [neon.tech](https://neon.tech).
2. Copiar la *connection string* (incluye `?sslmode=require`).

### Backend — Render

1. **New +** → **Web Service**, apuntando al repositorio.
2. Configuración:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm run start`
   - **Health Check Path**: `/health`
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la de Neon |
   | `JWT_ACCESS_SECRET` | `openssl rand -hex 48` |
   | `JWT_REFRESH_SECRET` | otro, distinto |
   | `CORS_ORIGINS` | `https://<tu-proyecto>.vercel.app` |
   | `NODE_ENV` | `production` |
   | `SEED_PASSWORD` | la contraseña de los usuarios demo |

4. Con el servicio arriba, cargar los datos iniciales una sola vez desde la
   consola de Render (**Shell**): `npm run db:seed`

También está `apps/api/render.yaml` para crearlo como Blueprint.

> El plan free de Render duerme el servicio tras 15 minutos sin tráfico, y el
> primer request después tarda unos 30 segundos. **Antes de una demo, abrir
> `https://<servicio>.onrender.com/health` para despertarlo.**

### Frontend — Vercel

1. **Add New** → **Project**, apuntando al repositorio.
2. **Root Directory**: `apps/web` (Vercel detecta Vite solo).
3. Variable de entorno: `VITE_API_URL` = `https://<servicio>.onrender.com`
4. Deploy.

> El orden importa: la URL de Vercel va en `CORS_ORIGINS` de Render, y la de
> Render en `VITE_API_URL` de Vercel. Conviene desplegar primero el backend,
> después el frontend, y volver a Render a completar `CORS_ORIGINS`.

---

## Responsive

La app se usa tanto desde una PC de escritorio como desde el teléfono en el
galpón, así que cada pantalla tiene que entrar en cualquier ancho.

Dos decisiones que vale la pena conocer antes de tocar el CSS:

- **El listado de registros tiene dos vistas de los mismos datos.** Abajo de
  `lg` son tarjetas apiladas (`TarjetaDesvio`), arriba es tabla. No es
  duplicación por descuido: las columnas son dinámicas (dependen de cuántos
  campos marque el admin como visibles), así que la tabla no tiene ancho
  máximo y en un teléfono el scroll horizontal esconde justo la columna que
  importa. El criterio de formato de cada valor vive en `ValorCampo` y lo
  comparten las dos vistas.
- **`.tarjeta` lleva `min-w-0`.** Las tarjetas casi siempre son hijas de un
  grid o un flex, que les dan `min-width: auto`: sin el `min-w-0` no se pueden
  encoger por debajo de su contenido, el `truncate` de adentro nunca se activa
  y la tarjeta desborda la pantalla.

Para verificarlo hay un banco de pruebas que carga cada ruta en iframes de
varios anchos y avisa si alguna desborda:

```bash
npm run dev
# y abrir http://localhost:5173/dev/responsive-check.html
```

Vive en `apps/web/dev/` y no en `public/` a propósito: así Vite lo sirve en
desarrollo pero no lo copia al build de producción.

---

## Seguridad

- **Contraseñas**: hash bcrypt con 12 rondas. Nunca se guarda el texto plano.
- **Sesión en dos tokens**: el *access token* (JWT, 15 min) vive solo en memoria
  del navegador; el *refresh token* (opaco, 7 días) viaja en una cookie
  `httpOnly` que el JavaScript de la página no puede leer. Un XSS no se lleva la
  sesión. El refresh está hasheado en la base, así que se puede revocar.
- **Rotación**: cada refresh revoca el token anterior y emite uno nuevo, de modo
  que un token robado sirve una sola vez.
- **Roles verificados en el servidor**: cada endpoint declara quién puede
  llamarlo. Esconder un botón en el frontend no es control de acceso.
- **Rate limit**: 300 req/min global, 10/min en login, 20/min en análisis.
- **CORS** con lista blanca explícita; `helmet` para las cabeceras.
- **Errores opacos**: al cliente nunca le llega un stack trace ni una query.
- Al desactivar un usuario o cambiarle el rol se revocan sus sesiones abiertas.

---

## Módulo de análisis

La pantalla **Análisis** responde preguntas en lenguaje natural sobre los
desvíos. Está construida sobre una interfaz `AIProvider` con dos
implementaciones:

- **`local`** (activa por defecto) — responde con las métricas reales calculadas
  sobre la base. No es un modelo de lenguaje: reconoce la intención de la
  pregunta, encuentra el campo que se está consultando (aunque sea un campo
  creado ayer desde el panel) y responde con la cifra **más la evidencia que la
  respalda**. Si hay empate, lo dice en lugar de elegir un ganador arbitrario.

- **`codex`** — el motor de la empresa. **Está escrito pero no conectado**: falta
  el endpoint y las credenciales. Cuando estén:

  1. completar `CODEX_API_URL` y `CODEX_API_KEY` en el `.env`;
  2. poner `AI_PROVIDER=codex`;
  3. revisar los dos `TODO(codex)` de
     `apps/api/src/modules/analysis/codex.provider.ts`, que marcan la forma del
     request y de la respuesta.

  Si Codex falla o no responde, el adaptador cae automáticamente al motor local
  y lo informa en la respuesta. La pantalla no cambia en ningún caso: siempre
  llama a `POST /api/analysis/ask`.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/auth/login` · `/refresh` · `/logout` | público |
| GET | `/api/auth/me` | autenticado |
| GET | `/api/catalogs` · `/:key` | autenticado |
| POST/PATCH/DELETE | `/api/catalogs` · `/:id/items` · `/items/:id` | admin |
| GET | `/api/fields` | autenticado |
| POST/PATCH/DELETE | `/api/fields` | admin |
| GET/POST | `/api/deviations` | autenticado |
| PATCH | `/api/deviations/:id` | supervisor, admin |
| DELETE | `/api/deviations/:id` | admin |
| GET | `/api/metrics/summary` · `/opportunities` | autenticado |
| POST | `/api/analysis/ask` | autenticado |
| GET/POST/PATCH | `/api/users` | admin |

---

## Qué falta para producción

Fuera del alcance de este MVP, en orden de prioridad:

1. **Ciclo de vida del desvío**: hoy se crea y se consulta. Falta asignar
   responsable, registrar acciones correctivas y cerrarlo.
2. **Auditoría**: quién cambió qué y cuándo. El modelo ya tiene `createdBy` y
   `updatedAt`, pero no hay historial de cambios.
3. **Edición de desvíos desde la UI**: el endpoint `PATCH` existe y está
   probado, falta la pantalla.
4. **Exportación a CSV/Excel** de los registros filtrados.
5. **Recuperación de contraseña** por email (hoy la resetea el admin).
6. **Tests automatizados** en el repositorio. `app.ts` está separado de
   `server.ts` justamente para poder usar `app.inject()` sin levantar red; por
   ahora la cobertura la da `scripts/smoke-test.sh`.
7. **Reordenar catálogos** con arrastrar y soltar (el endpoint de reordenamiento
   ya existe; en campos se hace con flechas).
