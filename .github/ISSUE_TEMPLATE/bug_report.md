name: Bug report
about: Create a report to help us improve Timeline Planner
title: ""
labels: bug
assignees: ""

body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug.

  - type: input
    id: summary
    attributes:
      label: Bug summary
      description: Briefly describe the issue.
      placeholder: Example: Timeline entries shift incorrectly when moving events across days
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: List the exact steps that led to the bug.
      placeholder: |
        1. Open the timeline
        2. Create a multi-day event
        3. Drag the event to a different date
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What did you expect to happen?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
      description: What happened instead?
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Add screenshots, browser info, or any other useful details.
