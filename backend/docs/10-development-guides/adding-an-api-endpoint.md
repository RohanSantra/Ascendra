# Adding an API endpoint

## 1. Find the owning module

Keep the route in the feature's `*.routes.js` file. Avoid adding feature endpoints directly to the global route registry.

## 2. Define the contract

Identify:
- HTTP method and relative path.
- Public/authenticated/platform-admin/organization-scoped access.
- Allowed organization roles.
- Body, params, query and header fields.
- Success status and response data.
- Expected business errors and side effects.

## 3. Add validation

Define a Zod schema in the module's `*.validation.js` file. Use `validateRequest(schema, { body: true, params: true, query: true })` only for sections the schema actually describes.

## 4. Add service behavior

Implement business rules in the service. Do not rely on route middleware alone for tenant isolation or referenced-resource ownership.

## 5. Add controller

The controller should:
- Read validated input from `req.validated`.
- Use authenticated context from `req.user`.
- Call the service.
- Return an `ApiResponse` helper.
- Allow errors to flow through `asyncHandler` / Express 5 async handling and centralized error middleware.

## 6. Add route middleware

For an organization-admin operation, the common sequence is:

```js
router.post(
    "/",
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin"),
    validateRequest(createExampleSchema, { body: true }),
    createExampleController
);
```

Adapt this to the actual access policy; do not copy admin middleware to public or platform-admin routes without analysis.

## 7. Register the router

Add its import and `router.use("/examples", exampleRoutes)` mount to `src/routes/index.js`.

## 8. Test and document

Test successful requests, validation failures, authentication, role denial, missing resources, cross-tenant references and side effects. Update the API index and OpenAPI specification.
