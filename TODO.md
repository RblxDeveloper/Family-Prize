# TODO: Fix Task Submission Modal and Task Visibility Issues

## 1. Fix Modal Closing Issue
- Ensure the upload modal closes after successful submission or shows error without closing if failed.
- Move `closeUploadModal()` call to after the try-catch block in `submitTaskForReview()` to guarantee it closes on success.

## 2. Show In-Progress Status to Other Children
- Modify `loadAvailableTasks()` to check for in-progress submissions by other children.
- For tasks in progress by another child, display "In progress by [child name]" instead of "Start Task" button.
- Fetch child names for in-progress tasks.

## 3. Hide Approved Tasks from Available Tasks List
- In `loadAvailableTasks()`, check for approved submissions by the current child.
- Exclude tasks that the child has already completed and approved from the available tasks grid.

## 4. Ensure Modal Closes with Success Message
- Confirm that the toast message "✅ Task submitted for review! Your parent will check it soon." is shown and modal closes.
- Update the toast message to "Submitted successfully!" as requested.

## 5. Update Child History
- Ensure `loadActivityHistory()` includes details of finished tasks, including images if possible.
- Verify that approved tasks appear in the activity history with points earned.

## 6. Test Changes
- Test task submission flow: start task, upload photos, submit, check modal closes.
- Test visibility: one child starts task, other sees in-progress; after approval, task disappears for all.
- Test history: approved tasks show in child's profile history.
