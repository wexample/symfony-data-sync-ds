Open `/data-sync/` with the access role and pick a definition. Its page plans at once, without writing: the status line says so.

- **Fields** unfolds the two panes of an update or a conflict. An arrow shows where each value travels; `?` marks a conflict the policy left to a human.
- **Link** on a candidate records the pair, as `data-sync:link` does, and plans again.
- **Apply the plan** runs it for real after a confirmation; the table then shows each outcome. Plan again to see what is left: a sync converges over runs.

The screen talks to three endpoints, usable by other screens or scripts holding the role:

| Endpoint | Does |
|---|---|
| `GET api/data-sync/plan/{key}` | plans, dry run: `SyncReport::toArray()` in the envelope |
| `POST api/data-sync/run/{key}` | plans and runs |
| `POST api/data-sync/link/{key}` with `{"localId", "remoteId"}` | links by hand; an error envelope says why it could not |
