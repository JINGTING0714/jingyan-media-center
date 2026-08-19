(() => {
    "use strict";


    const RECENT_LIMIT = 4;
    const FAVORITE_LIMIT = 4;

    const state = {
        favoriteExpanded: false,
        scheduled: false
    };


    function copyWithFallback(
        text
    ) {
        return new Promise(
            async (
                resolve,
                reject
            ) => {
                try {
                    if (
                        navigator.clipboard &&
                        window.isSecureContext
                    ) {
                        await navigator.clipboard.writeText(
                            text
                        );

                        resolve();

                        return;
                    }


                    const textarea =
                        document.createElement(
                            "textarea"
                        );

                    textarea.value =
                        text;

                    textarea.setAttribute(
                        "readonly",
                        ""
                    );

                    textarea.style.position =
                        "fixed";

                    textarea.style.left =
                        "-9999px";

                    textarea.style.top =
                        "0";

                    textarea.style.opacity =
                        "0";


                    document.body.append(
                        textarea
                    );


                    textarea.select();

                    textarea.setSelectionRange(
                        0,
                        textarea.value.length
                    );


                    const successful =
                        document.execCommand(
                            "copy"
                        );


                    textarea.remove();


                    if (
                        successful
                    ) {
                        resolve();

                    } else {
                        reject(
                            new Error(
                                "copy_failed"
                            )
                        );
                    }

                } catch (
                    error
                ) {
                    reject(
                        error
                    );
                }
            }
        );
    }


    function showToast(
        message
    ) {
        const toast =
            document.getElementById(
                "toast"
            );


        if (
            !toast
        ) {
            return;
        }


        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );


        window.clearTimeout(
            showToast.timer
        );


        showToast.timer =
            window.setTimeout(
                () => {
                    toast.classList.remove(
                        "show"
                    );
                },
                2200
            );
    }


    function createCopyButton(
        url
    ) {
        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";

        button.className =
            "drawer-media-open jy-copy-cdn";

        button.textContent =
            "复制 CDN";

        button.setAttribute(
            "aria-label",
            "复制媒体 CDN 直链"
        );


        button.addEventListener(
            "click",
            async (
                event
            ) => {
                event.preventDefault();

                event.stopPropagation();


                if (
                    button.disabled
                ) {
                    return;
                }


                const originalText =
                    button.textContent;


                button.disabled =
                    true;

                button.textContent =
                    "复制中…";


                try {
                    await copyWithFallback(
                        url
                    );


                    button.textContent =
                        "已复制";


                    showToast(
                        "CDN 直链已复制"
                    );


                    window.setTimeout(
                        () => {
                            if (
                                document.body.contains(
                                    button
                                )
                            ) {
                                button.textContent =
                                    originalText;

                                button.disabled =
                                    false;
                            }
                        },
                        1200
                    );

                } catch {
                    button.textContent =
                        originalText;

                    button.disabled =
                        false;


                    showToast(
                        "复制失败，请稍后重试"
                    );
                }
            }
        );


        return button;
    }


    function enhanceCollectionMediaRows() {
        const rows =
            document.querySelectorAll(
                ".drawer-media-item"
            );


        for (
            const row
            of rows
        ) {
            if (
                row.dataset.jyCdnReady ===
                "1"
            ) {
                continue;
            }


            const preview =
                row.querySelector(
                    ".drawer-media-preview[href]"
                );


            const actions =
                row.querySelector(
                    ".drawer-actions"
                );


            if (
                !preview ||
                !actions
            ) {
                continue;
            }


            const url =
                String(
                    preview.href ||
                    ""
                ).trim();


            if (
                !url
            ) {
                continue;
            }


            row.dataset.jyCdnReady =
                "1";


            const copyButton =
                createCopyButton(
                    url
                );


            actions.prepend(
                copyButton
            );
        }
    }


    function capList(
        list,
        limit
    ) {
        if (
            !list
        ) {
            return;
        }


        const children =
            Array.from(
                list.children
            );


        children.forEach(
            (
                child,
                index
            ) => {
                child.classList.toggle(
                    "jy-summary-overflow",
                    index >=
                        limit
                );
            }
        );
    }


    function findOverviewCards() {
        return Array.from(
            document.querySelectorAll(
                ".profile-overview-card"
            )
        );
    }


    function findCardByTitle(
        title
    ) {
        const cards =
            findOverviewCards();


        for (
            const card
            of cards
        ) {
            const label =
                card.querySelector(
                    ".profile-overview-card-head span"
                );


            if (
                label &&
                label.textContent
                    .trim() ===
                    title
            ) {
                return card;
            }
        }


        return null;
    }


    function updateRecentSummary() {
        const card =
            findCardByTitle(
                "最近上传"
            );


        if (
            !card
        ) {
            return;
        }


        const list =
            card.querySelector(
                ".profile-media-list"
            );


        capList(
            list,
            RECENT_LIMIT
        );


        const note =
            card.querySelector(
                ".profile-overview-note"
            );


        if (
            note
        ) {
            note.textContent =
                `最近 ${RECENT_LIMIT} 个`;
        }
    }


    function setFavoriteExpanded(
        card,
        button,
        expanded
    ) {
        state.favoriteExpanded =
            expanded;


        card.classList.toggle(
            "jy-overview-collapsed",
            !expanded
        );


        button.setAttribute(
            "aria-expanded",
            expanded
                ? "true"
                : "false"
        );


        button.textContent =
            expanded
                ? "收起"
                : "展开";


        const note =
            card.querySelector(
                ".profile-overview-note"
            );


        if (
            note
        ) {
            note.textContent =
                expanded
                    ? `最近 ${FAVORITE_LIMIT} 个`
                    : "默认折叠";
        }
    }


    function setupFavoriteSummary() {
        const card =
            findCardByTitle(
                "我的收藏"
            );


        if (
            !card
        ) {
            return;
        }


        const list =
            card.querySelector(
                ".profile-media-list"
            );


        capList(
            list,
            FAVORITE_LIMIT
        );


        let button =
            card.querySelector(
                ".jy-summary-toggle"
            );


        if (
            !button
        ) {
            const head =
                card.querySelector(
                    ".profile-overview-card-head"
                );


            if (
                !head
            ) {
                return;
            }


            button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.className =
                "jy-summary-toggle";


            button.addEventListener(
                "click",
                () => {
                    setFavoriteExpanded(
                        card,
                        button,
                        !state.favoriteExpanded
                    );
                }
            );


            head.append(
                button
            );
        }


        setFavoriteExpanded(
            card,
            button,
            state.favoriteExpanded
        );
    }


    function simplifyOverviewHeading() {
        const section =
            document.querySelector(
                ".profile-overview-section"
            );


        if (
            !section
        ) {
            return;
        }


        section.classList.add(
            "jy-compact-overview"
        );


        const description =
            section.querySelector(
                ".profile-overview-heading p"
            );


        if (
            description
        ) {
            description.textContent =
                "主页只保留少量摘要。图库、歌单和影集负责长期整理，媒体库负责完整查找。";
        }
    }


    function applyEnhancements() {
        enhanceCollectionMediaRows();

        updateRecentSummary();

        setupFavoriteSummary();

        simplifyOverviewHeading();
    }


    function scheduleEnhancements() {
        if (
            state.scheduled
        ) {
            return;
        }


        state.scheduled =
            true;


        window.requestAnimationFrame(
            () => {
                state.scheduled =
                    false;

                applyEnhancements();
            }
        );
    }


    function startObserver() {
        const observer =
            new MutationObserver(
                () => {
                    scheduleEnhancements();
                }
            );


        observer.observe(
            document.body,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    function init() {
        applyEnhancements();

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
