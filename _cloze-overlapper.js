/**
 * @param {number} begin
 * @param {number} [end]
 * @param {number} [step=1]
 * @returns {Generator<number, void, void>}
 */
function* range(begin, end, step = 1) {
    if (end == null) {
        [begin, end] = [1, begin];
    }
    for (let i = begin; i < end; i += step) {
        yield i;
    }
}

/**
 * @param {string} str
 * @param {RegExp} separator
 * @param {number} [numPrompts=1]
 * @returns {string}
 */
export function makeClozeDeletions(str, separator, numPrompts = 1) {
    // Not using simple String.split(), since it includes separator's capturing groups
    // in the array, which can lead to unpredictable results for arbitrary user-supplied regexes.
    const separators = Array.from(str.matchAll(separator));

    /**
     * @param {number} i
     * @returns {[number, number]}
     */
    function clozeRange(i) {
        const rangeBegin = Math.max(i + 3 - numPrompts, 1);
        const rangeEnd = Math.max(Math.min(i + 3, separators.length + 3 - numPrompts), 2);
        return [rangeBegin, rangeEnd];
    }

    const splits = ['{{c1::'];
    let lastIdx = 0;
    separators.forEach((m, i) => {
        const textWithHint = str.substring(lastIdx, m.index);
        const hintStart = textWithHint.indexOf('::');
        const text = hintStart > -1 ? textWithHint.substring(0, hintStart) : textWithHint;
        const hint = hintStart > -1 ? `::${textWithHint.substring(hintStart + 2)}` : '';

        const prevRange = clozeRange(i - 1);
        splits.push(
            text,
            `${hint}}}`.repeat(prevRange[1] - prevRange[0]),
            m[0],
            Array.from(range(...clozeRange(i))).map(i => `{{c${i}::`).join('')
        );
        lastIdx = /** @type {number} */ (m.index) + m[0].length;
    });
    splits.push(str.substring(lastIdx));
    splits.push('}}');
    return splits.join('');
}

