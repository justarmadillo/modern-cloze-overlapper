function any(iter, test) {
    for (const i of iter) {
        if (test(i)) {
            return true;
        }
    }
    return false;
}

const DEFAULT_HINT = '...';

class NodeArray {
    constructor() {
        this.nodes = [];
        this.lastCloze = null;
    }

    push(n) {
        this.nodes.push(n);
        if (n instanceof ClozeNode) {
            this.lastCloze = n;
        }
    }

    render(config, cardInfo) {
        return this.nodes.reduce((buf, n) => {
            buf.push(n.render(config, cardInfo));
            return buf;
        }, []).join('');
    }
}

class TextNode {
    constructor(text) {
        this.text = text;
    }

    render() {
        return this.text;
    }
}

class ClozeNode extends NodeArray {
    constructor(cardNum, parents, clozeBefore) {
        super();

        this.cardNum = cardNum;
        this.parents = parents ?? new Set();
        this.childCardNums = new Set();

        this.clozeBefore = clozeBefore;
        this.clozeAfter = null;

        this.hint = DEFAULT_HINT;
        this.isContext = false;
    }

    get parentsAndSelf() {
        const s = new Set(this.parents);
        s.add(this);
        return s;
    }

    get askAll() {
        return this.nodes.length === 1 && this.nodes[0].text === 'ask-all';
    }

    push(n) {
        super.push(n);
        if (n instanceof ClozeNode) {
            n.childCardNums.forEach(c => this.childCardNums.add(c));
            this.childCardNums.add(n.cardNum);
        }
    }

    #makeClozeSpan(className, html) {
        const span = document.createElement('span');
        span.className = className;
        span.dataset['ordinal'] = this.cardNum;
        span.innerHTML = html;
        return span;
    }

    render(config, cardInfo) {
        const renderClozeSpan = (className, html) => {
            return this.#makeClozeSpan(
                className, html ?? super.render(config, cardInfo)).outerHTML;
        };

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

const NEXT_TOKEN_RE = /\{\{c\d+::|\}\}|$/g;

