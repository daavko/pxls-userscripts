// ==UserScript==
// @name         Template color autoselector
// @namespace    https://pxls.daavko.moe/
// @version      1.3.2
// @description  automatically selects color for the active template
// @author       daavko
// @match        https://pxls.space/
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAOESURBVDhPFZNZbFR1FIe//507W2frtNNl0oXajWlpy7QUBIkKVAWs4sKiBKQmakhpYkyIiT7ZuDz70ieV+CKvhmggBEOoW6JpVQpUtC12SrdpZ6adzkx75947c6+X53Nycs7vfJ84daTPlIQDuxMQGoYhoeY1JNlO7fZWKBRZnJ4Gm8A0DFxWozAEFHUKsg3bzs62YVPINDbXk1WydHTtItxQT3u0h2hvLw0tETJ5naqwn7tj4+w/eJStooSiqOjFAnK0txtNLdK7J8pXX//HE4f60TQdbyBIKODBMG1IhpPF2TGam6rIF/Nsa9uOszHM1NQsUmT3XnqePkpndDfkN2l9rI6alhbC28K4yh0YjhI6uyLkErNUBXyUlMg4PG7sQRddvT3Y3h06Mzzx5zhuh4ayNsfknd/57cdb1ITKuPTlCH1PHeD+2HXyK9NMzy/wzLGX6dj5OCUOH7UNDVY0enq4uS3CyMjnXBgcwMyuIdQ0S7F/HxUZvfYtG6l/ePX4CVRniAN9R/j04884+dpZtrbSiK7OJlMTblyuIuFSwZVLX5DPLqOZJrLTiZZRUUWWTUcdh/vfBkOlsrqC188OcOfXW4jx27fNk/1PUlFdxsbWFj9f/YbV+QkkK7xHAXqEgiQCyJUHKQRMTh8/hldyUXAanDj9FvIHH55h/6EdlLj8JFMbZJRN9DyUe73ILq8FR57M5joNFRkGhoY4/Gw3kl2g6ArVoRBSa90u5uZy3JuIcf6N82i5DAF/JWpRkLZ+nbYYAJn5+2N8cnGY1EqeuYcZ1I1aVCWDWJqfNpfXHuC1F7CreXLJFeyyE9MtMTUzTaQ5QsFaSWxZg5wuvDUhDHcV9ZV7SSQmkX4av0ttWTPZh8vk1hYpGiYOt8W1UqC7PQqSDafbhxQsxbRpFg9x9PWcdQakcjLi++8umzevXqF3RwPVFV78gWp+uHGD0mCQdGaNQDCArltkej3s2bcPBzr3/p5h7K8FXnnzAuL6tctmJpFiYvwXqsrd+Hw+mpqaKQ0ESKwl8fn9eDxeVlfiKKqG2yWxuBAnnjJ46dwgtqpwcLjdEqijs4vR0ZuWZQqpZJxEOmkJJ9hIbrC8tGDJoyPpGrMPYvwxGWPw4kesptYR7793zvSFqnHY4IXnn7Omx8jFY8QTCVw2O7JFoykVLL29zMRmCFQ28uKpd5iNL2Aqgv8BL6t6iusC390AAAAASUVORK5CYII=
// @grant        none
// ==/UserScript==

// string[] with hex color values
let palette;

// ImageData or null
let lastKnownTemplateSrc = null;
let detemplatizedTemplate = null;
let detemplatizedTemplateX = null;
let detemplatizedTemplateY = null;

// number or null
let currentCoordX = null;
// number or null
let currentCoordY = null;

let coordsElement;
let templateImageElement;
let templateWidthElement;
let templateCoordsXElement;
let templateCoordsYElement;
let paletteDeselectButton;
let paletteSelectionButtons;

let pointerDownCoords = null;

const defaultOptions = {
    // regular options
    debug: false,
    deselectColorOutsideTemplate: false,
    selectColorWhenDeselectedInsideTemplate: false,

    // internal options
    settingsCollapsed: false,
};