const CLOZE_GENERATOR_TEMPLATE = document.createElement('template');
CLOZE_GENERATOR_TEMPLATE.innerHTML = `
    <style>
        cloze-generator * {
            box-sizing: border-box;
        }

        cloze-generator dialog {
            inset-block-start: 50%;
            inset-inline-start: 50%;
            margin: 0;
            block-size: 100%;
            inline-size: 100%;
            transform: translate(-50%, -50%);
        }

        cloze-generator form {
            block-size: 100%;
            display: grid;
            grid:
                "separatorLabel      separatorLabel"      min-content
                "separator           separator"           min-content
                "numPromptsLabel     numPromptsLabel"     min-content
                "numPrompts          numPrompts"          min-content
                "clozeInputLabel     clozeInputLabel"     min-content
                "clozeInput          clozeInput"          4ex
                "clozeInput          clozeInput"          1fr /* Absorbs remaining height. */
                "generateButton      closeButton"         min-content
                "generatedClozeLabel generatedClozeLabel" min-content
                "generatedCloze      generatedCloze"      4ex
                "generatedCloze      generatedCloze"      1fr; /* Absorbs remaining height. */
            grid-template-columns: repeat(2, minmax(10px, 1fr));
            gap: 1ex 0.75em;
            align-items: baseline;
        }

        @media (min-width: 500px) {
            cloze-generator dialog {
                width: 75%;
            }
        }

        @media (min-width: 650px) {
            @media (min-height: 500px) {
                cloze-generator dialog {
                    height: 75%;
                }
            }

            cloze-generator form {
                grid:
                    "separatorLabel  numPromptsLabel"     min-content
                    "separator       numPrompts"          min-content
                    "clozeInputLabel generatedClozeLabel" min-content
                    "clozeInput      generatedCloze"      min-content
                    "clozeInput      generatedCloze"      /* Absorbs remaining height. */
                    "generateButton  closeButton"         min-content;
            }
        }

        @media (min-width: 800px) {
            cloze-generator form {
                grid:
                    "separatorLabel  clozeInputLabel generatedClozeLabel" min-content
                    "separator       clozeInput      generatedCloze"      min-content
                    "numPromptsLabel clozeInput      generatedCloze"      min-content
                    "numPrompts      clozeInput      generatedCloze"      min-content
                    "generateButton  clozeInput      generatedCloze"      min-content
                    "closeButton     clozeInput      generatedCloze"      min-content
                    /* Absorbs remaining height. */
                    ".               clozeInput      generatedCloze";
                grid-template-columns: repeat(3, minmax(10px, 1fr));
            }
        }

        cloze-generator form label[for="separator"]          { grid-area: separatorLabel; }
        cloze-generator form input[name="separator"]         { grid-area: separator; }
        cloze-generator form label[for="numPrompts"]         { grid-area: numPromptsLabel; }
        cloze-generator form input[name="numPrompts"]        { grid-area: numPrompts; }
        cloze-generator form label[for="clozeInput"]         { grid-area: clozeInputLabel; }
        cloze-generator form textarea[name="clozeInput"]     { grid-area: clozeInput; }
        cloze-generator form label[for="generatedCloze"]     { grid-area: generatedClozeLabel; }
        cloze-generator form textarea[name="generatedCloze"] { grid-area: generatedCloze; }
        cloze-generator form button[name="closeButton"]      { grid-area: closeButton; }

        cloze-generator form button[name="generateButton"] {
            grid-area: generateButton;
            /* Variables are taken from desktop Anki's styles. */
            background-color: var(--button-primary-bg, #306bec);
            color: white;
        }

        cloze-generator form button[name="generateButton"]:hover {
            background: linear-gradient(
                180deg, var(--button-primary-gradient-start, #3b82f6) 0%,
                var(--button-primary-gradient-end, #306bec) 100%
            )
        }

        cloze-generator form input:invalid,
        cloze-generator form input:invalid:focus {
            border: 2px solid var(--accent-danger, #ef4444);
        }

        cloze-generator form textarea {
            resize: none;
            block-size: 100%;
        }

        cloze-generator form button {
            margin: 0;
        }

        cloze-generator dialog + button {
            display: block;
            margin-block-start: 0;
            margin-inline: auto 0;
        }
    </style>
    <dialog>
        <form method="dialog">
            <label for="separator">Separator regex:</label>
            <input name="separator" required value="\\n">
            <label for="numPrompts">Number of prompts:</label>
            <input name="numPrompts" type="number" required min="1" value="1">

            <label for="clozeInput">Enter text:</label>
            <textarea name="clozeInput"></textarea>
            <label for="generatedCloze">Copy to Anki:</label>
            <textarea name="generatedCloze" readonly></textarea>

            <button name="generateButton">Generate</button>
            <button name="closeButton" formnovalidate>Close</button>
        </form>
    </dialog>
    <button type="button">Generate Cloze</button>
`;

/** @this {HTMLInputElement} */
function reportRegexValidity() {
    let msg = '';
    try {
        new RegExp(this.value, 'ug');
    } catch (e) {
        if (!(e instanceof SyntaxError)) {
            throw e;
        }
        msg = e.message;
    }
    this.setCustomValidity(msg);
    this.reportValidity();
}

/** @this {HTMLInputElement} */
function reportValidity() {
    this.reportValidity();
}

const CLOZE_MARKERS_RE = /\{\{c\d+::|\}\}/;

/** @this {HTMLTextAreaElement} */
function reportClozeMarkers() {
    this.setCustomValidity(
        this.value.match(CLOZE_MARKERS_RE)
            ? 'Value must neither open “{{c#::” nor close “}}” a cloze'
            : ''
    );
    this.reportValidity();
}

/**
 * @typedef {Record<'separator' | 'numPrompts', HTMLInputElement>
 *           & Record<'clozeInput' | 'generatedCloze', HTMLTextAreaElement>
 *           & Record<'generateButton' | 'closeButton', HTMLButtonElement>} ClozeGeneratorInputs
 * @typedef {HTMLFormElement & { elements: ClozeGeneratorInputs }} ClozeGeneratorForm
 */

/**
 * @this {HTMLFormElement}
 * @param {SubmitEvent} e
 */
function updateGeneratedCloze(e) {
    if (/** @type {HTMLButtonElement} */ (e.submitter).name !== 'generateButton') {
        return;
    }
    e.preventDefault();
    const { separator, numPrompts,
            clozeInput, generatedCloze } = /** @type {ClozeGeneratorForm} */ (this).elements;
    generatedCloze.value = makeClozeDeletions(
        clozeInput.value, new RegExp(separator.value, 'ug'), numPrompts.valueAsNumber);
}

