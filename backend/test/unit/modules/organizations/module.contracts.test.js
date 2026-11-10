import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as organizationValidation from "../../../../src/modules/organizations/organization.validation.js";
import * as membershipValidation from "../../../../src/modules/organizationMemberships/organizationMembership.validation.js";

const objectId = () => new mongoose.Types.ObjectId().toString();


test("organization and membership schemas normalize inputs and reject unsafe fields", () => {
    const application = organizationValidation.createOrganizationApplicationSchema.parse({
        body: {
            name: "  Example Org ",
            slug: " Example-Org ",
            contactEmail: " ADMIN@EXAMPLE.COM "
        }
    });

    assert.equal(application.body.name, "Example Org");
    assert.equal(application.body.slug, "example-org");
    assert.equal(application.body.contactEmail, "admin@example.com");
    assert.equal(
        organizationValidation.createOrganizationApplicationSchema.safeParse({
            body: { name: "Org", slug: "org", applicantId: objectId() }
        }).success,
        false
    );

    assert.deepEqual(
        organizationValidation.discoverOrganizationsQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
    assert.equal(
        membershipValidation.createMembershipRequestSchema.safeParse({
            body: { orgId: objectId(), role: "admin" }
        }).success,
        false
    );
    assert.deepEqual(
        membershipValidation.pendingMembershipQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
});
