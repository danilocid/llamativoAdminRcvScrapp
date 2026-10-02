<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

# Llamativo RCV Scrapper

Servicio independiente de scraping del **Registro de Compras y Ventas (RCV) del SII**, desarrollado con NestJS 11 y Playwright. Fue extraído desde `llamativo-admin-back-end`: este servicio **no tiene base de datos propia**, solo extrae los datos del SII y se los envía al backend de Llamativo para que los persista.

## Versión Actual

**v1.0.1** - Ver [CHANGELOG.md](CHANGELOG.md) para detalles de cambios.

## Tecnologías

- **NestJS**: 11.1.19
- **TypeScript**: 6.0.2
- **Playwright**: 1.61.0 (Chromium headless)
- **JWT**: autenticación compartida con el backend
- **axios / @nestjs/axios**: comunicación con el backend
- **Jest**: 30.3.0
- **ESLint**: 10.2.0

## Arquitectura

```
                       ┌──────────────────────────────────────────────┐
  cliente (curl,       │  llamativoAdminRcvScrapp (este servicio)     │
  script, Swagger,     │                                              │
  backend en proxy) ──▶│  GET /rcv/sincronizar  ──▶ Playwright ──┐    │
                       │        ▲                                │    │
                       │        │ JWT (POST /auth/login)         │    │
                       └────────┼────────────────────────────────┼────┘
                                │                                │
                                │                                ▼
                                │                     ┌──────────────────┐
                                │                     │  SII (www4.sii.cl)│
                                │                     └──────────────────┘
                                │
                                ▼
                       ┌──────────────────────────────────────────────┐
                       │  llamativo-admin-back-end (dueño de la BD)   │
                       │                                              │
                       │  POST /auth/login          → JWT             │
                       │  POST /purchases/import    → persiste en MySQL│
                       └──────────────────────────────────────────────┘
```

**Flujo de una sincronización:**

1. El cliente llama `GET /rcv/sincronizar?mes=&anio=` con un JWT o un `x-api-key`.
2. El servicio hace login en el SII con Playwright, selecciona el período y extrae el resumen + detalle por tipo de documento.
3. Los registros (`PurchaseApiData[]`) se envían al backend con `POST {BACKEND_URL}/purchases/import`, autenticándose con un JWT obtenido vía `POST {BACKEND_URL}/auth/login`.
4. El backend deduplica, auto-crea proveedores, guarda las compras y genera las notificaciones.

## Requisitos Previos

- Node.js >= 20.0.0
- pnpm >= 11.0.0 (este repo usa `pnpm-lock.yaml`; `npm ci` no funciona sin `package-lock.json`)
- Cuenta de SII con RUT y clave (`SII_RUT`, `SII_PASSWORD`)
- Backend de Llamativo corriendo y accesible (`BACKEND_URL`)

## Instalación

```bash
# Instalar dependencias
pnpm install

# Playwright necesita su Chromium (si no usas CHROME_BIN del sistema)
pnpm exec playwright install chromium
```

## Configuración

Copia `.env.example` a `.env` y completa los valores:

```env
PORT=3010

# Misma clave que el backend: valida los JWT entrantes
JWT_SECRET=tu_secreto_compartido

# Backend dueño de la base de datos
BACKEND_URL=http://localhost:3000
BACKEND_USER=tu_usuario
BACKEND_PASSWORD=tu_password

# (Opcional) alternativa al JWT para llamadas servidor-a-servicio
# API_KEY=una_clave_larga_y_aleatoria

# SII
SII_RUT=tu_rut
SII_PASSWORD=tu_password_sii

# (Opcional) Chromium del sistema (Docker / Raspberry Pi)
# CHROME_BIN=/usr/bin/chromium
```

### Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `PORT` | No | Puerto del servicio (default `3010`) |
| `JWT_SECRET` | **Sí** | Secreto compartido con el backend; valida los JWT entrantes |
| `BACKEND_URL` | **Sí** | URL base del backend (sin barra final) |
| `BACKEND_USER` / `BACKEND_PASSWORD` | **Sí** | Credenciales para obtener el JWT en `POST {BACKEND_URL}/auth/login` |
| `API_KEY` | No | Si está definida, los endpoints también aceptan el header `x-api-key` |
| `CORS_ORIGINS` | No | Orígenes CORS separados por coma |
| `SII_RUT` / `SII_PASSWORD` | **Sí** | Credenciales de login del SII |
| `CHROME_BIN` | No | Ruta al binario de Chromium cuando no se usa el de Playwright |
| `ENV` | No | Entorno (`dev` / `prod`) |

## Ejecución

