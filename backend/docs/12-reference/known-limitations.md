# Known limitations and verification notes

This document records issues observed while inspecting the uploaded repository. It is not a claim that these are the only possible limitations.

## 1. Duplicate organization-admin report routes

`src/routes/index.js` mounts both:
- `src/modules/dashboards/organizationAdmin/routes/organizationDashboard.routes.js`
- `src/modules/dashboards/organizationAdmin/routes/organizationDashboard.reporting.routes.js`

Both files register:
- `GET /reports/activity`
- `GET /reports/assessment-performance`

The first router is mounted first. Express route handling may therefore cause the later duplicate handlers not to be reached when the earlier route responds. Consolidate the route definitions in a separate code change and add a route-level regression test.

## 2. License metadata mismatch

The checked-in `LICENSE` contains MIT license text, while `package.json` declares `"license": "ISC"`. The repository owner should determine the intended license and make the metadata and license text consistent before redistribution.

## 3. OpenAPI request/response schemas

The route inventory can be derived from Express routes, but a complete OpenAPI contract requires each Zod schema, controller response and status code to be mapped precisely. The included OpenAPI file documents verified routes, access metadata and headers; where exact body/response shapes were not safely inferable, it directs readers to source rather than fabricating a schema.

## 4. In-memory rate-limit store

The shared rate-limit helper uses express-rate-limit's default in-memory store. It is not shared across multiple application instances. Use a shared store for horizontally scaled deployments if a global limit is required.

## 5. Readiness checks

The readiness endpoint checks shutdown state and MongoDB connectivity. It does not currently check SMTP, Cloudinary or other optional integrations.

## 6. Operational infrastructure

No provider-specific deployment manifests, log aggregation configuration, metrics exporter, tracing backend, alerting configuration, backup scheduler or disaster-recovery automation was identified in the uploaded repository. These need separate operational decisions.

## 7. Feature boundaries

The backend contains modules for notifications, announcements and feedback, but the current code should not be described as implementing a general-purpose event bus, push notification service, or real-time delivery system without additional implementation evidence.

## Maintenance

When a limitation is fixed, update this page and add a changelog entry. Do not silently remove a note without verifying the corresponding source change.
