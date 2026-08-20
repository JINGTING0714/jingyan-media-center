(() => {
    "use strict";


    const MOBILE_QUERY =
        window.matchMedia(
            "(max-width: 900px)"
        );


    const STORAGE_KEY =
        "jingyan.sidebar.collapsed";


    const ICONS = {

        upload: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 16V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M7.5 8.5 12 4l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 14.5v3.25A2.25 2.25 0 0 0 7.25 20h9.5A2.25 2.25 0 0 0 19 17.75V14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `,

        library: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3.5" y="4" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M3.5 9h17" stroke="currentColor" stroke-width="1.8"/>
                <circle cx="8" cy="6.5" r=".8" fill="currentColor"/>
                <circle cx="11" cy="6.5" r=".8" fill="currentColor"/>
            </svg>
        `,

        profile: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.5 19c.65-3.45 3.05-5.5 6.5-5.5s5.85 2.05 6.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `,

        admin: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3.5 19 6v5.3c0 4.15-2.75 7.65-7 9.2-4.25-1.55-7-5.05-7-9.2V6l7-2.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="m9.2 12 1.8 1.8 3.8-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,

        account: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.8 19c.6-3.2 2.85-5.05 6.2-5.05S17.6 15.8 18.2 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `,

        key: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/>
                <path d="M12.5 12H20m-2.5 0v2.5M15 12v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `,

        palette: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4a8 8 0 1 0 0 16h1.25a1.75 1.75 0 0 0 0-3.5h-.65a1.8 1.8 0 0 1 0-3.6H14A6 6 0 0 0 20 7c0-1.65-3.55-3-8-3Z" stroke="currentColor" stroke-width="1.7"/>
                <circle cx="8" cy="8" r="1" fill="currentColor"/>
                <circle cx="11.2" cy="6.8" r="1" fill="currentColor"/>
                <circle cx="15" cy="7.5" r="1" fill="currentColor"/>
            </svg>
        `,

        chevron: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m8 10 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,

        collapse: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m14.5 7-5 5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,

        more: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="5.5" cy="12" r="1.3" fill="currentColor"/>
                <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
                <circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>
            </svg>
        `

    };


    function element(
        tag,
        className = "",
        text = undefined
    ) {

        const node =
            document.createElement(
                tag
            );


        if (
            className
        ) {

            node.className =
                className;

        }


        if (
            text !==
            undefined
        ) {

            node.textContent =
                text;

        }


        return node;

    }


    function icon(
        name
    ) {

        const span =
            element(
                "span",
                "jy-nav-icon"
            );


        span.innerHTML =
            ICONS[
                name
            ] ||
            "";


        return span;

    }


    function normalizedPath() {

        let path =
            location.pathname ||
            "/";


        if (
            path.length >
            1
        ) {

            path =
                path.replace(
                    /\/+$/,
                    ""
                );

        }


        return (
            path ||
            "/"
        );

    }


    function routeActive(
        href
    ) {

        const path =
            normalizedPath();


        if (
            href ===
            "/"
        ) {

            return (
                path ===
                "/"
            );

        }


        const target =
            href.replace(
                /\/+$/,
                ""
            );


        return (
            path ===
                target ||
            path.startsWith(
                target +
                "/"
            )
        );

    }


    function firstCharacter(
        name
    ) {

        return (
            Array.from(
                String(
                    name ||
                    "J"
                )
            )[0] ||
            "J"
        );

    }


    function roleLabel(
        user
    ) {

        return (
            user?.role ===
            "owner"
                ? "Owner"
                : "Member"
        );

    }


    function isOwner(
        user
    ) {

        return Boolean(
            user &&
            user.role ===
                "owner" &&
            user.status ===
                "active"
        );

    }


    async function loadUser() {

        try {

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
                !response.ok
            ) {

                return null;

            }


            const data =
                await response.json();


            if (
                !data?.authenticated ||
                !data?.user
            ) {

                return null;

            }


            return data.user;

        } catch {

            return null;

        }

    }


    async function loadProfileSettings() {

        try {

            const response =
                await fetch(
                    "/api/profile/settings",
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
                !response.ok
            ) {

                return null;

            }


            const data =
                await response.json();


            return (
                data.profile ||
                null
            );

        } catch {

            return null;

        }

    }


    function displayName(
        user,
        profile
    ) {

        return (
            profile?.displayName ||
            user?.displayName ||
            "Member"
        );

    }


    function fillAvatar(
        node,
        user,
        profile
    ) {

        if (
            !node
        ) {

            return;

        }


        node.textContent =
            "";


        node.style.overflow =
            "hidden";


        const avatar =
            profile?.avatar;


        if (
            avatar?.mode ===
            "media" &&
            avatar?.url
        ) {

            const image =
                document.createElement(
                    "img"
                );


            image.src =
                avatar.url;

            image.alt =
                "";

            image.decoding =
                "async";

            image.loading =
                "eager";


            image.style.width =
                "100%";

            image.style.height =
                "100%";

            image.style.display =
                "block";

            image.style.objectFit =
                "cover";

            image.style.borderRadius =
                "inherit";


            image.addEventListener(
                "error",
                () => {

                    node.textContent =
                        firstCharacter(
                            displayName(
                                user,
                                profile
                            )
                        );

                },
                {
                    once:
                        true
                }
            );


            node.append(
                image
            );


            return;

        }


        if (
            avatar?.mode ===
            "emoji" &&
            avatar?.value
        ) {

            node.textContent =
                avatar.value;


            return;

        }


        node.textContent =
            firstCharacter(
                displayName(
                    user,
                    profile
                )
            );

    }


    function avatarElement(
        user,
        profile
    ) {

        const node =
            element(
                "span",
                "jy-account-avatar"
            );


        fillAvatar(
            node,
            user,
            profile
        );


        return node;

    }


    function navItems(
        user
    ) {

        return [
            {
                href:
                    "/",

                label:
                    "上传",

                desktopLabel:
                    "上传中心",

                icon:
                    "upload",

                visible:
                    true
            },
            {
                href:
                    "/library",

                label:
                    "媒体",

                desktopLabel:
                    "媒体库",

                icon:
                    "library",

                /*
                 * V1.0:
                 * 媒体库不是 Owner 后台。
                 * 所有已登录用户都应该能进入自己的媒体库。
                 */
                visible:
                    Boolean(
                        user
                    )
            },
            {
                href:
                    "/profile/",

                label:
                    "主页",

                desktopLabel:
                    "我的主页",

                icon:
                    "profile",

                visible:
                    Boolean(
                        user
                    )
            },
            {
                href:
                    "/admin",

                label:
                    "后台",

                desktopLabel:
                    "管理后台",

                icon:
                    "admin",

                visible:
                    isOwner(
                        user
                    ),

                mobile:
                    false
            }
        ].filter(
            item =>
                item.visible
        );

    }


    function buildSidebar(
        user
    ) {

        const sidebar =
            element(
                "aside",
                "jy-sidebar"
            );


        sidebar.setAttribute(
            "aria-label",
            "主导航"
        );


        const inner =
            element(
                "div",
                "jy-sidebar-inner"
            );


        const brand =
            element(
                "a",
                "jy-sidebar-brand"
            );


        brand.href =
            "/";


        const mark =
            element(
                "span",
                "jy-brand-mark",
                "J"
            );


        const brandCopy =
            element(
                "span",
                "jy-brand-copy"
            );


        brandCopy.append(
            element(
                "strong",
                "",
                "Jingyan"
            ),

            element(
                "small",
                "",
                "Media Center"
            )
        );


        brand.append(
            mark,
            brandCopy
        );


        const divider =
            element(
                "div",
                "jy-sidebar-divider"
            );


        const label =
            element(
                "div",
                "jy-sidebar-label",
                "Workspace"
            );


        const nav =
            element(
                "nav",
                "jy-nav"
            );


        for (
            const item
            of navItems(
                user
            )
        ) {

            const link =
                element(
                    "a",
                    routeActive(
                        item.href
                    )
                        ? "jy-nav-link active"
                        : "jy-nav-link"
                );


            link.href =
                item.href;


            link.append(
                icon(
                    item.icon
                ),

                element(
                    "span",
                    "jy-nav-text",
                    item.desktopLabel
                )
            );


            nav.append(
                link
            );

        }


        const spacer =
            element(
                "div",
                "jy-sidebar-spacer"
            );


        const theme =
            element(
                "div",
                "jy-sidebar-theme"
            );


        theme.append(
            element(
                "span",
                "jy-theme-dot"
            )
        );


        const themeCopy =
            element(
                "span",
                "jy-theme-copy"
            );


        themeCopy.append(
            element(
                "strong",
                "",
                "Purple Aurora"
            ),

            element(
                "small",
                "",
                "紫境主题"
            )
        );


        theme.append(
            themeCopy
        );


        const collapse =
            element(
                "button",
                "jy-collapse"
            );


        collapse.type =
            "button";


        collapse.setAttribute(
            "aria-label",
            "折叠或展开侧边栏"
        );


        collapse.innerHTML =
            ICONS.collapse;


        collapse.append(
            element(
                "span",
                "",
                "收起导航"
            )
        );


        collapse.addEventListener(
            "click",
            () => {

                const collapsed =
                    document.body
                        .classList
                        .toggle(
                            "jy-sidebar-collapsed"
                        );


                try {

                    localStorage.setItem(
                        STORAGE_KEY,
                        collapsed
                            ? "1"
                            : "0"
                    );

                } catch {

                    // Ignore storage failures.

                }

            }
        );


        inner.append(
            brand,
            divider,
            label,
            nav,
            spacer,
            theme,
            collapse
        );


        sidebar.append(
            inner
        );


        return sidebar;

    }


    function buildAccountTrigger(
        user,
        profile,
        openMenu
    ) {

        if (
            !user
        ) {

            const login =
                element(
                    "a",
                    "jy-account-trigger"
                );


            login.href =
                "/login";


            login.append(
                avatarElement(
                    null,
                    null
                )
            );


            const copy =
                element(
                    "span",
                    "jy-account-copy"
                );


            copy.append(
                element(
                    "strong",
                    "",
                    "登录"
                ),

                element(
                    "small",
                    "",
                    "Jingyan"
                )
            );


            login.append(
                copy
            );


            return login;

        }


        const button =
            element(
                "button",
                "jy-account-trigger"
            );


        button.type =
            "button";


        button.setAttribute(
            "aria-haspopup",
            "dialog"
        );


        button.setAttribute(
            "aria-expanded",
            "false"
        );


        const copy =
            element(
                "span",
                "jy-account-copy"
            );


        copy.append(
            element(
                "strong",
                "",
                displayName(
                    user,
                    profile
                )
            ),

            element(
                "small",
                "",
                roleLabel(
                    user
                )
            )
        );


        const chevron =
            element(
                "span",
                "jy-account-chevron"
            );


        chevron.innerHTML =
            ICONS.chevron;


        button.append(
            avatarElement(
                user,
                profile
            ),
            copy,
            chevron
        );


        button.addEventListener(
            "click",
            openMenu
        );


        return button;

    }


    function menuLink(
        href,
        iconName,
        label,
        meta = ""
    ) {

        const link =
            element(
                "a",
                "jy-menu-link"
            );


        link.href =
            href;


        const iconNode =
            element(
                "span"
            );


        iconNode.innerHTML =
            ICONS[
                iconName
            ] ||
            "";


        link.append(
            iconNode,

            element(
                "span",
                "",
                label
            )
        );


        if (
            meta
        ) {

            link.append(
                element(
                    "small",
                    "",
                    meta
                )
            );

        }


        return link;

    }


    function buildAccountPanel(
        user,
        profile
    ) {

        const panel =
            element(
                "aside",
                "jy-account-panel"
            );


        panel.setAttribute(
            "role",
            "dialog"
        );


        panel.setAttribute(
            "aria-label",
            "账户索引"
        );


        if (
            !user
        ) {

            const head =
                element(
                    "div",
                    "jy-account-head"
                );


            head.append(
                avatarElement(
                    null,
                    null
                )
            );


            const copy =
                element(
                    "div",
                    "jy-account-head-copy"
                );


            copy.append(
                element(
                    "strong",
                    "",
                    "尚未登录"
                ),

                element(
                    "span",
                    "",
                    "Guest"
                )
            );


            head.append(
                copy
            );


            panel.append(
                head,

                menuLink(
                    "/login",
                    "account",
                    "登录"
                )
            );


            return panel;

        }


        const head =
            element(
                "div",
                "jy-account-head"
            );


        head.append(
            avatarElement(
                user,
                profile
            )
        );


        const headCopy =
            element(
                "div",
                "jy-account-head-copy"
            );


        headCopy.append(
            element(
                "strong",
                "",
                displayName(
                    user,
                    profile
                )
            ),

            element(
                "span",
                "",
                roleLabel(
                    user
                )
            )
        );


        head.append(
            headCopy
        );


        /*
         * 普通成员自己的高频功能全部放在 ME。
         * 媒体库不是 Owner 管理功能。
         */
        panel.append(
            head,

            element(
                "div",
                "jy-menu-separator"
            ),

            element(
                "div",
                "jy-menu-label",
                "ME"
            ),

            menuLink(
                "/profile/",
                "profile",
                "我的主页"
            ),

            menuLink(
                "/profile/settings/",
                "palette",
                "编辑个人资料",
                "头像 · 名称"
            ),

            menuLink(
                "/",
                "upload",
                "我的上传"
            ),

            menuLink(
                "/library",
                "library",
                "我的媒体库"
            ),

            menuLink(
                "/account",
                "account",
                "账户与安全"
            ),

            menuLink(
                "/passkeys",
                "key",
                "Passkey",
                "安全"
            )
        );


        /*
         * Owner 区域只保留真正的后台能力。
         */
        if (
            isOwner(
                user
            )
        ) {

            panel.append(
                element(
                    "div",
                    "jy-menu-separator"
                ),

                element(
                    "div",
                    "jy-menu-label",
                    "OWNER"
                ),

                menuLink(
                    "/admin",
                    "admin",
                    "管理后台"
                )
            );

        }


        panel.append(
            element(
                "div",
                "jy-menu-separator"
            ),

            element(
                "div",
                "jy-menu-label",
                "APPEARANCE"
            )
        );


        const theme =
            element(
                "div",
                "jy-theme-status"
            );


        theme.append(
            element(
                "span",
                "jy-theme-dot"
            )
        );


        const themeCopy =
            element(
                "span"
            );


        themeCopy.append(
            element(
                "strong",
                "",
                "Purple Aurora"
            ),

            element(
                "small",
                "",
                isOwner(
                    user
                )
                    ? "Owner 外观系统稍后接入"
                    : "当前主题"
            )
        );


        theme.append(
            themeCopy
        );


        panel.append(
            theme
        );


        return panel;

    }


    function buildMobileHeader(
        user,
        profile,
        openMenu
    ) {

        const header =
            element(
                "header",
                "jy-mobile-header"
            );


        const brand =
            element(
                "a",
                "jy-mobile-brand"
            );


        brand.href =
            "/";


        brand.append(
            element(
                "span",
                "jy-brand-mark",
                "J"
            ),

            element(
                "strong",
                "",
                "Jingyan"
            )
        );


        let account;


        if (
            user
        ) {

            account =
                element(
                    "button",
                    "jy-mobile-account"
                );


            account.type =
                "button";


            account.setAttribute(
                "aria-label",
                "打开账户索引"
            );


            account.append(
                avatarElement(
                    user,
                    profile
                )
            );


            account.addEventListener(
                "click",
                openMenu
            );

        } else {

            account =
                element(
                    "a",
                    "jy-mobile-account"
                );


            account.href =
                "/login";


            account.append(
                avatarElement(
                    null,
                    null
                )
            );

        }


        header.append(
            brand,
            account
        );


        return header;

    }


    function buildMobileNav(
        user,
        openMenu
    ) {

        const nav =
            element(
                "nav",
                "jy-mobile-nav"
            );


        nav.setAttribute(
            "aria-label",
            "手机导航"
        );


        const items =
            navItems(
                user
            ).filter(
                item =>
                    item.mobile !==
                    false
            );


        for (
            const item
            of items
        ) {

            const link =
                element(
                    "a",
                    routeActive(
                        item.href
                    )
                        ? "jy-mobile-nav-link active"
                        : "jy-mobile-nav-link"
                );


            link.href =
                item.href;


            const iconNode =
                element(
                    "span"
                );


            iconNode.innerHTML =
                ICONS[
                    item.icon
                ] ||
                "";


            link.append(
                iconNode,

                element(
                    "span",
                    "",
                    item.label
                )
            );


            nav.append(
                link
            );

        }


        if (
            user
        ) {

            const more =
                element(
                    "button",
                    "jy-mobile-nav-button"
                );


            more.type =
                "button";


            const iconNode =
                element(
                    "span"
                );


            iconNode.innerHTML =
                ICONS.more;


            more.append(
                iconNode,

                element(
                    "span",
                    "",
                    "更多"
                )
            );


            more.addEventListener(
                "click",
                openMenu
            );


            nav.append(
                more
            );

        }


        nav.style.setProperty(
            "--jy-mobile-nav-count",
            String(
                Math.max(
                    nav.children.length,
                    1
                )
            )
        );


        return nav;

    }


    function applyAvatarToPageElement(
        id,
        user,
        profile
    ) {

        const node =
            document.getElementById(
                id
            );


        if (
            node
        ) {

            fillAvatar(
                node,
                user,
                profile
            );

        }

    }


    function applyProfileToDocument(
        user,
        profile
    ) {

        if (
            !user ||
            !profile
        ) {

            return;

        }


        const name =
            displayName(
                user,
                profile
            );


        const profileName =
            document.getElementById(
                "profileName"
            );


        if (
            profileName
        ) {

            profileName.textContent =
                name;

        }


        const profileSubtitle =
            document.getElementById(
                "profileSubtitle"
            );


        if (
            profileSubtitle
        ) {

            profileSubtitle.textContent =
                profile.bio ||
                (
                    user.role ===
                    "owner"
                        ? "Owner · 我的私人媒体空间"
                        : "我的私人媒体空间"
                );

        }


        const accountName =
            document.getElementById(
                "accountName"
            );


        if (
            accountName
        ) {

            accountName.textContent =
                name;

        }


        applyAvatarToPageElement(
            "profileAvatar",
            user,
            profile
        );


        applyAvatarToPageElement(
            "accountAvatar",
            user,
            profile
        );

    }


    function restoreSidebarState() {

        try {

            if (
                localStorage.getItem(
                    STORAGE_KEY
                ) ===
                "1"
            ) {

                document.body.classList.add(
                    "jy-sidebar-collapsed"
                );

            }

        } catch {

            // Ignore storage failures.

        }

    }


    async function mount() {

        restoreSidebarState();


        const user =
            await loadUser();


        const profile =
            user
                ? await loadProfileSettings()
                : null;


        const backdrop =
            element(
                "div",
                "jy-menu-backdrop"
            );


        let panel =
            null;


        let desktopTrigger =
            null;


        function closeMenu() {

            if (
                !panel
            ) {

                return;

            }


            panel.classList.remove(
                "open"
            );


            backdrop.classList.remove(
                "open"
            );


            desktopTrigger
                ?.setAttribute(
                    "aria-expanded",
                    "false"
                );


            document.body.classList.remove(
                "jy-menu-open"
            );

        }


        function openMenu() {

            if (
                !user
            ) {

                location.href =
                    "/login";

                return;

            }


            const nextOpen =
                !panel
                    ?.classList
                    .contains(
                        "open"
                    );


            if (
                !nextOpen
            ) {

                closeMenu();

                return;

            }


            panel.classList.add(
                "open"
            );


            backdrop.classList.add(
                "open"
            );


            desktopTrigger
                ?.setAttribute(
                    "aria-expanded",
                    "true"
                );


            if (
                MOBILE_QUERY.matches
            ) {

                document.body.classList.add(
                    "jy-menu-open"
                );

            }

        }


        panel =
            buildAccountPanel(
                user,
                profile
            );


        desktopTrigger =
            buildAccountTrigger(
                user,
                profile,
                openMenu
            );


        const sidebar =
            buildSidebar(
                user
            );


        const mobileHeader =
            buildMobileHeader(
                user,
                profile,
                openMenu
            );


        const mobileNav =
            buildMobileNav(
                user,
                openMenu
            );


        backdrop.addEventListener(
            "click",
            closeMenu
        );


        panel.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        "a"
                    )
                ) {

                    closeMenu();

                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeMenu();

                }

            }
        );


        MOBILE_QUERY.addEventListener?.(
            "change",
            closeMenu
        );


        document.body.prepend(
            sidebar,
            mobileHeader
        );


        document.body.append(
            mobileNav,
            backdrop,
            panel,
            desktopTrigger
        );


        applyProfileToDocument(
            user,
            profile
        );


        /*
         * 部分旧页面自己的 JS 也会渲染一次用户名/头像。
         * 再同步一次，保证最终以 Profile Settings 为准。
         */
        setTimeout(
            () => {

                applyProfileToDocument(
                    user,
                    profile
                );

            },
            600
        );


        requestAnimationFrame(
            () => {

                document.body.classList.add(
                    "jy-shell-ready"
                );

            }
        );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            mount,
            {
                once:
                    true
            }
        );

    } else {

        mount();

    }

})();
