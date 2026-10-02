# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere al [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.2] - 2026-09-30

### Fixed

- **Docker: fallaba `pnpm install --frozen-lockfile`** en la Raspberry Pi porque pnpm 11.1.3 exige Node `>=22.13` y la imagen base es `node:20-slim`
  - Ambos Dockerfiles instalan **pnpm 10.34.6** (compatible con Node >=18.12); verificado con instalación limpia del lockfile

## [1.0.1] - 2026-09-30

### Fixed

- **Docker: `npm ci` fallaba en el build** (`process "/bin/sh -c npm ci" did not complete successfully`): el repo solo tiene `pnpm-lock.yaml`, no `package-lock.json`
  - `Dockerfile` y `Dockerfile.pi` ahora instalan pnpm 11 y usan `pnpm install --frozen-lockfile`
  - `Dockerfile.pi` define `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (usa el Chromium del sistema vía `CHROME_BIN`)

### Changed

- README y AGENTS.md actualizados a pnpm (en este repo `npm install` no funciona)

## [1.0.0] - 2026-09-30

### Added

- Primer versión del servicio de scraping del RCV del SII extraído desde `llamativo-admin-back-end`
- `SiiScraperService` con Playwright/Chromium: login SII, selección de período, extracción de resumen y detalle por tipo de documento
- `GET /rcv/sincronizar?mes=&anio=` — ejecuta el scraping y envía los registros al backend (`POST /purchases/import`)
- `GET /rcv/preview?mes=&anio=` — devuelve los registros crudos sin enviarlos al backend
- `POST /auth/login` — envía una petición POST al login del backend y devuelve el JWT
- `GET /health` — estado del servicio
- Autenticación de los endpoints con JWT (secret compartido con el backend) o header `x-api-key` opcional
- `BackendClientService` con JWT cacheado y reintento automático ante un 401 del backend
- Script CLI `pnpm run sync` para disparar una sincronización desde la terminal
- Documentación: README, AGENTS.md y `.env.example`
- Docker (imagen Playwright y variante Raspberry Pi con Chromium del sistema), docker-compose y `cloudbuild.yaml`

### Changed

- El servicio no tiene base de datos: la persistencia de las compras queda en el backend
- A diferencia de la versión original, los fallos de scraping se lanzan como excepción en vez de devolver `[]` silenciosamente
