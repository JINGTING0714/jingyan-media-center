(() => {
    "use strict";


    const ICON = `
        <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true">
            <path
            d="M6.5 5.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5.2L8.5 19v-2.5h-2a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"/>
            <path
            d="M8 10h8M8 13h5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"/>
        </svg>
    `;


    function category() {

        const path =
            location.pathname || "/";


        if (
            path === "/" ||
            path === "/index.html" ||
            path.startsWith("/upload")
        ) {
            return "upload";
        }


        if (
            path.startsWith("/library")
        ) {
            return "media";
        }


        if (
            path.startsWith("/account") ||
            path.startsWith("/passkeys")
        ) {
            return "account";
        }


        if (
            path.startsWith("/profile")
        ) {
            return "ui";
        }


        if (
            path.startsWith("/admin")
        ) {
            return "other";
        }


        return "other";
    }


    function feedbackHref() {

        const params =
            new URLSearchParams();


        params.set(
            "category",
            category()
        );


        params.set(
            "page",
            location.pathname +
            location.search
        );


        return (
            "/feedback/?" +
            params.toString()
        );
    }


    async function getUser() {

        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "same-origin",

                        cache:
                            "no-store",

                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );


            if (
                !response.ok
            ) {
                return null;
            }


            const data =
                await response.json();


            if (
                !data ||
                !data.authenticated ||
                !data.user ||
                data.user.status !==
                    "active"
            ) {
                return null;
            }


            return data.user;

        } catch {

            return null;
        }
    }


    async function getOpenIncidentCount(
        user
    ) {

        if (
            !user ||
            user.role !== "owner"
        ) {
            return 0;
        }


        try {

            const response =
                await fetch(
                    "/api/admin/incidents?status=open&limit=100",
                    {
                        credentials:
                            "same-origin",

                        cache:
                            "no-store",

                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );


            if (
                !response.ok
            ) {
                return 0;
            }


            const data =
                await response.json();


            if (
                !Array.isArray(
                    data.incidents
                )
            ) {
                return 0;
            }


            return data
                .incidents
                .length;

        } catch {

            return 0;
        }
    }


    function makeSidebarLink(
        id,
        href,
        label
    ) {

        const link =
            document.createElement(
                "a"
            );


        link.id =
            id;


        link.href =
            href;


        const target =
            href
                .split("?")[0]
                .replace(
                    /\/+$/,
                    ""
                ) || "/";


        const current =
            (
                location.pathname
                    .replace(
                        /\/+$/,
                        ""
                    ) ||
                "/"
            );


        link.className =
            (
                current === target ||
                (
                    target !== "/" &&
                    current.startsWith(
                        target + "/"
                    )
                )
            )

                ? "jy-nav-link active"

                : "jy-nav-link";


        const icon =
            document.createElement(
                "span"
            );


        icon.className =
            "jy-nav-icon";


        icon.innerHTML =
            ICON;


        const text =
            document.createElement(
                "span"
            );


        text.className =
            "jy-nav-text";


        text.textContent =
            label;


        link.append(
            icon,
            text
        );


        return link;
    }


    function addSidebar(
        user
    ) {

        const nav =
            document.querySelector(
                ".jy-nav"
            );


        if (
            !nav
        ) {
            return;
        }


        if (
            !document.getElementById(
                "jy-feedback-nav"
            )
        ) {

            nav.append(
                makeSidebarLink(
                    "jy-feedback-nav",
                    feedbackHref(),
                    "反馈问题"
                )
            );
        }


        if (
            user.role === "owner" &&
            !document.getElementById(
                "jy-incident-nav"
            )
        ) {

            nav.append(
                makeSidebarLink(
                    "jy-incident-nav",
                    "/admin/incidents/",
                    "反馈收件箱"
                )
            );
        }
    }


    function makeMenuLink(
        href,
        label,
        meta = ""
    ) {

        const link =
            document.createElement(
                "a"
            );


        link.className =
            "jy-menu-link";


        link.href =
            href;


        const icon =
            document.createElement(
                "span"
            );


        icon.innerHTML =
            ICON;


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            label;


        link.append(
            icon,
            text
        );


        if (
            meta
        ) {

            const small =
                document.createElement(
                    "small"
                );


            small.textContent =
                meta;


            link.append(
                small
            );
        }


        return link;
    }


    function createSeparator() {

        const separator =
            document.createElement(
                "div"
            );


        separator.className =
            "jy-menu-separator";


        return separator;
    }


    function createLabel(
        text
    ) {

        const label =
            document.createElement(
                "div"
            );


        label.className =
            "jy-menu-label";


        label.textContent =
            text;


        return label;
    }


    function insertHelpArea(
        panel,
        user,
        incidentCount
    ) {

        if (
            !panel ||
            panel.dataset
                .jyFeedbackEnhanced ===
                "1"
        ) {
            return;
        }


        panel.dataset
            .jyFeedbackEnhanced =
                "1";


        const fragment =
            document.createDocumentFragment();


        fragment.append(
            createSeparator(),
            createLabel(
                "HELP"
            ),
            makeMenuLink(
                feedbackHref(),
                "帮助与反馈",
                "反馈当前页面"
            )
        );


        if (
            user.role === "owner"
        ) {

            fragment.append(
                makeMenuLink(
                    "/admin/incidents/",
                    "反馈收件箱",
                    incidentCount > 0
                        ? `${incidentCount} 个待处理`
                        : "Owner"
                )
            );
        }


        const labels =
            Array.from(
                panel.querySelectorAll(
                    ".jy-menu-label"
                )
            );


        const appearance =
            labels.find(
                node =>
                    node.textContent
                        ?.trim()
                        .toUpperCase() ===
                    "APPEARANCE"
            );


        if (
            appearance
        ) {

            const previous =
                appearance
                    .previousElementSibling;


            if (
                previous &&
                previous.classList
                    .contains(
                        "jy-menu-separator"
                    )
            ) {

                panel.insertBefore(
                    fragment,
                    previous
                );

                return;
            }


            panel.insertBefore(
                fragment,
                appearance
            );

            return;
        }


        panel.append(
            fragment
        );
    }


    function addAccountMenus(
        user,
        incidentCount
    ) {

        const panels =
            document.querySelectorAll(
                ".jy-account-panel"
            );


        for (
            const panel
            of panels
        ) {

            insertHelpArea(
                panel,
                user,
                incidentCount
            );
        }
    }


    async function start() {

        const user =
            await getUser();


        if (
            !user
        ) {
            return;
        }


        const incidentCount =
            await getOpenIncidentCount(
                user
            );


        const apply =
            () => {

                addSidebar(
                    user
                );


                addAccountMenus(
                    user,
                    incidentCount
                );
            };


        apply();


        const observer =
            new MutationObserver(
                apply
            );


        observer.observe(
            document.documentElement,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    if (
        document.readyState ===
            "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:
                    true
            }
        );

    } else {

        start();
    }

})();
