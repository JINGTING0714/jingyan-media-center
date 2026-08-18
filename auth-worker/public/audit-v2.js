(() => {
    "use strict";


    const PAGE_SIZE =
        10;


    const NOISE_ACTIONS =
        new Set([
            "upload.create",
            "upload.queued",
            "upload.complete",
            "passkey.test"
        ]);


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

        "passkey.rename":
            "重命名 Passkey",

        "passkey.revoke":
            "撤销 Passkey",

        "passkey.test":
            "测试 Passkey",

        "upload.create":
            "创建上传任务",

        "upload.queued":
            "上传进入队列",

        "upload.complete":
            "媒体发布完成",

        "upload.failed":
            "媒体发布失败"
    };


    let logs =
        [];

    let category =
        "important";

    let search =
        "";

    let page =
        1;

    let renderTimer =
        null;


    function injectStyles() {
        if (
            document.getElementById(
                "auditV2Styles"
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "auditV2Styles";


        style.textContent = `
.audit-v2-toolbar {
    display: grid;
    gap: 10px;
    margin-bottom: 14px;
}

.audit-v2-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.audit-v2-tab {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    color: var(--muted);
    background: var(--surface-soft);
    cursor: pointer;
    font-size: 10px;
    font-weight: 750;
}

.audit-v2-tab.active {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(145deg,#956df0,#6d45dc);
}

.audit-v2-search {
    width: 100%;
    min-height: 42px;
    padding: 0 13px;
    border: 1px solid var(--line);
    border-radius: 12px;
    outline: none;
    color: var(--text);
    background: var(--surface-soft);
}

.audit-v2-note {
    margin: 0;
    color: var(--muted);
    font-size: 9px;
    line-height: 1.6;
}

.audit-v2-list {
    display: grid;
    gap: 8px;
}

.audit-v2-item {
    padding: 12px 13px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface-soft);
}

.audit-v2-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.audit-v2-head strong {
    min-width: 0;
    font-size: 11px;
}

.audit-v2-time {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 9px;
    white-space: nowrap;
}

.audit-v2-target {
    margin-top: 5px;
    overflow: hidden;
    color: var(--muted);
    font-size: 9px;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.audit-v2-details {
    margin-top: 8px;
    border-top: 1px solid var(--line);
}

.audit-v2-details summary {
    padding-top: 8px;
    color: var(--primary);
    cursor: pointer;
    font-size: 9px;
    font-weight: 700;
}

.audit-v2-metadata {
    margin: 8px 0 0;
    padding: 9px;
    overflow-wrap: anywhere;
    border-radius: 9px;
    color: var(--muted);
    background: rgba(255,255,255,.65);
    font-size: 9px;
    line-height: 1.6;
    white-space: pre-wrap;
}

.audit-v2-pagination {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
}

.audit-v2-pagination span {
    min-width: 70px;
    color: var(--muted);
    text-align: center;
    font-size: 9px;
}

.audit-v2-pagination button {
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: var(--text);
    background: var(--surface);
    cursor: pointer;
    font-size: 9px;
}

.audit-v2-pagination button:disabled {
    cursor: default;
    opacity: .45;
}

@media (max-width:640px) {
    .audit-v2-head {
        flex-direction: column;
        gap: 4px;
    }

    .audit-v2-target {
        white-space: normal;
    }
}
`;


        document.head.append(
            style
        );
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
            value * 1000
        )
            .toLocaleString(
                "zh-CN",
                {
                    hour12:
                        false,

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


    function labelFor(
        action
    ) {
        return (
            ACTION_LABELS[
                action
            ] ||
            action ||
            "未知操作"
        );
    }


    function isSecurityAction(
        action
    ) {
        const value =
            String(
                action ||
                ""
            );


        return [
            "system.",
            "user.",
            "invite.",
            "session.",
            "recovery.",
            "device_link.",
            "owner.",
            "passkey."
        ].some(
            prefix =>
                value.startsWith(
                    prefix
                )
        );
    }


    function matchesCategory(
        entry
    ) {
        const action =
            String(
                entry.action ||
                ""
            );


        if (
            category ===
            "all"
        ) {
            return true;
        }


        if (
            category ===
            "uploads"
        ) {
            return action
                .startsWith(
                    "upload."
                );
        }


        if (
            category ===
            "security"
        ) {
            return (
                isSecurityAction(
                    action
                ) &&
                action !==
                    "passkey.test"
            );
        }


        return !NOISE_ACTIONS
            .has(
                action
            );
    }


    function metadataText(
        metadata
    ) {
        if (
            !metadata
        ) {
            return "";
        }


        try {
            return JSON.stringify(
                metadata,
                null,
                2
            );

        } catch {
            return String(
                metadata
            );
        }
    }


    function getFilteredLogs() {
        const query =
            search
                .trim()
                .toLowerCase();


        return logs.filter(
            entry => {
                if (
                    !matchesCategory(
                        entry
                    )
                ) {
                    return false;
                }


                if (
                    !query
                ) {
                    return true;
                }


                const haystack =
                    [
                        entry.action,
                        labelFor(
                            entry.action
                        ),
                        entry.targetType,
                        entry.targetId,
                        metadataText(
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


    function renderToolbar() {
        const tools =
            document.getElementById(
                "auditTools"
            );


        if (
            !tools
        ) {
            return;
        }


        tools.textContent =
            "";


        const wrapper =
            createElement(
                "div",
                "audit-v2-toolbar"
            );


        const tabs =
            createElement(
                "div",
                "audit-v2-tabs"
            );


        const categories = [
            [
                "important",
                "重要"
            ],
            [
                "security",
                "安全 / 用户"
            ],
            [
                "uploads",
                "上传活动"
            ],
            [
                "all",
                "全部"
            ]
        ];


        for (
            const [
                value,
                text
            ]
            of categories
        ) {
            const button =
                createElement(
                    "button",
                    "audit-v2-tab" +
                    (
                        category ===
                        value
                            ? " active"
                            : ""
                    ),
                    text
                );


            button.type =
                "button";


            button.addEventListener(
                "click",
                () => {
                    category =
                        value;

                    page =
                        1;

                    render();
                }
            );


            tabs.append(
                button
            );
        }


        const input =
            createElement(
                "input",
                "audit-v2-search"
            );


        input.type =
            "search";

        input.placeholder =
            "搜索操作、目标或 ID…";

        input.value =
            search;


        input.addEventListener(
            "input",
            () => {
                search =
                    input.value;

                page =
                    1;

                renderList();
            }
        );


        const note =
            createElement(
                "p",
                "audit-v2-note",
                category ===
                    "important"
                    ? "默认隐藏：上传创建、排队、正常完成、Passkey 测试。上传失败和安全操作仍会显示。"
                    : "这里只改变后台显示方式，原始审计数据不会被危险地清空。"
            );


        wrapper.append(
            tabs,
            input,
            note
        );


        tools.append(
            wrapper
        );
    }


    function renderList() {
        const list =
            document.getElementById(
                "auditList"
            );

        const empty =
            document.getElementById(
                "auditEmpty"
            );

        const pagination =
            document.getElementById(
                "auditPagination"
            );


        if (
            !list ||
            !empty ||
            !pagination
        ) {
            return;
        }


        const filtered =
            getFilteredLogs();


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    filtered.length /
                    PAGE_SIZE
                )
            );


        page =
            Math.min(
                totalPages,
                Math.max(
                    1,
                    page
                )
            );


        const start =
            (
                page -
                1
            ) *
            PAGE_SIZE;


        const visible =
            filtered.slice(
                start,
                start +
                PAGE_SIZE
            );


        list.textContent =
            "";

        list.classList.add(
            "audit-v2-list"
        );


        empty.classList.toggle(
            "hidden",
            visible.length >
            0
        );


        if (
            !visible.length
        ) {
            empty.textContent =
                "当前筛选条件下没有审计记录。";
        }


        for (
            const entry
            of visible
        ) {
            const item =
                createElement(
                    "article",
                    "audit-v2-item"
                );


            const head =
                createElement(
                    "div",
                    "audit-v2-head"
                );


            head.append(
                createElement(
                    "strong",
                    "",
                    labelFor(
                        entry.action
                    )
                ),

                createElement(
                    "span",
                    "audit-v2-time",
                    formatDate(
                        entry.createdAt
                    )
                )
            );


            item.append(
                head
            );


            const targetParts =
                [
                    entry.targetType
                        ? `目标：${entry.targetType}`
                        : null,

                    entry.targetId
                ]
                    .filter(
                        Boolean
                    );


            if (
                targetParts.length
            ) {
                item.append(
                    createElement(
                        "div",
                        "audit-v2-target",
                        targetParts.join(
                            " · "
                        )
                    )
                );
            }


            const metadata =
                metadataText(
                    entry.metadata
                );


            if (
                metadata
            ) {
                const details =
                    createElement(
                        "details",
                        "audit-v2-details"
                    );


                const summary =
                    createElement(
                        "summary",
                        "",
                        "详情"
                    );


                const pre =
                    createElement(
                        "pre",
                        "audit-v2-metadata",
                        metadata
                    );


                details.append(
                    summary,
                    pre
                );


                item.append(
                    details
                );
            }


            list.append(
                item
            );
        }


        pagination.textContent =
            "";


        if (
            filtered.length >
            PAGE_SIZE
        ) {
            const wrapper =
                createElement(
                    "div",
                    "audit-v2-pagination"
                );


            const previous =
                createElement(
                    "button",
                    "",
                    "上一页"
                );


            previous.type =
                "button";

            previous.disabled =
                page <=
                1;


            previous.addEventListener(
                "click",
                () => {
                    page -=
                        1;

                    renderList();
                }
            );


            const next =
                createElement(
                    "button",
                    "",
                    "下一页"
                );


            next.type =
                "button";

            next.disabled =
                page >=
                totalPages;


            next.addEventListener(
                "click",
                () => {
                    page +=
                        1;

                    renderList();
                }
            );


            wrapper.append(
                previous,

                createElement(
                    "span",
                    "",
                    `${page} / ${totalPages}`
                ),

                next
            );


            pagination.append(
                wrapper
            );
        }


        const summaryAudit =
            document.getElementById(
                "summaryAudit"
            );


        if (
            summaryAudit
        ) {
            summaryAudit.textContent =
                String(
                    logs.filter(
                        entry =>
                            !NOISE_ACTIONS
                                .has(
                                    entry.action
                                )
                    ).length
                );
        }
    }


    function render() {
        renderToolbar();

        renderList();
    }


    async function loadAudit() {
        try {
            const response =
                await fetch(
                    "/api/admin/audit",
                    {
                        credentials:
                            "same-origin"
                    }
                );


            if (
                response.status ===
                401
            ) {
                location.href =
                    "/login";

                return;
            }


            if (
                !response.ok
            ) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            logs =
                Array.isArray(
                    data.logs
                )
                    ? data.logs
                    : [];


            render();

        } catch (
            error
        ) {
            console.error(
                "Audit V2:",
                error
            );
        }
    }


    function observeLegacyRender() {
        const list =
            document.getElementById(
                "auditList"
            );


        if (
            !list
        ) {
            return;
        }


        const observer =
            new MutationObserver(
                () => {
                    const first =
                        list.firstElementChild;


                    if (
                        first &&
                        !first.classList.contains(
                            "audit-v2-item"
                        )
                    ) {
                        clearTimeout(
                            renderTimer
                        );


                        renderTimer =
                            setTimeout(
                                render,
                                20
                            );
                    }
                }
            );


        observer.observe(
            list,
            {
                childList:
                    true
            }
        );
    }


    function init() {
        injectStyles();

        observeLegacyRender();


        const refresh =
            document.getElementById(
                "refreshAdmin"
            );


        if (
            refresh
        ) {
            refresh.addEventListener(
                "click",
                () => {
                    setTimeout(
                        loadAudit,
                        650
                    );
                }
            );
        }


        loadAudit();
    }


    window.addEventListener(
        "load",
        () => {
            setTimeout(
                init,
                500
            );
        }
    );
})();