let hotkeyToggle = true;
let pointerMoveFuse = false;

const coordsRegex = /^\(([0-9]+), ([0-9]+)\)$/;
let coordsMutationEnabled = false;
const coordsMutationObserver = new MutationObserver(() => {
    processCoords();
});

const debugLog = (message) => {
    if (getOption('debug')) {
        console.log('Template color autoselector: ' + message);
    }
};

const showError = (message, duration = 5000) => {
    console.error(message);

    const errorDiv = createDocumentFragment(
        `<div style="background-color: red; color: white; padding: 5px;">${message}</div>`,
    );

    const errorContainer = document.querySelector('body > header > .mid');
    if (!errorContainer) {
        throw new Error('Failed to find error container, this should never happen');
    }

    const errorDivChildren = [...errorDiv.children];
    errorContainer.appendChild(errorDiv);
    setTimeout(() => {
        for (const child of errorDivChildren) {
            errorContainer.removeChild(child);
        }
    }, duration);
};

const showSuccessMessage = (message, duration = 5000) => {
    const successDiv = createDocumentFragment(
        `<div style="background-color: green; color: white; padding: 5px;">${message}</div>`,
    );

    const successContainer = document.querySelector('body > header > .mid');
    if (!successContainer) {
        throw new Error('Failed to find success container, this should never happen');
    }

    const successDivChildren = [...successDiv.children];
    successContainer.appendChild(successDiv);
    setTimeout(() => {
        for (const child of successDivChildren) {
            successContainer.removeChild(child);
        }
    }, duration);
};

