# AGENTS.md - Guía para Agentes de IA

## Visión General

**Llamativo RCV Scrapper** es un servicio NestJS 11 independiente que hace scraping del Registro de Compras y Ventas (RCV) del SII de Chile con Playwright y envía los registros al backend de Llamativo (`llamativo-admin-back-end`) para su persistencia.

**Este servicio NO tiene base de datos.** Toda la persistencia (compras, proveedores, notificaciones) ocurre en el backend.

## Comandos Importantes

```bash
npm install              # Instalar dependencias
npx playwright install chromium   # Browser de Playwright (si no se usa CHROME_BIN)
npm run start:dev        # Desarrollo con watch
npm run build            # Build producción
npm run start            # Ejecutar build (node dist/main)
npm run lint             # ESLint + fix
npm test                 # Unit tests (Jest)
npm run test:cov         # Tests con cobertura
npm run test:e2e         # Tests end-to-end (health check)
npm run format           # Prettier
npm run sync -- --mes=9 --anio=2026   # Disparar sincronización desde terminal
```

## Estructura del Proyecto

```
llamativoAdminRcvScrapp/
├── scripts/
│   └── sync.mjs               # CLI: login + disparo de /rcv/sincronizar
├── src/
│   ├── common/
│   │   ├── dto/               # ResponseDto
│   │   ├── exceptions/        # HttpExceptionFilter (global)
│   │   └── guards/            # JwtAuthGuard, RcvAuthGuard (JWT o x-api-key)
│   ├── modules/
│   │   ├── auth/              # Proxy de POST /auth/login al backend + JwtStrategy
│   │   └── rcv/               # Scraping + envío al backend
│   │       ├── sii-scraper.service.ts      # Playwright contra el SII
│   │       ├── backend-client.service.ts   # POST /purchases/import
│   │       ├── rcv.service.ts              # Orquestación sync/preview
│   │       └── rcv.controller.ts           # /rcv/sincronizar, /rcv/preview
│   ├── health.controller.ts   # GET /health
│   ├── app.module.ts
│   └── main.ts                # Bootstrap, CORS, Swagger (/api-docs)
├── test/                      # e2e
├── Dockerfile / Dockerfile.pi / docker-compose.yml / cloudbuild.yaml
├── README.md / CHANGELOG.md / .env.example
└── package.json               # v1.0.0
```

## Flujo de Datos

1. Cliente → `GET /rcv/sincronizar?mes=&anio=` (JWT o `x-api-key`)
2. `SiiScraperService.scrapePurchases(mes, anio)` → `PurchaseApiData[]`
3. `BackendClientService.sendPurchases(...)` → `POST {BACKEND_URL}/purchases/import` con JWT obtenido de `POST {BACKEND_URL}/auth/login` (cacheado 1h, reintento si 401)
4. Backend persiste, deduplica, auto-crea proveedores y genera notificaciones

## Autenticación

- **Entrante** (`RcvAuthGuard`): acepta `Authorization: Bearer <JWT>` verificado con `JWT_SECRET` compartido con el backend, **o** header `x-api-key` si la env `API_KEY` está definida.
- **Saliente** (hacia el backend): `AuthService.getToken()` → `POST {BACKEND_URL}/auth/login` con `BACKEND_USER`/`BACKEND_PASSWORD`, token cacheado 1 hora.
- `POST /auth/login` de este servicio es un proxy que permite obtener un token sin conocer la URL del backend.

## Variables de Entorno

```
PORT (default 3010), ENV
JWT_SECRET                  # mismo valor que el backend
BACKEND_URL, BACKEND_USER, BACKEND_PASSWORD
API_KEY                     # opcional
CORS_ORIGINS                # opcional
SII_RUT, SII_PASSWORD
CHROME_BIN                  # opcional (Docker/Pi)
SCRAPER_URL                 # solo para scripts/sync.mjs
```

Ver `.env.example`.

## Convenciones

Idénticas a las del backend de Llamativo:

- Archivos `kebab-case`, clases `PascalCase`
- Respuesta estándar `{ serverResponseCode, serverResponseMessage, data }`
- Guard aplicado por endpoint con `@UseGuards`
- Errores lanzados desde services con excepciones de NestJS; `HttpExceptionFilter` los normaliza
- Imports absolutos con prefijo `src/` (configurado en `tsconfig.json`)
- DTOs con `class-validator` y `ValidationPipe({ transform, whitelist, forbidNonWhitelisted })`
- Logging con `Logger` de NestJS (no Google Cloud Logging: este servicio no tiene credenciales GCP)

## Errores Comunes

1. **401 en los endpoints**: falta o expiró el JWT → llamar `POST /auth/login`, o configurar `API_KEY`
2. **502**: no se pudo contactar al backend → verificar `BACKEND_URL` y que el backend esté corriendo
3. **Fallo de login SII**: verificar `SII_RUT`/`SII_PASSWORD`; el scraping lanza excepción (no devuelve `[]`)
4. **Chromium no inicia**: en Docker usar la imagen Playwright o `Dockerfile.pi` con `CHROME_BIN=/usr/bin/chromium` y `shm_size: 2gb`
5. **Timeout**: el scraping completo puede tardar varios minutos; `cloudbuild.yaml` usa `--timeout 600`

## Archivos Importantes para Modificar

- **Cambiar selectores del SII**: `src/modules/rcv/sii-scraper.service.ts`
- **Cambiar cómo se envían los datos al backend**: `src/modules/rcv/backend-client.service.ts` + el DTO del endpoint `POST /purchases/import` en el backend
- **Cambiar autenticación**: `src/common/guards/rcv-auth.guard.ts` y `src/modules/auth/`
- **Nuevo endpoint**: crear controller/service en `src/modules/rcv/` y registrarlo en `rcv.module.ts`

## Flujo de Release (Obligatorio)

Cada vez que se termine una funcionalidad o se pida subir cambios:

1. Bump version (patch): `npm version patch --no-git-tag-version`
2. Agregar entrada al inicio de `CHANGELOG.md` con formato `## [versión] - YYYY-MM-DD` + `### Added / Fixed / Changed / Removed`
3. Actualizar `README.md` si cambió la API o las variables de entorno
4. Commitear todo junto: `git add -A && git commit -m "feat|fix: descripción (vX.X.X)" && git push`

**Reglas:** siempre patch (X.X.+1), no saltarse pasos, el commit incluye código + changelog + package.json + lockfile.
