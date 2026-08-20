(() => {
    "use strict";


    if (
        window.__JINGYAN_PERSONAL_LIBRARY_V2__
    ) {

        return;
    }


    window.__JINGYAN_PERSONAL_LIBRARY_V2__ =
        true;


    const nativeFetch =
        window.fetch.bind(
            window
        );


    let currentUser =
        null;


    let observer =
        null;


    function requestMethod(
        input,
        options
    ) {

        return String(
            options?.method ||
            (
                input instanceof Request
                    ? input.method
                    : "GET"
            ) ||
            "GET"
        )
            .trim()
            .toUpperCase();
    }


    function requestUrl(
        input
    ) {

        try {

            return new URL(
                input instanceof Request
                    ? input.url
                    : String(
                        input
                    ),
                location.origin
            );

        } catch {

            return null;
        }
    }


    function blockedResponse() {

        return new Response(
            JSON.stringify({
                error:
                    "personal_library_read_only"
            }),
            {
                status:
                    403,

                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",

                    "Cache-Control":
                        "no-store, max-age=0"
                }
            }
        );
    }


    /*
     * library.js 仍然使用历史地址：
     *
     * /api/admin/media
     *
     * 这里在脚本执行最早阶段拦截，
     * 将“读取媒体”改到真正的个人媒体 API。
     *
     * 删除 / 恢复不会再从用户媒体库执行。
     */
    window.fetch =
        async function patchedFetch(
            input,
            options = {}
        ) {

            const url =
                requestUrl(
                    input
                );


            const method =
                requestMethod(
                    input,
                    options
                );


            if (
                url &&
                url.origin ===
                    location.origin &&
                url.pathname ===
                    "/api/admin/media"
            ) {

                if (
                    method !==
                        "GET"
                ) {

                    return blockedResponse();
                }


                url.pathname =
                    "/api/library/media";


                url.searchParams.set(
                    "status",
                    "published"
                );


                return nativeFetch(
                    url.toString(),
                    options
                );
            }


            return nativeFetch(
                input,
                options
            );
        };


    function isOwner() {

        return (
            currentUser?.role ===
            "owner"
        );
    }


    async function loadUser() {

        const response =
            await nativeFetch(
                "/api/auth/me",
                {
                    credentials:
                        "same-origin",

                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (
            response.status ===
                401
        ) {

            location.replace(
                "/login"
            );


            return null;
        }


        if (
            !response.ok
        ) {

            return null;
        }


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        return data.user ||
            null;
    }


    function updateIdentity() {

        const identity =
            document.getElementById(
                "libraryIdentity"
            );


        if (
            !identity ||
            !currentUser
        ) {

            return;
        }


        const strong =
            identity.querySelector(
                "strong"
            );


        if (
            strong &&
            currentUser.displayName
        ) {

            strong.textContent =
                currentUser.displayName;
        }


        const small =
            identity.querySelector(
                "small"
            );


        if (
            small
        ) {

            small.textContent =
                isOwner()
                    ? "Owner"
                    : "Member";
        }
    }


    function updateAdminLinks() {

        if (
            isOwner()
        ) {

            return;
        }


        document
            .querySelectorAll(
                'a[href="/admin"], a[href="/admin/"]'
            )
            .forEach(
                link => {

                    link.classList.add(
                        "hidden"
                    );
                }
            );
    }


    function forcePublishedMode() {

        const published =
            document.querySelector(
                '.library-mode-button[data-status="published"]'
            );


        const trash =
            document.querySelector(
                '.library-mode-button[data-status="trashed"]'
            );


        if (
            trash
        ) {

            trash.classList.add(
                "hidden"
            );

            trash.setAttribute(
                "aria-hidden",
                "true"
            );

            trash.tabIndex =
                -1;
        }


        const switcher =
            document.getElementById(
                "libraryModeSwitch"
            );


        if (
            switcher
        ) {

            switcher.style.gridTemplateColumns =
                "1fr";
        }


        if (
            trash?.classList.contains(
                "active"
            )
        ) {

            published?.click();
        }
    }


    function hideDestructiveButtons() {

        document
            .querySelectorAll(
                "#mediaGrid .button.danger"
            )
            .forEach(
                button => {

                    button.classList.add(
                        "hidden"
                    );

                    button.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                    button.tabIndex =
                        -1;
                }
            );
    }


    function updateSearch() {

        const search =
            document.getElementById(
                "searchInput"
            );


        if (
            search
        ) {

            search.placeholder =
                "搜索我的文件名、Media ID、SHA256、仓库…";
        }
    }


    function updateHero() {

        const hero =
            document.querySelector(
                ".library-hero"
            );


        if (
            !hero
        ) {

            return;
        }


        const title =
            hero.querySelector(
                "h1"
            );


        if (
            title
        ) {

            title.innerHTML =
                "我的全部媒体，<br>集中在这里。";
        }


        const paragraph =
            hero.querySelector(
                "p"
            );


        if (
            paragraph
        ) {

            paragraph.textContent =
                "这里只显示当前账户自己上传过的图片、音频与视频。可以搜索、预览、复制 CDN，并继续整理到自己的图库、歌单和影集。";
        }
    }


    function updateEmptyText() {

        const empty =
            document.getElementById(
                "libraryEmpty"
            );


        if (
            empty
        ) {

            empty.textContent =
                "你的媒体库里还没有符合条件的内容。";
        }
    }


    function applyPersonalLibraryUi() {

        updateIdentity();

        updateAdminLinks();

        forcePublishedMode();

        hideDestructiveButtons();

        updateSearch();

        updateHero();

        updateEmptyText();
    }


    function startObserver() {

        if (
            observer ||
            !document.body
        ) {

            return;
        }


        observer =
            new MutationObserver(
                () => {

                    forcePublishedMode();

                    hideDestructiveButtons();

                    updateIdentity();
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


    async function init() {

        currentUser =
            await loadUser();


        if (
            !currentUser
        ) {

            return;
        }


        applyPersonalLibraryUi();

        startObserver();


        /*
         * 兼容旧 library-access.js 即使仍被缓存：
         * 前两秒持续覆盖一次 UI 权限状态。
         */
        let attempts =
            0;


        const timer =
            setInterval(
                () => {

                    attempts +=
                        1;


                    applyPersonalLibraryUi();


                    if (
                        attempts >=
                            8
                    ) {

                        clearInterval(
                            timer
                        );
                    }

                },
                250
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
