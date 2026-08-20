const PERMISSION_KEYS = [
    "uploadImage",
    "uploadAudio",
    "uploadVideo",
    "deleteMedia",
    "editMedia",
    "manageUsers",
    "manageInvites",
    "manageRepositories",
    "manageSystem",
    "runMaintenance"
];


const PERMISSION_LABELS = {
    uploadImage:
        "上传图片",

    uploadAudio:
        "上传音频",

    uploadVideo:
        "上传视频",

    deleteMedia:
        "删除媒体",

    editMedia:
        "编辑媒体",

    manageUsers:
        "管理用户",

    manageInvites:
        "管理邀请",

    manageRepositories:
        "管理仓库",

    manageSystem:
        "管理系统",

    runMaintenance:
        "运行维护"
};


const DEFAULT_UPLOADER = {
    uploadImage:
        true,

    uploadAudio:
        true,

    uploadVideo:
        true,

    deleteMedia:
        false,

    editMedia:
        false,

    manageUsers:
        false,

    manageInvites:
        false,

    manageRepositories:
        false,

    manageSystem:
        false,

    runMaintenance:
        false
};


const ACTION_LABELS = {
    "system.bootstrap":
        "初始化 Owner",

    "invite.create":
        "创建邀请码",

    "invite.redeem":
        "邀请码已激活",

    "invite.revoke":
        "撤销邀请码",

    "user.update":
        "修改用户",

    "user.delete":
        "删除用户",

    "user.restore":
        "恢复用户",

    "session.logout":
        "退出当前设备",

    "session.logout_all":
        "退出全部设备",

    "session.revoke_own":
        "用户撤销设备",

    "session.revoke_by_owner":
        "Owner 撤销设备",

    "session.revoke_all_by_owner":
        "Owner 撤销全部 Session",

    "recovery.create":
        "创建恢复码",

    "recovery.redeem":
        "使用恢复码",

    "device_link.create":
        "创建设备配对码",

    "device_link.redeem":
        "新设备已配对",

    "owner.recovery":
        "Owner 紧急恢复",

    "passkey.register":
        "注册 Passkey",

    "passkey.login":
        "Passkey 登录",

    "passkey.test":
        "测试 Passkey",

    "passkey.rename":
        "重命名 Passkey",

    "passkey.revoke":
        "撤销 Passkey",

    "upload.create":
        "创建上传任务",

    "upload.queued":
        "上传任务进入队列",

    "upload.complete":
        "媒体发布完成",

    "upload.failed":
        "媒体发布失败"
};


const PAGE_SIZE_USERS =
    8;

const PAGE_SIZE_INVITES =
    6;

const PAGE_SIZE_AUDIT =
    10;


const adminIdentity =
    document.getElementById(
        "adminIdentity"
    );

const summaryUsers =
    document.getElementById(
        "summaryUsers"
    );

const summaryUploaders =
    document.getElementById(
        "summaryUploaders"
    );

const summaryInvites =
    document.getElementById(
        "summaryInvites"
    );

const summaryAudit =
    document.getElementById(
        "summaryAudit"
    );

const refreshAdmin =
    document.getElementById(
        "refreshAdmin"
    );

const inviteForm =
    document.getElementById(
        "inviteForm"
    );

const inviteName =
    document.getElementById(
        "inviteName"
    );

const inviteExpiry =
    document.getElementById(
        "inviteExpiry"
    );

const inviteNote =
    document.getElementById(
        "inviteNote"
    );

const invitePermissions =
    document.getElementById(
        "invitePermissions"
    );

const resetInvitePermissions =
    document.getElementById(
        "resetInvitePermissions"
    );

const usersList =
    document.getElementById(
        "usersList"
    );

const usersEmpty =
    document.getElementById(
        "usersEmpty"
    );

const usersTools =
    document.getElementById(
        "usersTools"
    );

const usersPagination =
    document.getElementById(
        "usersPagination"
    );

const deletedUsersList =
    document.getElementById(
        "deletedUsersList"
    );

const deletedUsersEmpty =
    document.getElementById(
        "deletedUsersEmpty"
    );

const invitesList =
    document.getElementById(
        "invitesList"
    );

const invitesEmpty =
    document.getElementById(
        "invitesEmpty"
    );

const invitesTools =
    document.getElementById(
        "invitesTools"
    );

const invitesPagination =
    document.getElementById(
        "invitesPagination"
    );

const auditList =
    document.getElementById(
        "auditList"
    );

const auditEmpty =
    document.getElementById(
        "auditEmpty"
    );

const auditTools =
    document.getElementById(
        "auditTools"
    );

const auditPagination =
    document.getElementById(
        "auditPagination"
    );

const secretPanel =
    document.getElementById(
        "secretPanel"
    );

