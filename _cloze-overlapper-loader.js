(async () => {
    'use strict';

    const CLOZE_CONTAINER = /** @type {HTMLDivElement} */ (
        document.getElementById('rendered-cloze'));

    /** @param {any} e */
    function showMessage(e) {
        CLOZE_CONTAINER.textContent = e;
    }

    async function renderClozes(typesetMathJax = false) {
        try {
            const ClozeOverlapper = await import('./_cloze-overlapper.js');
            await ClozeOverlapper.renderClozes(
                {}, typesetMathJax ? ClozeOverlapper.typesetMathJax : undefined);
        } catch (e) {
            showMessage(e);
        }
    }

    /** @typedef {Array<() => any>} HooksList */
    /** @typedef {{ startup: { promise: Promise<void> }; }} MathJax */

    /** @type {((r: 'anki/reviewer') => { onUpdateHook: HooksList; }) | undefined} */
    const REQUIRE = /** @type {any} */ (globalThis).require;
    /** @type {HooksList | undefined} */
    const ON_UPDATE_HOOK = /** @type {any} */ (globalThis).onUpdateHook;

    /** @returns {MathJax | undefined} */
    function getMathJax() {
        return /** @type {any} */ (globalThis).MathJax;
    }

    /** @return {HooksList | undefined} */
    function getUpdateHook() {
        // Anki Desktop has both require() and onUpdateHook.
        // AnkiDroid has only onUpdateHook.
        // AnkiWeb has neither.
        // AnkiMobile – ???
        if (REQUIRE) {
            try {
                return REQUIRE('anki/reviewer').onUpdateHook;
            } catch (/** @type {any} */ e) {
                if (!e?.message.includes('Cannot require')) {
                    throw e;
                }
            }
        }
        return ON_UPDATE_HOOK;
    }

    try {
        const updateHook = getUpdateHook();
        if (updateHook) {
            // onUpdateHook guarantees the presence of a .card# class on the <body>.
            // It also does a MathJax render, so we don't have to do one ourselves.
            updateHook.push(renderClozes);
        } else if (getMathJax()) {
            // AnkiDroid loads MathJax only if \( and/or \[ are present.
            // (Must not take this branch since AnkiDroid has onUpdateHook.)

            // MathJax loading on AnkiWeb is kinda slow.
            while (!getMathJax()?.startup?.promise) {
                showMessage('Waiting for MathJax to initialise...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            await /** @type {MathJax} */ (getMathJax()).startup.promise;
            showMessage(null);
            // Assume that waiting for MathJax to initialise is enough to get a .card# class
            // on #qa_box on AnkiWeb (actually never saw #qa_box's class list change).
            // Without onUpdateHook, MathJax must be re-typeset explicitly.
            renderClozes(true);
        } else {
            renderClozes();
        }
    } catch (e) {
        showMessage(e);
    }
})();
