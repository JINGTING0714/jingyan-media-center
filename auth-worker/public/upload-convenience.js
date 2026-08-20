(() => {
    "use strict";


    const HISTORY_LIMIT =
        4;


    let scheduled =
        false;


    function getHistoryElements() {

        const historyList =
            document.getElementById(
                "historyList"
            );


        if (
            !historyList
        ) {

            return {
                historyList:
                    null,

                card:
                    null,

                heading:
                    null
            };
        }


        const card =
            historyList.closest(
                ".card"
            );


        const heading =
            card?.querySelector(
                ".section-heading"
            ) ||
            null;


        return {
            historyList,
            card,
            heading
        };
    }


    function ensureHistoryNote() {

        const {
            heading
        } =
            getHistoryElements();


        if (
            !heading
        ) {

            return;
        }


        if (
            heading.querySelector(
                "[data-history-summary-note]"
            )
        ) {

            return;
        }


        const headingCopy =
            heading.querySelector(
                "div"
            );


        if (
            !headingCopy
        ) {

            return;
        }


        const note =
            document.createElement(
                "div"
            );


        note.dataset.historySummaryNote =
            "true";


        note.className =
            "job-meta";


        const summary =
            document.createElement(
                "span"
            );


        summary.textContent =
            `仅展示最近 ${HISTORY_LIMIT} 条`;


        const hint =
            document.createElement(
                "span"
            );


        hint.textContent =
            "完整媒体请到媒体库查找";


        note.append(
            summary,
            hint
        );


        headingCopy.append(
            note
        );
    }


    function removeOldFooter(
        card
    ) {

        card
            ?.querySelector(
                "[data-history-summary-footer]"
            )
            ?.remove();
    }


    function ensureFooter(
        card,
        hiddenCount
    ) {

        if (
            !card
        ) {

            return;
        }


        removeOldFooter(
            card
        );


        if (
            hiddenCount <=
            0
        ) {

            return;
        }


        const footer =
            document.createElement(
                "div"
            );


        footer.dataset.historySummaryFooter =
            "true";


        footer.className =
            "job-meta";


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            `已收起更早的 ${hiddenCount} 条记录`;


        const link =
            document.createElement(
                "a"
            );


        link.href =
            "/library/";


        link.className =
            "text-button";


        link.textContent =
            "去媒体库 →";


        footer.append(
            text,
            link
        );


        const historyList =
            document.getElementById(
                "historyList"
            );


        historyList
            ?.insertAdjacentElement(
                "afterend",
                footer
            );
    }


    function setRowVisible(
        row,
        visible
    ) {

        /*
         * 之前使用 row.hidden。
         *
         * 但 .job-item 本身设置了 display:grid，
         * 在当前样式结构下会导致 hidden 没真正隐藏。
         *
         * 项目已经有：
         *
         * .hidden {
         *   display:none !important;
         * }
         *
         * 所以这里直接使用统一 hidden class。
         */

        row.classList.toggle(
            "hidden",
            !visible
        );


        row.setAttribute(
            "aria-hidden",
            visible
                ? "false"
                : "true"
        );
    }


    function compactHistory() {

        const {
            historyList,
            card
        } =
            getHistoryElements();


        if (
            !historyList
        ) {

            return;
        }


        const rows =
            Array.from(
                historyList.children
            )
            .filter(
                element =>
                    element.nodeType ===
                    Node.ELEMENT_NODE
            );


        rows.forEach(
            (
                row,
                index
            ) => {

                setRowVisible(
                    row,
                    index <
                    HISTORY_LIMIT
                );
            }
        );


        const hiddenCount =
            Math.max(
                0,
                rows.length -
                HISTORY_LIMIT
            );


        ensureFooter(
            card,
            hiddenCount
        );
    }


    function apply() {

        ensureHistoryNote();

        compactHistory();
    }


    function scheduleApply() {

        if (
            scheduled
        ) {

            return;
        }


        scheduled =
            true;


        requestAnimationFrame(
            () => {

                scheduled =
                    false;


                apply();
            }
        );
    }


    function startObserver() {

        const historyList =
            document.getElementById(
                "historyList"
            );


        if (
            !historyList
        ) {

            return;
        }


        const observer =
            new MutationObserver(
                () => {

                    scheduleApply();
                }
            );


        observer.observe(
            historyList,
            {
                childList:
                    true
            }
        );
    }


    function init() {

        apply();

        startObserver();


        /*
         * app.js 的历史数据是异步加载。
         * 再做一次延迟保险。
         */

        setTimeout(
            apply,
            300
        );


        setTimeout(
            apply,
            1000
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();
    }

})();
