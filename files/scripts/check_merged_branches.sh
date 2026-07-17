#!/usr/bin/env bash
# Checks which local branches have associated PRs that were already merged.

set -euo pipefail

# Check gh auth first
if ! gh auth status &>/dev/null; then
  echo "Error: GitHub CLI is not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

current_branch=$(git symbolic-ref --short HEAD)
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")

echo "Checking local branches for merged PRs..."
echo ""

found=0
branches_to_delete=()

for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
  # Skip default branch and current branch
  if [[ "$branch" == "$default_branch" || "$branch" == "$current_branch" ]]; then
    continue
  fi

  # Search for merged PRs with this branch as head
  if ! pr_info=$(gh pr list --head "$branch" --state merged --json number,title,mergedAt --jq '.[] | "#\(.number) \(.title) (merged \(.mergedAt | split("T")[0]))"' 2>/dev/null); then
    echo "  ⚠  $branch — failed to query PR status, skipping"
    continue
  fi

  if [[ -n "$pr_info" ]]; then
    found=1
    branches_to_delete+=("$branch")
    echo "  🗑  $branch"
    while IFS= read -r line; do
      echo "      └─ $line"
    done <<< "$pr_info"
  fi
done

echo ""
if [[ $found -eq 0 ]]; then
  echo "No local branches with merged PRs found."
else
  echo "Found ${#branches_to_delete[@]} branch(es) with merged PRs."
  read -rp "Delete them all? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    git branch -D "${branches_to_delete[@]}"
  else
    echo "Skipped. You can delete them manually with:"
    echo "  git branch -D ${branches_to_delete[*]}"
  fi
fi

# Check for branches with unpushed commits
echo ""
echo "Checking for branches with unpushed commits..."
echo ""

unpushed_found=0

for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
  upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null) || true

  if [[ -z "$upstream" ]]; then
    # Branch has no upstream tracking branch
    commit_count=$(git rev-list --count "$default_branch".."$branch" 2>/dev/null || echo "0")
    if [[ "$commit_count" -gt 0 ]]; then
      unpushed_found=1
      echo "  ⚠  $branch — no upstream, $commit_count commit(s) ahead of $default_branch"
    fi
  else
    # Branch has upstream, check for unpushed commits
    ahead=$(git rev-list --count "$upstream".."$branch" 2>/dev/null || echo "0")
    if [[ "$ahead" -gt 0 ]]; then
      unpushed_found=1
      echo "  ⚠  $branch — $ahead unpushed commit(s) vs $upstream"
    fi
  fi
done

if [[ $unpushed_found -eq 0 ]]; then
  echo "All branches are up to date with their remotes."
fi