const init = () => {
    debugLog('Initializing');

    initOptions();
    const optionsSidebar = document.querySelector('aside#settings > .panel-body');
    if (!optionsSidebar) {
        showError('Failed to find options sidebar, this should never happen');
        return;
    } else {
        optionsSidebar.appendChild(createOptions());
    }

    const boardElement = document.querySelector('canvas#board');
    if (!boardElement) {
        showError('Failed to find board element, this should never happen');
        return;
    }

    coordsElement = document.querySelector('#coords-info > .coords');
    if (!coordsElement) {
        showError('Failed to find coords element, this should never happen');
        return;
    }

    templateImageElement = document.querySelector('img.board-template');
    if (!templateImageElement) {
        showError('Failed to find template image element, this should never happen');
        return;
    }

    templateWidthElement = document.querySelector('input#template-width');
    if (!templateWidthElement) {
        showError('Failed to find template width element, this should never happen');
        return;
    }

    templateCoordsXElement = document.querySelector('input#template-coords-x');
    if (!templateCoordsXElement) {
        showError('Failed to find template coords x element, this should never happen');
        return;
    }

    templateCoordsYElement = document.querySelector('input#template-coords-y');
    if (!templateCoordsYElement) {
        showError('Failed to find template coords y element, this should never happen');
        return;
    }

    paletteDeselectButton = document.querySelector('#palette > .palette-button.deselect-button');
    if (!paletteDeselectButton) {
        showError('Failed to find palette deselect button, this should never happen');
        return;
    }

    const paletteSelectionButtonsNodes = document.querySelectorAll(
        '#palette > .palette-button:not(.deselect-button):not(.palette-button-special)',
    );
    if (paletteSelectionButtonsNodes.length === 0) {
        showError('Failed to find palette selection buttons, this should never happen');
        return;
    } else {
        paletteSelectionButtons = [...paletteSelectionButtonsNodes];
    }

    fetchPalette()
        .then((pal) => {
            palette = pal;
        })
        .then(() => {
            debugLog('Observing coords element for changes');
            enableCoordsMutationObserver(true);

            boardElement.addEventListener(
                'pointerdown',
                (event) => {
                    pointerDownCoords = { x: event.clientX, y: event.clientY };
                    pointerMoveFuse = false;
                    debugLog(`Pointer down at ${pointerDownCoords.x}, ${pointerDownCoords.y}`);
                },
                { passive: true },
            );
            boardElement.addEventListener(
                'pointerup',
                () => {
                    debugLog('Pointer up');
                    pointerDownCoords = null;
                    pointerMoveFuse = false;
                    maybeEnableCoordsMutationObserver(true);
                },
                { passive: true },
            );
            boardElement.addEventListener(
                'pointermove',
                (event) => {
                    if (pointerDownCoords === null || pointerMoveFuse) {
                        return;
                    }

                    const coords = { x: event.clientX, y: event.clientY };
                    const distance = Math.sqrt(
                        (coords.x - pointerDownCoords.x) ** 2 + (coords.y - pointerDownCoords.y) ** 2,
                    );
                    if (distance > 5) {
                        debugLog(`Pointer move fuse triggered at ${coords.x},${coords.y} distance ${distance}`);
                        pointerMoveFuse = true;
                        disableCoordsMutationObserver(true);
                    }
                },
                { passive: true },
            );

            document.body.addEventListener('keydown', (event) => {
                if (event.key === 'z') {
                    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                        return;
                    }

                    hotkeyToggle = !hotkeyToggle;
                    debugLog(`Hotkey toggle: ${hotkeyToggle}`);
                    if (hotkeyToggle) {
                        maybeEnableCoordsMutationObserver();
                    } else {
                        disableCoordsMutationObserver();
                    }
                }
            });

            const templateImageMutationObserver = new MutationObserver(() => {
                debugLog('Template image element changed');
                if (templateImageElement.src === lastKnownTemplateSrc) {
                    debugLog('Template image element changed but src is the same');
                    // no change
                    return;
                }
                lastKnownTemplateSrc = templateImageElement.src;
                templateParamChanged();
            });
            debugLog('Observing template image element for changes');
            templateImageMutationObserver.observe(templateImageElement, { attributes: true });

            templateWidthElement.addEventListener('change', () => {
                debugLog('Template width changed');
                templateParamChanged();
            });
            templateCoordsXElement.addEventListener('change', () => {
                debugLog('Template coords X changed');
                const x = document.querySelector('input#template-coords-x').valueAsNumber;
                if (x < 0 || Number.isNaN(x)) {
                    showError('Invalid template X coordinate');
                    return;
                }
                detemplatizedTemplateX = x;
            });
            templateCoordsYElement.addEventListener('change', () => {
                debugLog('Template coords Y changed');
                const y = document.querySelector('input#template-coords-y').valueAsNumber;
                if (y < 0 || Number.isNaN(y)) {
                    showError('Invalid template Y coordinate');
                    return;
                }
                detemplatizedTemplateY = y;
            });

            if (templateImageElement.src !== '' && templateWidthElement.value !== '') {
                debugLog('Initial template params set, loading template');
                lastKnownTemplateSrc = templateImageElement.src;
                templateParamChanged();
            }
        })
        .catch((error) => {
            showError(error.message);
        });
};

const processCoords = () => {
    if (pointerMoveFuse || !hotkeyToggle) {
        // disabled via any internal mechanism
        return;
    }

    if (detemplatizedTemplate == null || detemplatizedTemplateX == null || detemplatizedTemplateY == null) {
        // no template = nothing to do
        return;
    }

    if (!window.App.user.isLoggedIn()) {
        // not logged in, can't place so don't touch
        return;
    }

    const coordsText = coordsElement.textContent.trim();
    if (coordsText === '') {
        // empty is fine
        return;
    }

    const match = coordsText.match(coordsRegex);
    if (!match) {
        showError('Failed to parse coords text');
        return;
    }

    const x = parseInt(match[1]);
    const y = parseInt(match[2]);

    if (x === currentCoordX && y === currentCoordY) {
        // no change
        return;
    }

    currentCoordX = x;
    currentCoordY = y;

    coordsChanged(x - detemplatizedTemplateX, y - detemplatizedTemplateY);
};

