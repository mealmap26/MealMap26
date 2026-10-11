# MealMap

API REST para planificación de comidas. Resuelve dos problemas:

1. **"¿Qué cocino con lo que tengo?"** — el usuario registra los ingredientes disponibles en su nevera (sin cantidades: "tengo arroz, pollo, tomate") y la app le sugiere recetas del catálogo que puede preparar con eso.
2. **"¿Qué compro esta semana?"** — el usuario define sus metas de macros (calorías, proteína, carbohidratos y grasas por día) y la app genera un plan semanal de comidas más una lista de compras con cantidades exactas (por ejemplo "500 g de pechuga de pollo", "1 kg de arroz") para cumplirlas.

No es un meal prep estricto: no le dice al usuario que prepare todo el domingo. Le dice qué necesita tener y cuánto, para poder cocinar bien durante la semana.

## Índice

- [Estado del proyecto](#estado-del-proyecto)
- [Módulos](#módulos)
- [Stack](#stack)
- [Equipo y responsabilidades](#equipo-y-responsabilidades)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Endpoints](#endpoints)
- [Autenticación y roles](#autenticación-y-roles)
- [Modelo de datos](#modelo-de-datos)
- [Pruebas](#pruebas)
- [Pruebas con Postman](#pruebas-con-postman)
- [Guía para agregar tu módulo](#guía-para-agregar-tu-módulo)
- [CI/CD y despliegue](#cicd-y-despliegue)

## Estado del proyecto

| Parte | Responsable | Estado |
|---|---|---|
| Setup de NestJS, PostgreSQL y TypeORM | Persona 1 | Listo |
| Las 8 entidades del modelo de datos | Persona 1 | Listo |
| Auth: registro, login, logout con JWT | Persona 1 | Listo |
| 2FA con TOTP (QR + verificación) | Persona 1 | Listo |
| Guards (`JwtAuthGuard`, `RolesGuard`) | Persona 1 | Listo |
| `POST /seed` con datos iniciales | Persona 1 | Listo |
| Swagger en `/api` | Persona 1 | Listo |
| Pruebas de Auth (unitarias, integración y Postman) | Persona 1 | Listo |
| Catálogo (recetas, ingredientes, categorías) | Persona 2 | Listo |
| Módulo Nevera (`/fridge`) | Persona 2 | Listo |
| GitHub Actions (CI) | Persona 3 (pipeline base) y Persona 2 (Newman, todas las ramas, hook `pre-push`) | Listo |
| Módulo Meal Prep (macros, plan semanal, lista de compras) | Persona 3 | Listo |
| Despliegue en Render (Blueprint + deploy hook) | Persona 3 | Listo |

## Módulos

### Módulo 1 — Nevera (¿Qué cocino hoy?)

El usuario tiene una "nevera virtual": una lista de ingredientes disponibles. Cuando pide sugerencias, la app filtra el catálogo de recetas y devuelve las que se pueden preparar con lo que tiene.

1. El usuario agrega ingredientes a su nevera: `POST /fridge`
2. Pide sugerencias: `GET /fridge/suggestions`
3. La app responde con las recetas que puede preparar con esos ingredientes.

### Módulo 2 — Meal prep semanal

El usuario configura sus macros objetivo (por ejemplo, 2000 kcal/día y 150 g de proteína/día). La app selecciona recetas del catálogo que, combinadas, cumplan esas metas, las organiza en un plan de 7 días y calcula las cantidades totales de cada ingrediente que hay que comprar.

1. El usuario configura sus macros: `PATCH /users/me/macros`
2. Genera su plan: `POST /meal-plan/generate`
3. Consulta el plan día por día: `GET /meal-plan`
4. Pide su lista de compras: `GET /meal-plan/shopping-list`, con los ingredientes consolidados y sus cantidades exactas.

## Stack

- NestJS 12 con TypeScript estricto
- PostgreSQL 16 + TypeORM (entidades con decoradores)
- Autenticación con JWT (`@nestjs/jwt`) y 2FA con TOTP (`otplib` + `qrcode`)
- Documentación con Swagger (`@nestjs/swagger`)
- Pruebas con Vitest (unitarias), Supertest (integración) y Postman
- CI/CD con GitHub Actions (pruebas, Postman con Newman y despliegue)
- Despliegue en Render

> El proyecto usa **Vitest** en lugar de Jest: es el runner que trae por defecto la versión actual de Nest, y es compatible con la sintaxis de Jest (`describe`, `it`, `expect`).

## Equipo y responsabilidades

Cada persona tiene un módulo, sus pruebas y una responsabilidad extra:

| Persona | Módulo | Responsabilidad extra |
|---|---|---|
| Persona 1 | Base del proyecto + Auth | — |
| Persona 2 | Catálogo + Módulo Nevera | GitHub Actions (CI) |
| Persona 3 | Módulo Meal Prep | Despliegue |

## Puesta en marcha

### Requisitos

- Node.js 20.19+, 22.13+ o 24.11+ (probado con Node 24)
- Docker Desktop (para PostgreSQL)

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Crear tu archivo de variables de entorno
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env

# 3. Levantar PostgreSQL
docker compose up -d

# 4. Arrancar la API en modo desarrollo
npm run start:dev
```

La API queda en `http://localhost:3000` y la documentación Swagger en `http://localhost:3000/api`.

Las tablas se crean solas al arrancar (`synchronize` está activo mientras `NODE_ENV` no sea `production`).

### Cargar los datos iniciales

`POST /seed` crea 5 categorías, 77 ingredientes, 81 recetas (con sus ingredientes y macros por porción calculados) y el usuario administrador. Es **idempotente**: puedes llamarlo varias veces sin duplicar nada ni pisar cambios.

```bash
curl -X POST http://localhost:3000/seed -H "x-seed-key: <el valor de SEED_KEY en tu .env>"
```

También puedes llamarlo desde Swagger (`/api`, sección *Seed*). El administrador se crea con `ADMIN_EMAIL` y `ADMIN_PASSWORD` de tu `.env`.

## Variables de entorno

Se definen en `.env` (no se sube a git). `.env.example` es la plantilla: **si agregas una variable nueva, agrégala también ahí.**

| Variable | Descripción |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL. Docker Compose usa los mismos valores para crear la base. |
| `DATABASE_URL` | Opcional. Si existe (Render la entrega), se usa en lugar de las variables `DB_*`. |
| `DB_SSL` | `true` para conectarse con SSL (por ejemplo, a la base de Render desde fuera de su red). |
| `NODE_ENV` | `development` o `production`. En `production` se desactiva `synchronize` y se ejecutan las migraciones al arrancar. |
| `JWT_SECRET` | Secreto con el que se firman los tokens. Usa uno largo y aleatorio. **La app no arranca sin él.** |
| `JWT_EXPIRES_IN_SECONDS` | Duración del token (por defecto 3600). |
| `SEED_KEY` | Llave que debe enviarse en el header `x-seed-key` para usar `POST /seed`. Si no está definida, el seed queda deshabilitado. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credenciales del administrador que crea el seed. Cámbialas en producción. |

> El puerto de PostgreSQL por defecto es **5442** (no el 5432) para no chocar con instalaciones locales de PostgreSQL. Si lo cambias, hazlo en `.env`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Arranca la API y recarga al guardar |
| `npm run build` | Compila a `dist/` |
| `npm test` | Pruebas unitarias (mocks, no requieren base de datos) |
| `npm run test:e2e` | Pruebas de integración con Supertest (requieren `docker compose up -d`) |
| `npm run test:cov` | Pruebas unitarias con reporte de cobertura |
| `npm run test:ci` | Unitarias + integración con cobertura; falla si queda por debajo del 80 % (es lo que corre el CI) |
| `npm run lint` | Linter (oxlint) |
| `npm run migration:run` | Compila y ejecuta las migraciones pendientes (en producción se ejecutan solas al arrancar) |
| `npm run prepare` | Activa los hooks de git del repositorio (`.githooks/`). Se ejecuta solo con `npm install` |

### Hook `pre-push`

`npm install` configura git para usar la carpeta versionada `.githooks/` (`git config core.hooksPath .githooks`). Desde ese momento, cada `git push` ejecuta antes `npm run lint`, `npm run build` y `npm test`; si alguno falla, el push se cancela. Las pruebas de integración no se corren ahí porque necesitan Docker: de esas se encarga GitHub Actions.

Para comprobar que quedó activo: `git config core.hooksPath` debe mostrar `.githooks`. Solo en una emergencia puedes saltarte la verificación con `git push --no-verify`.

## Estructura del proyecto

```
src/
├── auth/            Registro, login, logout, 2FA, guards (JwtAuthGuard, RolesGuard), decoradores
├── users/           Entidad User, UsersService, enum Role
├── categories/      CRUD de categorías
├── ingredients/     CRUD de ingredientes (recalcula las recetas al editar sus macros)
├── recipes/         CRUD de recetas, cálculo de macros por porción, enum Unit
├── fridge/          Nevera del usuario y sugerencias de recetas
├── meal-plan/       Plan semanal y lista de compras, enum MealType
├── seed/            POST /seed y sus datos iniciales
├── database/        Configuración de TypeORM y data source de las migraciones
├── migrations/      Migraciones (se ejecutan solas en producción)
├── common/          Código compartido (transformer de decimales)
├── app.module.ts    Módulo raíz
├── app.setup.ts     Configuración compartida de la app (pipes de validación)
└── main.ts          Arranque y configuración de Swagger
test/                Pruebas de integración y utilidades (test/support)
postman/             Colección y entorno de Postman
docs/                Guía de despliegue en Render
.githooks/           Hook pre-push versionado
.github/workflows/   Pipeline de CI/CD
```

## Endpoints

La documentación interactiva está en `http://localhost:3000/api` (Swagger). El documento OpenAPI en crudo, útil para importarlo en Postman, está en `http://localhost:3000/api-json`.

### Auth (listo)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/register` | Público | Crea un usuario con rol `USER` |
| POST | `/auth/login` | Público | Devuelve el JWT. Si el usuario tiene 2FA, exige `totpCode` |
| POST | `/auth/logout` | Token | Invalida el token actual |
| POST | `/auth/2fa/enable` | Token | Genera el QR para Google Authenticator |
| POST | `/auth/2fa/verify` | Token | Verifica el código TOTP y activa el 2FA |

### Seed (listo)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/seed` | Header `x-seed-key` | Carga categorías, ingredientes, recetas y el usuario admin |

### Catálogo

Todas las rutas piden token. **Leer** (`GET`) está disponible para cualquier usuario autenticado (el `USER` necesita los ids de los ingredientes para llenar su nevera); **crear, editar y borrar** solo para `ADMIN` (un `USER` recibe 403).

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/categories` | Token | Listar categorías, ordenadas por nombre |
| GET | `/categories/:id` | Token | Ver una categoría |
| POST | `/categories` | ADMIN | Crear categoría (`{ "name" }`, 2 a 60 caracteres) |
| PATCH | `/categories/:id` | ADMIN | Renombrar categoría |
| DELETE | `/categories/:id` | ADMIN | Eliminar categoría (409 si tiene recetas) |
| GET | `/ingredients` | Token | Listar ingredientes, ordenados por nombre. `?search=pollo` filtra por nombre |
| GET | `/ingredients/:id` | Token | Ver un ingrediente |
| POST | `/ingredients` | ADMIN | Crear ingrediente (`name`, `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g` y, opcional, `gramsPerUnit`) |
| PATCH | `/ingredients/:id` | ADMIN | Editar ingrediente (parcial). Si cambian sus macros o `gramsPerUnit`, recalcula las recetas que lo usan |
| DELETE | `/ingredients/:id` | ADMIN | Eliminar ingrediente (409 si alguna receta lo usa; de las neveras se quita solo) |
| GET | `/recipes` | Token | Listar recetas, ordenadas por nombre. Filtros opcionales y combinables: `categoryId`, `search`, `maxPrepTime`, `maxCalories`, `minProtein` |
| GET | `/recipes/:id` | Token | Ver una receta con su categoría y sus ingredientes (cantidades para la receta completa) |
| POST | `/recipes` | ADMIN | Crear receta (`name`, `description`, `prepTimeMinutes`, `servingSize`, `categoryId`, `ingredients: [{ ingredientId, quantity, unit }]`) |
| PATCH | `/recipes/:id` | ADMIN | Editar receta (parcial). Si se envía `ingredients`, reemplaza todas las líneas |
| DELETE | `/recipes/:id` | ADMIN | Eliminar receta y sus líneas (409 si está en algún plan semanal) |

Reglas del catálogo:

- Los nombres son únicos sin distinguir mayúsculas ("Snack" y "snack" chocan): un nombre repetido responde 409. Se guardan sin espacios al inicio ni al final.
- **Los macros de las recetas los calcula el servidor**; si se envían `calories`, `protein`, `carbs` o `fat` la petición se rechaza con 400. Se suman los valores por 100 g de cada ingrediente (`ml` se toma como `g` y `unidad` se convierte con `gramsPerUnit`) y se dividen entre `servingSize`, redondeando a 2 decimales. Se recalculan al cambiar los ingredientes o las porciones de la receta, y al editar los macros o `gramsPerUnit` de un ingrediente.
- Una línea en `unidad` exige que el ingrediente tenga `gramsPerUnit` (si no, 400). Tampoco se le puede quitar `gramsPerUnit` a un ingrediente que alguna receta usa en `unidad`.
- Si la categoría o algún ingrediente de la receta no existe, responde 404 y el mensaje dice cuáles.
- Enviar `null` en un campo obligatorio al editar responde 400 (solo `description` y `gramsPerUnit` admiten `null`).

### Nevera — Módulo 1

Solo para usuarios con rol `USER` (el `ADMIN` recibe 403). Cada usuario ve únicamente su propia nevera.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/fridge` | Ver los ingredientes del usuario: `[{ ingredientId, name }]`, ordenados por nombre |
| POST | `/fridge` | Agregar un ingrediente: `{ "ingredientId": "<uuid>" }`. 404 si no existe, 409 si ya está en la nevera |
| DELETE | `/fridge/:ingredientId` | Quitar un ingrediente (204). 404 si no está en la nevera |
| GET | `/fridge/suggestions` | Recetas sugeridas con lo que hay en la nevera |

Cómo funcionan las sugerencias:

- Se comparan los ingredientes de cada receta con los de la nevera (sin cantidades).
- Por defecto solo salen las recetas que se pueden preparar completas. Con `?maxMissing=N` (entero de 0 a 5) también salen las que tienen hasta N ingredientes faltantes.
- Cada sugerencia trae `recipe` (id, nombre, tiempo, macros por porción y categoría), `matchedIngredients`, `totalIngredients`, `missingIngredients` (`[{ id, name }]`) y `canPrepare` (`true` si no falta nada).
- Solo se incluyen recetas que usan al menos un ingrediente de la nevera. Se ordenan por menos faltantes, mayor proporción de coincidencia y nombre. Con la nevera vacía la lista es vacía.

### Meal prep — Módulo 2

| Método | Ruta | Descripción |
|---|---|---|
| PATCH | `/users/me/macros` | Actualizar las metas de macros |
| POST | `/meal-plan/generate` | Generar el plan semanal según los macros del usuario |
| GET | `/meal-plan` | Ver el plan semanal actual |
| GET | `/meal-plan/shopping-list` | Lista de compras con cantidades exactas |

## Autenticación y roles

Para las rutas protegidas se envía el header `Authorization: Bearer <accessToken>`. En Swagger, usa el botón **Authorize**.

- **Contraseñas:** se guardan como hash de bcrypt, nunca en texto plano.
- **Login:** responde siempre "Credenciales inválidas" si falla el email o la contraseña, para no dar pistas.
- **Logout:** cada token lleva un identificador único (`jti`). Al cerrar sesión se guarda en la tabla `revoked_tokens` y el guard lo rechaza desde entonces.
- **2FA:** se activa en dos pasos. `enable` devuelve el QR (y la clave manual) pero **no activa** nada; solo cuando `verify` recibe un código correcto queda activo. Desde ese momento el login exige `totpCode`. No se puede volver a llamar a `enable` con el 2FA activo.
- **Registro:** siempre crea usuarios `USER`; el campo `role` se rechaza. El `ADMIN` sale del seed.
- **El rol se lee del token**, así que un cambio de rol aplica desde el siguiente login.

| Rol | Qué puede hacer |
|---|---|
| `ADMIN` | Gestiona el catálogo global (recetas, ingredientes, categorías). Viene precargado en el seed. |
| `USER` | Usa la app: registra su nevera, genera su plan y ve su lista de compras. |

## Modelo de datos

Todos los IDs son UUID.

| Tabla | Campos principales |
|---|---|
| `users` | `id`, `email` (único), `password` (hash), `role` (`ADMIN` \| `USER`), `twoFASecret`, `twoFAEnabled`, `dailyCalories`, `dailyProtein`, `dailyCarbs`, `dailyFat`, `createdAt` |
| `recipes` | `id`, `name`, `description`, `prepTimeMinutes`, `calories`, `protein`, `carbs`, `fat`, `servingSize`, `categoryId`, `createdAt` |
| `ingredients` | `id`, `name` (único), `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g`, `gramsPerUnit` (peso de una unidad en g; `null` si no aplica) |
| `recipe_ingredients` | `id`, `recipeId`, `ingredientId`, `quantity`, `unit` (`g` \| `ml` \| `unidad`) |
| `categories` | `id`, `name` (único). Ej.: "Alto en proteína", "Vegetariano", "Rápido", "Desayuno", "Snack" |
| `user_ingredients` | `id`, `userId`, `ingredientId` (la nevera del usuario) |
| `meal_plans` | `id`, `userId`, `weekStartDate`, `createdAt` |
| `meal_plan_entries` | `id`, `mealPlanId`, `recipeId`, `dayOfWeek` (1–7), `mealType` (`BREAKFAST` \| `LUNCH` \| `DINNER` \| `SNACK`) |
| `revoked_tokens` | `jti`, `expiresAt` (tokens invalidados por logout) |

Puntos a tener en cuenta al construir sobre este modelo:

- **Macros de `recipes`** (`calories`, `protein`, `carbs`, `fat`): son **por porción** y **los calcula el servidor** a partir de los ingredientes. `servingSize` es el número de porciones que rinde la receta completa. Al editar los macros (o `gramsPerUnit`) de un ingrediente, se recalculan las recetas que lo usan.
- **`recipe_ingredients.quantity`**: es para la **receta completa**. La unidad puede ser `g`, `ml` o `unidad`; `unidad` solo se permite si el ingrediente tiene `gramsPerUnit`. Al sumar para la lista de compras, no mezcles unidades distintas del mismo ingrediente.
- **Borrados:** no se puede borrar una categoría con recetas, un ingrediente usado en una receta ni una receta usada en un plan (`RESTRICT`); la API responde 409 con un mensaje que lo explica. Borrar una receta borra sus líneas de ingredientes, borrar un ingrediente lo quita de las neveras, y borrar un usuario borra su nevera y sus planes (`CASCADE`).
- **Unicidad:** un ingrediente no se repite dentro de la misma receta ni de la misma nevera, y hay un único plan por usuario y semana (`userId` + `weekStartDate`).
- Las macros del usuario son `null` hasta que las configure.

## Pruebas

El proyecto exige **cobertura mínima de 80%**. Hay tres niveles de pruebas.

| Nivel | Comando | Requiere | Qué cubre |
|---|---|---|---|
| Unitarias (Vitest) | `npm test` | Nada (usa mocks) | Servicios de Auth y 2FA, `RolesGuard`, `JwtStrategy`, configuración de la base, servicios de categorías, ingredientes, recetas, nevera, usuarios y plan semanal, y la lógica pura: cálculo de macros por porción, sugerencias de la nevera, generador del plan, lista de compras y semanas |
| Integración (Supertest) | `npm run test:e2e` | `docker compose up -d` | Con HTTP real y base de datos real: Auth, 2FA, roles, seed, migraciones, CRUD del catálogo (permisos, validaciones, 404/409, macros y recálculo), nevera y sugerencias, plan semanal, lista de compras y metas de macros |
| Postman | Ver la sección siguiente | La API corriendo | Seed, Auth, 2FA, logout, catálogo y nevera, de punta a punta |

Las pruebas de integración usan una base **separada**, `mealmap_test`, que se crea sola y se borra y recrea en cada archivo de prueba. **Nunca tocan tu base de desarrollo.** Con unitarias e integración juntas (`npm run test:ci`), el código de `src/` queda por encima del 99 % de sentencias y líneas; el mínimo exigido es 80 %.

## Pruebas con Postman

En la carpeta `postman/` hay una colección lista para importar, con pruebas automáticas (aserciones) en cada petición:

- `MealMap.postman_collection.json` — la colección (84 peticiones, 135 verificaciones).
- `MealMap.postman_environment.json` — el entorno "MealMap - Local" con las variables.

### Cómo usarla

1. Levanta todo: `docker compose up -d` y `npm run start:dev`.
2. En Postman: **Import** y selecciona los dos archivos de `postman/`.
3. Elige el entorno **MealMap - Local** (arriba a la derecha) y revisa sus variables:

   | Variable | Valor |
   |---|---|
   | `baseUrl` | `http://localhost:3000` |
   | `seedKey` | El `SEED_KEY` de tu `.env` |
   | `adminEmail` / `adminPassword` | El `ADMIN_EMAIL` / `ADMIN_PASSWORD` de tu `.env` |

4. Abre la colección y pulsa **Run** (Collection Runner). Ejecútala **completa y en orden**: las peticiones se pasan datos entre sí (el token, el secreto del 2FA).

### Qué prueba la colección

| Carpeta | Peticiones |
|---|---|
| 0. Seed | Carga de datos (201) y rechazo sin llave (403) |
| 1. Auth - registro y login | Registro (rol `USER`, sin contraseña en la respuesta), email repetido (409), contraseña corta (400), intento de asignarse `ADMIN` (400), login correcto e incorrecto (401), login del admin del seed (el token trae rol `ADMIN`) |
| 2. Auth - 2FA | `enable` sin token (401), generación del QR, código incorrecto (400), activación con código correcto, `enable` repetido (409), login sin código (401), con código incorrecto (401) y con código correcto (200) |
| 3. Auth - logout | Logout sin token (401), logout correcto (204) y reutilización del token cerrado (401, "Sesión cerrada") |
| 4. Catálogo - categorías | Login del admin y de un usuario nuevo (guarda los dos tokens), lectura sin token (401) y como `USER` (200, ordenadas), crear como `USER` (403), crear como `ADMIN` (201, quita los espacios), nombre repetido en minúsculas (409), nombre corto (400), ver por id (200, 404 y 400 con un id que no es UUID), renombrar (200) y renombrar como `USER` (403) |
| 5. Catálogo - ingredientes | Búsqueda `?search=pollo`, crear como `USER` (403), crear los ingredientes A (por gramos) y B (con `gramsPerUnit`), nombre repetido (409), valores fuera de rango (400), ver por id (200 y 404), editar como `USER` (403) y `null` en un campo obligatorio (400) |
| 6. Catálogo - recetas | Filtro `maxPrepTime` (200 y 400 si no es número), crear como `USER` (403), enviar macros a mano (400), `unidad` sin `gramsPerUnit` (400), ingrediente inexistente (404), crear como `ADMIN` con los **macros calculados por el servidor** (350 kcal por porción), nombre repetido (409), filtro por categoría, detalle, 404, **editar las calorías de A recalcula la receta** (350 → 500 kcal), cambiar porciones (500 → 250 kcal) y borrar la categoría o el ingrediente en uso (409) |
| 7. Nevera | Sin token (401), como `ADMIN` (403), nevera y sugerencias vacías, agregar A (201), repetido (409), inexistente (404), id inválido (400), sugerencias con `maxMissing=1` (falta B), sin `maxMissing` (no aparece), agregar B, ver la nevera, sugerencias con `canPrepare: true`, `maxMissing` fuera de rango (400), quitar B (204) y quitarlo otra vez (404) |
| 8. Limpieza | Borrar la receta como `USER` (403) y como `ADMIN` (204), los ingredientes A y B (A sale también de la nevera) y la categoría, para no dejar datos de prueba |

Notas:

- Cada ejecución registra usuarios con emails únicos (`postman-<fecha>@example.com` y `postman-nevera-<fecha>@example.com`) y crea la categoría, los ingredientes y la receta con nombres únicos; la carpeta 8 los borra al final. Puedes repetir la colección sin limpiar la base.
- El código TOTP del 2FA lo calcula un script de la propia colección a partir del secreto que devuelve `/auth/2fa/enable`, igual que lo haría Google Authenticator. No necesitas el celular.
- Si el seed ya se cargó antes, la primera petición también responde 201 (es idempotente).

### Ejecutarla desde la terminal (opcional)

Con [Newman](https://github.com/postmanlabs/newman), el ejecutor de Postman en consola (es lo mismo que hace el job *Pruebas de Postman (Newman)* del CI):

```bash
npx --yes newman@6 run postman/MealMap.postman_collection.json \
  -e postman/MealMap.postman_environment.json \
  --env-var seedKey=<tu SEED_KEY> \
  --env-var adminEmail=<tu ADMIN_EMAIL> \
  --env-var adminPassword=<tu ADMIN_PASSWORD>
```

### Probar los endpoints nuevos

Al agregar endpoints nuevos, puedes:

- **Importarlos de golpe:** en Postman, **Import** → pega `http://localhost:3000/api-json`. Postman genera una petición por cada ruta de Swagger.
- **Sumarlos a la colección del equipo:** agrega una carpeta nueva en `postman/MealMap.postman_collection.json` con sus aserciones (siguiendo la numeración, por ejemplo "9. Meal prep") y expórtala de nuevo desde Postman. El CI la ejecuta en cada push.

## Guía para agregar tu módulo

Cada módulo de dominio ya existe con su entidad registrada (`TypeOrmModule.forFeature`) y exporta `TypeOrmModule`. Tú agregas controlador, servicio y DTOs dentro de tu carpeta.

- **Persona 2:** `categories/`, `ingredients/`, `recipes/` (CRUD del catálogo: lectura para cualquier usuario autenticado, escritura solo ADMIN) y `fridge/`.
- **Persona 3:** `meal-plan/` y el endpoint de macros del usuario.

Convenciones:

- Las importaciones llevan extensión `.js` (`import { X } from './x.js'`), porque el proyecto usa ESM.
- Los DTOs usan `class-validator`. La validación es global y **rechaza campos que no estén declarados** en el DTO.
- Los DTOs se documentan solos en Swagger. En tu controlador agrega `@ApiTags('Nombre')` y, en rutas protegidas, `@ApiBearerAuth()`.
- Las columnas decimales (`numeric`) llevan `transformer: decimalTransformer` (de `src/common/transformers`), para que lleguen como `number` y no como texto.
- Registra tu módulo en `AppModule`.
- Escribe tus pruebas junto con tu código: unitarias en `*.spec.ts` al lado del archivo, e integración en `test/*.e2e-spec.ts` (usa `createTestApp()` de `test/support/test-app.ts`).

### Proteger rutas

```ts
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../users/enums/role.enum.js';

// Solo usuarios autenticados
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Get('me')
findMine(@CurrentUser() user: AuthenticatedUser) { /* user.id, user.email, user.role */ }

// Solo ADMIN (el orden de los guards importa: primero JwtAuthGuard)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Post()
create(@Body() dto: CreateRecipeDto) { /* ... */ }
```

No necesitas importar `AuthModule` en tu módulo para usar estos guards: basta con que esté cargado en `AppModule`, que ya lo está.

## CI/CD y despliegue

### Pipeline de GitHub Actions

El workflow [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) (`CI/CD`) corre en **cada push a cualquier rama** y en cada pull request. Para no ejecutar todo dos veces, un pull request desde una rama de este mismo repositorio se apoya en la ejecución del push de esa rama; solo los que vienen de un fork corren su propia ejecución. Si llega un push nuevo a la misma rama, se cancela la ejecución anterior.

| Job | Cuándo | Qué hace |
|---|---|---|
| Pruebas | Siempre | `npm ci`, `npm run lint`, `npm run build` y `npm run test:ci` (unitarias + integración contra un PostgreSQL 16 de servicio). Falla si la cobertura queda por debajo del 80 % |
| Pruebas de Postman (Newman) | Si pasan las pruebas | Levanta un PostgreSQL vacío, compila y arranca la API (`node dist/main` con `NODE_ENV=development`, así `synchronize` crea las tablas) con credenciales de prueba que solo existen en ese job, espera a que responda `/api-json` y corre la colección completa con `newman@6` |
| Despliegue a Render | Si pasan los dos anteriores y el push es a `main` | Llama al deploy hook de Render (secreto `RENDER_DEPLOY_HOOK_URL`). Si el secreto no existe, muestra una advertencia y no despliega |

Antes del push, el hook local `pre-push` (ver [Scripts](#scripts)) corre lint, build y las pruebas unitarias.

### Despliegue en Render

[`render.yaml`](render.yaml) (Blueprint) crea la base PostgreSQL `mealmap-db` y el servicio `mealmap-api`. En producción la app usa `DATABASE_URL`, no usa `synchronize` y ejecuta las migraciones al arrancar. La guía paso a paso (cuenta, Blueprint, variables, deploy hook y problemas comunes) está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

Después del primer despliegue hay que llamar una vez a `POST /seed` con la `SEED_KEY` del servicio.

### Pendiente antes de un uso real

- Una limpieza periódica de `revoked_tokens` (los tokens vencidos ya no hacen falta).
- Cifrar `twoFASecret` en la base.
