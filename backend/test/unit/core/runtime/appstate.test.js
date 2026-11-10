import test from "node:test";
import assert from "node:assert/strict";

import {
    markShuttingDown,
    isApplicationShuttingDown
} from "../../../../src/core/runtime/appstate.js";

test("reports the application shutdown state and marks shutdown once initiated", () => {
    assert.equal(isApplicationShuttingDown(), false);

    markShuttingDown();

    assert.equal(isApplicationShuttingDown(), true);

    markShuttingDown();

    assert.equal(isApplicationShuttingDown(), true);
});
