(() => {
    "use strict";


    const MOBILE_QUERY =
        window.matchMedia(
            "(max-width: 760px)"
        );


    const COLLECTION_META = {
        image: {
            label:
                "图库",

            action:
                "加入图库",

            icon:
                "▧",

            placeholder:
                "例如：月华、旅行、壁纸"
        },

        audio: {
            label:
                "歌单",

            action:
                "加入歌单",

            icon:
                "♫",

            placeholder:
                "例如：甜蜜、深夜、通勤"
        },

        video: {
            label:
                "影集",

            action:
                "加入影集",

            icon:
                "▶",

            placeholder:
                "例如：旅行、演唱会、收藏片段"
        }
    };


    const refs = {
        identity:
            document.getElementById(
                "libraryIdentity"
            ),

        manifestUpdated:
            document.getElementById(
                "manifestUpdated"
            ),

        countAll:
            document.getElementById(
                "countAll"
            ),

        countImage:
            document.getElementById(
                "countImage"
            ),

        countAudio:
            document.getElementById(
                "countAudio"
            ),

        countVideo:
            document.getElementById(
                "countVideo"
            ),

        searchInput:
            document.getElementById(
                "searchInput"
            ),

        refresh:
            document.getElementById(
                "refreshLibrary"
            ),

        resultCount:
            document.getElementById(
                "resultCount"
            ),

        loading:
            document.getElementById(
                "libraryLoading"
            ),

        empty:
            document.getElementById(
                "libraryEmpty"
            ),

        grid:
            document.getElementById(
                "mediaGrid"
            ),

        pagination:
            document.getElementById(
                "pagination"
            ),

        previous:
            document.getElementById(
                "previousPage"
            ),

        next:
            document.getElementById(
                "nextPage"
            ),

        pageText:
            document.getElementById(
                "pageText"
            ),

        pageSize:
            document.getElementById(
                "pageSizeSelect"
            ),

        toolbar:
            document.querySelector(
                ".library-toolbar"
            ),

        toast:
            document.getElementById(
                "toast"
            ),

        previewBackdrop:
            document.getElementById(
                "previewBackdrop"
            ),

        previewSheet:
            document.getElementById(
                "previewSheet"
            ),

        previewClose:
            document.getElementById(
                "previewClose"
            ),

        previewTitle:
            document.getElementById(
                "previewTitle"
            ),

        previewStage:
            document.getElementById(
                "previewStage"
            ),

        previewInfo:
            document.getElementById(
                "previewInfo"
            ),

        previewOpen:
            document.getElementById(
                "previewOpen"
            ),

        previewCopy:
            document.getElementById(
                "previewCopy"
            ),

        collectionBackdrop:
            document.getElementById(
                "collectionBackdrop"
            ),

        collectionSheet:
            document.getElementById(
                "collectionSheet"
            ),

        collectionClose:
            document.getElementById(
                "collectionClose"
            ),

        collectionKicker:
            document.getElementById(
                "collectionKicker"
            ),

        collectionTitle:
            document.getElementById(
                "collectionTitle"
            ),

        collectionMediaName:
            document.getElementById(
                "collectionMediaName"
            ),

        newCollectionName:
            document.getElementById(
                "newCollectionName"
            ),

        createCollectionButton:
            document.getElementById(
                "createCollectionButton"
            ),

        collectionPickerLoading:
            document.getElementById(
                "collectionPickerLoading"
            ),

        collectionPickerEmpty:
            document.getElementById(
                "collectionPickerEmpty"
            ),

        collectionPickerList:
            document.getElementById(
                "collectionPickerList"
            )
    };


    const typeButtons =
        Array.from(
            document.querySelectorAll(
                ".library-stat[data-type]"
            )
        );


    const modeButtons =
        Array.from(
            document.querySelectorAll(
                ".library-mode-button[data-status]"
            )
        );


    let currentUser =
        null;

    let currentCapabilities =
        {};

    let currentType =
        "all";

    let currentStatus =
        "published";

    let currentPage =
        1;

    let currentTotalPages =
        1;

    let currentPageSize =
        MOBILE_QUERY.matches
            ? 12
            : 24;

    let currentPreviewItem =
        null;

    let collectionMedia =
        null;

    let searchTimer =
        null;

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


    function humanError(
        code
    ) {
        const messages = {
            authentication_required:
                "登录状态已经失效",

            active_account_required:
                "当前账户不可用",

            permission_denied:
                "你没有删除媒体的权限",

            media_not_found:
                "找不到这个媒体，或它不属于当前账户",

            media_protected:
                "这个媒体已受保护，不能删除",

            media_not_published:
                "这个媒体当前不在普通媒体库",

            media_not_trashed:
                "这个媒体当前不在回收站",

            media_not_deletable:
                "这个媒体当前不能永久删除",

            media_source_missing:
                "媒体源文件信息不完整",

            media_purge_dispatch_failed:
                "永久删除任务启动失败，媒体没有被删除",

            invalid_media_id:
                "媒体 ID 无效",

            invalid_media_status_filter:
                "媒体状态参数错误",

            invalid_media_type_filter:
                "媒体类型参数错误",

            collection_name_required:
                "请输入分组名称",

            collection_name_exists:
                "已经存在同名分组",

            collection_not_found:
                "找不到这个分组",

            collection_permission_denied:
                "你没有权限管理这个分组",

            collection_media_type_mismatch:
                "媒体类型与分组类型不一致",

            request_failed:
                "请求失败",

            internal_error:
                "系统暂时出现问题"
        };

        return (
            messages[
                code
            ] ||
            code ||
            "操作失败"
        );
    }


    function showToast(
        message
    ) {
        refs.toast.textContent =
            message;

        refs.toast.classList.add(
            "show"
        );

        clearTimeout(
            toastTimer
        );

        toastTimer =
            setTimeout(
                () => {
                    refs.toast.classList.remove(
                        "show"
                    );
                },
                3000
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


    function canDeleteMedia() {
        return Boolean(
            currentCapabilities
                ?.deleteMedia
        );
    }


    function formatBytes(
        bytes
    ) {
        const value =
            Number(
                bytes
            );

        if (
            !Number.isFinite(
                value
            ) ||
            value < 0
        ) {
            return "—";
        }

        if (
            value < 1024
        ) {
            return `${value} B`;
        }

        if (
            value <
            1024 * 1024
        ) {
            return (
                value /
                1024
            )
                .toFixed(
                    1
                ) +
                " KiB";
        }

        return (
            value /
            1024 /
            1024
        )
            .toFixed(
                2
            ) +
            " MiB";
    }


    function formatDate(
        value
    ) {
        if (
            !value
        ) {
            return "—";
        }

        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleString(
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


    function remainingTrashTime(
        value
    ) {
        if (
            !value
        ) {
            return "—";
        }

        const expires =
            new Date(
                value
            )
                .getTime();

        if (
            !Number.isFinite(
                expires
            )
        ) {
            return "—";
        }

        const remaining =
            expires -
            Date.now();

        if (
            remaining <= 0
        ) {
            return "已超过保留期";
        }

        const hours =
            Math.floor(
                remaining /
                3600000
            );

        return (
            `${Math.floor(hours / 24)} 天 ` +
            `${hours % 24} 小时`
        );
    }


    function shortHash(
        value
    ) {
        const text =
            String(
                value ||
                ""
            );

        if (
            !text
        ) {
            return "—";
        }

        if (
            text.length <=
            18
        ) {
            return text;
        }

        return (
            text.slice(
                0,
                10
            ) +
            "…" +
            text.slice(
                -6
            )
        );
    }


    function mediaName(
        item
    ) {
        return (
            item.displayTitle ||
            item.originalName ||
            item.filename ||
            item.mediaId ||
            "未命名媒体"
        );
    }


    async function copyText(
        value,
        success
    ) {
        if (
            !value
        ) {
            showToast(
                "没有可以复制的内容"
            );

            return;
        }

        try {
            await navigator
                .clipboard
                .writeText(
                    value
                );

            showToast(
                success
            );

        } catch {
            showToast(
                "复制失败，请手动复制"
            );
        }
    }


    function renderIdentity() {
        refs.identity.textContent =
            "";

        const link =
            createElement(
                "a",
                "user-chip"
            );

        link.href =
            "/account";

        const displayName =
            currentUser
                ?.displayName ||
            "Jingyan";

        link.append(
            createElement(
                "span",
                "user-avatar",
                Array.from(
                    displayName
                )[0] ||
                "J"
            )
        );

        const copy =
            createElement(
                "span"
            );

        copy.append(
            createElement(
                "strong",
                "",
                displayName
            ),

            createElement(
                "small",
                "",
                currentUser
                    ?.role ===
                    "owner"
                    ? "Owner"
                    : "Member"
            )
        );

        link.append(
            copy
        );

        refs.identity.append(
            link
        );


        if (
            currentUser
                ?.role !==
            "owner"
        ) {
            document
                .querySelectorAll(
                    'a[href="/admin"], a[href="/admin/"]'
                )
                .forEach(
                    element => {
                        element.classList.add(
                            "hidden"
                        );
                    }
                );
        }
    }


    function metaRow(
        label,
        value,
        title = ""
    ) {
        const row =
            createElement(
                "div",
                "media-meta-row"
            );

        row.append(
            createElement(
                "span",
                "",
                label
            )
        );

        const strong =
            createElement(
                "strong",
                "",
                value ||
                "—"
            );

        if (
            title
        ) {
            strong.title =
                title;
        }

        row.append(
            strong
        );

        return row;
    }


    function createBadge(
        text,
        extraClass = ""
    ) {
        return createElement(
            "span",
            `media-badge ${extraClass}`.trim(),
            text
        );
    }


    function lockPage() {
        document.body
            .classList
            .add(
                "sheet-open"
            );
    }


    function unlockPage() {
        if (
            refs.previewSheet
                .classList
                .contains(
                    "hidden"
                ) &&
            refs.collectionSheet
                .classList
                .contains(
                    "hidden"
                )
        ) {
            document.body
                .classList
                .remove(
                    "sheet-open"
                );
        }
    }


    function closePreview() {
        refs.previewSheet
            .classList
            .add(
                "hidden"
            );

        refs.previewBackdrop
            .classList
            .add(
                "hidden"
            );

        refs.previewSheet
            .setAttribute(
                "aria-hidden",
                "true"
            );

        refs.previewStage.textContent =
            "";

        currentPreviewItem =
            null;

        unlockPage();
    }


    function openPreview(
        item
    ) {
        if (
            !item.url
        ) {
            showToast(
                "这个媒体没有可用 CDN 地址"
            );

            return;
        }

        currentPreviewItem =
            item;

        refs.previewTitle.textContent =
            mediaName(
                item
            );

        refs.previewStage.textContent =
            "";

        if (
            item.type ===
            "image"
        ) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                item.url;

            image.alt =
                mediaName(
                    item
                );

            refs.previewStage.append(
                image
            );

        } else if (
            item.type ===
            "video"
        ) {
            const video =
                document.createElement(
                    "video"
                );

            video.src =
                item.url;

            video.controls =
                true;

            video.playsInline =
                true;

            video.preload =
                "metadata";

            refs.previewStage.append(
                video
            );

        } else if (
            item.type ===
            "audio"
        ) {
            const audio =
                document.createElement(
                    "audio"
                );

            audio.src =
                item.url;

            audio.controls =
                true;

            audio.preload =
                "metadata";

            refs.previewStage.append(
                audio
            );
        }

        refs.previewInfo.textContent =
            "";

        refs.previewInfo.append(
            metaRow(
                "Media ID",
                item.mediaId
            ),

            metaRow(
                "类型",
                item.type
            ),

            metaRow(
                "大小",
                formatBytes(
                    item.sizeBytes
                )
            ),

            metaRow(
                "上传者",
                item.uploader
                    ?.displayName ||
                "—"
            )
        );

        refs.previewSheet
            .classList
            .remove(
                "hidden"
            );

        refs.previewBackdrop
            .classList
            .remove(
                "hidden"
            );

        refs.previewSheet
            .setAttribute(
                "aria-hidden",
                "false"
            );

        lockPage();
    }


    function createPreviewThumb(
        item
    ) {
        const wrapper =
            createElement(
                "button",
                `media-thumb ${item.type || "unknown"}`
            );

        wrapper.type =
            "button";

        if (
            item.type ===
                "image" &&
            item.url
        ) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                item.url;

            image.alt =
                mediaName(
                    item
                );

            image.loading =
                "lazy";

            image.decoding =
                "async";

            wrapper.append(
                image
            );

        } else if (
            item.type ===
                "video"
        ) {
            wrapper.append(
                createElement(
                    "span",
                    "media-thumb-fallback",
                    "▶"
                )
            );

        } else {
            wrapper.append(
                createElement(
                    "span",
                    "media-thumb-fallback",
                    item.type ===
                        "audio"
                        ? "♫"
                        : "◆"
                )
            );
        }

        if (
            currentStatus ===
                "published"
        ) {
            wrapper.addEventListener(
                "click",
                () => {
                    openPreview(
                        item
                    );
                }
            );

        } else {
            wrapper.disabled =
                true;
        }

        return wrapper;
    }


    function actionButton(
        text,
        className,
        handler
    ) {
        const button =
            createElement(
                "button",
                className,
                text
            );

        button.type =
            "button";

        button.addEventListener(
            "click",
            handler
        );

        return button;
    }


    async function trashMedia(
        item
    ) {
        if (
            !confirm(
                `把「${mediaName(item)}」移入回收站？\n\n7 天内可以恢复。`
            )
        ) {
            return;
        }

        try {
            await api(
                "/api/library/media",
                {
                    method:
                        "DELETE",

                    body:
                        JSON.stringify({
                            mediaId:
                                item.mediaId
                        })
                }
            );

            showToast(
                "已移入回收站"
            );

            await loadLibrary();

        } catch (
            error
        ) {
            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    async function restoreMedia(
        item
    ) {
        if (
            !confirm(
                `恢复「${mediaName(item)}」？`
            )
        ) {
            return;
        }

        try {
            await api(
                "/api/library/media",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            action:
                                "restore",

                            mediaId:
                                item.mediaId
                        })
                }
            );

            showToast(
                "媒体已恢复"
            );

            await loadLibrary();

        } catch (
            error
        ) {
            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    async function permanentDeleteMedia(
        item
    ) {
        const confirmed =
            confirm(
                `永久删除「${mediaName(item)}」？\n\n` +
                "这会删除媒体记录，并启动 GitHub 源文件与 CDN 清理。\n" +
                "此操作不能恢复。"
            );

        if (
            !confirmed
        ) {
            return;
        }

        const confirmedAgain =
            confirm(
                "最后确认：永久删除后无法从回收站恢复。继续？"
            );

        if (
            !confirmedAgain
        ) {
            return;
        }

        try {
            await api(
                "/api/library/media",
                {
                    method:
                        "DELETE",

                    body:
                        JSON.stringify({
                            mediaId:
                                item.mediaId,

                            permanent:
                                true
                        })
                }
            );

            showToast(
                "已提交永久删除"
            );

            await loadLibrary();

        } catch (
            error
        ) {
            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    function createMediaCard(
        item
    ) {
        const card =
            createElement(
                "article",
                currentStatus ===
                    "trashed"
                    ? "media-card trashed"
                    : "media-card"
            );

        const main =
            createElement(
                "div",
                "media-card-main"
            );

        const content =
            createElement(
                "div",
                "media-card-content"
            );

        const header =
            createElement(
                "div",
                "media-card-header"
            );

        const titleBlock =
            createElement(
                "div",
                "media-title-block"
            );

        const title =
            createElement(
                "h3",
                "media-title",
                mediaName(
                    item
                )
            );

        title.title =
            item.filename ||
            mediaName(
                item
            );

        titleBlock.append(
            title,

            createElement(
                "div",
                "media-id",
                item.mediaId ||
                "未记录 Media ID"
            )
        );

        const badges =
            createElement(
                "div",
                "media-badges"
            );

        badges.append(
            createBadge(
                String(
                    item.type ||
                    "unknown"
                ).toUpperCase()
            )
        );

        if (
            currentStatus ===
                "trashed"
        ) {
            badges.append(
                createBadge(
                    "回收站",
                    "trashed"
                )
            );
        }

        if (
            item.protected
        ) {
            badges.append(
                createBadge(
                    "已保护",
                    "protected"
                )
            );
        }

        header.append(
            titleBlock,
            badges
        );

        const essentials =
            createElement(
                "div",
                "media-essentials"
            );

        essentials.append(
            metaRow(
                "类型",
                item.type
            ),

            metaRow(
                "大小",
                formatBytes(
                    item.sizeBytes
                )
            ),

            metaRow(
                "上传时间",
                formatDate(
                    item.addedAt
                )
            ),

            metaRow(
                "上传者",
                item.uploader
                    ?.displayName ||
                "—"
            )
        );

        if (
            currentStatus ===
                "trashed"
        ) {
            essentials.append(
                metaRow(
                    "删除时间",
                    formatDate(
                        item.trashedAt
                    )
                ),

                metaRow(
                    "剩余",
                    remainingTrashTime(
                        item.trashExpiresAt
                    )
                )
            );
        }

        content.append(
            header,
            essentials
        );

        main.append(
            createPreviewThumb(
                item
            ),
            content
        );

        const actions =
            createElement(
                "div",
                "media-actions"
            );

        if (
            currentStatus ===
                "published"
        ) {
            actions.append(
                actionButton(
                    "预览",
                    "button primary",
                    () => {
                        openPreview(
                            item
                        );
                    }
                ),

                actionButton(
                    "复制 CDN",
                    "button secondary",
                    () => {
                        copyText(
                            item.url,
                            "CDN 链接已复制"
                        );
                    }
                )
            );

            if (
                COLLECTION_META[
                    item.type
                ]
            ) {
                actions.append(
                    actionButton(
                        COLLECTION_META[
                            item.type
                        ].action,
                        "button collection-button",
                        () => {
                            openCollectionPicker(
                                item
                            );
                        }
                    )
                );
            }

            if (
                canDeleteMedia()
            ) {
                actions.append(
                    actionButton(
                        item.protected
                            ? "已保护"
                            : "移入回收站",
                        "button danger",
                        () => {
                            if (
                                !item.protected
                            ) {
                                trashMedia(
                                    item
                                );
                            }
                        }
                    ),

                    actionButton(
                        "立即删除",
                        "button danger",
                        () => {
                            if (
                                !item.protected
                            ) {
                                permanentDeleteMedia(
                                    item
                                );
                            }
                        }
                    )
                );
            }

        } else if (
            canDeleteMedia()
        ) {
            actions.append(
                actionButton(
                    "恢复媒体",
                    "button restore",
                    () => {
                        restoreMedia(
                            item
                        );
                    }
                ),

                actionButton(
                    "立即删除",
                    "button danger",
                    () => {
                        permanentDeleteMedia(
                            item
                        );
                    }
                )
            );
        }

        const details =
            createElement(
                "details",
                "media-details"
            );

        details.append(
            createElement(
                "summary",
                "",
                "高级信息"
            )
        );

        const advanced =
            createElement(
                "div",
                "media-advanced"
            );

        advanced.append(
            metaRow(
                "文件名",
                item.filename ||
                "—",
                item.filename ||
                ""
            ),

            metaRow(
                "原始名称",
                item.originalName ||
                "—",
                item.originalName ||
                ""
            ),

            metaRow(
                "SHA256",
                shortHash(
                    item.sha256
                ),
                item.sha256 ||
                ""
            ),

            metaRow(
                "源仓库",
                item.source
                    ?.repository ||
                "—"
            ),

            metaRow(
                "源分支",
                item.source
                    ?.branch ||
                "—"
            ),

            metaRow(
                "源路径",
                item.source
                    ?.path ||
                "—"
            ),

            metaRow(
                "发布时间",
                formatDate(
                    item.publishedAt
                )
            )
        );

        details.append(
            advanced
        );

        card.append(
            main
        );

        if (
            actions.childElementCount >
            0
        ) {
            card.append(
                actions
            );
        }

        card.append(
            details
        );

        return card;
    }


    function updateButtons() {
        typeButtons
            .forEach(
                button => {
                    button.classList.toggle(
                        "active",
                        button.dataset.type ===
                            currentType
                    );
                }
            );

        modeButtons
            .forEach(
                button => {
                    button.classList.toggle(
                        "active",
                        button.dataset.status ===
                            currentStatus
                    );
                }
            );

        refs.searchInput.placeholder =
            currentStatus ===
                "trashed"
                ? "搜索我的回收站…"
                : "搜索我的文件名、Media ID、SHA256、仓库…";
    }


    function setLoading(
        loading
    ) {
        refs.loading.classList.toggle(
            "hidden",
            !loading
        );

        refs.refresh.disabled =
            loading;
    }


    function renderData(
        data
    ) {
        currentCapabilities =
            data.capabilities ||
            {};

        const summary =
            data.summary ||
            {};

        refs.countAll.textContent =
            String(
                summary.total ||
                0
            );

        refs.countImage.textContent =
            String(
                summary.image ||
                0
            );

        refs.countAudio.textContent =
            String(
                summary.audio ||
                0
            );

        refs.countVideo.textContent =
            String(
                summary.video ||
                0
            );

        refs.manifestUpdated.textContent =
            data.manifest
                ?.lastPublishedAt
                ? `最后发布：${formatDate(data.manifest.lastPublishedAt)}`
                : "媒体索引已连接";

        const query =
            data.query ||
            {};

        currentPage =
            Number(
                query.page
            ) ||
            1;

        currentTotalPages =
            Number(
                query.totalPages
            ) ||
            1;

        const filteredTotal =
            Number(
                query.filteredTotal
            ) ||
            0;

        refs.resultCount.textContent =
            `${filteredTotal} 个结果`;

        refs.grid.textContent =
            "";

        const items =
            Array.isArray(
                data.items
            )
                ? data.items
                : [];

        refs.empty.textContent =
            currentStatus ===
                "trashed"
                ? "你的回收站为空。"
                : "你的媒体库里没有符合条件的内容。";

        refs.empty.classList.toggle(
            "hidden",
            items.length >
                0
        );

        refs.grid.classList.toggle(
            "hidden",
            items.length ===
                0
        );

        items.forEach(
            item => {
                refs.grid.append(
                    createMediaCard(
                        item
                    )
                );
            }
        );

        refs.pagination.classList.toggle(
            "hidden",
            filteredTotal ===
                0
        );

        refs.pageText.textContent =
            `第 ${currentPage} / ${currentTotalPages} 页`;

        refs.previous.disabled =
            currentPage <=
            1;

        refs.next.disabled =
            currentPage >=
            currentTotalPages;
    }


    async function loadLibrary() {
        setLoading(
            true
        );

        try {
            const params =
                new URLSearchParams({
                    status:
                        currentStatus,

                    type:
                        currentType,

                    page:
                        String(
                            currentPage
                        ),

                    pageSize:
                        String(
                            currentPageSize
                        )
                });

            const search =
                refs.searchInput
                    .value
                    .trim();

            if (
                search
            ) {
                params.set(
                    "q",
                    search
                );
            }

            const data =
                await api(
                    `/api/library/media?${params.toString()}`
                );

            renderData(
                data
            );

        } catch (
            error
        ) {
            console.error(
                error
            );

            refs.grid.classList.add(
                "hidden"
            );

            refs.empty.classList.remove(
                "hidden"
            );

            refs.empty.textContent =
                `媒体库读取失败：${humanError(error.code || error.message)}`;

        } finally {
            setLoading(
                false
            );
        }
    }


    function closeCollectionPicker() {
        refs.collectionSheet
            .classList
            .add(
                "hidden"
            );

        refs.collectionBackdrop
            .classList
            .add(
                "hidden"
            );

        refs.collectionSheet
            .setAttribute(
                "aria-hidden",
                "true"
            );

        refs.collectionPickerList.textContent =
            "";

        refs.newCollectionName.value =
            "";

        collectionMedia =
            null;

        unlockPage();
    }


    async function addMediaToCollection(
        collection,
        item,
        button
    ) {
        button.disabled =
            true;

        try {
            const data =
                await api(
                    `/api/collections/${encodeURIComponent(collection.id)}/items`,
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                mediaId:
                                    item.mediaId
                            })
                    }
                );

            button.textContent =
                data.added ===
                    false
                    ? "已在分组中"
                    : "已加入";

            showToast(
                data.added ===
                    false
                    ? `已经在「${collection.name}」中`
                    : `已加入「${collection.name}」`
            );

        } catch (
            error
        ) {
            button.disabled =
                false;

            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    async function loadCollectionPicker(
        item
    ) {
        refs.collectionPickerLoading
            .classList
            .remove(
                "hidden"
            );

        refs.collectionPickerList.textContent =
            "";

        try {
            const data =
                await api(
                    `/api/collections?type=${encodeURIComponent(item.type)}&page=1&pageSize=100`
                );

            const collections =
                Array.isArray(
                    data.collections
                )
                    ? data.collections
                    : [];

            refs.collectionPickerEmpty
                .classList
                .toggle(
                    "hidden",
                    collections.length >
                        0
                );

            collections.forEach(
                collection => {
                    const row =
                        createElement(
                            "div",
                            "collection-picker-item"
                        );

                    const left =
                        createElement(
                            "div",
                            "collection-picker-copy"
                        );

                    left.append(
                        createElement(
                            "span",
                            "collection-picker-icon",
                            COLLECTION_META[
                                item.type
                            ].icon
                        )
                    );

                    const copy =
                        createElement(
                            "span"
                        );

                    copy.append(
                        createElement(
                            "strong",
                            "",
                            collection.name
                        ),

                        createElement(
                            "small",
                            "",
                            `${collection.itemCount || 0} 个媒体`
                        )
                    );

                    left.append(
                        copy
                    );

                    const add =
                        createElement(
                            "button",
                            "collection-picker-add",
                            "加入"
                        );

                    add.type =
                        "button";

                    add.addEventListener(
                        "click",
                        () => {
                            addMediaToCollection(
                                collection,
                                item,
                                add
                            );
                        }
                    );

                    row.append(
                        left,
                        add
                    );

                    refs.collectionPickerList.append(
                        row
                    );
                }
            );

        } catch (
            error
        ) {
            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );

        } finally {
            refs.collectionPickerLoading
                .classList
                .add(
                    "hidden"
                );
        }
    }


    async function openCollectionPicker(
        item
    ) {
        const meta =
            COLLECTION_META[
                item.type
            ];

        if (
            !meta
        ) {
            return;
        }

        collectionMedia =
            item;

        refs.collectionKicker.textContent =
            meta.label.toUpperCase();

        refs.collectionTitle.textContent =
            meta.action;

        refs.collectionMediaName.textContent =
            mediaName(
                item
            );

        refs.newCollectionName.placeholder =
            meta.placeholder;

        refs.collectionSheet
            .classList
            .remove(
                "hidden"
            );

        refs.collectionBackdrop
            .classList
            .remove(
                "hidden"
            );

        refs.collectionSheet
            .setAttribute(
                "aria-hidden",
                "false"
            );

        lockPage();

        await loadCollectionPicker(
            item
        );
    }


    async function createAndAddCollection() {
        if (
            !collectionMedia
        ) {
            return;
        }

        const name =
            refs.newCollectionName
                .value
                .trim();

        if (
            !name
        ) {
            showToast(
                "请输入分组名称"
            );

            return;
        }

        refs.createCollectionButton.disabled =
            true;

        try {
            const created =
                await api(
                    "/api/collections",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                type:
                                    collectionMedia.type,

                                name,

                                visibility:
                                    "members",

                                pinned:
                                    false
                            })
                    }
                );

            await api(
                `/api/collections/${encodeURIComponent(created.collection.id)}/items`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            mediaId:
                                collectionMedia.mediaId
                        })
                }
            );

            refs.newCollectionName.value =
                "";

            showToast(
                `已创建「${created.collection.name}」并加入媒体`
            );

            await loadCollectionPicker(
                collectionMedia
            );

        } catch (
            error
        ) {
            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );

        } finally {
            refs.createCollectionButton.disabled =
                false;
        }
    }


    function bindEvents() {
        typeButtons.forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        currentType =
                            button.dataset.type;

                        currentPage =
                            1;

                        updateButtons();

                        loadLibrary();
                    }
                );
            }
        );


        modeButtons.forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        currentStatus =
                            button.dataset.status;

                        currentPage =
                            1;

                        updateButtons();

                        loadLibrary();
                    }
                );
            }
        );


        refs.searchInput.addEventListener(
            "input",
            () => {
                clearTimeout(
                    searchTimer
                );

                searchTimer =
                    setTimeout(
                        () => {
                            currentPage =
                                1;

                            loadLibrary();
                        },
                        300
                    );
            }
        );


        refs.refresh.addEventListener(
            "click",
            loadLibrary
        );


        refs.pageSize.value =
            String(
                currentPageSize
            );


        refs.pageSize.addEventListener(
            "change",
            () => {
                currentPageSize =
                    Number(
                        refs.pageSize.value
                    ) ||
                    12;

                currentPage =
                    1;

                loadLibrary();
            }
        );


        refs.previous.addEventListener(
            "click",
            async () => {
                if (
                    currentPage <= 1
                ) {
                    return;
                }

                currentPage -=
                    1;

                await loadLibrary();

                refs.toolbar
                    ?.scrollIntoView({
                        block:
                            "start"
                    });
            }
        );


        refs.next.addEventListener(
            "click",
            async () => {
                if (
                    currentPage >=
                    currentTotalPages
                ) {
                    return;
                }

                currentPage +=
                    1;

                await loadLibrary();

                refs.toolbar
                    ?.scrollIntoView({
                        block:
                            "start"
                    });
            }
        );


        refs.previewClose.addEventListener(
            "click",
            closePreview
        );

        refs.previewBackdrop.addEventListener(
            "click",
            closePreview
        );


        refs.previewOpen.addEventListener(
            "click",
            () => {
                if (
                    currentPreviewItem
                        ?.url
                ) {
                    window.open(
                        currentPreviewItem.url,
                        "_blank",
                        "noopener,noreferrer"
                    );
                }
            }
        );


        refs.previewCopy.addEventListener(
            "click",
            () => {
                copyText(
                    currentPreviewItem
                        ?.url,
                    "CDN 链接已复制"
                );
            }
        );


        refs.collectionClose.addEventListener(
            "click",
            closeCollectionPicker
        );

        refs.collectionBackdrop.addEventListener(
            "click",
            closeCollectionPicker
        );


        refs.createCollectionButton.addEventListener(
            "click",
            createAndAddCollection
        );


        refs.newCollectionName.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();

                    createAndAddCollection();
                }
            }
        );


        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                if (
                    !refs.collectionSheet
                        .classList
                        .contains(
                            "hidden"
                        )
                ) {
                    closeCollectionPicker();

                    return;
                }

                if (
                    !refs.previewSheet
                        .classList
                        .contains(
                            "hidden"
                        )
                ) {
                    closePreview();
                }
            }
        );
    }


    async function bootstrap() {
        bindEvents();

        const data =
            await api(
                "/api/auth/me"
            );

        currentUser =
            data.user;

        if (
            !currentUser ||
            currentUser.status !==
                "active"
        ) {
            location.href =
                "/login";

            return;
        }

        renderIdentity();

        updateButtons();

        await loadLibrary();
    }


    bootstrap()
        .catch(
            error => {
                console.error(
                    error
                );

                refs.loading.classList.add(
                    "hidden"
                );

                refs.empty.classList.remove(
                    "hidden"
                );

                refs.empty.textContent =
                    `媒体库初始化失败：${humanError(error.code || error.message)}`;
            }
        );

})();
