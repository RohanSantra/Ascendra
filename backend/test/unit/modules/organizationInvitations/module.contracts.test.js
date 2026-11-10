import test from "node:test";
import assert from "node:assert/strict";
import * as invitationValidation from "../../../../src/modules/organizationInvitations/organizationInvitation.validation.js";

test("invitation schemas apply defaults, normalize email, and validate tokens", () => {
    const parsed = invitationValidation.createOrganizationInvitationSchema.parse({
        body: { email: "TRAINER@EXAMPLE.COM", role: "trainer" }
    });

    assert.equal(parsed.body.email, "trainer@example.com");
    assert.equal(parsed.body.expiresInDays, 7);
    assert.equal(
        invitationValidation.acceptOrganizationInvitationSchema.safeParse({
            body: { token: "not-a-token" }
        }).success,
        false
    );
    assert.deepEqual(
        invitationValidation.listOrganizationInvitationsQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
});