customElements.define('cloze-generator', class extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        // Not using shadow DOM to allow standard Anki styling to work.
        this.appendChild(CLOZE_GENERATOR_TEMPLATE.content.cloneNode(true));

        const dialog = /** @type {HTMLDialogElement} */ (this.getElementsByTagName('dialog')[0]);
        /** @type {HTMLButtonElement} */ (dialog.nextElementSibling).addEventListener(
            'click', () => dialog.showModal(), { passive: true }
        );

        const form = /** @type {ClozeGeneratorForm} */ (this.getElementsByTagName('form')[0]);
        form.elements['separator'].addEventListener(
            'input', reportRegexValidity, { passive: true });
        form.elements['numPrompts'].addEventListener(
            'input', reportValidity, { passive: true });
        form.elements['clozeInput'].addEventListener(
            'input', reportClozeMarkers, { passive: true });
        form.addEventListener('submit', updateGeneratedCloze);
    }
});

/**
 * @template T
 * @param {Iterable<T>} iterable
 * @param {(t: T) => boolean} predicate
 * @returns {boolean}
 */
function any(iterable, predicate) {
    for (const i of iterable) {
        if (predicate(i)) {
            return true;
        }
    }
    return false;
}

const DEFAULT_HINT = '...';

/**
 * @typedef {ClozeNode | TextNode} ClozeOrTextNode
 * @typedef {{ contextBefore: number, contextAfter: number, showOnlyContext: boolean,
 *             revealAllClozes: boolean, showInactiveHints: boolean }} RenderConfig
 * @typedef {{ cardNum: number, isBack: boolean,
 *             askAll: boolean, hasUnrevealedClozes: boolean }} CardInfo
 */

class NodeArray {
    constructor() {
        /** @type {ClozeOrTextNode[]} */
        this.nodes = [];

        /** @type {ClozeNode | undefined} */
        this.lastCloze = undefined;
    }

    /** @param {ClozeOrTextNode} n */
    push(n) {
        this.nodes.push(n);
        if (n instanceof ClozeNode) {
            this.lastCloze = n;
        }
    }

    /**
     * @param {RenderConfig} config
     * @param {CardInfo} cardInfo
     * @returns {string}
     */
    render(config, cardInfo) {
        return this.nodes.reduce((buf, n) => {
            buf.push(n.render(config, cardInfo));
            return buf;
        }, /** @type {string[]} */ ([])).join('');
    }
}

class TextNode {
    /** @param {string} text */
    constructor(text) {
        /** @type {string} */
        this.text = text;
    }

    /** @returns {string} */
    render() {
        return this.text;
    }
}

class ClozeNode extends NodeArray {
    /**
     * @param {number} cardNum
     * @param {Set<ClozeNode>} [parents]
     * @param {ClozeNode} [clozeBefore]
     */
    constructor(cardNum, parents, clozeBefore) {
        super();

        /** @type {number} */
        this.cardNum = cardNum;

        /** @type {Set<ClozeNode>} */
        this.parents = parents ?? new Set();

        /** @type {Set<number>} */
        this.childCardNums = new Set();

        /** @type {ClozeNode | undefined} */
        this.clozeBefore = clozeBefore;

        /** @type {ClozeNode | null} */
        this.clozeAfter = null;

        /** @type {string} */
        this.hint = DEFAULT_HINT;

        /** @type {boolean} */
        this.isContext = false;
    }

    get parentsAndSelf() {
        const s = new Set(this.parents);
        s.add(this);
        return s;
    }

    /** @returns {boolean} */
    get askAll() {
        return this.nodes.length === 1
               && /** @type {TextNode} */ (this.nodes[0]).text === 'ask-all';
    }

    /**
     * @override
     * @param {ClozeOrTextNode} n
     */
    push(n) {
        super.push(n);
        if (n instanceof ClozeNode) {
            n.childCardNums.forEach(c => this.childCardNums.add(c));
            this.childCardNums.add(n.cardNum);
        }
    }

