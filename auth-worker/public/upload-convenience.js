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


        /*
         * 直接复用网站已经存在的 job-meta 样式：
         * 不另外增加 CSS，
         * 保持当前 UI 的字号、颜色和间距体系。
         */
        note.className =
            "job-meta";


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            `仅展示最近 ${HISTORY_LIMIT} 条`;


        const hint =
            document.createElement(
                "span"
            );


        hint.textContent =
            "完整媒体请到媒体库查找";


        note.append(
            text,
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


        /*
         * 继续复用现有 job-meta。
         * 它本身就是轻量的辅助信息样式。
         */
        footer.className =
            "job-meta";


        const info =
            document.createElement(
                "span"
            );


        info.textContent =
            `已收起更早的 ${hiddenCount} 条记录`;


        const libraryLink =
            document.createElement(
                "a"
            );


        libraryLink.href =
            "/library/";


        libraryLink.className =
            "text-button";


        libraryLink.textContent =
            "去媒体库 →";


        footer.append(
            info,
            libraryLink
        );


        const historyList =
            document.getElementById(
                "historyList"
            );


        if (
            historyList
        ) {
            historyList.insertAdjacentElement(
                "afterend",
                footer
            );
        }
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
            );


        rows.forEach(
            (
                row,
                index
            ) => {
                /*
                 * 使用浏览器原生 hidden，
                 * 不依赖新的 CSS 文件。
                 */
                row.hidden =
                    index >=
                    HISTORY_LIMIT;
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


        /*
         * app.js 每次点击“刷新”
         * 都会重新生成 History DOM。
         *
         * 所以这里监听 childList，
         * 每次刷新以后自动重新压缩。
         */
        const observer =
            new MutationObserver(
                scheduleApply
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
