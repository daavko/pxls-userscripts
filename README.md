# Pxls userscripts by daavko

## Installation

1. Get a userscript extension for your browser. Popular options include (this is not an exhaustive list):
    - [Tampermonkey](https://www.tampermonkey.net/)
    - [Violentmonkey](https://violentmonkey.github.io/)
    - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
2. Install the script you want by visiting [pxls.daavko.moe](https://pxls.daavko.moe/) and clicking one of the links in
   the "Userscripts" section. This will automatically install the script in your userscript extension.

Note: The scripts should work on any userscript extension, but they are primarily tested on Tampermonkey. If you
encounter any issues, please create an issue on this GitHub repository or find me on Discord.

## List of scripts

### Template color autoselector

This script automatically selects the color of the pixel you are currently hovering over, based on the loaded template.
There's various options in the settings menu to customize the behavior of the script.

## License

All scripts in this repository are licensed under the GPLv3 license or any later version. You can find the full license
text in the [LICENSE](LICENSE.md) file.

## How to build a script locally

Run the `build.js` script with Node.js to build. The first argument is the path to the script you want to build. There's
also the following options you can include:

- `--no-minify` - Don't minify the output script (useful for debugging)
- `--sourcemap` - Generate a source map for the output script (useful for debugging)
- `--watch` - Watch for changes in the script and rebuild automatically