    /**
     * @param {string} className
     * @param {string} html
     * @returns {HTMLSpanElement}
     */
    #makeClozeSpan(className, html) {
        const span = document.createElement('span');
        span.className = className;
        span.dataset['ordinal'] = String(this.cardNum);
        span.innerHTML = html;
        return span;
    }

    /**
     * @override
     * @param {RenderConfig} config
     * @param {CardInfo} cardInfo
     * @returns {string}
     */
    render(config, cardInfo) {
        /** @type {(className: string, html?: string) => string} */
        const renderClozeSpan = (className, html) => this.#makeClozeSpan(
            className, html ?? super.render(config, cardInfo)
        ).outerHTML;

        // Ask all clozes are never shown.
        if (this.askAll) {
            return '';
        }
        if (this.cardNum === cardInfo.cardNum || cardInfo.askAll) {
            if (cardInfo.isBack) {
                return renderClozeSpan('cloze');
            }
            const span = this.#makeClozeSpan('cloze', `[${this.hint}]`);
            span.dataset['cloze'] = super.render(config, cardInfo);
            return span.outerHTML;
        }
        if (this.isContext || any(this.parents, p => p.isContext)
            || this.childCardNums.has(cardInfo.cardNum)
            || cardInfo.isBack && any(this.parents, p => p.cardNum === cardInfo.cardNum))
        {
            return renderClozeSpan('cloze-inactive');
        }
        if (!config.showOnlyContext) {
            if (cardInfo.isBack && config.revealAllClozes) {
                return renderClozeSpan('cloze-inactive');
            }
            cardInfo.hasUnrevealedClozes = true;
            return renderClozeSpan('cloze-inactive',
                                   `[${config.showInactiveHints ? this.hint : DEFAULT_HINT}]`);
        }
        return '';
    }
}

const NEXT_TOKEN_RE = /\{\{c\d*[1-9]\d*::|\}\}|$/g;

// https://github.com/ankitects/anki/blob/main/rslib/src/cloze.rs
// parse_text_with_clozes()

/**
 * @param {string} clozeSrc
 * @param {RenderConfig} config
 * @param {CardInfo} cardInfo
 * @returns {NodeArray}
 */
export function parseCloze(clozeSrc, config, cardInfo) {
    const currentCardClozes = /** @type {ClozeNode[]} */ ([]);
    const topLevel = new NodeArray();
    const nestedClozes = /** @type {ClozeNode[]} */ ([]);

    let lastIndex = NEXT_TOKEN_RE.lastIndex = 0, m;
    while (m = NEXT_TOKEN_RE.exec(clozeSrc)) {
        let txt = clozeSrc.substring(lastIndex, m.index);
        if (txt) {
            if (nestedClozes.length) {
                const c = /** @type {ClozeNode} */ (nestedClozes.at(-1));
                // Anki doesn't check the presence of a closing "}}":
                // parsing "{{c1::cloze ::hint{{c2::text}} after hint::override}}"
                // sets the hint to "override" and adds " after hint" to c1's nodes.
                const clozedTextEnd = txt.indexOf('::');
                if (clozedTextEnd !== -1) {
                    c.hint = txt.substring(clozedTextEnd + 2);
                    txt = txt.substring(0, clozedTextEnd);
                }
                c.push(new TextNode(txt));
            } else {
                topLevel.push(new TextNode(txt));
            }
        }

        if (m[0].startsWith('{{c')) {
            const clozeBefore = nestedClozes.findLast(
                c => c.lastCloze)?.lastCloze ?? topLevel.lastCloze;
            const c = new ClozeNode(parseInt(m[0].substring(3, m[0].length - 2), 10),
                                    nestedClozes.at(-1)?.parentsAndSelf, clozeBefore);
            nestedClozes.push(c);
            if (c.cardNum === cardInfo.cardNum) {
                currentCardClozes.push(c);
            }
        } else if (m[0] === '}}') {
            if (nestedClozes.length) {
                const c = /** @type {ClozeNode} */ (nestedClozes.pop());
                const currentLevel = nestedClozes.at(-1) ?? topLevel;
                let lastDeeperCloze = currentLevel.lastCloze;
                while (lastDeeperCloze) {
                    lastDeeperCloze.clozeAfter = c;
                    lastDeeperCloze = lastDeeperCloze.lastCloze;
                }
                currentLevel.push(c);
            } else {
                // Closing marker outside of any clozes.
                topLevel.push(new TextNode(m[0]));
            }
        }

        // End-of-string match loops indefinitely unless broken.
        if ((lastIndex = NEXT_TOKEN_RE.lastIndex) === clozeSrc.length) {
            NEXT_TOKEN_RE.lastIndex = 0;
            break;
        }
    }
    // Anki ignores unclosed nestedClozes, so do we.

    /**
     * @param {number} n
     * @returns {number}
     */
    function infIfNeg(n) {
        return n < 0 ? Number.POSITIVE_INFINITY : n;
    }

    for (const c of currentCardClozes) {
        cardInfo.askAll ||= c.askAll;
        for (let b = c.clozeBefore, i = infIfNeg(config.contextBefore); b && i > 0; --i) {
            b.isContext = true;
            b = b.clozeBefore;
        }
        for (let a = c.clozeAfter, i = infIfNeg(config.contextAfter); a && i > 0; --i) {
            a.isContext = true;
            a = a.clozeAfter;
        }
    }

    return topLevel;
}

