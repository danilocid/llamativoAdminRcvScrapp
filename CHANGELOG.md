# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere al [Versionado Semántico](https://semver.org/lang/es/).

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
- Script CLI `npm run sync` para disparar una sincronización desde la terminal
- Documentación: README, AGENTS.md y `.env.example`
- Docker (imagen Playwright y variante Raspberry Pi con Chromium del sistema), docker-compose y `cloudbuild.yaml`

### Changed

- El servicio no tiene base de datos: la persistencia de las compras queda en el backend
- A diferencia de la versión original, los fallos de scraping se lanzan como excepción en vez de devolver `[]` silenciosamente