const secretTitle =
    document.getElementById(
        "secretTitle"
    );

const secretHint =
    document.getElementById(
        "secretHint"
    );

const secretValue =
    document.getElementById(
        "secretValue"
    );

const copySecret =
    document.getElementById(
        "copySecret"
    );

const closeSecret =
    document.getElementById(
        "closeSecret"
    );

const toast =
    document.getElementById(
        "toast"
    );


let currentUser =
    null;

let currentSecret =
    "";

let toastTimer =
    null;

let users =
    [];

let deletedUsers =
    [];

let invites =
    [];

let audit =
    [];

let userSearch =
    "";

let inviteSearch =
    "";

let auditSearch =
    "";

let userPage =
    1;

let invitePage =
    1;

let auditPage =
    1;


class ApiError
extends Error {

    constructor(
        status,
        code
    ) {
        super(
            code
        );

        this.status =
            status;

        this.code =
            code;
    }

}


function showToast(
    message
) {
    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {
                toast.classList.remove(
                    "show"
                );
            },
            2800
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
        options.body !==
            undefined &&
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
        data =
            {};
    }

    if (
        !response.ok
    ) {
        if (
            response.status ===
            401
        ) {
            location.href =
                "/login";
        }

        throw new ApiError(
            response.status,
            data.error ||
            "request_failed"
        );
    }

    return data;
}


function createElement(
    tag,
    className = "",
    text = undefined
) {
    const element =
        document.createElement(
            tag
        );

    if (
        className
    ) {
        element.className =
            className;
    }

    if (
        text !==
        undefined
    ) {
        element.textContent =
            text;
    }

    return element;
}


function formatDate(
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
                hour12:
                    false
            }
        );
}


function statusClass(
    status
) {
    return String(
        status ||
        ""
    )
        .toLowerCase()
        .replace(
            /[^a-z0-9_-]/g,
            ""
        );
}


function createBadge(
    text,
    className
) {
    return createElement(
        "span",
        `status-badge ${className}`,
        text
    );
}


function renderIdentity() {
    adminIdentity.textContent =
        "";

    const link =
        createElement(
            "a",
            "user-chip"
        );

    link.href =
        "/account";

    link.append(
        createElement(
            "span",
            "user-avatar",
            currentUser
                .displayName
                .slice(
                    0,
                    1
                )
                .toUpperCase()
        )
    );

    const text =
        createElement(
            "span"
        );

    text.append(
        createElement(
            "strong",
            "",
            currentUser.displayName
        ),

        createElement(
            "small",
            "",
            "Owner"
        )
    );

    link.append(
        text
    );

    adminIdentity.append(
        link
    );
}


function renderPermissionEditor(
    container,
    values,
    disabled = false
) {
    container.textContent =
        "";

    for (
        const key
        of PERMISSION_KEYS
    ) {
        const label =
            createElement(
                "label",
                "permission-toggle" +
                (
                    disabled
                        ? " disabled"
                        : ""
                )
            );

        const input =
            document.createElement(
                "input"
            );

        input.type =
            "checkbox";

        input.checked =
            Boolean(
                values?.[key]
            );

        input.disabled =
            disabled;

        input.dataset.permission =
            key;

        const text =
            createElement(
                "span",
                "permission-toggle-text"
            );

        text.append(
            createElement(
                "strong",
                "",
                PERMISSION_LABELS[key]
            ),

            createElement(
                "small",
                "",
                key
            )
        );

        label.append(
            input,
            text
        );

        container.append(
            label
        );
    }
}


function readPermissionEditor(
    container
) {
    const output =
        {};

    for (
        const input
        of container.querySelectorAll(
            "input[data-permission]"
        )
    ) {
        output[
            input.dataset.permission
        ] =
            input.checked;
    }

    return output;
}


function showSecret(
    title,
    value,
    hint
) {
    currentSecret =
        value;

    secretTitle.textContent =
        title;

    secretValue.textContent =
        value;

    secretHint.textContent =
        hint;

    secretPanel.classList.remove(
        "hidden"
    );

    secretPanel.scrollIntoView({
        behavior:
            "smooth",

        block:
            "center"
    });
}


function hideSecret() {
    currentSecret =
        "";

    secretValue.textContent =
        "";

    secretPanel.classList.add(
        "hidden"
    );
}


function allowedPermissionTags(
    permissions
) {
    const wrapper =
        createElement(
            "div",
            "permission-tags"
        );

    for (
        const key
        of PERMISSION_KEYS
    ) {
        if (
            permissions?.[key] !==
            true
        ) {
            continue;
        }

        wrapper.append(
            createElement(
                "span",
                "permission-tag",
                PERMISSION_LABELS[key]
            )
        );
    }

    return wrapper;
}


