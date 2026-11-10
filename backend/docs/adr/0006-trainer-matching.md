# ADR 0006: Separate matching runs from trainer assignments

- Status: Accepted (current-state record)
- Date: 2026-11-10

## Context

A training requirement may be evaluated multiple times as trainer profiles, evidence, availability, and matching configuration change. A matching result is a recommendation/evaluation outcome, while an assignment is a separate operational commitment.

## Decision

Matching configuration, match-run history, and trainer assignment are represented by separate modules/models. Match runs store requirement and configuration snapshots plus execution results. Assignments reference a requirement, match run, trainer and trainer profile.

## Alternatives considered

No historical comparison of matching algorithms or assignment data models is recorded in the repository.

## Consequences

- Historical match runs can retain the criteria/configuration used at execution time.
- A match result does not itself reserve a trainer.
- Assignment creation owns capacity reservation and lifecycle transitions.
- Future matching algorithm changes can be versioned and traced through run metadata.

## References

- `src/modules/matching/`
- `src/modules/matchingConfig/`
- `src/modules/matchRun/matchRun.model.js`
- `src/modules/trainerAssignments/`
- [Trainer matching](../05-modules/trainer-matching.md)