const coordsChanged = (x, y) => {
    if (x < 0 || y < 0 || x >= detemplatizedTemplate.width || y >= detemplatizedTemplate.height) {
        // out of bounds

        if (getOption('deselectColorOutsideTemplate')) {
            unselectColor();
        }
        return;
    }

    const i = (y * detemplatizedTemplate.width + x) * 4;
    const r = detemplatizedTemplate.data[i];
    const g = detemplatizedTemplate.data[i + 1];
    const b = detemplatizedTemplate.data[i + 2];
    const a = detemplatizedTemplate.data[i + 3];

    if (a === 0) {
        // transparent, so out of template

        if (getOption('deselectColorOutsideTemplate')) {
            unselectColor();
        }
        return;
    }

    const toHex = (n) => n.toString(16).padStart(2, '0');
    const color = `${toHex(r)}${toHex(g)}${toHex(b)}`;
    const paletteColorIndex = palette.indexOf(color);
    if (paletteColorIndex === -1) {
        // no color, don't touch
        return;
    }

    if (getOption('selectColorWhenDeselectedInsideTemplate')) {
        selectColor(paletteColorIndex);
    } else {
        const anyColorSelected = paletteDeselectButton.classList.contains('active');
        if (anyColorSelected) {
            selectColor(paletteColorIndex);
        }
    }
};

const unselectColor = () => {
    if (!paletteDeselectButton.classList.contains('active')) {
        // already deselected
        return;
    }

    paletteDeselectButton.click();
};

const selectColor = (colorIndex) => {
    const paletteSelectionButton = paletteSelectionButtons[colorIndex];
    if (!paletteSelectionButton) {
        showError('Failed to find palette selection button, this should never happen');
        return;
    }

    if (paletteSelectionButton.classList.contains('active')) {
        // already selected
        return;
    }

    paletteSelectionButton.click();
};

const templateParamChanged = () => {
    const widthString = templateWidthElement.value;
    const width = templateWidthElement.valueAsNumber;
    const xString = templateCoordsXElement.value;
    const x = templateCoordsXElement.valueAsNumber;
    const yString = templateCoordsYElement.value;
    const y = templateCoordsYElement.valueAsNumber;

    if (templateImageElement.src === '' || widthString === '' || xString === '' || yString === '') {
        // no template, clear detemplatizedTemplate
        debugLog('No template, clearing detemplatized template');
        detemplatizedTemplate = null;
        detemplatizedTemplateX = null;
        detemplatizedTemplateY = null;
        return;
    }

    if (width <= 0 || Number.isNaN(width)) {
        showError('Invalid template width');
        return;
    }

    if (x < 0 || Number.isNaN(x) || y < 0 || Number.isNaN(y)) {
        showError('Invalid template coords');
        return;
    }

    loadDetemplatizedTemplate(templateImageElement, width)
        .then((imageData) => {
            debugLog('Template loaded');
            detemplatizedTemplate = imageData;
            detemplatizedTemplateX = x;
            detemplatizedTemplateY = y;
            showSuccessMessage('AutoColorSelector template loaded');
        })
        .catch((error) => {
            showError(error.message);
        });
};

const fetchPalette = async () => {
    debugLog('Fetching palette');
    const response = await fetch('/info');

    if (!response.ok) {
        throw new Error('Failed to fetch palette');
    }

    debugLog('Parsing palette');
    const responseBody = await response.json();
    const responsePalette = responseBody.palette;

    if (!Array.isArray(responsePalette)) {
        throw new Error('Palette is not an array');
    }

    const colorHexRegex = /^[0-9a-f]{6}$/i;
    for (const color of responsePalette) {
        if (typeof color !== 'object' || color === null) {
            throw new Error('Color is not an object');
        }

        if (typeof color.value !== 'string' || !colorHexRegex.test(color.value)) {
            debugLog('Encountered invalid color hex in palette: ' + color.value);
            throw new Error('Color hex is not a string');
        }
    }

    return responsePalette.map((color) => color.value.toLowerCase());
};