function createSearchToolbar(
    container,
    placeholder,
    value,
    onInput
) {
    container.textContent =
        "";

    const toolbar =
        createElement(
            "div",
            "admin-toolbar"
        );

    const input =
        document.createElement(
            "input"
        );

    input.className =
        "admin-search";

    input.type =
        "search";

    input.placeholder =
        placeholder;

    input.value =
        value;

    input.addEventListener(
        "input",
        () => {
            onInput(
                input.value
            );
        }
    );

    toolbar.append(
        input
    );

    container.append(
        toolbar
    );
}


function renderPagination(
    container,
    page,
    totalItems,
    pageSize,
    onChange
) {
    container.textContent =
        "";

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalItems /
                pageSize
            )
        );

    const safePage =
        Math.min(
            totalPages,
            Math.max(
                1,
                page
            )
        );

    if (
        totalItems <=
        pageSize
    ) {
        return safePage;
    }

    const wrapper =
        createElement(
            "div",
            "pagination"
        );

    const previous =
        createElement(
            "button",
            "button secondary small",
            "上一页"
        );

    previous.type =
        "button";

    previous.disabled =
        safePage <=
        1;

    previous.addEventListener(
        "click",
        () => {
            onChange(
                safePage -
                1
            );
        }
    );

    const text =
        createElement(
            "span",
            "",
            `${safePage} / ${totalPages}`
        );

    const next =
        createElement(
            "button",
            "button secondary small",
            "下一页"
        );

    next.type =
        "button";

    next.disabled =
        safePage >=
        totalPages;

    next.addEventListener(
        "click",
        () => {
            onChange(
                safePage +
                1
            );
        }
    );

    wrapper.append(
        previous,
        text,
        next
    );

    container.append(
        wrapper
    );

    return safePage;
}


async function loadUserSessions(
    user,
    container
) {
    container.classList.remove(
        "hidden"
    );

    container.textContent =
        "正在读取设备…";

    try {
        const data =
            await api(
                `/api/admin/users/${encodeURIComponent(user.id)}/sessions`
            );

        container.textContent =
            "";

        const list =
            createElement(
                "div",
                "session-list"
            );

        if (
            !data.sessions?.length
        ) {
            container.textContent =
                "没有 Session。";

            return;
        }

        for (
            const session
            of data.sessions
        ) {
            const row =
                createElement(
                    "div",
                    "session-row"
                );

            const info =
                createElement(
                    "div"
                );

            info.append(
                createElement(
                    "strong",
                    "",
                    session.deviceLabel ||
                    "未命名设备"
                ),

                createElement(
                    "small",
                    "",
                    `创建：${formatDate(session.createdAt)} · 最后活动：${formatDate(session.lastSeenAt)} · 到期：${formatDate(session.expiresAt)}${session.revokedAt ? " · 已撤销" : ""}`
                )
            );

            row.append(
                info
            );

            if (
                !session.revokedAt
            ) {
                const revoke =
                    createElement(
                        "button",
                        "button danger small",
                        "撤销"
                    );

                revoke.type =
                    "button";

                revoke.addEventListener(
                    "click",
                    async () => {
                        if (
                            !confirm(
                                "确认撤销这个设备 Session？"
                            )
                        ) {
                            return;
                        }

                        revoke.disabled =
                            true;

                        try {
                            await api(
                                `/api/admin/sessions/${encodeURIComponent(session.id)}/revoke`,
                                {
                                    method:
                                        "POST",

                                    body:
                                        "{}"
                                }
                            );

                            showToast(
                                "Session 已撤销"
                            );

                            await loadUserSessions(
                                user,
                                container
                            );

                        } catch (
                            error
                        ) {
                            showToast(
                                error.code ||
                                error.message
                            );

                            revoke.disabled =
                                false;
                        }
                    }
                );

                row.append(
                    revoke
                );
            }

            list.append(
                row
            );
        }

        container.append(
            list
        );

    } catch (
        error
    ) {
        container.textContent =
            `读取失败：${error.code || error.message}`;
    }
}