// https://github.com/ankitects/anki/blob/main/rslib/src/cloze.rs
// parse_text_with_clozes()
export function parseCloze(clozeSrc, config, cardInfo) {
    const currentCardClozes = [];
    const topLevel = new NodeArray();
    const nestedClozes = [];

    let lastIndex = NEXT_TOKEN_RE.lastIndex = 0, m;
    while (m = NEXT_TOKEN_RE.exec(clozeSrc)) {
        let txt = clozeSrc.substring(lastIndex, m.index);
        if (txt) {
            if (nestedClozes.length) {
                const c = nestedClozes.at(-1);
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
            const c = new ClozeNode(m[0].substring(3, m[0].length - 2),
                                    nestedClozes.at(-1)?.parentsAndSelf, clozeBefore);
            nestedClozes.push(c);
            if (c.cardNum === cardInfo.cardNum) {
                currentCardClozes.push(c);
            }
        } else if (m[0] === '}}') {
            if (nestedClozes.length) {
                const c = nestedClozes.pop();
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

    for (const c of currentCardClozes) {
        cardInfo.askAll ||= c.askAll;
        for (let b = c.clozeBefore, i = config.contextBefore; b && i > 0; --i) {
            b.isContext = true;
            b = b.clozeBefore;
        }
        for (let a = c.clozeAfter, i = config.contextAfter; a && i > 0; --i) {
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
        dom.body.innerText = dom.body.textContent;
        return dom.body.innerHTML;
    });
}

const CONFIG_SPLIT_RE = /[,\s|.]+/;

export function parseConfig(elementId = 'cloze-config') {
    const config = document.getElementById(elementId).content.textContent.split(CONFIG_SPLIT_RE);

    const contextBefore = config[0] === '0' ? 0 : Math.max(+config[0] || 1, 1);
    const contextAfter = Math.max(+config[1] || 0, 0);
    const showOnlyContext = (config[2] || 'false').toLowerCase() === 'true';
    const revealAllClozes = (config[3] || 'false').toLowerCase() === 'true';
    const showInactiveHints = (config[4] || 'false').toLowerCase() === 'true';

    return { contextBefore, contextAfter, showOnlyContext, revealAllClozes, showInactiveHints };
}

function revealAllCallback(e) {
    const target = e.currentTarget;
    doRenderClozes({ revealAllClozes: true }, () => { target.hidden = true; });
}

function defineMathJaxClozeCommands(clozeContainer) {
    // Not using querySelector('span.cloze')
    // since stripHtmlFromMathJax might have removed all of them.
    const styleTest = document.createElement('span');
    styleTest.className = 'cloze';
    clozeContainer.append(styleTest);
    const clozeStyle = window.getComputedStyle(styleTest);
    const clozeColour = clozeStyle.color;
    const clozeFontStyle = clozeStyle.fontStyle;
    const clozeFontWeight = clozeStyle.fontWeight;
    styleTest.remove();

    let ankiClozeQ = '#1';
    // https://www.w3.org/TR/css-color-4/#serializing-sRGB-values
    const rgbStartIdx = clozeColour.startsWith('rgb(') ? 4
                      : clozeColour.startsWith('rgba(') ? 5
                      : -1;
    if (rgbStartIdx !== -1) {
        const rgb = clozeColour.substring(rgbStartIdx, clozeColour.length - 1).split(', ')
                               .slice(0, 3).map(Math.round).join(', ');
        ankiClozeQ = String.raw`\color[RGB]{${rgb}} ${ankiClozeQ}`;
    }
    if (clozeFontStyle === 'italic' || clozeFontStyle.startsWith('oblique')) {
        ankiClozeQ = String.raw`\mathit{${ankiClozeQ}}`;
    }
    if (+clozeFontWeight >= 700) {
        ankiClozeQ = String.raw`\mathbf{${ankiClozeQ}}`;
    }

    const mathJaxClozeCmd = document.createElement('div');
    mathJaxClozeCmd.style.display = 'none';
    mathJaxClozeCmd.textContent = String.raw`\[
        \newcommand\AnkiClozeQ[1]{${ankiClozeQ}}
        \newcommand\AnkiClozeA[1]{\AnkiClozeQ{#1}}
    \]`;
    clozeContainer.prepend(mathJaxClozeCmd);
}

const CARD_NUM_RE = /(?<=\bcard)\d+\b/;

function doRenderClozes(config, postRender) {
    config = { ...parseConfig(), ...config };
    const revealAllButton = document.getElementById('reveal-all-button');
    const cardInfo = {
        cardNum: (
            document.body.className.match(CARD_NUM_RE)?.[0]
                ?? document.getElementById('qa_box')?.className.match(CARD_NUM_RE)?.[0]
                ?? document.getElementById('anki-cloze').content
                           .querySelector('.cloze[data-ordinal]')?.dataset['ordinal']
                ?? '1'
        ),
        isBack: !!revealAllButton,
        askAll: false,
        hasUnrevealedClozes: false
    };

    const renderedCloze = stripHtmlFromMathJax(
        parseCloze(document.getElementById('cloze-source').innerHTML,
                   config, cardInfo).render(config, cardInfo),
        cardInfo
    );

    return new Promise(resolve => {
        requestAnimationFrame(() => {
            if (cardInfo.isBack && cardInfo.hasUnrevealedClozes) {
                revealAllButton.addEventListener(
                    'click', revealAllCallback, { once: true, passive: true });
                revealAllButton.hidden = false;
            }
            const clozeContainer = document.getElementById('rendered-cloze');
            clozeContainer.innerHTML = renderedCloze;
            if (postRender) {
                postRender();
            }
            // https://docs.mathjax.org/en/latest/web/typeset.html#updating-previously-typeset-content
            if (typeof MathJax !== 'undefined') {
                defineMathJaxClozeCommands(clozeContainer);
                // Anki doesn't seem to support auto-numbering, but nonetheless.
                MathJax.startup.document.state(0);
                MathJax.typesetClear();
                MathJax.texReset();
                resolve(MathJax.typesetPromise());
            } else {
                resolve();
            }
        });
    });
}

export function renderClozes(config) {
    // AnkiDroid loads MathJax only when \( and/or \[ are present.
    if (typeof MathJax === 'undefined') {
        return doRenderClozes(config);
    }
    return MathJax.startup.promise = MathJax.startup.promise.then(() => doRenderClozes(config));
}