const loadDetemplatizedTemplate = async (img, targetWidth) => {
    debugLog(`Loading and detemplatizing template to width ${targetWidth}`);
    await img.decode();

    const { naturalWidth: imgWidth, naturalHeight: imgHeight } = img;
    debugLog(`Template image dimensions: ${imgWidth}x${imgHeight}`);

    if (imgWidth === 0 || imgHeight === 0) {
        throw new Error('Template image has zero dimensions after decoding, this should never happen');
    }

    if (getOption('debug')) {
        console.time('Detemplatizing template');
    }

    const imgCanvas = new OffscreenCanvas(imgWidth, imgHeight);
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.drawImage(img, 0, 0);

    const scaleFactor = imgWidth / targetWidth;
    if (!Number.isInteger(scaleFactor)) {
        throw new Error('Template image width does not divide evenly by target width');
    } else if (imgHeight % scaleFactor !== 0) {
        throw new Error('Template height is not a multiple of scale factor');
    }

    const targetHeight = imgHeight / scaleFactor;

    const sourceImageData = imgCtx.getImageData(0, 0, imgWidth, imgHeight);
    const targetImageData = new ImageData(targetWidth, targetHeight);

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const color = getScaledPixelColor(sourceImageData, x * scaleFactor, y * scaleFactor, scaleFactor);
            if (color) {
                const i = (y * targetWidth + x) * 4;
                targetImageData.data[i] = color.r;
                targetImageData.data[i + 1] = color.g;
                targetImageData.data[i + 2] = color.b;
                targetImageData.data[i + 3] = 255;
            }
        }
    }

    if (getOption('debug')) {
        console.timeEnd('Detemplatizing template');
    }

    return targetImageData;
};

const getScaledPixelColor = (imageData, x, y, pixelSize) => {
    const { data, width } = imageData;
    let color;
    for (let blockY = 0; blockY < pixelSize; blockY++) {
        const rowStart = (y + blockY) * width;
        for (let blockX = 0; blockX < pixelSize; blockX++) {
            const i = (rowStart + (x + blockX)) * 4;
            if (i < 0 || i >= data.length) {
                continue;
            }
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a === 0) {
                continue;
            }
            if (a !== 255) {
                debugLog(
                    `Pixel block for downscaling (position ${x}, ${y}, scaled ${pixelSize}x) has alpha value other than 0 or 255 (actual: ${a})`,
                );
                throw new Error('Pixel block for downscaling has alpha value other than 0 or 255');
            }
            if (color) {
                if (color.r !== r || color.g !== g || color.b !== b) {
                    debugLog(
                        `Pixel block for downscaling (position ${x}, ${y}; block position ${blockX}, ${blockY}; scaled ${pixelSize}x) has more than one color (previous: ${color.r}, ${color.g}, ${color.b}, current: ${r}, ${g}, ${b})`,
                    );
                    throw new Error(
                        'Pixel block for downscaling has more than one color. If you have Firefox Enhanced Tracking Protection enabled, try disabling it for this site.',
                    );
                }
            } else {
                color = { r, g, b };
            }
        }
    }
    return color;
};

const enableCoordsMutationObserver = (silent = false) => {
    if (coordsMutationEnabled) {
        // already enabled
        return;
    }

    debugLog('Enabling coords mutation observer');
    coordsMutationObserver.observe(coordsElement, { childList: true });
    coordsMutationEnabled = true;
    processCoords();
    if (!silent) {
        showSuccessMessage('AutoColorSelector enabled', 1000);
    }
};

const disableCoordsMutationObserver = (silent = false) => {
    if (!coordsMutationEnabled) {
        // already disabled
        return;
    }

    debugLog('Disabling coords mutation observer');
    coordsMutationObserver.disconnect();
    coordsMutationEnabled = false;
    if (!silent) {
        showSuccessMessage('AutoColorSelector disabled', 1000);
    }
};