```bash
# Desarrollo con watch
pnpm run start:dev

# Producción
pnpm run build && pnpm run start

# Sincronizar un período desde la terminal
pnpm run sync -- --mes=9 --anio=2026

# Solo inspeccionar los datos del SII (no toca el backend)
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3010/rcv/preview?mes=9&anio=2026"
```

La API estará disponible en `http://localhost:3010` y la documentación en `http://localhost:3010/api-docs`.

## Autenticación

Los endpoints protegidos (`/rcv/*`) aceptan **cualquiera** de los dos mecanismos:

1. **JWT** — header `Authorization: Bearer <token>`. Cualquier JWT emitido por el backend sirve, porque ambos comparten `JWT_SECRET`. Se puede obtener un token llamando a `POST /auth/login` de este servicio (que a su vez hace la petición POST al login del backend).
2. **API Key** — header `x-api-key: <valor>` igual a la variable `API_KEY`. Solo funciona si `API_KEY` está definida; está pensada para llamadas servidor-a-servicio sin hacer login.

```bash
# Opción 1: login y luego sincronizar
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user":"admin","password":"123456"}'
# → { "serverResponseCode": 200, "data": "<JWT>" }

curl "http://localhost:3010/rcv/sincronizar?mes=9&anio=2026" \
  -H "Authorization: Bearer <JWT>"

# Opción 2: API key
curl "http://localhost:3010/rcv/sincronizar?mes=9&anio=2026" \
  -H "x-api-key: $API_KEY"
```

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/auth/login` | No | Envía una petición POST al login del backend y devuelve el JWT |
| `GET` | `/rcv/sincronizar?mes=&anio=` | JWT / API key | Scraping + envío de registros al backend |
| `GET` | `/rcv/preview?mes=&anio=` | JWT / API key | Scraping sin persistir (devuelve los registros crudos) |
| `GET` | `/health` | No | Estado del servicio |

`mes` (1-12) y `anio` son opcionales; por defecto se usa el período actual.

> **Importante:** `/rcv/sincronizar` y `/rcv/preview` pueden tardar varios minutos. El backend recibe los datos en `POST /purchases/import`.

## Testing

```bash
npm test          # unitarios (Jest)
npm run test:cov  # cobertura
npm run test:e2e  # end-to-end (health check)
npm run lint      # ESLint
```

## Estructura del Proyecto

```
src/
├── common/
│   ├── dto/                 # ResponseDto (serverResponseCode/Message/data)
│   ├── exceptions/          # Filtro global de excepciones HTTP
│   └── guards/              # JwtAuthGuard y RcvAuthGuard (JWT o x-api-key)
├── modules/
│   ├── auth/                # Proxy de login al backend + estrategia JWT
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   └── jwt-strategy/
│   └── rcv/                 # Scraping del RCV y envío al backend
│       ├── rcv.controller.ts
│       ├── rcv.service.ts
│       ├── sii-scraper.service.ts
│       ├── backend-client.service.ts
│       └── dto/
├── health.controller.ts     # GET /health
├── app.module.ts
└── main.ts                  # Bootstrap, CORS, Swagger
```

## Convenciones de Código

Mismas que el backend de Llamativo (ver `.github/instructions/nestjs-conventions.instructions.md` allí):

- Archivos en `kebab-case`, clases en `PascalCase`
- Respuestas con `{ serverResponseCode, serverResponseMessage, data }`
- Guard por endpoint (`@UseGuards`), nunca a nivel de clase si solo algunas rutas lo requieren
- Errores lanzados desde los servicios con excepciones de NestJS
- `class-validator` + `ValidationPipe` para la entrada de datos

## Docker

```bash
# Imagen con Chromium de Playwright (recomendada)
docker build -t llamativo-rcv-scrapper .

# Variante Raspberry Pi (Chromium del sistema + CHROME_BIN)
docker build -f Dockerfile.pi -t llamativo-rcv-scrapper .

docker compose up -d
```

`docker-compose.yml` levanta el servicio en el puerto `3010` y expone `shm_size: 2gb`, necesario para Chromium headless.

## Relación con el Backend

| Responsabilidad | Dónde vive |
|-----------------|-----------|
| Login SII y extracción del RCV | **Este servicio** (`SiiScraperService`) |
| Recibir registros y guardarlos en MySQL | Backend (`POST /purchases/import`) |
| Dedupe, auto-creación de proveedores, notificaciones | Backend (`PurchasesService.importRcvData`) |
| Disparar una sincronización | Este servicio (`GET /rcv/sincronizar`) o el proxy `GET /purchases/sincronizar` del backend |

## Versionado

[Versionado Semántico](https://semver.org/lang/es/): MAJOR = cambios incompatibles, MINOR = funcionalidad nueva, PATCH = correcciones.

## Licencia

Propietario - Todos los derechos reservados

## Contacto

Danilo Cid - Desarrollador Principal
