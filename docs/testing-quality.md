# Testing and Quality Rules

    > Status: Mandatory
    > Project: Poromosiyo API

    Every change must leave the project in a verifiable state.

    ## Current Verification

    Run the commands that exist for the project:

    ```bash
    npm run lint
npm test
npm run test:e2e
npm run build
    ```

    As the project grows, tests must be added alongside business-critical
    behavior.

    ## Quality Requirements

    - TypeScript errors are not acceptable.
    - ESLint errors are not acceptable.
    - Build errors are not acceptable.
    - Tests must not be disabled simply to make CI pass.
    - Do not use `any` to bypass proper typing without a documented reason.
    - Do not silence errors with broad ESLint disables.
    - Do not remove failing tests without understanding why they fail.
    - Separate pre-existing failures from failures introduced by the current work.

    ## Definition of Done

    A task is not complete until applicable linting, type checking, tests, and
    build commands have been run or the reason they could not run is clearly
    reported.