const MATHJAX_RE = /\\\(.*?\\\)|\\\[.*?\\\]/sg;

// https://github.com/ankitects/anki/blob/main/rslib/src/cloze.rs
// strip_html_inside_mathjax()
//
// https://github.com/ankitects/anki/blob/main/rslib/src/text.rs
// strip_html_preserving_entities()

/**
 * @param {string} html
 * @param {CardInfo} cardInfo
 * @returns string
 */
export function stripHtmlFromMathJax(html, cardInfo) {
    const parser = new DOMParser();
    MATHJAX_RE.lastIndex = 0;
    return html.replaceAll(MATHJAX_RE, mathjax => {
        const dom = parser.parseFromString(mathjax, 'text/html');
        ['script', 'style'].forEach(t =>
            Array.prototype.forEach.call(dom.getElementsByTagName(t), e => e.remove())
        );
        Array.prototype.forEach.call(dom.querySelectorAll('span.cloze'), e => {
            e.prepend(cardInfo.isBack ? '\\AnkiClozeA{' : '\\AnkiClozeQ{');
            e.append('}')
        });
        // Strip tags and encode entities.
        dom.body.innerText = /** @type {string} */ (dom.body.textContent);
        return dom.body.innerHTML;
    });
}

const convertToRgba = (() => {
    /** @type {OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null} */
    let context = null;

    /**
     * @param {string} cssColor
     * @return {Uint8ClampedArray}
     * */
    return cssColor => {
        // Android WebView doesn't support offscreen 2D canvas.
        // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext#browser_compatibility
        context ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
        if (!context) {
            const canvas = document.createElement('canvas');
            canvas.height = canvas.width = 1;
            context = /** @type {CanvasRenderingContext2D} */ (
                canvas.getContext('2d', { willReadFrequently: true }));
        }
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = cssColor;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data;
    };
})();

/** @param {HTMLDivElement} clozeContainer */
function defineMathJaxClozeCommands(clozeContainer) {
    // Not using querySelector('span.cloze')
    // since stripHtmlFromMathJax might have removed all of them.
    const styleTest = document.createElement('span');
    styleTest.className = 'cloze';
    clozeContainer.append(styleTest);
    const clozeStyle = window.getComputedStyle(styleTest);
    const { color, fontStyle, fontWeight } = clozeStyle;
    styleTest.remove();

    let ankiClozeQ = '#1';
    // https://www.w3.org/TR/css-color-4/#serializing-sRGB-values
    const rgbStartIdx = color.startsWith('rgb(') ? 4
                      : color.startsWith('rgba(') ? 5
                      : -1;
    const rgb = rgbStartIdx !== -1
              ? color.substring(rgbStartIdx, color.length - 1).split(', ').map(s => Math.round(+s))
              : convertToRgba(color); // Slow path.
    ankiClozeQ = String.raw`\color[RGB]{${rgb.slice(0, 3).join(', ')}} ${ankiClozeQ}`;
    if (fontStyle === 'italic' || fontStyle.startsWith('oblique')) {
        ankiClozeQ = String.raw`\mathit{${ankiClozeQ}}`;
    }
    if (+fontWeight >= 700) {
        ankiClozeQ = String.raw`\boldsymbol{${ankiClozeQ}}`;
    }

    const mathJaxClozeCmd = document.createElement('div');
    mathJaxClozeCmd.style.display = 'none';
    mathJaxClozeCmd.textContent = String.raw`\[
        \newcommand\AnkiClozeQ[1]{${ankiClozeQ}}
        \newcommand\AnkiClozeA[1]{\AnkiClozeQ{#1}}
    \]`;
    clozeContainer.prepend(mathJaxClozeCmd);
}

/**
 * @type {{
 *     startup: { document: { state(s: number): void } };
 *     typesetClear(): void;
 *     texReset(): void;
 *     typesetPromise(): Promise<void>
 * } | undefined}
 */
const MATH_JAX = /** @type {any} */ (globalThis).MathJax;

