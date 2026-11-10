import test from "node:test";
import assert from "node:assert/strict";
import * as matchingConfigValidation from "../../../../src/modules/matchingConfig/matchingConfig.validation.js";
import * as notificationValidation from "../../../../src/modules/notifications/notification.validation.js";

test("matching configuration and notification schemas enforce supported values", () => {
    assert.equal(
        matchingConfigValidation.createInitialMatchingConfigSchema.safeParse({
            body: {}
        }).success,
        false
    );
    assert.equal(
        matchingConfigValidation.createMatchingConfigVersionSchema.safeParse({
            body: { weights: { skills: -1 } }
        }).success,
        false
    );
    assert.deepEqual(
        matchingConfigValidation.listMatchingConfigVersionsQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
    assert.deepEqual(
        notificationValidation.listNotificationsQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20, sortOrder: "desc" }
    );
    assert.equal(
        notificationValidation.listNotificationsQuerySchema.safeParse({
            query: { status: "pending" }
        }).success,
        false
    );
});
