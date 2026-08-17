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

    "upload.create":
        "创建上传任务",

    "upload.queued":
        "上传任务进入队列",

    "upload.complete":
        "媒体发布完成",

    "upload.failed":
        "媒体发布失败"
};


const adminIdentity =
    document.getElementById(
        "adminIdentity"
    );

const ownerName =
    document.getElementById(
        "ownerName"
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

const invitesList =
    document.getElementById(
        "invitesList"
    );

const invitesEmpty =
    document.getElementById(
        "invitesEmpty"
    );

const auditList =
    document.getElementById(
        "auditList"
    );

const auditEmpty =
    document.getElementById(
        "auditEmpty"
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


    if (!response.ok) {

        if (
            response.status ===
            401
        ) {

            location.href =
                "/activate";

        }


        throw new ApiError(
            response.status,
            data.error ||
            "request_failed"
        );

    }


    return data;

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
        .toLocaleString();

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


function createElement(
    tag,
    className = "",
    text = undefined
) {

    const element =
        document.createElement(
            tag
        );


    if (className) {

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

    const result =
        {};


    for (
        const input
        of container.querySelectorAll(
            "input[data-permission]"
        )
    ) {

        result[
            input.dataset.permission
        ] =
            input.checked;

    }


    return result;

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


    secretPanel.classList
        .remove(
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

    secretPanel.classList
        .add(
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


async function loadUserSessions(
    user,
    container
) {

    container.classList
        .remove(
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

                        } catch (error) {

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

    } catch (error) {

        container.textContent =
            `读取失败：${error.code || error.message}`;

    }

}


function renderUsers(
    users
) {

    usersList.textContent =
        "";


    usersEmpty.classList.toggle(
        "hidden",
        users.length >
        0
    );


    for (
        const user
        of users
    ) {

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
                user.displayName
            ),

            createElement(
                "p",
                "",
                `创建：${formatDate(user.createdAt)} · 最后登录：${formatDate(user.lastLoginAt)}`
            )
        );


        const badges =
            createElement(
                "div",
                "badge-row"
            );


        badges.append(
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


        head.append(
            title,
            badges
        );


        card.append(
            head
        );


        if (
            user.role ===
            "owner"
        ) {

            const permissions =
                createElement(
                    "div",
                    "permission-grid user-editor"
                );


            renderPermissionEditor(
                permissions,
                user.permissions,
                true
            );


            card.append(
                permissions
            );


            usersList.append(
                card
            );


            continue;

        }


        const editor =
            createElement(
                "div",
                "user-editor"
            );


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

        nameInput.value =
            user.displayName;

        nameInput.maxLength =
            80;


        const statusSelect =
            document.createElement(
                "select"
            );


        statusSelect.className =
            "admin-select";


        for (
            const value
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
                value;

            option.textContent =
                value ===
                    "active"
                    ? "启用"
                    : "禁用";

            option.selected =
                user.status ===
                value;


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
                "保存"
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
                "查看设备"
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

                } catch (error) {

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
                        `仅用于恢复现有账号，不会创建新用户。有效至 ${formatDate(data.expiresAt)}。此代码只显示这一次。`
                    );

                } catch (error) {

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

                    sessionPanel.classList
                        .add(
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


                    if (
                        !sessionPanel.classList
                            .contains(
                                "hidden"
                            )
                    ) {

                        await loadUserSessions(
                            user,
                            sessionPanel
                        );

                    }

                } catch (error) {

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


        editor.append(
            top,
            permissions,
            actions,
            sessionPanel
        );


        card.append(
            editor
        );


        usersList.append(
            card
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


function renderInvites(
    invites
) {

    invitesList.textContent =
        "";


    invitesEmpty.classList.toggle(
        "hidden",
        invites.length >
        0
    );


    for (
        const invite
        of invites
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
                    ? `创建：${formatDate(invite.createdAt)} · 到期：${formatDate(invite.expiresAt)}`
                    : `创建：${formatDate(invite.createdAt)} · 永不过期`
            )
        );


        const badges =
            createElement(
                "div",
                "badge-row"
            );


        badges.append(
            createBadge(
                displayStatus,
                statusClass(
                    displayStatus
                )
            )
        );


        head.append(
            title,
            badges
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


        const meta =
            createElement(
                "div",
                "entity-meta"
            );


        if (
            invite.usedAt
        ) {

            meta.append(
                createElement(
                    "span",
                    "",
                    `已使用：${formatDate(invite.usedAt)}`
                )
            );

        }


        if (
            invite.revokedAt
        ) {

            meta.append(
                createElement(
                    "span",
                    "",
                    `已撤销：${formatDate(invite.revokedAt)}`
                )
            );

        }


        if (
            meta.children.length
        ) {

            card.append(
                meta
            );

        }


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
                    "撤销邀请码"
                );


            revoke.type =
                "button";


            revoke.addEventListener(
                "click",
                async () => {

                    if (
                        !confirm(
                            `确认撤销 ${invite.displayName} 的邀请码？`
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

                    } catch (error) {

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


    const entries =
        Object.entries(
            metadata
        )
        .slice(
            0,
            5
        );


    if (!entries.length) {

        return "";

    }


    return entries
        .map(
            ([key, value]) => {

                let printable;


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
                    90
                ) {

                    printable =
                        printable.slice(
                            0,
                            87
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


function renderAudit(
    logs
) {

    auditList.textContent =
        "";


    auditEmpty.classList.toggle(
        "hidden",
        logs.length >
        0
    );


    for (
        const entry
        of logs
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


        const details = [
            formatDate(
                entry.createdAt
            ),

            entry.targetType
                ? `目标：${entry.targetType}`
                : null,

            entry.targetId
                ? entry.targetId
                : null,

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


function renderSummary(
    users,
    invites,
    audit
) {

    summaryUsers.textContent =
        String(
            users.length
        );


    summaryUploaders.textContent =
        String(
            users.filter(
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


async function loadAll() {

    refreshAdmin.disabled =
        true;


    try {

        const [
            usersData,
            invitesData,
            auditData
        ] =
            await Promise.all([
                api(
                    "/api/admin/users"
                ),

                api(
                    "/api/admin/invites"
                ),

                api(
                    "/api/admin/audit"
                )
            ]);


        const users =
            usersData.users ||
            [];

        const invites =
            invitesData.invites ||
            [];

        const audit =
            auditData.logs ||
            [];


        renderUsers(
            users
        );

        renderInvites(
            invites
        );

        renderAudit(
            audit
        );

        renderSummary(
            users,
            invites,
            audit
        );

    } catch (error) {

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
                "一个邀请码只对应一个人，只能成功激活一次。明文邀请码不会再次从数据库读取，请现在复制并发送给对应的人。"
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

        } catch (error) {

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

        if (!currentSecret) {

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