/** @returns {Promise<void>} */
export function typesetMathJax() {
    // AnkiDroid loads MathJax only when \( and/or \[ are present.
    if (typeof MATH_JAX === 'undefined') {
        return Promise.resolve();
    }
    // https://docs.mathjax.org/en/latest/web/typeset.html#updating-previously-typeset-content
    // Anki doesn't seem to support auto-numbering, but nonetheless.
    MATH_JAX.startup.document.state(0);
    MATH_JAX.typesetClear();
    MATH_JAX.texReset();
    return MATH_JAX.typesetPromise();
}

const CONFIG_SPLIT_RE = /[,\s|.]+/;
const BOOL_RE = /^(?:true|false)$/;

/**
 * @param {string} elementId
 * @returns {Partial<RenderConfig>}
 */
function parseConfig(elementId) {
    const config = /** @type {string} */ (
        /** @type {HTMLTemplateElement} */ (document.getElementById(elementId)).content.textContent
    ).split(CONFIG_SPLIT_RE);

    const parsedConf = {};

    const contextBefore = +(config[0] || 'NaN');
    if (Number.isSafeInteger(contextBefore)) {
        parsedConf.contextBefore = contextBefore;
    }
    const contextAfter = +(config[1] || 'NaN');
    if (Number.isSafeInteger(contextAfter)) {
        parsedConf.contextAfter = contextAfter;
    }

    if (BOOL_RE.test(config[2] || '')) {
        parsedConf.showOnlyContext = config[2] === 'true';
    }
    if (BOOL_RE.test(config[3] || '')) {
        parsedConf.revealAllClozes = config[3] === 'true';
    }
    if (BOOL_RE.test(config[4] || '')) {
        parsedConf.showInactiveHints = config[4] === 'true';
    }

    return parsedConf;
}

/** @this {HTMLButtonElement} */
function revealAllCallback() {
    renderClozes({ revealAllClozes: true }, () => {
        this.hidden = true;
        return typesetMathJax();
    });
}

const CARD_NUM_RE = /(?<=\bcard)\d+\b/;

/**
 * @param {Partial<RenderConfig>} partialConf
 * @param {() => Promise<void>} [onRender]
 */
export function renderClozes(partialConf, onRender) {
    const config = {
        contextBefore: 1,
        contextAfter: 0,
        showOnlyContext: false,
        revealAllClozes: false,
        showInactiveHints: false,

        ...parseConfig('default-cloze-config'),
        ...parseConfig('cloze-config'),
        ...partialConf
    };
    const revealAllButton = document.getElementById('reveal-all-button');
    // card# class is guaranteed to be present only if the script is invoked from onUpdateHook.
    // ".cloze[data-ordinal]" is absent in MathJax clozes.
    const cardInfo = {
        cardNum: parseInt(
            document.body.className.match(CARD_NUM_RE)?.[0]
                ?? document.getElementById('qa_box')?.className.match(CARD_NUM_RE)?.[0]
                ?? /** @type {HTMLElement | null} */ (
                       /** @type {HTMLTemplateElement} */ (
                           document.getElementById('anki-cloze')
                       ).content.querySelector('.cloze[data-ordinal]')
                   )?.dataset['ordinal']
                ?? '1',
            10
        ),
        isBack: !!revealAllButton,
        askAll: false,
        hasUnrevealedClozes: false
    };

    const clozeSource = /** @type {HTMLTemplateElement} */ (
        document.getElementById('cloze-source'));
    const renderedCloze = stripHtmlFromMathJax(
        parseCloze(clozeSource.innerHTML, config, cardInfo).render(config, cardInfo), cardInfo);

    return /** @type {Promise<void>} */ (new Promise(resolve => {
        requestAnimationFrame(() => {
            if (revealAllButton && cardInfo.hasUnrevealedClozes) {
                revealAllButton.addEventListener(
                    'click', revealAllCallback, { once: true, passive: true });
                revealAllButton.hidden = false;
            }
            const clozeContainer = /** @type {HTMLDivElement} */ (
                document.getElementById('rendered-cloze'));
            clozeContainer.innerHTML = renderedCloze;
            // AnkiDroid loads MathJax only if \( and/or \[ are present.
            if (typeof MATH_JAX !== 'undefined') {
                defineMathJaxClozeCommands(clozeContainer);
            }
            onRender?.();
            // Clozes in MathJax can't be scrolled to.
            clozeContainer.querySelector('.cloze')?.scrollIntoView({ block: 'center' });
            resolve();
        });
    }));
}
