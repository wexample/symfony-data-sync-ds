# symfony-data-sync-ds

Version: 2.0.2

Open `/data-sync/` with the access role and pick a definition. Its page plans at once, without writing: the status line says so.

- **Fields** unfolds the two panes of an update or a conflict. An arrow shows where each value travels; `?` marks a conflict the policy left to a human.
- **Link** on a candidate records the pair, as `data-sync:link` does, and plans again.
- **Keep local** / **Keep remote** on a field conflict writes the kept side's values on the other one, through `SyncResolver`, and plans again.
- **Apply the plan** runs it for real after a confirmation; the table then shows each outcome. Plan again to see what is left: a sync converges over runs.

The screen talks to three endpoints, usable by other screens or scripts holding the role:

| Endpoint | Does |
|---|---|
| `GET api/data-sync/plan/{key}` | plans, dry run: `SyncReport::toArray()` in the envelope |
| `POST api/data-sync/run/{key}` | plans and runs |
| `POST api/data-sync/link/{key}` with `{"localId", "remoteId"}` | links by hand; an error envelope says why it could not |
| `POST api/data-sync/resolve/{key}` with `{"localId", "kept": "local"\|"remote"}` | settles the pair's field conflict; an error envelope when there is none |

## Table of Contents

- [Architecture](#architecture)
- [Integration in the Suite](#integration-in-the-suite)
- [Dependencies](#dependencies)
- [Versioning & Compatibility Policy](#versioning--compatibility-policy)
- [License](#license)
- [About us](#about-us)
- [Migration Notes](#migration-notes)

## Architecture

Two controllers and two pages over `symfony-data-sync`'s services; nothing here plans or writes by itself.

src/Controller/Pages/DataSyncController.php renders `index` (every definition, its local class and adapter class) and `definition` (one definition's summary). Neither page plans: planning lists the remote, so the definition page renders at once and asks for its plan afterwards.

src/Api/Controller/DataSyncController.php is a thin layer over `SyncRunner` (plan and run, the same filters as `data-sync:run`) and `SyncLinker` (the checks and the link of `data-sync:link`). Answers are `SyncReport::toArray()`, the contract `symfony-data-sync` keeps stable.

assets/pages/data_sync/definition.ts fetches the plan through `RoutingService` and `unwrapApiEnvelope()`, and builds the table with DOM nodes and `textContent` only — values come from outside services. Markers come from `<template>` elements the page renders once per operation with the design system's `marker()`; labels come from a template's data attributes, so the script holds no text.

Both controllers carry `#[IsGranted(DataSyncAccessVoter::ATTRIBUTE)]`; src/Security/DataSyncAccessVoter.php answers with the configured `access_role`.

Tests: tests/Unit/Api/Controller/DataSyncControllerTest.php runs the endpoints over real `SyncRunner` and `SyncLinker`, with in-memory definitions processed by `symfony-data-sync`'s own configuration.

## Integration in the Suite

This package is part of the Wexample Suite — a collection of high-quality, modular tools designed to work seamlessly together across multiple languages and environments.

### Related Packages

The suite includes packages for configuration management, file handling, prompts, and more. Each package can be used independently or as part of the integrated suite.

Visit the [Wexample Suite documentation](https://docs.wexample.com) for the complete package ecosystem.

## Dependencies

- php: >=8.5
- wexample/symfony-api: >=8.0.0
- wexample/symfony-data-sync: >=3.0.0
- wexample/symfony-design-system: >=25.0.0
- wexample/symfony-helpers: >=12.0.0
- wexample/symfony-loader: >=16.0.0

## Versioning & Compatibility Policy

Wexample packages follow **Semantic Versioning** (SemVer):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

We maintain backward compatibility within major versions and provide clear migration guides for breaking changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Free to use in both personal and commercial projects.

## About us

[Wexample](https://wexample.com) stands as a cornerstone of the digital ecosystem — a collective of seasoned engineers, researchers, and creators driven by a relentless pursuit of technological excellence. More than a media platform, it has grown into a vibrant community where innovation meets craftsmanship, and where every line of code reflects a commitment to clarity, durability, and shared intelligence.

This packages suite embodies this spirit. Trusted by professionals and enthusiasts alike, it delivers a consistent, high-quality foundation for modern development — open, elegant, and battle-tested. Its reputation is built on years of collaboration, refinement, and rigorous attention to detail, making it a natural choice for those who demand both robustness and beauty in their tools.

Wexample cultivates a culture of mastery. Each package, each contribution carries the mark of a community that values precision, ethics, and innovation — a community proud to shape the future of digital craftsmanship.

## Migration Notes

When upgrading between major versions, refer to the migration guides in the documentation.

Breaking changes are clearly documented with upgrade paths and examples.
