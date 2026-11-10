# Adding a new model

## 1. Confirm ownership

Place the model in the module that owns the data. Avoid putting unrelated models into a generic shared directory.

## 2. Define the schema

Follow the existing Mongoose style:

```js
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const exampleSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

const Example = models.Example || model("Example", exampleSchema);

export default Example;
```

This is an illustrative pattern. Match the exact options and export conventions used by the target module.

## 3. Consider data integrity

- Add required/enum/range/length validators.
- Decide whether the field is immutable or excluded from default selection.
- Add timestamps where lifecycle auditing requires them.
- Add compound unique indexes for organization-scoped uniqueness.
- Add indexes for demonstrated query patterns, not speculative queries.
- Use TTL indexes only for records whose expiry semantics permit asynchronous cleanup.
- Use references for independently managed entities and embedded schemas for tightly coupled values.

## 4. Keep tenant boundaries explicit

Organization-owned documents should include the organization reference and services must scope reads/writes by it. Validate referenced IDs against the same organization.

## 5. Add tests

Test defaults, required fields, enum/range validation, indexes/uniqueness, nested structures, and any custom validators.

## 6. Update references

Update `docs/06-database/data-models.md`, relationships, indexes and the owning module document. If the model is exposed through an API, update validation and OpenAPI too.
