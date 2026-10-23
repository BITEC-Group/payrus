#!/usr/bin/env bash
# PRS-AI-006 / TC-29-2: nothing financial, regulatory, security or identity related (including AI-authored changes)
# merges without a human Code Owner review and green CI. Run once, after `gh auth login`, as a repo admin:
#   bash scripts/apply-branch-protection.sh [owner/repo] [branch ...]
set -euo pipefail
REPO="${1:-infobitecconsulting-maker/payrus}"; shift || true
BRANCHES=("${@:-main}")
for B in "${BRANCHES[@]}"; do
  gh api -X PUT "repos/$REPO/branches/$B/protection" --input - <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["verify", "security"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "require_code_owner_reviews": true, "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
  echo "protected $REPO@$B"
done
gh api "repos/$REPO/branches/${BRANCHES[0]}/protection/required_pull_request_reviews" --jq '{codeOwners: .require_code_owner_reviews, approvals: .required_approving_review_count}'
