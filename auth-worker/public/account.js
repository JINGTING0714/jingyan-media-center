(() => {
    "use strict";


    const PAGE_SIZE =
        4;


    let currentUser =
        null;


    let sessions =
        [];


    let page =
        1;


    let toastTimer =
        null;


    const refs = {};


    function cacheRefs() {

        refs.accountAvatar =
            document.getElementById(
                "accountAvatar"
            );


        refs.accountName =
            document.getElementById(
                "accountName"
            );


        refs.accountRole =
            document.getElementById(
                "accountRole"
            );


        refs.ownerAdminLink =
            document.getElementById(
                "ownerAdminLink"
            );


        refs.createPairButton =
            document.getElementById(
                "createPairButton"
            );


        refs.pairPanel =
            document.getElementById(
                "pairPanel"
            );


        refs.pairCode =
            document.getElementById(
                "pairCode"
            );


        refs.pairExpiry =
            document.getElementById(
                "pairExpiry"
            );


        refs.copyPairButton =
            document.getElementById(
                "copyPairButton"
            );


        refs.closePairButton =
            document.getElementById(
                "closePairButton"
            );


        refs.sessionsLoading =
            document.getElementById(
                "sessionsLoading"
            );


        refs.sessionsEmpty =
            document.getElementById(
                "sessionsEmpty"
            );


        refs.sessionList =
            document.getElementById(
                "sessionList"
            );


        refs.sessionPagination =
            document.getElementById(
                "sessionPagination"
            );


        refs.previousSessionPage =
            document.getElementById(
                "previousSessionPage"
            );


        refs.nextSessionPage =
            document.getElementById(
                "nextSessionPage"
            );


        refs.sessionPageText =
            document.getElementById(
                "sessionPageText"
            );


        refs.refreshSessions =
            document.getElementById(
                "refreshSessions"
            );


        refs.revokedCount =
            document.getElementById(
                "revokedCount"
            );


        refs.revokedList =
            document.getElementById(
                "revokedList"
            );


        refs.logoutButton =
            document.getElementById(
                "logoutButton"
            );


        refs.logoutAllButton =
            document.getElementById(
                "logoutAllButton"
            );


        refs.toast =
            document.getElementById(
                "accountToast"
            );

    }


    function firstCharacter(
        value
    ) {

        return (
            Array.from(
                String(
                    value ||
                    "J"
                )
            )[0] ||
            "J"
        );

    }


    function roleLabel(
        role
    ) {

        return role ===
            "owner"

            ? "Owner"

            : "Member";

    }


    function humanError(
        code
    ) {

        const messages = {

            authentication_required:
                "登录状态已经失效。",

            active_account_required:
                "当前账户不可用。",

            session_not_found:
                "找不到这个登录设备。",

            permission_denied:
                "没有权限执行此操作。",

            invalid_json:
                "请求数据格式错误。",

            internal_error:
                "系统暂时出现问题。",

            request_failed:
                "请求失败，请稍后再试。"

        };


        return (
            messages[
                code
            ] ||
            code ||
            "请求失败"
        );

    }


    function showToast(
        text
    ) {

        if (
            !refs.toast
        ) {

            return;

        }


        refs.toast.textContent =
            text;


        refs.toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    refs.toast
                        .classList
                        .remove(
                            "show"
                        );

                },
                2600
            );

    }


    async function api(
        url,
        options = {}
    ) {

        const headers =
            new Headers(
                options.headers ||
                {}
            );


        if (
            options.body &&
            !headers.has(
                "Content-Type"
            )
        ) {

            headers.set(
                "Content-Type",
                "application/json"
            );

        }


        const response =
            await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    ...options,

                    headers
                }
            );


        let data =
            {};


        try {

            data =
                await response.json();

        } catch {

            data = {};

        }


        if (
            response.status ===
            401
        ) {

            location.replace(
                "/login"
            );


            throw new Error(
                "authentication_required"
            );

        }


        if (
            !response.ok
        ) {

            throw new Error(
                data.error ||
                "request_failed"
            );

        }


        return data;

    }


    function formatTime(
        seconds
    ) {

        const value =
            Number(
                seconds
            );


        if (
            !Number.isFinite(
                value
            ) ||
            value <=
            0
        ) {

            return "—";

        }


        return new Date(
            value *
            1000
        )
            .toLocaleString(
                "zh-CN",
                {
                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit",

                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );

    }


    function renderUser() {

        const displayName =
            currentUser
                ?.displayName ||
            "成员";


        refs.accountName
            .textContent =
                displayName;


        refs.accountAvatar
            .textContent =
                firstCharacter(
                    displayName
                );


        refs.accountRole
            .textContent =
                roleLabel(
                    currentUser
                        ?.role
                );


        refs.ownerAdminLink
            .classList
            .toggle(
                "hidden",
                currentUser
                    ?.role !==
                    "owner"
            );

    }


    async function loadUser() {

        const data =
            await api(
                "/api/auth/me"
            );


        if (
            !data
                ?.authenticated ||
            !data
                ?.user
        ) {

            location.replace(
                "/login"
            );


            return;

        }


        currentUser =
            data.user;


        renderUser();

    }


    function createElement(
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


    function createMetaRow(
        label,
        value
    ) {

        const row =
            createElement(
                "div",
                "session-meta-row"
            );


        row.append(
            createElement(
                "span",
                "",
                label
            ),

            createElement(
                "strong",
                "",
                value
            )
        );


        return row;

    }


    function createSessionCard(
        session
    ) {

        const card =
            createElement(
                "article",
                session.current
                    ? "session-card current"
                    : "session-card"
            );


        const top =
            createElement(
                "div",
                "session-top"
            );


        const title =
            createElement(
                "div",
                "session-title"
            );


        title.append(
            createElement(
                "strong",
                "",
                session.deviceLabel ||
                "未命名设备"
            ),

            createElement(
                "small",
                "",
                session.current
                    ? "正在使用这台设备"
                    : "已登录设备"
            )
        );


        top.append(
            title
        );


        if (
            session.current
        ) {

            top.append(
                createElement(
                    "span",
                    "session-badge",
                    "当前设备"
                )
            );

        }


        const meta =
            createElement(
                "div",
                "session-meta"
            );


        meta.append(
            createMetaRow(
                "登录于",
                formatTime(
                    session.createdAt
                )
            ),

            createMetaRow(
                "到期",
                formatTime(
                    session.expiresAt
                )
            )
        );


        const actions =
            createElement(
                "div",
                "session-actions"
            );


        const revoke =
            createElement(
                "button",
                "session-revoke",
                session.current
                    ? "退出这台设备"
                    : "撤销此设备"
            );


        revoke.type =
            "button";


        revoke.addEventListener(
            "click",
            async () => {

                const message =
                    session.current

                        ? "确定退出当前设备吗？"

                        : `确定撤销「${session.deviceLabel || "未命名设备"}」吗？`;


                if (
                    !confirm(
                        message
                    )
                ) {

                    return;

                }


                revoke.disabled =
                    true;


                revoke.textContent =
                    "处理中…";


                try {

                    await api(
                        `/api/account/sessions/${encodeURIComponent(session.id)}/revoke`,
                        {
                            method:
                                "POST",

                            body:
                                "{}"
                        }
                    );


                    if (
                        session.current
                    ) {

                        location.replace(
                            "/login"
                        );


                        return;

                    }


                    showToast(
                        "设备已撤销"
                    );


                    await loadSessions();

                } catch (
                    error
                ) {

                    revoke.disabled =
                        false;


                    revoke.textContent =
                        session.current
                            ? "退出这台设备"
                            : "撤销此设备";


                    showToast(
                        humanError(
                            error.message
                        )
                    );

                }

            }
        );


        actions.append(
            revoke
        );


        card.append(
            top,
            meta,
            actions
        );


        return card;

    }


    function renderActiveSessions() {

        const active =
            sessions.filter(
                item =>
                    !item.revokedAt
            );


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    active.length /
                    PAGE_SIZE
                )
            );


        page =
            Math.min(
                page,
                totalPages
            );


        const start =
            (
                page -
                1
            ) *
            PAGE_SIZE;


        const visible =
            active.slice(
                start,
                start +
                PAGE_SIZE
            );


        refs.sessionList
            .textContent =
                "";


        for (
            const session
            of visible
        ) {

            refs.sessionList
                .append(
                    createSessionCard(
                        session
                    )
                );

        }


        const hasActive =
            active.length >
            0;


        refs.sessionsEmpty
            .classList
            .toggle(
                "hidden",
                hasActive
            );


        refs.sessionList
            .classList
            .toggle(
                "hidden",
                !hasActive
            );


        refs.sessionPagination
            .classList
            .toggle(
                "hidden",
                active.length <=
                PAGE_SIZE
            );


        refs.sessionPageText
            .textContent =
                `${page} / ${totalPages}`;


        refs.previousSessionPage
            .disabled =
                page <=
                1;


        refs.nextSessionPage
            .disabled =
                page >=
                totalPages;

    }


    function renderRevokedSessions() {

        const revoked =
            sessions.filter(
                item =>
                    Boolean(
                        item.revokedAt
                    )
            );


        refs.revokedCount
            .textContent =
                String(
                    revoked.length
                );


        refs.revokedList
            .textContent =
                "";


        if (
            revoked.length ===
            0
        ) {

            refs.revokedList
                .append(
                    createElement(
                        "div",
                        "revoked-item",
                        "暂无历史设备"
                    )
                );


            return;

        }


        for (
            const session
            of revoked.slice(
                0,
                6
            )
        ) {

            const row =
                createElement(
                    "div",
                    "revoked-item"
                );


            const copy =
                createElement(
                    "div"
                );


            copy.append(
                createElement(
                    "strong",
                    "",
                    session.deviceLabel ||
                    "未命名设备"
                ),

                createElement(
                    "small",
                    "",
                    `登录于 ${formatTime(session.createdAt)}`
                )
            );


            row.append(
                copy,

                createElement(
                    "span",
                    "",
                    "已撤销"
                )
            );


            refs.revokedList
                .append(
                    row
                );

        }

    }


    async function loadSessions() {

        refs.sessionsLoading
            .classList
            .remove(
                "hidden"
            );


        try {

            const data =
                await api(
                    "/api/account/sessions"
                );


            sessions =
                Array.isArray(
                    data.sessions
                )

                    ? data.sessions

                    : [];


            renderActiveSessions();

            renderRevokedSessions();

        } catch (
            error
        ) {

            showToast(
                humanError(
                    error.message
                )
            );

        } finally {

            refs.sessionsLoading
                .classList
                .add(
                    "hidden"
                );

        }

    }


    async function createPairCode() {

        refs.createPairButton
            .disabled =
                true;


        try {

            const data =
                await api(
                    "/api/device-links",
                    {
                        method:
                            "POST",

                        body:
                            "{}"
                    }
                );


            refs.pairCode
                .textContent =
                    data.code ||
                    "------";


            refs.pairExpiry
                .textContent =
                    formatTime(
                        data.expiresAt
                    );


            refs.pairPanel
                .classList
                .remove(
                    "hidden"
                );


            refs.pairPanel
                .scrollIntoView({
                    behavior:
                        "smooth",

                    block:
                        "center"
                });


            showToast(
                "配对码已生成"
            );

        } catch (
            error
        ) {

            showToast(
                humanError(
                    error.message
                )
            );

        } finally {

            refs.createPairButton
                .disabled =
                    false;

        }

    }


    async function copyPairCode() {

        const value =
            refs.pairCode
                .textContent
                .trim();


        if (
            !value ||
            value ===
            "------"
        ) {

            return;

        }


        try {

            await navigator
                .clipboard
                .writeText(
                    value
                );


            showToast(
                "配对码已复制"
            );

        } catch {

            const range =
                document.createRange();


            range.selectNodeContents(
                refs.pairCode
            );


            const selection =
                window.getSelection();


            selection.removeAllRanges();

            selection.addRange(
                range
            );


            showToast(
                "已选中配对码，请复制"
            );

        }

    }


    async function logoutCurrent() {

        if (
            !confirm(
                "确定退出当前设备吗？"
            )
        ) {

            return;

        }


        refs.logoutButton
            .disabled =
                true;


        try {

            await api(
                "/api/auth/logout",
                {
                    method:
                        "POST",

                    body:
                        "{}"
                }
            );


            location.replace(
                "/login"
            );

        } catch (
            error
        ) {

            refs.logoutButton
                .disabled =
                    false;


            showToast(
                humanError(
                    error.message
                )
            );

        }

    }


    async function logoutAll() {

        if (
            !confirm(
                "确定退出全部设备吗？所有已登录设备都需要重新验证。"
            )
        ) {

            return;

        }


        refs.logoutAllButton
            .disabled =
                true;


        try {

            await api(
                "/api/auth/logout-all",
                {
                    method:
                        "POST",

                    body:
                        "{}"
                }
            );


            location.replace(
                "/login"
            );

        } catch (
            error
        ) {

            refs.logoutAllButton
                .disabled =
                    false;


            showToast(
                humanError(
                    error.message
                )
            );

        }

    }


    function bindEvents() {

        refs.createPairButton
            .addEventListener(
                "click",
                createPairCode
            );


        refs.copyPairButton
            .addEventListener(
                "click",
                copyPairCode
            );


        refs.closePairButton
            .addEventListener(
                "click",
                () => {

                    refs.pairPanel
                        .classList
                        .add(
                            "hidden"
                        );

                }
            );


        refs.refreshSessions
            .addEventListener(
                "click",
                () => {

                    page =
                        1;


                    loadSessions();

                }
            );


        refs.previousSessionPage
            .addEventListener(
                "click",
                () => {

                    if (
                        page >
                        1
                    ) {

                        page -=
                            1;


                        renderActiveSessions();

                    }

                }
            );


        refs.nextSessionPage
            .addEventListener(
                "click",
                () => {

                    const activeCount =
                        sessions
                            .filter(
                                item =>
                                    !item.revokedAt
                            )
                            .length;


                    const totalPages =
                        Math.max(
                            1,
                            Math.ceil(
                                activeCount /
                                PAGE_SIZE
                            )
                        );


                    if (
                        page <
                        totalPages
                    ) {

                        page +=
                            1;


                        renderActiveSessions();

                    }

                }
            );


        refs.logoutButton
            .addEventListener(
                "click",
                logoutCurrent
            );


        refs.logoutAllButton
            .addEventListener(
                "click",
                logoutAll
            );

    }


    async function start() {

        cacheRefs();

        bindEvents();


        try {

            await loadUser();

            await loadSessions();

        } catch (
            error
        ) {

            showToast(
                humanError(
                    error.message
                )
            );

        }

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
