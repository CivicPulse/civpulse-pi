---
description: Find registered Civic Pulse accounts or promote an existing user to admin
argument-hint: "<email, display name or promotion request>"
---
Handle this Civic Pulse account-administration request: ${@:-<search for or promote an account>}

Work through the `civic-user-admin` skill:

1. Load the `civic-user-admin` skill, then run `whoami` and confirm the account is an admin.
2. Use `search_users` (not `search_people` or `search_site`) with a focused query; paginate with `offset` increments of 50.
3. Resolve the exact email and UUID. Ask which account is intended if results are ambiguous.
4. Only promote when the human has explicitly requested promotion of that resolved account. Use `promote_user_to_admin`; the `civpulse-pi` write guard will ask for confirmation.
5. Search the exact email again and verify the same UUID now has `role=admin`. Report the account and resulting role.