function createUserCard(
    user
) {
    const card =
        createElement(
            "article",
            "entity-card"
        );

    const head =
        createElement(
            "div",
            "entity-head clickable"
        );

    const title =
        createElement(
            "div",
            "entity-title"
        );

    title.append(
        createElement(
            "h3",
            "",
            user.displayName
        ),

        createElement(
            "p",
            "",
            `创建：${formatDate(user.createdAt)} · 最后登录：${formatDate(user.lastLoginAt)}`
        )
    );

    const right =
        createElement(
            "div",
            "badge-row"
        );

    right.append(
        createBadge(
            user.role ===
                "owner"
                ? "Owner"
                : "Uploader",

            user.role ===
                "owner"
                ? "owner"
                : "active"
        ),

        createBadge(
            user.status,
            statusClass(
                user.status
            )
        )
    );

    const arrow =
        createElement(
            "span",
            "entity-expand-icon",
            "›"
        );

    right.append(
        arrow
    );

    head.append(
        title,
        right
    );

    const details =
        createElement(
            "div",
            "entity-details hidden"
        );

    head.addEventListener(
        "click",
        event => {
            if (
                event.target.closest(
                    "button, input, select"
                )
            ) {
                return;
            }

            const expanded =
                details.classList
                    .toggle(
                        "hidden"
                    ) ===
                false;

            card.classList.toggle(
                "expanded",
                expanded
            );
        }
    );

    card.append(
        head
    );


    if (
        user.role ===
        "owner"
    ) {
        const note =
            createElement(
                "div",
                "notice",
                "Owner 账户不能在这里停用或删除。Owner 权限固定为系统最高权限。"
            );

        details.append(
            note
        );

        card.append(
            details
        );

        return card;
    }


    const top =
        createElement(
            "div",
            "user-editor-top"
        );

    const nameInput =
        document.createElement(
            "input"
        );

    nameInput.className =
        "admin-input";

    nameInput.maxLength =
        80;

    nameInput.value =
        user.displayName;


    const statusSelect =
        document.createElement(
            "select"
        );

    statusSelect.className =
        "admin-select";


    for (
        const optionValue
        of [
            "active",
            "disabled"
        ]
    ) {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            optionValue;

        option.textContent =
            optionValue ===
                "active"
                ? "启用"
                : "禁用";

        option.selected =
            user.status ===
            optionValue;

        statusSelect.append(
            option
        );
    }


    top.append(
        nameInput,
        statusSelect
    );


    const permissions =
        createElement(
            "div",
            "permission-grid"
        );

    renderPermissionEditor(
        permissions,
        user.permissions
    );


    const actions =
        createElement(
            "div",
            "entity-actions"
        );


    const save =
        createElement(
            "button",
            "button primary small",
            "保存设置"
        );

    const recovery =
        createElement(
            "button",
            "button ghost small",
            "生成恢复码"
        );

    const devices =
        createElement(
            "button",
            "button ghost small",
            "登录设备"
        );

    const revokeAll =
        createElement(
            "button",
            "button danger small",
            "撤销全部 Session"
        );


    for (
        const button
        of [
            save,
            recovery,
            devices,
            revokeAll
        ]
    ) {
        button.type =
            "button";
    }


    const sessionPanel =
        createElement(
            "div",
            "session-panel hidden"
        );


    save.addEventListener(
        "click",
        async () => {
            save.disabled =
                true;

            try {
                await api(
                    `/api/admin/users/${encodeURIComponent(user.id)}`,
                    {
                        method:
                            "PATCH",

                        body:
                            JSON.stringify({
                                displayName:
                                    nameInput.value,

                                status:
                                    statusSelect.value,

                                permissions:
                                    readPermissionEditor(
                                        permissions
                                    )
                            })
                    }
                );

                showToast(
                    "用户设置已保存"
                );

                await loadAll();

            } catch (
                error
            ) {
                showToast(
                    error.code ||
                    error.message
                );

                save.disabled =
                    false;
            }
        }
    );


    recovery.addEventListener(
        "click",
        async () => {
            recovery.disabled =
                true;

            try {
                const data =
                    await api(
                        `/api/admin/users/${encodeURIComponent(user.id)}/recovery`,
                        {
                            method:
                                "POST",

                            body:
                                "{}"
                        }
                    );

                showSecret(
                    `${user.displayName} 的恢复码`,
                    data.recoveryCode,
                    `仅恢复现有账号，不创建新用户。有效至 ${formatDate(data.expiresAt)}。明文只显示这一次。`
                );

            } catch (
                error
            ) {
                showToast(
                    error.code ||
                    error.message
                );

            } finally {
                recovery.disabled =
                    false;
            }
        }
    );


    devices.addEventListener(
        "click",
        async () => {
            if (
                !sessionPanel.classList
                    .contains(
                        "hidden"
                    )
            ) {
                sessionPanel.classList.add(
                    "hidden"
                );

                return;
            }

            await loadUserSessions(
                user,
                sessionPanel
            );
        }
    );


    revokeAll.addEventListener(
        "click",
        async () => {
            if (
                !confirm(
                    `确认撤销 ${user.displayName} 的全部登录 Session？`
                )
            ) {
                return;
            }

            revokeAll.disabled =
                true;

            try {
                await api(
                    `/api/admin/users/${encodeURIComponent(user.id)}/sessions/revoke-all`,
                    {
                        method:
                            "POST",

                        body:
                            "{}"
                    }
                );

                showToast(
                    "全部 Session 已撤销"
                );

                sessionPanel.classList.add(
                    "hidden"
                );

            } catch (
                error
            ) {
                showToast(
                    error.code ||
                    error.message
                );

            } finally {
                revokeAll.disabled =
                    false;
            }
        }
    );


    actions.append(
        save,
        recovery,
        devices,
        revokeAll
    );


    const dangerZone =
        createElement(
            "div",
            "user-danger-zone"
        );

    dangerZone.append(
        createElement(
            "strong",
            "",
            "危险操作"
        )
    );

    const deleteUser =
        createElement(
            "button",
            "button danger",
            "删除用户"
        );

    deleteUser.type =
        "button";


    deleteUser.addEventListener(
        "click",
        async () => {
            const confirmed =
                confirm(
                    `删除 ${user.displayName}？\n\n` +
                    "账号会立即无法登录，全部 Session、恢复码和 Passkey 都会失效。\n\n" +
                    "媒体与上传历史不会删除，7 天内可以从“已删除用户”恢复。"
                );

            if (
                !confirmed
            ) {
                return;
            }

            deleteUser.disabled =
                true;

            try {
                await api(
                    `/api/admin/users/${encodeURIComponent(user.id)}`,
                    {
                        method:
                            "DELETE"
                    }
                );

                showToast(
                    `${user.displayName} 已删除`
                );

                await loadAll();

            } catch (
                error
            ) {
                showToast(
                    error.code ||
                    error.message
                );

                deleteUser.disabled =
                    false;
            }
        }
    );


    dangerZone.append(
        deleteUser
    );


    details.append(
        top,
        permissions,
        actions,
        sessionPanel,
        dangerZone
    );

    card.append(
        details
    );

    return card;
}


