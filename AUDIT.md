# OverTake modular audit

The original monolithic page is separated while preserving the original script order.

Client fixes included:
- Guest username rename now updates `cfe_guest_display_name`, so the renamed identity survives the next render/refresh.
- Shared integer normalization prevents fractional XP/RP/trophy/high-score values from leaking into UI/state.
- Profile trophy reads cannot blindly lower a newer locally confirmed trophy value when the response is stale/empty.
- Explicit shop purchase responses are persisted to logged-in local cache, so a refresh does not restore the pre-purchase trophy balance.
- Tournament game-over reward display uses `tournamentTrophyEarned` from `gameEnd` when the backend supplies it.
- Leaderboard self entries are normalized before rendering.
- High-score persistence/display is integer-normalized.

Backend limitation:
The uploaded source contains a Google Apps Script endpoint but not the server-side Apps Script/database source. Server-side leaderboard calculations, medal persistence, tournament rollover, and database writes cannot be fully verified or rewritten from the client upload alone.


## Backend API fixes added
- Server-authoritative Rank Match daily limit: 30 → 28 → 26 → 24 → 22 → 20 → 18, minimum 10, resetting each Monday.
- Fixed Rank promotion target at 300 RP to match the client.
- Rank RP calculation now supports negative RP when the score misses the 300 target, matching the client rule.
- Tournament Trophy reward now applies the same logged-in 2× / guest 1× multiplier as frontend progression.
- Tournament activity is recorded as `TOURNAMENT_MATCH` instead of `CLASSIC_MATCH`.
- Monthly Tournament leaderboard rolls stale records into the current month before ranking.
- Weekly demotion no longer uses `Last Login` elapsed time; it uses the stored tournament week boundary.
- Username changes no longer enforce uniqueness, matching the frontend's documented behavior.
- Avatar cost is server-authoritative at 50 RP; username change cost/count is server-authoritative.
- Daily login/challenge reward multipliers are server-authoritative and cannot be inflated by client input.
- Numeric activity fields are sanitized to prevent NaN/negative values from being stored.
