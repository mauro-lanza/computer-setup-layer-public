---
name: slack-triage
description: Use when asked what the user was requested to do, promised, or still owes on Slack or Jira over a period (e.g. "the past two months"), or which assigned tickets and epics they forgot. Builds a status-checked list, separating open items from ones that were done, answered, superseded or overruled by a manager or lead. Read-only; never posts.
---

# Slack Triage

Turn a period of Slack into one list: what is still open, what the user promised,
and what was closed or overruled. Keyword searches alone miss most requests and
cannot tell open from done; the status comes from reading what happened next.

## Invocation

- **period:** start date, default two months back.
- **manager:** the user's manager, and any leads whose word overrides a request.
  Infer it from DMs (performance reviews, approvals) if not given, and say which
  person you assumed.
- Searching DMs and private channels (`slack_search_public_and_private`) needs the
  user's consent. Ask once, and explain that public-only search finds almost nothing.

## Workflow

1. **Find the conversations.** The current user's ID is in the Slack tool
   descriptions. Search one week at a time from the start date, because one search
   returns about 20 hits. Run two queries per week:
   - `<@USER_ID>`: mentions in channels and threads.
   - `-from:<@USER_ID>` with `channel_types: "im,mpim"`: DMs and group DMs.

   Use `include_context: false` and follow the `cursor \`...\`` in
   `pagination_info`. Parse `Channel: ... (ID: X)` and `thread_ts=` from each hit,
   and collect the unique conversation IDs.
2. **Dump the full history** of each conversation since the start date with
   `slack_read_channel` (`oldest`, `limit: 100`, following the
   `cursor: \`...\`` in `pagination_info`). Then read every message marked
   `Thread: N replies` with `slack_read_thread`. Include the user's own replies: they
   carry the "done", "I'll do it" and the pushback.
   - Do it in a single `execute` script that retries on `ratelimited` errors. There
     is no sleep, so retry up to about 15 times per call and record what still fails.
   - Return the whole dump. It is too large for the context, so the harness saves it
     to a file. Use that file from here on.
3. **Split the dump across up to 4 Sonnet workers.**
   - Grep `^===== CONVERSATION` for the boundaries and give each worker a line range
     that ends on a boundary.
   - Give bot-heavy monitoring channels to one worker, with instructions to grep for
     mentions and human senders instead of reading them in full.
   - Each brief contains:
     - the user's name and ID, and the manager's name and ID;
     - the file path and line range;
     - the format: messages are newest first, and threads follow as
       `--- THREAD <ts> ---`;
     - the status classes below;
     - a PR check: `gh pr view <n> --repo <org>/<repo> --json state,reviewDecision`;
     - a request to list any manager directives that affect other conversations;
     - a return format: a table of status | requester | date | request | evidence
       (conversation ID + ts, or PR state), under 40 lines, ending with
       `Unresolved:`.
4. **Reconcile.**
   - Merge the tables and deduplicate the same topic raised in several places.
   - Apply each manager directive across slices. For example, a request handled in a
     group DM may be overruled later in the manager's DM. When the action and the
     veto are both timestamped, say which came first.
   - Grep the dump for every mention of the user to catch anything the workers
     skipped, and read the few that look uncovered.
5. **Cross-check Jira** (Atlassian MCP, inside `execute`). Get the `cloudId` from
   `getAccessibleAtlassianResources` once. Run these `searchJiraIssuesUsingJql`
   queries with `fields: [summary, status, issuetype, parent, updated]`:
   - `assignee = currentUser() AND statusCategory != Done ORDER BY issuetype, updated DESC`
     lists every ticket assigned to the user. Open epics and old tickets nobody has
     touched in a while are the ones that get forgotten.
   - `parent = <EPIC> AND statusCategory != Done` for each open epic the user owns.
     Unassigned children are scope the user is accountable for.
   - `assignee = currentUser() AND statusCategory = Done AND resolved >= <start>`:
     tickets that close Slack items.
   - `text ~ "<first name>" AND updated >= <start> AND statusCategory != Done AND assignee != currentUser()`,
     then `listJiraIssueComments` on the hits to find commitments made in comments.
     Expect noise from other people with the same name.

   Match tickets to Slack items. A done ticket closes an item. A Slack item with no
   ticket is untracked work. A ticket with no Slack activity and no update for a
   long time is stale: ask whether to close it rather than counting it as work.
6. **Report**, grouped:
   - **Open: waiting on your review or deploy.** Open PRs, approved-but-unmerged
     PRs, and deploys you announced.
   - **Open: you promised.** Things the user said they would do. This is the biggest
     blind spot, because no one tags you for it.
   - **Open: waiting on your answer or action.**
   - **Overruled or taken off you**, naming who decided.
   - **Standing manager directives** that govern future requests (no force-merge,
     everything via Terraform, and so on).
   - **Jira**: tickets in progress, open epics and their unowned children, stale
     tickets to close, and Slack work that has no ticket.

   Leave done and answered items out of the report unless asked. Give their count,
   and say which channels were only grepped.

## Status classes

- `done`: the user or someone else did it. Evidence is a confirmation message or a
  merged PR.
- `answered`: a question the user replied to.
- `superseded`: replaced by another PR or approach, or taken over by someone else.
- `overruled (per X)`: the manager or a lead said no, said to ignore it, or
  redirected it.
- `cancelled`: the requester withdrew it.
- `open`: no later evidence that it was resolved.
- `promised`: the user committed to it and there is no evidence it was delivered.

## Rules

- Read-only. Never post, react, draft or schedule messages, and never comment on,
  transition or edit Jira tickets, unless asked.
- Evidence for every status is a conversation ID + message ts or a PR state. "No
  follow-up seen" counts as open, not done.
- Workers' cross-slice claims are leads. Confirm the ones that change a status by
  reading the cited lines.
- Never copy message content into repo files or docs. The list stays in the chat.