function renderUsers() {
    createSearchToolbar(
        usersTools,
        "搜索用户…",
        userSearch,
        value => {
            userSearch =
                value;

            userPage =
                1;

            renderUsers();
        }
    );

    const deletedIds =
        new Set(
            deletedUsers.map(
                user =>
                    user.id
            )
        );

    const query =
        userSearch
            .trim()
            .toLowerCase();

    const filtered =
        users
            .filter(
                user =>
                    !deletedIds.has(
                        user.id
                    )
            )
            .filter(
                user => {
                    if (!query) {
                        return true;
                    }

                    return (
                        user.displayName
                            .toLowerCase()
                            .includes(
                                query
                            ) ||

                        user.role
                            .toLowerCase()
                            .includes(
                                query
                            ) ||

                        user.status
                            .toLowerCase()
                            .includes(
                                query
                            )
                    );
                }
            );


    usersEmpty.classList.toggle(
        "hidden",
        filtered.length >
        0
    );

    userPage =
        renderPagination(
            usersPagination,
            userPage,
            filtered.length,
            PAGE_SIZE_USERS,
            page => {
                userPage =
                    page;

                renderUsers();

                document
                    .getElementById(
                        "usersSection"
                    )
                    .scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "start"
                    });
            }
        );


    const start =
        (
            userPage -
            1
        ) *
        PAGE_SIZE_USERS;

    const pageUsers =
        filtered.slice(
            start,
            start +
            PAGE_SIZE_USERS
        );


    usersList.textContent =
        "";

    for (
        const user
        of pageUsers
    ) {
        usersList.append(
            createUserCard(
                user
            )
        );
    }
}


