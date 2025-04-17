# Changelog

All notable changes to this project will be documented in this file.

## Milestone watcher v1.2.0

- Internal optimizations
- Settings now sync across open tabs
- Add settings reset button

## Template color autoselector v2.3.1

- Fix detemplatize process would not work for unstyled templates

## Milestone watcher v1.1.0

- Add a setting to watch every 1000 canvas and all-time pixels (useful for updating egos)

## Milestone watcher v1.0.0

- Initial release of the Milestone watcher script

## Template color autoselector v2.3.0

- Internal refactor in settings
- Replace Zod with Valibot to reduce bundle size by more than half

## Template color autoselector v2.2.0

- Remove ResizeObserver on template image, as it was causing issues on initial load sometimes
- Replace that with a class check on the existing MutationObserver, so we can still detect when the template image is
  hidden via keyboard shortcut or settings
- Add an icon to the bottom right corner, which allows you to see the current status of the script and toggle it on and
  off with the mouse (this will also allow people on mobile to toggle it)

## Template color autoselector v2.1.0

- Show keybinds in the settings menu
- Fix race condition on initial load that would sometimes cause the template not to load
- Polish log messages and popup messages
- Various small internal refactorings

## Template color autoselector v2.0.0

- Rewrite everything to TS, with a ESbuild build system.
- Move detemplating to a worker, to avoid blocking the main thread with large templates.

## Template color autoselector v1.3.2 and below

No changelog available. Mostly bugfixes and adding the features that exist at this point.
