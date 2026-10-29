# symfony-data-sync-ds

Version: 3.0.5

Design-system screens to review and apply symfony-data-sync plans

## Table of Contents

- [Installation](#installation)
- [Introduction](#introduction)

## Installation

```php
// config/bundles.php
Wexample\SymfonyDataSync\WexampleSymfonyDataSyncBundle::class => ['all' => true],
Wexample\SymfonyDataSyncDs\WexampleSymfonyDataSyncDsBundle::class => ['all' => true],
```

```yaml
# config/packages/wexample_symfony_data_sync_ds.yaml — optional
wexample_symfony_data_sync_ds:
  access_role: ROLE_ADMIN   # the default
```

Controllers are routed by the application's `routing.controllers` import. The API routes are exposed to the JS router.

`symfony-data-sync-ds` is the screen of `symfony-data-sync`, built on the design system. `/data-sync/` lists the definitions; each definition's page loads its plan as a dry run and shows every relation — link, create, update, unlink, conflict, candidate — with, for updates and conflicts, the differing fields side by side: local value, the direction it will travel, remote value, the side to be written in bold.

From there a human does what the planner must not: link a candidate the fuzzy rule proposed, settle a field conflict by keeping one side, then apply the plan, which writes on both sides. Access follows a configurable role, `ROLE_ADMIN` by default.
