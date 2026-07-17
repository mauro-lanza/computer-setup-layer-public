#!/usr/bin/env bash
# Checks which local branches have associated PRs that were already merged,
# offers to delete them, then reports branches with unpushed commits.

set -euo pipefail

# Must be run inside a git repository.
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

# GitHub CLI must be authenticated to query PR status.
if ! gh auth status &>/dev/null; then
  echo "Error: GitHub CLI is not authenticated." >&2
  echo "Run: gh auth login" >&2
  exit 1
fi

current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || true)
default_branch=${default_branch:-master}

# Collect local branches once.
mapfile -t branches < <(git for-each-ref --format='%(refname:short)' refs/heads/)

echo "Checking local branches for merged PRs..."
echo ""

merged_branches=()

for branch in "${branches[@]}"; do
  # Skip the default branch and the branch currently checked out.
  if [[ "$branch" == "$default_branch" || "$branch" == "$current_branch" ]]; then
    continue
  fi

  # Look for merged PRs with this branch as head.
  if ! pr_info=$(gh pr list --head "$branch" --state merged \
    --json number,title,mergedAt \
    --jq '.[] | "#\(.number) \(.title) (merged \(.mergedAt | split("T")[0]))"' 2>/dev/null); then
    echo "  ⚠  $branch — failed to query PR status, skipping"
    continue
  fi

  if [[ -n "$pr_info" ]]; then
    merged_branches+=("$branch")
    echo "  🗑  $branch"
    while IFS= read -r line; do
      echo "      └─ $line"
    done <<< "$pr_info"
  fi
done

echo ""
if [[ ${#merged_branches[@]} -eq 0 ]]; then
  echo "No local branches with merged PRs found."
else
  echo "Found ${#merged_branches[@]} branch(es) with merged PRs."
  read -rp "Delete them all? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    git branch -D "${merged_branches[@]}"
    merged_branches=()
  else
    echo "Skipped. You can delete them manually with:"
    echo "  git branch -D ${merged_branches[*]}"
  fi
fi

# Report branches with commits that aren't on their remote.
echo ""
echo "Checking for branches with unpushed commits..."
echo ""

unpushed_found=0

for branch in "${branches[@]}"; do
  # Skip branches already flagged as merged (and possibly deleted).
  skip=0
  for merged in "${merged_branches[@]}"; do
    [[ "$branch" == "$merged" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue

  # Skip branches that no longer exist (deleted above).
  git show-ref --quiet --verify "refs/heads/$branch" || continue

  if upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null); then
    ahead=$(git rev-list --count "$upstream".."$branch" 2>/dev/null || echo "0")
    if [[ "$ahead" -gt 0 ]]; then
      unpushed_found=1
      echo "  ⚠  $branch — $ahead unpushed commit(s) vs $upstream"
    fi
  else
    # No upstream tracking branch; compare against the default branch.
    commit_count=$(git rev-list --count "$default_branch".."$branch" 2>/dev/null || echo "0")
    if [[ "$commit_count" -gt 0 ]]; then
      unpushed_found=1
      echo "  ⚠  $branch — no upstream, $commit_count commit(s) ahead of $default_branch"
    fi
  fi
done

if [[ $unpushed_found -eq 0 ]]; then
  echo "All branches are up to date with their remotes."
fi
