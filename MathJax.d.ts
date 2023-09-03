declare namespace MathJax {
    const startup: {
        document: {
            state(s: number): void;
        };
    };

    function typesetClear(): void;

    function texReset(): void;

    function typesetPromise(): Promise<void>;
}
