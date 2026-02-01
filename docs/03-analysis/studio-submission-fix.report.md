# Studio Submission Logic Analysis & Fix Plan

## 1. Issues Identified

### A. UI Layout Issue ("Button Count")
*   **Current Behavior:** The code renders a "Create" (제작하기) button *if* `partyTemplateProjectId` exists, AND allows rendering the "Select" (제작물 선택하기) button alongside it.
*   **User Expectation:** If a template is valid (Studio Submission context), the user likely wants a single, clear "Create" action or a simplified view, not redundant choices that imply conflicting paths.
*   **Root Cause:** The conditions for rendering buttons were additive rather than exclusive.

### B. Data Persistence Failure (Initialization Reset)
*   **Current Behavior:** When returning from the Editor:
    1.  `MissionDetailPage` mounts.
    2.  `useEffect` detects URL params (`openSubMission`) → Sets `selectedSubMission`.
    3.  `SubmissionForm` mounts.
    4.  `useState` initializes `slotsData` taking Draft from `sessionStorage`. **(Success)**
    5.  **BUT**, the `useEffect` at line 1402 (detecting `subMission.submission`) fires immediately after mount.
    6.  This effect overwrites `slotsData` with the *server's* version (which is empty/old), erasing the just-restored draft.
*   **Root Cause:** The "Server Sync" `useEffect` does not respect the "Draft Restored" state. It blindly updates the state whenever `subMission` exists.

---

## 2. Proposed Solutions

### A. Fix UI Layout
*   **Logic:**
    *   If `partyTemplateProjectId` exists: Show **only** the "Create" button (which now says "Create Again" if project selected). Hide/Remove "Select" button to avoid confusion.
    *   If NO template ID: Show "Select" button (or "Create New" if that feature is added later).
*   **Action:** Modify `MissionDetail.tsx` to render buttons mutually exclusively or hide the "Select" button when in Template mode.

### B. Fix Data Persistence
*   **Logic:**
    *   Introduce a reference `isDraftRestored` or check `sessionStorage` strictly inside the effect.
    *   Modify the `useEffect` that syncs server data: **Do NOT overwrite** if a draft was just successfully loaded.
    *   Alternatively, move the Draft Load logic *into* a `useEffect` that runs **after** the server sync effect, forcing the Draft to win.
*   **Preferred Approach:** Add a `ref` currently tracking if we just mounted. Or simpler: Inside the server-sync effect, check if `sessionStorage` has a draft. If yes, **SKIP** the server sync (because the `useState` initializer already handled it, or let a separate effect handle it).

## 3. Work Checklist

1.  **[UI]** Modify `MissionDetail.tsx`: Condition to hide "Select" button when "Create" is primary.
2.  **[Logic]** Modify `MissionDetail.tsx`: logic to prevent `useEffect` from overwriting Draft data.
3.  **[Verify]** Confirm buttons are accurate (2 max, or 1 based on context) and Data persists after "Save & Return".

---
Prepared for: Immediate Implementation