function renderDeletedUsers() {
    deletedUsersList.textContent =
        "";

    deletedUsersEmpty.classList.toggle(
        "hidden",
        deletedUsers.length >
        0
    );

    for (
        const user
        of deletedUsers
    ) {
        const item =
            createElement(
                "article",
                "deleted-user-item"
            );

        const head =
            createElement(
                "div",
                "deleted-user-head"
            );

        const info =
            createElement(
                "div"
            );

        info.append(
            createElement(
                "h3",
                "",
                user.displayName
            ),

            createElement(
                "p",
                "",
                `删除：${formatDate(user.deletedAt)} · 自动清理目标：${formatDate(user.purgeAfter)}`
            )
        );

        head.append(
            info,

            createBadge(
                "已删除",
                "disabled"
            )
        );


        const warning =
            createElement(
                "div",
                "delete-warning",
                "恢复用户会重新启用账号；永久删除用户会删除登录身份和上传历史，但已发布媒体本身会保留并匿名化上传者。"
            );


        const actions =
            createElement(
                "div",
                "deleted-user-actions"
            );


        const restore =
            createElement(
                "button",
                "button primary small",
                "恢复用户"
            );

        restore.type =
            "button";


        restore.addEventListener(
            "click",
            async () => {
                if (
                    !confirm(
                        `恢复 ${user.displayName}？恢复后账号会重新启用，但需要重新登录。`
                    )
                ) {
                    return;
                }

                restore.disabled =
                    true;

                try {
                    await api(
                        `/api/admin/deleted-users/${encodeURIComponent(user.id)}/restore`,
                        {
                            method:
                                "POST",

                            body:
                                "{}"
                        }
                    );

                    showToast(
                        `${user.displayName} 已恢复`
                    );

                    await loadAll();

                } catch (
                    error
                ) {
                    showToast(
                        error.code ||
                        error.message
                    );

                    restore.disabled =
                        false;
                }
            }
        );


        const purge =
            createElement(
                "button",
                "button danger small",
                "立即永久删除"
            );

        purge.type =
            "button";


        purge.addEventListener(
            "click",
            async () => {
                const first =
                    confirm(
                        `永久删除 ${user.displayName}？\n\n` +
                        "账号、Session、Passkey、恢复码和上传历史将永久删除。\n" +
                        "已发布媒体会保留，但上传者身份会匿名化。\n\n" +
                        "此操作不能恢复。"
                    );

                if (
                    !first
                ) {
                    return;
                }


                const typed =
                    prompt(
                        "请输入 DELETE 确认永久删除："
                    );


                if (
                    typed !==
                    "DELETE"
                ) {
                    showToast(
                        "已取消永久删除"
                    );

                    return;
                }


                restore.disabled =
                    true;

                purge.disabled =
                    true;


                try {
                    await api(
                        `/api/admin/deleted-users/${encodeURIComponent(user.id)}/purge`,
                        {
                            method:
                                "DELETE"
                        }
                    );

                    showToast(
                        `${user.displayName} 已永久删除`
                    );

                    await loadAll();

                } catch (
                    error
                ) {
                    showToast(
                        error.code ||
                        error.message
                    );

                    restore.disabled =
                        false;

                    purge.disabled =
                        false;
                }
            }
        );


        actions.append(
            restore,
            purge
        );


        item.append(
            head,
            warning,
            actions
        );


        deletedUsersList.append(
            item
        );
    }
}

function inviteDisplayStatus(
    invite
) {
    if (
        invite.status ===
            "active" &&
        invite.expiresAt &&
        Number(
            invite.expiresAt
        ) <=
            Math.floor(
                Date.now() /
                1000
            )
    ) {
        return "expired";
    }

    return invite.status;
}


function renderInvites() {
    createSearchToolbar(
        invitesTools,
        "搜索邀请码名称或备注…",
        inviteSearch,
        value => {
            inviteSearch =
                value;

            invitePage =
                1;

            renderInvites();
        }
    );

    const query =
        inviteSearch
            .trim()
            .toLowerCase();

    const filtered =
        invites.filter(
            invite => {
                if (!query) {
                    return true;
                }

                return (
                    invite.displayName
                        .toLowerCase()
                        .includes(
                            query
                        ) ||

                    String(
                        invite.note ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            query
                        )
                );
            }
        );


    invitesEmpty.classList.toggle(
        "hidden",
        filtered.length >
        0
    );


    invitePage =
        renderPagination(
            invitesPagination,
            invitePage,
            filtered.length,
            PAGE_SIZE_INVITES,
            page => {
                invitePage =
                    page;

                renderInvites();
            }
        );


    const start =
        (
            invitePage -
            1
        ) *
        PAGE_SIZE_INVITES;


    invitesList.textContent =
        "";


    for (
        const invite
        of filtered.slice(
            start,
            start +
            PAGE_SIZE_INVITES
        )
    ) {
        const displayStatus =
            inviteDisplayStatus(
                invite
            );

        const card =
            createElement(
                "article",
                "entity-card"
            );

        const head =
            createElement(
                "div",
                "entity-head"
            );

        const title =
            createElement(
                "div",
                "entity-title"
            );

        title.append(
            createElement(
                "h3",
                "",
                invite.displayName
            ),

            createElement(
                "p",
                "",
                invite.expiresAt
                    ? `到期：${formatDate(invite.expiresAt)}`
                    : "永不过期"
            )
        );

        head.append(
            title,
            createBadge(
                displayStatus,
                statusClass(
                    displayStatus
                )
            )
        );

        card.append(
            head
        );


        if (
            invite.note
        ) {
            card.append(
                createElement(
                    "p",
                    "invite-note",
                    invite.note
                )
            );
        }


        card.append(
            allowedPermissionTags(
                invite.permissions
            )
        );


        if (
            invite.status ===
                "active" &&
            displayStatus !==
                "expired"
        ) {
            const actions =
                createElement(
                    "div",
                    "entity-actions"
                );

            const revoke =
                createElement(
                    "button",
                    "button danger small",
                    "撤销"
                );

            revoke.type =
                "button";

            revoke.addEventListener(
                "click",
                async () => {
                    if (
                        !confirm(
                            `撤销 ${invite.displayName} 的邀请码？`
                        )
                    ) {
                        return;
                    }

                    revoke.disabled =
                        true;

                    try {
                        await api(
                            `/api/admin/invites/${encodeURIComponent(invite.id)}/revoke`,
                            {
                                method:
                                    "POST",

                                body:
                                    "{}"
                            }
                        );

                        showToast(
                            "邀请码已撤销"
                        );

                        await loadAll();

                    } catch (
                        error
                    ) {
                        showToast(
                            error.code ||
                            error.message
                        );

                        revoke.disabled =
                            false;
                    }
                }
            );

            actions.append(
                revoke
            );

            card.append(
                actions
            );
        }


        invitesList.append(
            card
        );
    }
}


