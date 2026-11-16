# V1 sessions missing from session_v2

Verified against OpenCode v2.3.0 (`packages/core/src/database/v1-migration.bun.ts`).

## The gap

OpenCode V2 copies the V1 tables (`session`, `message`, `part`) into `session_v2` / `session_message` once, when the service first starts. A client that still writes V1 afterwards (for example an editor bundling a V1 OpenCode) adds rows to `session` that are never copied. `usage-report` reads only `session_v2`, so it warns and leaves them out.

Mechanics that shape the fix:

- Progress is kv key `migration.v1-v2`: `{"phase":"completed"}`, or `{"phase":"sessions","cursor":"<id>"}` while running. At service start, `completed` stops everything.
- The walk takes V1 sessions in `id DESC` order with `id < cursor`. V1 ids shrink over time, so this goes oldest to newest.
- For each walked session the session row is `INSERT OR IGNORE` (manual `project_id` / `path` fixes survive), but its `session_message` rows are deleted and rebuilt from V1 and the V1 row is updated. A session continued in V2 loses its V2 messages if walked.
- Any other state (no key, unknown phase) wipes the whole `event` table and restarts the walk.

So the marker must be set to a cursor just above the highest missing id, and every other V1 session below it must be safe to rebuild.

## Do not

- Delete the marker row.
- Set `{"phase":"sessions"}` without a `cursor`.
- Edit the database while the service runs.
- Write with anything but the steps below; ask the user before each step marked **ASK**.

## Procedure

```sh
DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"   # absolute path; honours XDG_DATA_HOME via `opencode debug paths`
RO="file:$DB?mode=ro"
```

1. Read-only: list the gap.
   ```sh
   sqlite3 -readonly "$RO" "select id, datetime(time_created/1000,'unixepoch','localtime'), directory from session where id not in (select id from session_v2) order by id"
   ```
   Empty: nothing to do.

2. Read-only: compute the cursor. `~` sorts after every id character, so `id < cursor` includes the highest missing id.
   ```sh
   CURSOR=$(sqlite3 -readonly "$RO" "select max(id)||'~' from session where id not in (select id from session_v2)")
   ```
   Check what the walk would rebuild; abort if the second count is not 0 (those sessions were continued in V2):
   ```sh
   sqlite3 -readonly "$RO" "select count(*) from session where id < '$CURSOR'"
   sqlite3 -readonly "$RO" "select count(*) from session s join session_v2 v using(id) where s.id < '$CURSOR' and v.time_updated > s.time_updated"
   ```

3. **ASK** Stop the service: `opencode service stop`.

4. **ASK** Back up and verify.
   ```sh
   BACKUP="$DB.bak-$(date +%Y%m%d-%H%M%S)"
   sqlite3 -readonly "$RO" ".backup '$BACKUP'" && chmod 600 "$BACKUP"
   sqlite3 "file:$BACKUP?mode=ro&immutable=1" "pragma quick_check"   # must print: ok
   ```

5. **ASK** Set the marker (the only write to the migration state).
   ```sh
   sqlite3 "$DB" "update kv set value = json_object('phase','sessions','cursor','$CURSOR'), time_updated = cast(strftime('%s','now') as integer) * 1000 where key = 'migration.v1-v2'"
   sqlite3 -readonly "$RO" "select value from kv where key = 'migration.v1-v2'"
   ```
   The update must change exactly one row; if the key is absent, stop and report instead of inserting.

6. **ASK** Start the service: `opencode service start`. Poll until the status is `completed`:
   ```sh
   opencode api get /api/experimental/migration/v1
   ```
   `error` in the status: stop, keep the service stopped, and go to Rollback.

7. Read-only: re-run the query of step 1; it must return nothing. Check the marker is `{"phase":"completed"}`.

8. Optional, sessions that landed under project `global` with a relative path. Find them, then fix with the directory `$D` and the id `$N` of the project V2 created for it (listed in the `project` table):
   ```sh
   sqlite3 -readonly "$RO" "select project_id, directory, count(*) from session_v2 where project_id = 'global' group by 1, 2"
   ```
   **ASK** With the service stopped:
   ```sql
   begin immediate;
   update session set project_id='$N' where project_id='global' and directory='$D';
   update session_v2 set project_id='$N' where project_id='global' and directory='$D';
   commit;
   update session set path='' where project_id='$N' and path<>'';
   update session_v2 set path='' where project_id='$N' and path is null;
   ```
   Then start the service again.

## Rollback

**ASK** With the service stopped, replace the database with the backup: `cp "$BACKUP" "$DB"`. Remove stale `$DB-wal` and `$DB-shm` first if they exist. Start the service and re-check step 1.
