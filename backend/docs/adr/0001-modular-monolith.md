# ADR 0001: Modular monolith architecture

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

Ascendra has multiple business domains, including identity, organizations, trainer management, matching, course delivery and learning. The repository needs clear feature boundaries while remaining straightforward to develop and deploy.

## Decision

The backend is organized as a modular monolith. Feature code lives under `src/modules/`; shared infrastructure lives under `src/core/`, `src/config/` and `src/middleware/`. A central route registry composes feature routers into one Express application.

## Alternatives considered

The repository does not establish a historical record of alternatives that were formally evaluated. This ADR does not claim that microservices or other architectures were rejected through a documented process.

## Consequences

- One process and deployment can serve all feature modules.
- Feature ownership is visible in the directory structure.
- Cross-module dependencies remain in-process and must be kept intentional.
- A module boundary is a code organization boundary, not a separate runtime/security boundary.
- Extracting services later would require explicit API/event contracts and data ownership work.

## References

- `src/app.js`
- `src/routes/index.js`
- `src/modules/`
- [System overview](../03-architecture/system-overview.md)
