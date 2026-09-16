---
name: conductor
description: Context-driven software development methodology using a conductor/ directory as the single source of truth for project context, plans, specs, tracks, and execution state.
risk: low
source_type: community
date_added: 2026-09-15
license: MIT
author: Antigravity Skills
---

# Conductor — Context-Driven Development

Conductor is an engineering methodology for AI-assisted software development that treats project context as persistent, structured repository artifacts rather than ephemeral chat memory.

## When to Use

Use this skill when:
- Bootstrapping or orchestrating complex features, refactors, or cross-cutting migrations.
- Setting up a single source of truth for project vision, technical architecture, and development workflows.
- Managing discrete units of work ("tracks") with explicit `spec.md` and `plan.md` documents.
- Maintaining consistent context across multiple agent sessions, avoiding hallucinations or drift.
- Ensuring test-driven, verifiable progress with rollback-friendly milestone tracking.

## Conductor Directory Architecture

When Conductor is initialized in a repository, the `conductor/` folder serves as the central brain:

```text
conductor/
├── product.md          # Project vision, business goals, user personas & target outcomes
├── tech-stack.md       # Technical stack, architecture decisions, frameworks, DB schema
├── workflow.md         # Development guidelines, git flow, testing gates & code standards
├── tracks.md           # Registry/index of active and completed development tracks
└── tracks/             # Individual feature/task tracks
    └── [track_name]/
        ├── spec.md     # Requirements, user stories, acceptance criteria, boundaries
        └── plan.md     # Step-by-step phased execution plan with checkboxes & test tasks
```

## The Conductor Workflow Protocol

### 1. Context Synchronization
Before taking any action, always inspect the core context files:
- Read `conductor/product.md` to understand business constraints and domain rules.
- Read `conductor/tech-stack.md` to identify approved libraries, versions, and architectural boundaries.
- Read `conductor/workflow.md` to comply with linting, testing, and security policies.

### 2. Track Creation & Specification
For any significant milestone or feature:
1. Create a directory `conductor/tracks/<track-name>/`.
2. Write `spec.md`:
   - State the problem statement and clear business goals.
   - List explicit functional requirements and acceptance criteria.
   - Define non-goals and out-of-scope items to prevent scope creep.
3. Write `plan.md`:
   - Break implementation into logical, manageable phases.
   - Include automated tests for every phase.
   - Ensure each phase can be tested and verified independently.
4. Register the track in `conductor/tracks.md`.

### 3. Execution & Checkpointing
- Execute phase-by-phase following `plan.md`.
- Mark completed tasks with `[x]` as progress is made.
- Commit code atomically per phase with clear conventional commit messages.
- Never advance to the next phase until automated tests pass.

### 4. Track Completion & Archival
- Validate full acceptance criteria against `spec.md`.
- Run full regression tests across the repository.
- Update `conductor/tracks.md` to mark the track as completed.

## Invariants & Best Practices
- **Single Source of Truth**: All architectural decisions must be written down in `conductor/`, not assumed in chat.
- **Spec Before Code**: Never write code without an approved `spec.md` and `plan.md`.
- **Zero Drift**: Keep `tech-stack.md` updated whenever new dependencies or database migrations are added.
