# Guía de despliegue en Render

Esta guía deja MealMap publicado en la nube con **despliegue automático**: cada push a `main` ejecuta las pruebas en GitHub Actions y, solo si pasan, Render publica la nueva versión.

```
push a main ──► GitHub Actions: lint → build → pruebas (80 % de cobertura)
                        │ si todo pasa
                        ▼
                 job "deploy" ──► deploy hook ──► Render: build → migraciones → API en línea
```

Qué crea el archivo [`render.yaml`](../render.yaml) en un solo paso:

| Recurso | Detalle |
|---|---|
| Base de datos | PostgreSQL `mealmap-db` (plan free) |
| Servicio web | `mealmap-api`: compila con `npm ci --include=dev && npm run build` y arranca con `npm run start:prod` |
| Variables | `DATABASE_URL` (conectada a la base), `JWT_SECRET` (se genera sola), `NODE_ENV`, `NODE_VERSION` y las que tú escribes: `SEED_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

Al arrancar en producción, la app **ejecuta las migraciones** y crea las tablas sola: no hay que correr nada a mano en la base.

---

## Paso 0 — Antes de empezar
- [ ] El código con `render.yaml` y `docs/` ya está subido a la rama `main`.
- [ ] Tienes una cuenta de GitHub con acceso al repositorio.
- [ ] Para el **Paso 6** (secreto del pipeline) necesitas ser **administradora del repositorio**. Si el repo es de otra persona, pídele que haga ese paso o que te dé permisos. Hay un plan B en el Paso 6.

## Paso 1 — Crear la cuenta en Render
1. Entra a <https://render.com> y regístrate con **GitHub** (*Sign in with GitHub*).
2. Los planes gratuitos cambian con el tiempo: revisa en <https://render.com/pricing> si piden tarjeta y cuáles son los límites vigentes antes de seguir.

## Paso 2 — Dar acceso al repositorio
1. En Render: **New +** → **Blueprint**.
2. Si no ves el repo, pulsa **Configure account** y autoriza la aplicación de Render en GitHub para el repositorio `MealMap`. Si el repo pertenece a otra cuenta, **esa persona** debe autorizarlo.

## Paso 3 — Crear todo con el Blueprint
1. Elige el repositorio y la rama **`main`**. Render lee `render.yaml` y muestra lo que va a crear: la base `mealmap-db` y el servicio `mealmap-api`.
2. Render te pide tres valores. **Anótalos**, los vas a necesitar:

   | Variable | Qué poner |
   |---|---|
   | `SEED_KEY` | Una llave larga y aleatoria. Puedes generarla con `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
   | `ADMIN_EMAIL` | `admin@mealmap.com` (o el que prefieras) |
   | `ADMIN_PASSWORD` | Una contraseña fuerte (mínimo 8 caracteres) |

3. Pulsa **Apply**. Render crea la base y hace el primer despliegue.

## Paso 4 — Esperar el primer despliegue (5 a 10 minutos)
1. Entra al servicio `mealmap-api` → pestaña **Logs**.
2. Debe terminar con una línea como `Nest application successfully started` y el servicio en estado **Live**.
3. Si falla, mira **Problemas comunes** al final.

## Paso 5 — Probar y cargar los datos
Tu URL será parecida a `https://mealmap-api.onrender.com` (aparece arriba en el servicio).

1. Abre `https://TU-URL/api`: debe cargar **Swagger**. La primera vez tarda hasta un minuto si el servicio estaba dormido.
2. Carga el catálogo y el usuario admin una sola vez (cambia la URL y la llave):

   ```bash
   curl -X POST https://TU-URL/seed -H "x-seed-key: TU_SEED_KEY"
   ```

   Debe responder con algo como `{"categories":{"created":5,...},"recipes":{"created":81,...},"admin":{"created":1,...}}`.
3. Prueba el flujo en Swagger: `POST /auth/login` con el admin → **Authorize** con el token.

## Paso 6 — Conectar el pipeline (despliegue automático)
El job `deploy` de [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) llama al *deploy hook* de Render. Falta darle esa URL.

1. En Render: servicio `mealmap-api` → **Settings** → **Deploy Hook** → copia la URL. Es **secreta**: quien la tenga puede lanzar despliegues.
2. En GitHub: repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Secret: la URL copiada.

**Plan B (si no puedes crear secretos en el repo):** deja que Render despliegue por su cuenta cuando el CI pase.
1. En `render.yaml` cambia `autoDeployTrigger: off` por `autoDeployTrigger: checksPass` y súbelo; o en Render → **Settings** → **Build & Deploy** → **Auto-Deploy** → *After CI Checks Pass*.
2. No crees el secreto: el job `deploy` mostrará una advertencia y se omitirá, sin poner el pipeline en rojo.
3. No uses ambos a la vez: provocarías dos despliegues por cada push.

## Paso 7 — Verificar el pipeline completo
1. Haz un cambio pequeño (por ejemplo, una línea en el README) y súbelo a `main`.
2. En GitHub → pestaña **Actions**: debe correr **CI/CD**. El job *Pruebas* en verde, y después *Despliegue a Render* en verde.
3. En Render → **Events**: aparece un despliegue nuevo, disparado por el hook.

Guarda **capturas** de la pestaña Actions en verde y del servicio en estado *Live*: sirven para el informe.

---

## El día de la sustentación
El servicio gratuito **se duerme tras 15 minutos sin tráfico** y tarda cerca de un minuto en despertar.
- **Abre `https://TU-URL/api` unos 10 minutos antes** y déjalo cargado.
- Antes de presentar, confirma que el login y `GET /meal-plan` responden.
- La base gratuita de Render expira a los 30 días de crearse: sirve para la revisión, pero conserva las capturas en el informe.

## Problemas comunes
| Síntoma | Causa y solución |
|---|---|
| El build falla con `nest: not found` | Faltan dependencias de desarrollo. El comando de build debe ser `npm ci --include=dev && npm run build` (ya está en `render.yaml`). |
| Error de conexión mencionando SSL | Agrega la variable `DB_SSL=true` en el servicio y redespliega. |
| La app no arranca y los logs hablan de migraciones | Revisa que `DATABASE_URL` esté conectada a `mealmap-db` (Settings → Environment). |
| `POST /seed` responde 403 | La llave del header `x-seed-key` no coincide con `SEED_KEY` del servicio. |
| El job `deploy` falla con 401 | El hook cambió o está mal copiado. Regenera el hook en Render y actualiza el secreto. |
| El job `deploy` dice "Falta el secreto…" | Es solo una advertencia: crea `RENDER_DEPLOY_HOOK_URL` (Paso 6) o usa el plan B. |
| Cada push provoca dos despliegues | Tienes el hook **y** el auto-deploy activos. Deja solo uno. |