function formatMetadata(
    metadata
) {
    if (
        !metadata ||
        typeof metadata !==
            "object"
    ) {
        return "";
    }

    return Object.entries(
        metadata
    )
        .slice(
            0,
            4
        )
        .map(
            ([key, value]) => {
                let printable =
                    "";

                if (
                    value &&
                    typeof value ===
                        "object"
                ) {
                    try {
                        printable =
                            JSON.stringify(
                                value
                            );

                    } catch {
                        printable =
                            "[object]";
                    }

                } else {
                    printable =
                        String(
                            value
                        );
                }

                if (
                    printable.length >
                    80
                ) {
                    printable =
                        printable.slice(
                            0,
                            77
                        ) +
                        "...";
                }

                return `${key}: ${printable}`;
            }
        )
        .join(
            " · "
        );
}


function renderAudit() {
    createSearchToolbar(
        auditTools,
        "搜索操作、目标或 ID…",
        auditSearch,
        value => {
            auditSearch =
                value;

            auditPage =
                1;

            renderAudit();
        }
    );

    const query =
        auditSearch
            .trim()
            .toLowerCase();

    const filtered =
        audit.filter(
            entry => {
                if (!query) {
                    return true;
                }

                const haystack =
                    [
                        entry.action,
                        ACTION_LABELS[
                            entry.action
                        ],
                        entry.targetType,
                        entry.targetId,
                        formatMetadata(
                            entry.metadata
                        )
                    ]
                        .filter(
                            Boolean
                        )
                        .join(
                            " "
                        )
                        .toLowerCase();

                return haystack
                    .includes(
                        query
                    );
            }
        );


    auditEmpty.classList.toggle(
        "hidden",
        filtered.length >
        0
    );


    auditPage =
        renderPagination(
            auditPagination,
            auditPage,
            filtered.length,
            PAGE_SIZE_AUDIT,
            page => {
                auditPage =
                    page;

                renderAudit();
            }
        );


    const start =
        (
            auditPage -
            1
        ) *
        PAGE_SIZE_AUDIT;


    auditList.textContent =
        "";


    for (
        const entry
        of filtered.slice(
            start,
            start +
            PAGE_SIZE_AUDIT
        )
    ) {
        const item =
            createElement(
                "article",
                "audit-item"
            );

        item.append(
            createElement(
                "strong",
                "",
                ACTION_LABELS[
                    entry.action
                ] ||
                entry.action
            )
        );

        const details =
            [
                formatDate(
                    entry.createdAt
                ),

                entry.targetType
                    ? `目标：${entry.targetType}`
                    : null,

                entry.targetId,

                formatMetadata(
                    entry.metadata
                )
            ]
                .filter(
                    Boolean
                )
                .join(
                    " · "
                );

        item.append(
            createElement(
                "p",
                "",
                details
            )
        );

        auditList.append(
            item
        );
    }
}


function renderSummary() {
    const deletedIds =
        new Set(
            deletedUsers.map(
                user =>
                    user.id
            )
        );

    const visibleUsers =
        users.filter(
            user =>
                !deletedIds.has(
                    user.id
                )
        );

    summaryUsers.textContent =
        String(
            visibleUsers.length
        );

    summaryUploaders.textContent =
        String(
            visibleUsers.filter(
                user =>
                    user.role ===
                        "uploader" &&
                    user.status ===
                        "active"
            ).length
        );

    summaryInvites.textContent =
        String(
            invites.filter(
                invite =>
                    inviteDisplayStatus(
                        invite
                    ) ===
                    "active"
            ).length
        );

    summaryAudit.textContent =
        String(
            audit.length
        );
}


