import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import {
    createCompetency
} from "../../../../src/modules/competencies/competency.service.js";

const id = () => new mongoose.Types.ObjectId();


test("competency creation generates a slug and maps duplicate keys to conflicts", async (t) => {
    const orgId = id();
    const adminId = id();
    const competencyId = id();
    let savedData;
    t.mock.method(Competency, "create", async (data) => {
        savedData = data;
        return {
            _id: competencyId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    const result = await createCompetency({
        orgId,
        adminId,
        data: { name: "  Facilitation Skills " }
    });

    assert.equal(savedData.slug, "facilitation-skills");
    assert.equal(savedData.org, orgId);
    assert.equal(result.id, competencyId.toString());
});
