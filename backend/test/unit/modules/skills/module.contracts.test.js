import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as skillValidation from "../../../../src/modules/skills/skill.validation.js";
import * as competencyValidation from "../../../../src/modules/competencies/competency.validation.js";

const objectId = () => new mongoose.Types.ObjectId().toString();


test("skill and competency schemas normalize names and reject duplicate or empty updates", () => {
    assert.equal(
        skillValidation.createSkillSchema.parse({
            body: { name: " Facilitation ", slug: " Facilitation-Skills " }
        }).body.slug,
        "facilitation-skills"
    );
    assert.equal(
        skillValidation.createSkillSchema.safeParse({
            body: { name: "Writing", competencies: [objectId(), objectId()] }
        }).success,
        true
    );
    const repeatedId = objectId();
    assert.equal(
        skillValidation.createSkillSchema.safeParse({
            body: { name: "Writing", competencies: [repeatedId, repeatedId] }
        }).success,
        false
    );
    assert.equal(
        competencyValidation.createCompetencySchema.parse({
            body: { name: " Facilitation ", slug: " FACILITATION " }
        }).body.slug,
        "facilitation"
    );
    assert.equal(
        competencyValidation.updateCompetencySchema.safeParse({
            params: { id: objectId() },
            body: {}
        }).success,
        false
    );
});