function setupSectionCollapse() {
    const sections =
        Array.from(
            document.querySelectorAll(
                ".admin-card"
            )
        );

    const mobile =
        window.matchMedia(
            "(max-width: 640px)"
        ).matches;


    for (
        const section
        of sections
    ) {
        const heading =
            section.querySelector(
                ".section-heading"
            );

        const content =
            section.querySelector(
                ".section-collapsible-content"
            );

        if (
            !heading ||
            !content ||
            heading.querySelector(
                ".mobile-section-toggle"
            )
        ) {
            continue;
        }


        const toggle =
            createElement(
                "button",
                "mobile-section-toggle",
                "⌄"
            );

        toggle.type =
            "button";

        heading.append(
            toggle
        );


        const setCollapsed =
            collapsed => {
                section.classList.toggle(
                    "section-collapsed",
                    collapsed
                );

                toggle.textContent =
                    collapsed
                        ? "›"
                        : "⌄";

                toggle.setAttribute(
                    "aria-expanded",
                    collapsed
                        ? "false"
                        : "true"
                );
            };


        toggle.addEventListener(
            "click",
            () => {
                setCollapsed(
                    !section.classList
                        .contains(
                            "section-collapsed"
                        )
                );
            }
        );


        if (
            mobile
        ) {
            setCollapsed(
                ![
                    "usersSection"
                ].includes(
                    section.id
                )
            );

        } else {
            setCollapsed(
                false
            );
        }
    }
}


async function loadAll() {
    refreshAdmin.disabled =
        true;

    try {
        const [
            usersData,
            deletedData,
            invitesData,
            auditData
        ] =
            await Promise.all([

                api(
                    "/api/admin/users"
                ),

                api(
                    "/api/admin/deleted-users"
                ),

                api(
                    "/api/admin/invites"
                ),

                api(
                    "/api/admin/audit"
                )

            ]);


        users =
            usersData.users ||
            [];

        deletedUsers =
            deletedData.users ||
            [];

        invites =
            invitesData.invites ||
            [];

        audit =
            auditData.logs ||
            [];


        renderUsers();

        renderDeletedUsers();

        renderInvites();

        renderAudit();

        renderSummary();


    } catch (
        error
    ) {
        showToast(
            `后台数据读取失败：${error.code || error.message}`
        );

    } finally {
        refreshAdmin.disabled =
            false;
    }
}


inviteForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const submit =
            inviteForm.querySelector(
                'button[type="submit"]'
            );

        submit.disabled =
            true;

        try {
            const expiryValue =
                inviteExpiry.value;

            const data =
                await api(
                    "/api/admin/invites",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                displayName:
                                    inviteName.value,

                                expiresInDays:
                                    expiryValue ===
                                        "never"
                                        ? null
                                        : Number(
                                            expiryValue
                                        ),

                                note:
                                    inviteNote.value,

                                permissions:
                                    readPermissionEditor(
                                        invitePermissions
                                    )
                            })
                    }
                );


            showSecret(
                `${data.displayName} 的邀请码`,
                data.inviteCode,
                "一人一码，只能成功激活一次。明文邀请码不会再次从数据库读取，请现在复制。"
            );


            inviteName.value =
                "";

            inviteNote.value =
                "";


            renderPermissionEditor(
                invitePermissions,
                DEFAULT_UPLOADER
            );


            await loadAll();


        } catch (
            error
        ) {
            showToast(
                `创建失败：${error.code || error.message}`
            );

        } finally {
            submit.disabled =
                false;
        }
    }
);


resetInvitePermissions.addEventListener(
    "click",
    () => {
        renderPermissionEditor(
            invitePermissions,
            DEFAULT_UPLOADER
        );
    }
);


copySecret.addEventListener(
    "click",
    async () => {
        if (
            !currentSecret
        ) {
            return;
        }

        try {
            await navigator
                .clipboard
                .writeText(
                    currentSecret
                );

            showToast(
                "已复制"
            );

        } catch {
            showToast(
                "复制失败，请手动复制"
            );
        }
    }
);


closeSecret.addEventListener(
    "click",
    hideSecret
);


refreshAdmin.addEventListener(
    "click",
    loadAll
);


async function bootstrap() {
    const data =
        await api(
            "/api/auth/me"
        );

    currentUser =
        data.user;


    if (
        currentUser?.role !==
            "owner" ||

        currentUser?.permissions
            ?.manageUsers !==
            true ||

        currentUser?.permissions
            ?.manageInvites !==
            true ||

        currentUser?.permissions
            ?.manageSystem !==
            true
    ) {
        location.href =
            "/";

        return;
    }


    renderIdentity();


    renderPermissionEditor(
        invitePermissions,
        DEFAULT_UPLOADER
    );


    setupSectionCollapse();


    await loadAll();
}


bootstrap()
    .catch(
        error => {
            console.error(
                error
            );

            showToast(
                `管理后台初始化失败：${error.code || error.message}`
            );
        }
    );
