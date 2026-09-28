## Architecture

Two controllers and two pages over `symfony-data-sync`'s services; nothing here plans or writes by itself.

src/Controller/Pages/DataSyncController.php renders `index` (every definition, its local class and adapter class) and `definition` (one definition's summary). Neither page plans: planning lists the remote, so the definition page renders at once and asks for its plan afterwards.

src/Api/Controller/DataSyncController.php is a thin layer over `SyncRunner` (plan and run, the same filters as `data-sync:run`) and `SyncLinker` (the checks and the link of `data-sync:link`). Answers are `SyncReport::toArray()`, the contract `symfony-data-sync` keeps stable.

assets/pages/data_sync/definition.ts fetches the plan through `RoutingService` and `unwrapApiEnvelope()`, and builds the table with DOM nodes and `textContent` only — values come from outside services. Markers come from `<template>` elements the page renders once per operation with the design system's `marker()`; labels come from a template's data attributes, so the script holds no text.

Both controllers carry `#[IsGranted(DataSyncAccessVoter::ATTRIBUTE)]`; src/Security/DataSyncAccessVoter.php answers with the configured `access_role`.

Tests: tests/Unit/Api/Controller/DataSyncControllerTest.php runs the endpoints over real `SyncRunner` and `SyncLinker`, with in-memory definitions processed by `symfony-data-sync`'s own configuration.
