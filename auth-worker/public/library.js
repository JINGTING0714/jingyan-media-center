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


    function humanError(
        code
    ) {

        const messages = {

            media_not_found:
                "找不到这个媒体",

            media_protected:
                "媒体已受保护，请先解除保护",

            media_not_published:
                "这个媒体当前不能删除",

            media_not_trashed:
                "这个媒体不在回收站",

            permission_denied:
                "没有执行此操作的权限",

            invalid_media_id:
                "媒体 ID 无效",

            collection_name_required:
                "请输入分组名称",

            collection_name_too_long:
                "分组名称最多 60 个字符",

            collection_name_invalid:
                "分组名称包含不允许的字符",

            collection_name_exists:
                "已经存在同名分组",

            collection_not_found:
                "找不到这个分组",

            collection_permission_denied:
                "你没有权限管理这个分组",

            collection_media_type_mismatch:
                "媒体类型与分组类型不一致",

            active_account_required:
                "当前账户不可用",

            authentication_required:
                "登录状态已经失效",

            invalid_json:
                "请求数据格式错误",

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
                    ...options,

                    credentials:
                        "same-origin",

                    headers
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch {

            data = {};

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
            value <
            0
        ) {

            return "—";

        }


        if (
            value <
            1024
        ) {

            return `${value} B`;

        }


        if (
            value <
            1024 *
            1024
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
            ).getTime();


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
            remaining <=
            0
        ) {

            return "等待永久清理";

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
            "Owner";


        const avatar =
            createElement(
                "span",
                "user-avatar",
                Array.from(
                    displayName
                )[0] ||
                "J"
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
                "Owner"
            )

        );


        link.append(
            avatar,
            copy
        );


        refs.identity.append(
            link
        );

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


        wrapper.title =
            item.type ===
                "image"
                ? "预览图片"
                : item.type ===
                    "video"
                    ? "预览视频"
                    : "播放音频";


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

            if (
                item.url
            ) {

                const video =
                    document.createElement(
                        "video"
                    );


                video.src =
                    item.url;


                video.muted =
                    true;


                video.playsInline =
                    true;


                video.preload =
                    "metadata";


                wrapper.append(
                    video
                );

            }


            wrapper.append(
                createElement(
                    "span",
                    "media-thumb-overlay",
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

                    if (
                        item.type ===
                            "audio"
                    ) {

                        if (
                            item.url
                        ) {

                            window.open(
                                item.url,
                                "_blank",
                                "noopener,noreferrer"
                            );

                        }


                        return;

                    }


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


    function createOpenButton(
        item
    ) {

        const button =
            createElement(
                "button",
                "button primary",
                item.type ===
                    "audio"
                    ? "播放 / 打开"
                    : "预览"
            );


        button.type =
            "button";


        button.disabled =
            !item.url;


        button.addEventListener(
            "click",
            () => {

                if (
                    !item.url
                ) {

                    return;

                }


                if (
                    item.type ===
                    "audio"
                ) {

                    window.open(
                        item.url,
                        "_blank",
                        "noopener,noreferrer"
                    );


                    return;

                }


                openPreview(
                    item
                );

            }
        );


        return button;

    }


    function createCopyButton(
        item
    ) {

        const button =
            createElement(
                "button",
                "button secondary",
                "复制 CDN"
            );


        button.type =
            "button";


        button.disabled =
            !item.url;


        button.addEventListener(
            "click",
            () => {

                copyText(
                    item.url,
                    "CDN 链接已复制"
                );

            }
        );


        return button;

    }


    function createCollectionButton(
        item
    ) {

        const meta =
            COLLECTION_META[
                item.type
            ];


        if (
            !meta
        ) {

            return null;

        }


        const button =
            createElement(
                "button",
                "button collection-button",
                meta.action
            );


        button.type =
            "button";


        button.addEventListener(
            "click",
            () => {

                openCollectionPicker(
                    item
                );

            }
        );


        return button;

    }


    function createTrashButton(
        item
    ) {

        const button =
            createElement(
                "button",
                "button danger",
                item.protected
                    ? "已保护"
                    : "移入回收站"
            );


        button.type =
            "button";


        if (
            item.protected
        ) {

            button.disabled =
                true;


            button.title =
                "请先解除媒体保护";

        } else {

            button.addEventListener(
                "click",
                () => {

                    trashMedia(
                        item
                    );

                }
            );

        }


        return button;

    }


    function createRestoreButton(
        item
    ) {

        const button =
            createElement(
                "button",
                "button restore",
                "恢复媒体"
            );


        button.type =
            "button";


        button.addEventListener(
            "click",
            () => {

                restoreMedia(
                    item
                );

            }
        );


        return button;

    }


    async function trashMedia(
        item
    ) {

        if (
            item.protected
        ) {

            showToast(
                "这个媒体已受保护"
            );


            return;

        }


        const confirmed =
            window.confirm(
                `确定把「${mediaName(item)}」移入回收站吗？\n\n媒体会从普通媒体库隐藏，并保留 7 天。`
            );


        if (
            !confirmed
        ) {

            return;

        }


        try {

            await api(
                "/api/admin/media",
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
                "媒体已移入回收站"
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

        const confirmed =
            window.confirm(
                `确定恢复「${mediaName(item)}」吗？`
            );


        if (
            !confirmed
        ) {

            return;

        }


        try {

            await api(
                "/api/admin/media",
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


        const thumb =
            createPreviewThumb(
                item
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


        const mediaId =
            createElement(
                "div",
                "media-id",
                item.mediaId ||
                "未记录 Media ID"
            );


        titleBlock.append(
            title,
            mediaId
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
            thumb,
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
                createOpenButton(
                    item
                ),

                createCopyButton(
                    item
                )
            );


            const collectionButton =
                createCollectionButton(
                    item
                );


            if (
                collectionButton
            ) {

                actions.append(
                    collectionButton
                );

            }


            actions.append(
                createTrashButton(
                    item
                )
            );

        } else {

            actions.append(
                createRestoreButton(
                    item
                )
            );

        }


        const details =
            createElement(
                "details",
                "media-details"
            );


        const summary =
            createElement(
                "summary",
                "",
                "高级信息"
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
                "—",
                item.source
                    ?.repository ||
                ""
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
                "—",
                item.source
                    ?.path ||
                ""
            ),

            metaRow(
                "CDN Shard",
                item.cdnShard ||
                "—"
            ),

            metaRow(
                "发布时间",
                formatDate(
                    item.publishedAt
                )
            )

        );


        if (
            item.source
                ?.repository &&
            item.source
                ?.path
        ) {

            const sourceCopy =
                createElement(
                    "button",
                    "advanced-copy",
                    "复制源路径"
                );


            sourceCopy.type =
                "button";


            sourceCopy.addEventListener(
                "click",
                () => {

                    copyText(
                        `${item.source.repository}:${item.source.path}`,
                        "源路径已复制"
                    );

                }
            );


            advanced.append(
                sourceCopy
            );

        }


        details.append(
            summary,
            advanced
        );


        card.append(
            main,
            actions,
            details
        );


        return card;

    }


    function updateTypeButtons() {

        for (
            const button
            of typeButtons
        ) {

            button.classList.toggle(
                "active",
                button.dataset.type ===
                    currentType
            );

        }

    }


    function updateModeButtons() {

        for (
            const button
            of modeButtons
        ) {

            button.classList.toggle(
                "active",
                button.dataset.status ===
                    currentStatus
            );

        }


        refs.searchInput.placeholder =
            currentStatus ===
                "trashed"
                ? "搜索回收站中的文件名、Media ID、SHA256、仓库…"
                : "搜索文件名、Media ID、SHA256、仓库…";

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
                : "尚无发布时间";


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
                ? "回收站为空。"
                : "没有找到符合条件的媒体。";


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


        for (
            const item
            of items
        ) {

            refs.grid.append(
                createMediaCard(
                    item
                )
            );

        }


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
                new URLSearchParams();


            params.set(
                "status",
                currentStatus
            );


            params.set(
                "type",
                currentType
            );


            params.set(
                "page",
                String(
                    currentPage
                )
            );


            params.set(
                "pageSize",
                String(
                    currentPageSize
                )
            );


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
                    `/api/admin/media?${params.toString()}`
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


            showToast(
                `媒体库读取失败：${humanError(error.code || error.message)}`
            );

        } finally {

            setLoading(
                false
            );

        }

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


        refs.previewStage
            .textContent =
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


        refs.collectionPickerList
            .textContent =
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


        const oldText =
            button.textContent;


        button.textContent =
            "加入中…";


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


            if (
                data.added ===
                false
            ) {

                button.textContent =
                    "已在分组中";


                button.classList.add(
                    "already-added"
                );


                showToast(
                    `已经在「${collection.name}」中`
                );

            } else {

                button.textContent =
                    "已加入";


                button.classList.add(
                    "already-added"
                );


                showToast(
                    `已加入「${collection.name}」`
                );

            }

        } catch (
            error
        ) {

            button.disabled =
                false;


            button.textContent =
                oldText;


            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );

        }

    }


    function renderCollectionPicker(
        collections,
        item
    ) {

        refs.collectionPickerList
            .textContent =
                "";


        refs.collectionPickerEmpty
            .classList
            .toggle(
                "hidden",
                collections.length >
                    0
            );


        if (
            collections.length ===
            0
        ) {

            return;

        }


        for (
            const collection
            of collections
        ) {

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


            const icon =
                createElement(
                    "span",
                    "collection-picker-icon",
                    COLLECTION_META[
                        item.type
                    ].icon
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
                    `${collection.itemCount || 0} 个媒体 · ${
                        collection.visibility === "private"
                            ? "仅自己"
                            : "成员可见"
                    }`
                )

            );


            left.append(
                icon,
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


            refs.collectionPickerList
                .append(
                    row
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


        refs.collectionPickerEmpty
            .classList
            .add(
                "hidden"
            );


        refs.collectionPickerList
            .textContent =
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


            renderCollectionPicker(
                collections,
                item
            );

        } catch (
            error
        ) {

            showToast(
                `分组读取失败：${humanError(error.code || error.message)}`
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


            refs.newCollectionName
                .focus();


            return;

        }


        refs.createCollectionButton
            .disabled =
                true;


        const oldText =
            refs.createCollectionButton
                .textContent;


        refs.createCollectionButton
            .textContent =
                "创建中…";


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


            const collection =
                created.collection;


            await api(
                `/api/collections/${encodeURIComponent(collection.id)}/items`,
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
                `已创建「${collection.name}」并加入媒体`
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

            refs.createCollectionButton
                .disabled =
                    false;


            refs.createCollectionButton
                .textContent =
                    oldText;

        }

    }


    function scrollToToolbar() {

        refs.toolbar
            ?.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "start"
            });

    }


    function bindEvents() {

        for (
            const button
            of typeButtons
        ) {

            button.addEventListener(
                "click",
                () => {

                    currentType =
                        button.dataset.type;


                    currentPage =
                        1;


                    updateTypeButtons();


                    loadLibrary();

                }
            );

        }


        for (
            const button
            of modeButtons
        ) {

            button.addEventListener(
                "click",
                () => {

                    currentStatus =
                        button.dataset.status;


                    currentPage =
                        1;


                    updateModeButtons();


                    loadLibrary();

                }
            );

        }


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
                        350
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
                    currentPage <=
                    1
                ) {

                    return;

                }


                currentPage -=
                    1;


                await loadLibrary();


                scrollToToolbar();

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


                scrollToToolbar();

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
            currentUser
                ?.role !==
                "owner" ||

            currentUser
                ?.status !==
                "active" ||

            currentUser
                ?.permissions
                ?.manageSystem !==
                true
        ) {

            location.href =
                "/";


            return;

        }


        renderIdentity();


        updateTypeButtons();


        updateModeButtons();


        await loadLibrary();

    }


    bootstrap()
        .catch(
            error => {

                console.error(
                    error
                );


                showToast(
                    `媒体库初始化失败：${humanError(error.code || error.message)}`
                );

            }
        );

})();
