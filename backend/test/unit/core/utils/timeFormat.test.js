import test from "node:test";
import assert from "node:assert/strict";

import { formatTimestamp } from "../../../../src/core/utils/timeFormat.js";

test("formats timestamps in Indian Standard Time", () => {
    assert.equal(
        formatTimestamp(new Date("2026-11-10T00:00:00.000Z")),
        "10 Nov 2026, 05:30:00 am IST"
    );
});

test("formats timestamps across the UTC date boundary", () => {
    assert.equal(
        formatTimestamp(new Date("2026-11-10T20:00:00.000Z")),
        "11 Nov 2026, 01:30:00 am IST"
    );
});
