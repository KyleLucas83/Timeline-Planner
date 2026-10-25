name: Feature request
about: Suggest an idea or enhancement for Timeline Planner
title: ""
labels: enhancement
assignees: ""

body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting an improvement.

  - type: input
    id: feature
    attributes:
      label: Feature summary
      description: What would you like to see added?
      placeholder: Example: Recurring event support
    validations:
      required: true

  - type: textarea
    id: problem
    attributes:
      label: Problem to solve
      description: What pain point or user need does this address?
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: Describe the feature or desired behavior.
    validations:
      required: true

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      description: What should be true when this feature is complete?
      placeholder: |
        - User can create a recurring event
        - Event repeats on the selected schedule
        - Timeline remains readable and editable
    validations:
      required: true
