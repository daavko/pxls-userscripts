# Changelog

All notable changes to this project will be documented in this file.

## DPUS v1.2.0

- Add wrong color selector mode to auto color selector, which allows you to select a color that is _not_ on the template

## DPUS v1.1.0

- Add message on first run that explains where to enable scripts

## DPUS v1.0.4

- Fix virgin abuse calculation not working correctly due to even proessing order when a pixel is placed

## DPUS v1.0.3

- Hide template info when the info bubble is collapsed

## DPUS v1.0.2

- Fixed template info script not updating virgin abuse when placed color is not the template color

## DPUS v1.0.1

- Fixed template info script counting virgin abuse into the negatives by accident

## DPUS v1.0.0

- Initial release of the unified Daavko's Pxls Utility Scripts
- Add a message specific to Brave browser when detemplatization fails, as their tracking protection messes with canvas colors and causes issues
- Dependency updates
- Various internal refactors and bugfixes

# Outdated changelogs, before script unification

## Grief tracker v1.2.0

- Icon button is now properly set to "disabled" when there's no template and grief overlay is disabled in settings
- There are now 4 configurable modes for the grief overlay:
    - "Everything" - initially shows all griefs
    - "Non-virgin only" - initially shows only griefs on non-virgin pixels
    - "Recent only" - initially shows only griefs on pixels that are active on the heatmap
    - "New only" - initially shows no griefs, will only show new ones
- Added 3 ways to clear the entire grief list:
    - Button in settings
    - New icon button next to the existing one (can be disabled in settings)
    - Keyboard shortcut, the Y key (without any modifiers)

## Template color autoselector v2.5.0

- Update some internal modules due to changes made for the Grief tracker
- Icon button now only reacts to left click, without keyboard modifiers
- Fix keyboard shortcut reacting when user is typing in a text input

## Grief tracker v1.1.0

- Remove one of the available highlight animations, as it can cause the tab to freeze when zoomed out with enough
  detected griefs
- Add a "very slow" animation speed option

## Grief tracker v1.0.0

- Initial release of the Grief tracker script

## Template color autoselector v2.4.0

- Internal optimizations
- Settings now sync across open tabs

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