const maybeEnableCoordsMutationObserver = (silent = false) => {
    if (hotkeyToggle && !pointerMoveFuse) {
        enableCoordsMutationObserver(silent);
    }
};

const createDocumentFragment = (html) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
};

const initOptions = () => {
    const storedOptions = localStorage.getItem('autoColorSelectorOptions');
    if (storedOptions) {
        try {
            const parsedOptions = JSON.parse(storedOptions);
            const options = { ...defaultOptions, ...parsedOptions };
            localStorage.setItem('autoColorSelectorOptions', JSON.stringify(options));
        } catch (error) {
            showError('Failed to parse stored options');
            console.error(error);
        }
    } else {
        localStorage.setItem('autoColorSelectorOptions', JSON.stringify(defaultOptions));
    }
};

const getOption = (key) => {
    const storedOptions = localStorage.getItem('autoColorSelectorOptions');
    if (storedOptions) {
        try {
            const options = JSON.parse(storedOptions);
            return options[key];
        } catch (error) {
            showError('Failed to parse stored options');
            console.error(error);
        }
    }
    return defaultOptions[key];
};

const setOption = (key, value) => {
    const storedOptions = localStorage.getItem('autoColorSelectorOptions');
    if (storedOptions) {
        try {
            const options = JSON.parse(storedOptions);
            options[key] = value;
            localStorage.setItem('autoColorSelectorOptions', JSON.stringify(options));
        } catch (error) {
            showError('Failed to parse stored options');
            console.error(error);
        }
    }
};

const resetOptions = () => {
    localStorage.setItem('autoColorSelectorOptions', JSON.stringify(defaultOptions));
};

const createBooleanOption = (key, label) => {
    const id = 'a' + crypto.randomUUID().replace(/-/g, '');
    const optionHtml = createDocumentFragment(
        `<div>
                <label for="${id}" class="input-group">
                    <input type="checkbox" id="${id}" ${getOption(key) ? 'checked' : ''}>
                    <span class="label-text">${label}</span>
                </label>
            </div>`,
    );
    optionHtml.querySelector(`#${id}`).addEventListener('change', (event) => {
        setOption(key, event.target.checked);
    });
    return optionHtml;
};

const createResetOptionsButton = () => {
    const resetOptionsButtonHtml = createDocumentFragment(
        `<div>
                <button class="text-button">Reset options</button>
            </div>`,
    );
    resetOptionsButtonHtml.querySelector('button').addEventListener('click', () => {
        resetOptions();
    });
    return resetOptionsButtonHtml;
};

const createOptions = () => {
    const optionsHtml = createDocumentFragment(
        `<article>
                <header>
                    <h3>Template color autoselector</h3>
                </header>
                <div class="pad-wrapper">
                    <section></section>
                </div>
            </article>`,
    );

    const header = optionsHtml.querySelector('header');
    const container = optionsHtml.querySelector('.pad-wrapper');
    header.addEventListener('click', () => {
        container.classList.toggle('hidden');
        setOption('settingsCollapsed', container.classList.contains('hidden'));
    });
    if (getOption('settingsCollapsed')) {
        container.classList.add('hidden');
    }

    const section = optionsHtml.querySelector('section');
    section.appendChild(createBooleanOption('debug', 'Debug logging'));
    section.appendChild(createBooleanOption('deselectColorOutsideTemplate', 'Deselect color outside template'));
    section.appendChild(
        createBooleanOption('selectColorWhenDeselectedInsideTemplate', 'Select color when deselected inside template'),
    );
    section.appendChild(createResetOptionsButton());
    section.appendChild(
        createDocumentFragment(
            `<p>
                    Changes are applied immediately. If you have multiple tabs open, you will need to reload the other
                    tabs when you change an option. Resetting options requires you to reload all open Pxls tabs.
                </p>`,
        ),
    );
    return optionsHtml;
};

const initIntervalId = setInterval(() => {
    debugLog('Waiting for App...');
    if (window.App) {
        clearInterval(initIntervalId);
        init();
    }
}, 1000);
