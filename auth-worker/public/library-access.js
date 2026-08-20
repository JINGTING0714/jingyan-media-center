(() => {
    "use strict";


    let currentUser =
        null;


    let observer =
        null;


    function isOwner() {

        return (
            currentUser?.role ===
            "owner"
        );
    }


    function canDeleteMedia() {

        return Boolean(
            isOwner() ||
            currentUser
                ?.permissions
                ?.deleteMedia ===
                true
        );
    }


    async function loadUser() {

        const response =
            await fetch(
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


        const small =
            identity.querySelector(
                "small"
            );


        if (
            small
        ) {

            const roleLabel =
                currentUser.role ===
                    "owner"

                    ? "Owner"

                    : "Member";


            if (
                small.textContent !==
                roleLabel
            ) {

                small.textContent =
                    roleLabel;
            }
        }


        const strong =
            identity.querySelector(
                "strong"
            );


        if (
            strong &&
            currentUser.displayName &&
            strong.textContent !==
                currentUser.displayName
        ) {

            strong.textContent =
                currentUser.displayName;
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


    function updateTrashMode() {

        const trashButton =
            document.querySelector(
                '.library-mode-button[data-status="trashed"]'
            );


        if (
            !trashButton
        ) {

            return;
        }


        trashButton
            .classList
            .toggle(
                "hidden",
                !canDeleteMedia()
            );


        if (
            !canDeleteMedia() &&
            trashButton.classList.contains(
                "active"
            )
        ) {

            const publishedButton =
                document.querySelector(
                    '.library-mode-button[data-status="published"]'
                );


            publishedButton
                ?.click();
        }
    }


    function updateDestructiveButtons() {

        if (
            canDeleteMedia()
        ) {

            return;
        }


        document
            .querySelectorAll(
                "#mediaGrid .button.danger"
            )
            .forEach(
                button => {

                    button.classList.add(
                        "hidden"
                    );
                }
            );
    }


    function updateSearchPlaceholder() {

        const search =
            document.getElementById(
                "searchInput"
            );


        if (
            !search
        ) {

            return;
        }


        if (
            !canDeleteMedia()
        ) {

            search.placeholder =
                "搜索文件名、Media ID、SHA256、仓库…";
        }
    }


    function applyPermissions() {

        updateIdentity();

        updateAdminLinks();

        updateTrashMode();

        updateDestructiveButtons();

        updateSearchPlaceholder();
    }


    function startObserver() {

        if (
            observer
        ) {

            return;
        }


        observer =
            new MutationObserver(
                () => {

                    applyPermissions();
                }
            );


        const grid =
            document.getElementById(
                "mediaGrid"
            );


        if (
            grid
        ) {

            observer.observe(
                grid,
                {
                    childList:
                        true,

                    subtree:
                        true
                }
            );
        }


        const identity =
            document.getElementById(
                "libraryIdentity"
            );


        if (
            identity
        ) {

            observer.observe(
                identity,
                {
                    childList:
                        true,

                    subtree:
                        true
                }
            );
        }
    }


    async function init() {

        currentUser =
            await loadUser();


        if (
            !currentUser
        ) {

            return;
        }


        applyPermissions();

        startObserver();


        /*
         * library.js 会异步读取数据并重新创建卡片。
         * 两次延迟执行作为额外保险。
         */

        setTimeout(
            applyPermissions,
            300
        );


        setTimeout(
            applyPermissions,
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
