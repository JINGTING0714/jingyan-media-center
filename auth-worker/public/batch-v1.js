(() => {
    "use strict";


    const MAX_FILES =
        20;


    const STAGING_CONCURRENCY =
        3;


    const POLL_INTERVAL_MS =
        4000;


    const RULES = {

        image: {

            extensions: [
                "jpg",
                "jpeg",
                "png",
                "webp",
                "gif"
            ],

            maxBytes:
                15 *
                1024 *
                1024
        },


        audio: {

            extensions: [
                "mp3",
                "wav",
                "flac",
                "aac"
            ],

            maxBytes:
                24 *
                1024 *
                1024
        },


        video: {

            extensions: [
                "mp4",
                "webm"
            ],

            maxBytes:
                24 *
                1024 *
                1024
        }

    };


    const EXTENSION_MAP =
        new Map();


    for (
        const [
            type,
            rule
        ]
        of Object.entries(
            RULES
        )
    ) {

        for (
            const extension
            of rule.extensions
        ) {

            EXTENSION_MAP.set(
                extension,
                type
            );

        }

    }


    const ACTIVE_BATCH_STATUSES =
        new Set([
            "created",
            "staging",
            "ready",
            "queued",
            "processing"
        ]);


    const TERMINAL_ITEM_STATUSES =
        new Set([
            "complete",
            "failed",
            "review",
            "cancelled"
        ]);


    let currentUser =
        null;


    let batch =
        null;


    let fileByItemId =
        new Map();


    let clientErrors =
        new Map();


    let clientStaging =
        new Set();


    let pollRunning =
        false;


    let stageRunning =
        false;


    let startRunning =
        false;


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


    function sleep(
        milliseconds
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );

    }


    function showToast(
        message
    ) {

        const toast =
            document.getElementById(
                "toast"
            );


        if (
            !toast
        ) {

            return;

        }


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
                3000
            );

    }


    async function readResponse(
        response
    ) {

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

            throw new ApiError(
                response.status,
                data.error ||
                "request_failed"
            );

        }


        return data;

    }


    async function apiJson(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    ...options,

                    headers: {

                        ...(
                            options.body
                                ? {
                                    "Content-Type":
                                        "application/json"
                                  }
                                : {}
                        ),

                        ...(
                            options.headers ||
                            {}
                        )

                    }
                }
            );


        return readResponse(
            response
        );

    }


    function extensionOf(
        filename
    ) {

        const index =
            filename.lastIndexOf(
                "."
            );


        if (
            index <=
            0
        ) {

            return "";

        }


        return filename
            .slice(
                index +
                1
            )
            .toLowerCase();

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
            )
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


    function validateFile(
        file
    ) {

        const extension =
            extensionOf(
                file.name
            );


        const type =
            EXTENSION_MAP.get(
                extension
            );


        if (
            !type
        ) {

            throw new Error(
                `不支持的格式：${file.name}`
            );

        }


        const rule =
            RULES[
                type
            ];


        if (
            file.size <=
            0
        ) {

            throw new Error(
                `文件为空：${file.name}`
            );

        }


        if (
            file.size >
            rule.maxBytes
        ) {

            throw new Error(
                `${file.name} 超过 ${formatBytes(rule.maxBytes)} 限制`
            );

        }


        const permission = {

            image:
                "uploadImage",

            audio:
                "uploadAudio",

            video:
                "uploadVideo"

        }[
            type
        ];


        if (
            currentUser &&
            currentUser.permissions &&
            currentUser.permissions[
                permission
            ] !==
            true
        ) {

            throw new Error(
                `当前账号没有 ${type} 上传权限`
            );

        }


        return {
            type,
            extension
        };

    }


    function humanError(
        code
    ) {

        const value =
            String(
                code ||
                "request_failed"
            );


        const messages = {

            request_failed:
                "请求失败，请稍后重试。",

            upload_batch_active_exists:
                "当前账号已经有一个批量任务，请先处理现有批次。",

            upload_batch_files_required:
                "没有收到批量文件信息。",

            upload_batch_file_count_invalid:
                "批量上传一次支持 2～20 个文件。",

            invalid_upload_batch_file:
                "批量文件信息无效。",

            invalid_filename:
                "文件名不符合上传规则。",

            unsupported_media_type:
                "存在不支持的媒体格式。",

            media_too_large:
                "有文件超过允许大小。",

            upload_permission_denied:
                "当前账号没有这种媒体的上传权限。",

            upload_batch_not_found:
                "找不到这个批量任务。",

            upload_batch_not_stageable:
                "这个批次已经不能继续上传临时文件。",

            upload_batch_item_not_found:
                "找不到批次中的文件。",

            upload_batch_item_not_ready:
                "这个文件已经上传过临时存储。",

            upload_batch_item_changed:
                "文件状态已经改变，请刷新后再试。",

            upload_size_mismatch:
                "上传文件大小与创建批次时不一致。",

            upload_body_required:
                "没有收到文件内容。",

            upload_batch_not_ready:
                "还有文件没有完成临时上传。",

            upload_batch_items_not_ready:
                "批次中的文件还没有全部准备完成。",

            upload_batch_start_conflict:
                "这个批次已经开始发布。",

            github_batch_dispatch_failed:
                "GitHub 批量发布任务启动失败，可以稍后再次启动。",

            pipeline_state_not_saved:
                "媒体可能已经处理，但最终状态没有安全保存。请先检查媒体库，不要盲目重传。",

            batch_item_result_missing:
                "媒体流水线没有返回这个文件的最终结果，请先检查媒体库。",

            batch_item_pipeline_failed:
                "这个文件在媒体流水线中处理失败。"

        };


        return (
            messages[
                value
            ] ||
            value
        );

    }


    function isActiveBatch(
        value = batch
    ) {

        return Boolean(
            value &&
            ACTIVE_BATCH_STATUSES.has(
                value.status
            )
        );

    }


    function isTerminalItem(
        item
    ) {

        return TERMINAL_ITEM_STATUSES
            .has(
                item.status
            );

    }


    function statusText(
        item
    ) {

        if (
            clientStaging.has(
                item.id
            )
        ) {

            return "临时上传";

        }


        return {

            created:
                "等待临时上传",

            staged:
                "已暂存",

            queued:
                "GitHub 排队",

            processing:
                "发布中",

            complete:
                "完成",

            failed:
                "失败",

            review:
                "需确认",

            cancelled:
                "已取消"

        }[
            item.status
        ] ||
        item.status;

    }


    function batchStatusText(
        status
    ) {

        return {

            created:
                "准备文件",

            staging:
                "正在临时上传",

            ready:
                "准备启动发布",

            queued:
                "GitHub 已接收整批任务",

            processing:
                "GitHub 正在发布",

            partial:
                "部分完成",

            complete:
                "全部完成",

            failed:
                "批次失败",

            cancelled:
                "已取消"

        }[
            status
        ] ||
        status;

    }


    function getPanel() {

        return document.getElementById(
            "batchV1Panel"
        );

    }


    function ensurePanel() {

        let panel =
            getPanel();


        if (
            panel
        ) {

            return panel;

        }


        const queueList =
            document.getElementById(
                "queueList"
            );


        if (
            !queueList
        ) {

            return null;

        }


        panel =
            createElement(
                "div",
                "batch-v1 hidden"
            );


        panel.id =
            "batchV1Panel";


        queueList
            .parentNode
            .insertBefore(
                panel,
                queueList
            );


        return panel;

    }


    function refreshHistory() {

        const button =
            document.getElementById(
                "refreshHistory"
            );


        if (
            button
        ) {

            button.click();

        }

    }


    function batchAgeText() {

        if (
            !batch
        ) {

            return "";

        }


        const start =
            Number(
                batch.startedAt ||
                batch.createdAt ||
                0
            );


        if (
            !start
        ) {

            return "";

        }


        const seconds =
            Math.max(
                0,
                Math.floor(
                    Date.now() /
                    1000 -
                    start
                )
            );


        if (
            seconds <
            60
        ) {

            return `${seconds} 秒`;

        }


        if (
            seconds <
            3600
        ) {

            return `${Math.floor(seconds / 60)} 分钟`;

        }


        return `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`;

    }


    function getMissingItems() {

        if (
            !batch
        ) {

            return [];

        }


        return (
            batch.items ||
            []
        )
            .filter(
                item =>
                    item.status ===
                    "created"
            );

    }


    function availableMissingFiles() {

        return getMissingItems()
            .filter(
                item =>
                    fileByItemId.has(
                        item.id
                    )
            );

    }


    function calculateProgress() {

        if (
            !batch ||
            !batch.totalCount
        ) {

            return 0;

        }


        if (
            [
                "complete",
                "partial",
                "failed",
                "cancelled"
            ].includes(
                batch.status
            )
        ) {

            return 100;

        }


        const total =
            Number(
                batch.totalCount
            );


        const terminal =
            (
                batch.items ||
                []
            )
                .filter(
                    isTerminalItem
                )
                .length;


        if (
            [
                "created",
                "staging",
                "ready"
            ].includes(
                batch.status
            )
        ) {

            return Math.min(
                35,

                (
                    Number(
                        batch.stagedCount ||
                        0
                    ) /
                    total
                ) *
                35
            );

        }


        return Math.min(
            99,

            35 +
            (
                terminal /
                total
            ) *
            65
        );

    }


    function batchNotice() {

        if (
            !batch
        ) {

            return "";

        }


        const missing =
            getMissingItems();


        if (
            missing.length >
            0 &&
            availableMissingFiles().length ===
            0
        ) {

            return `这个批次还有 ${missing.length} 个文件没有进入临时存储。如果刚刚刷新了页面，请重新选择原批次文件，系统会自动匹配并继续，不会重新创建批次。`;

        }


        if (
            batch.status ===
            "queued"
        ) {

            const age =
                batchAgeText();


            return `整个批次只对应 1 个 GitHub Workflow。当前已等待 ${age || "0 秒"}。`;

        }


        if (
            batch.status ===
            "processing"
        ) {

            return "GitHub 正在逐个处理这一批文件。单个文件失败不会让整批文件重新上传。";

        }


        if (
            batch.status ===
            "partial"
        ) {

            return "这一批已经结束，但部分文件需要检查。成功的文件不会受到影响。";

        }


        if (
            Number(
                batch.reviewCount ||
                0
            ) >
            0
        ) {

            return "存在“需确认”文件。此类状态可能已经写入媒体仓，请先到媒体库搜索，不要直接重复上传。";

        }


        return "";

    }


    function renderPanel() {

        const panel =
            ensurePanel();


        if (
            !panel
        ) {

            return;

        }


        if (
            !batch
        ) {

            panel.classList.add(
                "hidden"
            );


            return;

        }


        const queueEmpty =
            document.getElementById(
                "queueEmpty"
            );


        if (
            queueEmpty
        ) {

            queueEmpty.classList.add(
                "hidden"
            );

        }


        panel.classList.remove(
            "hidden"
        );


        panel.textContent =
            "";


        const items =
            batch.items ||
            [];


        const complete =
            items.filter(
                item =>
                    item.status ===
                    "complete"
            ).length;


        const failed =
            items.filter(
                item =>
                    item.status ===
                    "failed"
            ).length;


        const review =
            items.filter(
                item =>
                    item.status ===
                    "review"
            ).length;


        const terminal =
            items.filter(
                isTerminalItem
            ).length;


        const processing =
            items.filter(
                item =>
                    item.status ===
                        "processing" ||
                    item.status ===
                        "queued"
            ).length;


        const waiting =
            items.filter(
                item =>
                    item.status ===
                        "created" ||
                    item.status ===
                        "staged"
            ).length;


        const head =
            createElement(
                "div",
                "batch-v1-head"
            );


        const title =
            createElement(
                "div"
            );


        title.append(

            createElement(
                "h3",
                "",
                "批量上传 V2"
            ),

            createElement(
                "p",
                "",
                `最多 ${MAX_FILES} 个文件 · 临时上传并发 ${STAGING_CONCURRENCY} · 整批只启动 1 个 GitHub Workflow`
            )

        );


        head.append(

            title,

            createElement(
                "div",
                "batch-v1-count",
                `${terminal} / ${batch.totalCount}`
            )

        );


        const statusLine =
            createElement(
                "div",
                "batch-v1-stage"
            );


        statusLine.append(

            createElement(
                "strong",
                "",
                batchStatusText(
                    batch.status
                )
            ),

            createElement(
                "span",
                "",
                `Batch ${batch.id}`
            )

        );


        const progress =
            createElement(
                "div",
                "batch-v1-progress"
            );


        const progressBar =
            createElement(
                "div",
                "batch-v1-progress-bar"
            );


        progressBar.style.width =
            `${calculateProgress()}%`;


        progress.append(
            progressBar
        );


        const stats =
            createElement(
                "div",
                "batch-v1-stats"
            );


        stats.append(

            createElement(
                "span",
                "batch-v1-stat success",
                `✓ 成功 ${complete}`
            ),

            createElement(
                "span",
                "batch-v1-stat",
                `● 处理中 ${processing}`
            ),

            createElement(
                "span",
                "batch-v1-stat",
                `○ 准备 ${waiting}`
            ),

            createElement(
                "span",
                "batch-v1-stat failed",
                `! 失败 ${failed}`
            ),

            createElement(
                "span",
                "batch-v1-stat review",
                `? 需确认 ${review}`
            )

        );


        const noticeText =
            batchNotice();


        let notice =
            null;


        if (
            noticeText
        ) {

            notice =
                createElement(
                    "div",
                    "batch-v1-notice",
                    noticeText
                );

        }


        const actions =
            createElement(
                "div",
                "batch-v1-actions"
            );


        const missing =
            getMissingItems();


        if (
            missing.length >
            0
        ) {

            const retryable =
                availableMissingFiles();


            const retry =
                createElement(
                    "button",
                    "primary",
                    "继续临时上传"
                );


            retry.type =
                "button";


            retry.disabled =
                retryable.length ===
                    0 ||
                stageRunning;


            retry.addEventListener(
                "click",
                () => {

                    stageAvailableFiles()
                        .catch(
                            error => {

                                showToast(
                                    humanError(
                                        error.code ||
                                        error.message
                                    )
                                );

                            }
                        );

                }
            );


            const choose =
                createElement(
                    "button",
                    "",
                    "重新选择缺失文件"
                );


            choose.type =
                "button";


            choose.disabled =
                stageRunning;


            choose.addEventListener(
                "click",
                () => {

                    const fileInput =
                        document.getElementById(
                            "fileInput"
                        );


                    fileInput?.click();

                }
            );


            actions.append(
                retry,
                choose
            );

        }


        if (
            batch.status ===
            "ready"
        ) {

            const start =
                createElement(
                    "button",
                    "primary",
                    "启动整批发布"
                );


            start.type =
                "button";


            start.disabled =
                startRunning;


            start.addEventListener(
                "click",
                () => {

                    startBatchPublishing()
                        .catch(
                            error => {

                                showToast(
                                    humanError(
                                        error.code ||
                                        error.message
                                    )
                                );

                            }
                        );

                }
            );


            actions.append(
                start
            );

        }


        if (
            batch.githubRunUrl
        ) {

            const githubLink =
                createElement(
                    "a",
                    "batch-v1-link",
                    "查看 GitHub Workflow"
                );


            githubLink.href =
                batch.githubRunUrl;


            githubLink.target =
                "_blank";


            githubLink.rel =
                "noopener noreferrer";


            actions.append(
                githubLink
            );

        }


        const list =
            createElement(
                "div",
                "batch-v1-list"
            );


        for (
            const item
            of items
        ) {

            const itemElement =
                createElement(
                    "div",
                    "batch-v1-item"
                );


            const file =
                createElement(
                    "div",
                    "batch-v1-file"
                );


            file.append(
                createElement(
                    "div",
                    "batch-v1-name",
                    item.originalName
                )
            );


            const meta =
                createElement(
                    "div",
                    "batch-v1-meta"
                );


            meta.append(

                createElement(
                    "span",
                    "",
                    item.mediaType
                ),

                createElement(
                    "span",
                    "",
                    formatBytes(
                        item.sizeBytes
                    )
                )

            );


            if (
                item.mediaId
            ) {

                meta.append(
                    createElement(
                        "span",
                        "",
                        item.mediaId
                    )
                );

            }


            file.append(
                meta
            );


            const right =
                createElement(
                    "div",
                    "batch-v1-right"
                );


            const visualStatus =
                clientStaging.has(
                    item.id
                )
                    ? "staging"
                    : item.status;


            right.append(
                createElement(
                    "span",
                    `batch-v1-status ${visualStatus}`,
                    statusText(
                        item
                    )
                )
            );


            if (
                item.status ===
                    "complete" &&
                item.cdnUrl
            ) {

                const copy =
                    createElement(
                        "button",
                        "batch-v1-copy",
                        "复制 CDN"
                    );


                copy.type =
                    "button";


                copy.addEventListener(
                    "click",
                    async () => {

                        try {

                            await navigator
                                .clipboard
                                .writeText(
                                    item.cdnUrl
                                );


                            showToast(
                                "CDN 链接已复制"
                            );

                        } catch {

                            showToast(
                                "复制失败"
                            );

                        }

                    }
                );


                right.append(
                    copy
                );

            }


            itemElement.append(
                file,
                right
            );


            const error =
                clientErrors.get(
                    item.id
                ) ||
                item.error;


            if (
                error
            ) {

                itemElement.append(
                    createElement(
                        "div",
                        item.status ===
                            "review"
                            ? "batch-v1-error review"
                            : "batch-v1-error",
                        humanError(
                            error
                        )
                    )
                );

            }


            list.append(
                itemElement
            );

        }


        panel.append(
            head,
            statusLine,
            progress,
            stats
        );


        if (
            notice
        ) {

            panel.append(
                notice
            );

        }


        if (
            actions.children.length >
            0
        ) {

            panel.append(
                actions
            );

        }


        panel.append(
            list
        );

    }


    async function ensureUser() {

        if (
            currentUser
        ) {

            return true;

        }


        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "same-origin"
                    }
                );


            if (
                !response.ok
            ) {

                return false;

            }


            const data =
                await response.json();


            currentUser =
                data.user ||
                null;


            return Boolean(
                currentUser
            );

        } catch {

            return false;

        }

    }


    async function createServerBatch(
        files
    ) {

        const response =
            await apiJson(
                "/api/upload-batches",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            files:
                                files.map(
                                    file => ({
                                        originalName:
                                            file.name,

                                        sizeBytes:
                                            file.size,

                                        contentType:
                                            file.type ||
                                            "application/octet-stream"
                                    })
                                )
                        })
                }
            );


        return response.batch;

    }


    async function getCurrentBatch() {

        const response =
            await apiJson(
                "/api/upload-batches/current"
            );


        return (
            response.batch ||
            null
        );

    }


    async function getBatch(
        batchId
    ) {

        const response =
            await apiJson(
                `/api/upload-batches/${encodeURIComponent(batchId)}`
            );


        return response.batch;

    }


    async function refreshBatch() {

        if (
            !batch
        ) {

            return null;

        }


        batch =
            await getBatch(
                batch.id
            );


        renderPanel();


        return batch;

    }


    async function stageItem(
        item,
        file
    ) {

        clientErrors.delete(
            item.id
        );


        clientStaging.add(
            item.id
        );


        renderPanel();


        try {

            const response =
                await fetch(
                    `/api/upload-batches/${encodeURIComponent(batch.id)}/items/${encodeURIComponent(item.id)}/content`,
                    {
                        method:
                            "PUT",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/octet-stream"
                        },

                        body:
                            file
                    }
                );


            await readResponse(
                response
            );


            item.status =
                "staged";


            clientErrors.delete(
                item.id
            );

        } catch (
            error
        ) {

            clientErrors.set(
                item.id,
                error.code ||
                error.message ||
                "request_failed"
            );


            throw error;

        } finally {

            clientStaging.delete(
                item.id
            );


            renderPanel();

        }

    }


    async function stageAvailableFiles() {

        if (
            stageRunning ||
            !batch
        ) {

            return;

        }


        const pending =
            getMissingItems()
                .filter(
                    item =>
                        fileByItemId.has(
                            item.id
                        )
                );


        if (
            pending.length ===
            0
        ) {

            renderPanel();


            return;

        }


        stageRunning =
            true;


        renderPanel();


        let cursor =
            0;


        const workers =
            new Array(
                Math.min(
                    STAGING_CONCURRENCY,
                    pending.length
                )
            )
                .fill(
                    null
                )
                .map(
                    async () => {

                        while (
                            true
                        ) {

                            const index =
                                cursor;


                            cursor +=
                                1;


                            if (
                                index >=
                                pending.length
                            ) {

                                return;

                            }


                            const item =
                                pending[
                                    index
                                ];


                            const file =
                                fileByItemId.get(
                                    item.id
                                );


                            try {

                                await stageItem(
                                    item,
                                    file
                                );

                            } catch (
                                error
                            ) {

                                console.error(
                                    "Batch staging failed:",
                                    item.originalName,
                                    error
                                );

                            }

                        }

                    }
                );


        try {

            await Promise.all(
                workers
            );


            await refreshBatch();


            if (
                batch?.status ===
                "ready"
            ) {

                await startBatchPublishing();

            }

        } finally {

            stageRunning =
                false;


            renderPanel();

        }

    }


    async function startBatchPublishing() {

        if (
            startRunning ||
            !batch ||
            batch.status !==
                "ready"
        ) {

            return;

        }


        startRunning =
            true;


        clientErrors.delete(
            "__batch__"
        );


        renderPanel();


        try {

            const response =
                await apiJson(
                    `/api/upload-batches/${encodeURIComponent(batch.id)}/start`,
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({})
                    }
                );


            batch = {
                ...batch,
                ...response.batch
            };


            await refreshBatch();


            showToast(
                `整批 ${batch.totalCount} 个文件已交给 GitHub`
            );


            pollBatch()
                .catch(
                    error => {

                        console.error(
                            "Batch polling failed:",
                            error
                        );

                    }
                );

        } catch (
            error
        ) {

            clientErrors.set(
                "__batch__",
                error.code ||
                error.message ||
                "github_batch_dispatch_failed"
            );


            try {

                await refreshBatch();

            } catch {

                // 保留当前 UI 状态。

            }


            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );

        } finally {

            startRunning =
                false;


            renderPanel();

        }

    }


    function terminalBatch(
        value = batch
    ) {

        return Boolean(
            value &&
            [
                "complete",
                "partial",
                "failed",
                "cancelled"
            ].includes(
                value.status
            )
        );

    }


    async function pollBatch() {

        if (
            pollRunning ||
            !batch
        ) {

            return;

        }


        pollRunning =
            true;


        try {

            while (
                batch &&
                [
                    "ready",
                    "queued",
                    "processing"
                ].includes(
                    batch.status
                )
            ) {

                if (
                    batch.status ===
                    "ready"
                ) {

                    await startBatchPublishing();


                    if (
                        batch.status ===
                        "ready"
                    ) {

                        return;

                    }

                }


                await sleep(
                    POLL_INTERVAL_MS
                );


                await refreshBatch();


                if (
                    terminalBatch()
                ) {

                    break;

                }

            }


            if (
                terminalBatch()
            ) {

                const complete =
                    (
                        batch.items ||
                        []
                    )
                        .filter(
                            item =>
                                item.status ===
                                "complete"
                        )
                        .length;


                const review =
                    (
                        batch.items ||
                        []
                    )
                        .filter(
                            item =>
                                item.status ===
                                "review"
                        )
                        .length;


                const failed =
                    (
                        batch.items ||
                        []
                    )
                        .filter(
                            item =>
                                item.status ===
                                "failed"
                        )
                        .length;


                showToast(
                    `批量上传结束：${complete} 成功，${failed} 失败，${review} 需确认`
                );


                refreshHistory();

            }

        } catch (
            error
        ) {

            console.error(
                "Batch poll error:",
                error
            );


            showToast(
                "批量状态读取失败，系统会在刷新页面后继续恢复。"
            );

        } finally {

            pollRunning =
                false;


            renderPanel();

        }

    }


    function assignInitialFiles(
        serverBatch,
        selected
    ) {

        fileByItemId =
            new Map();


        const items =
            [...(
                serverBatch.items ||
                []
            )]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        Number(
                            a.position
                        ) -
                        Number(
                            b.position
                        )
                );


        for (
            let index = 0;
            index <
            items.length;
            index +=
            1
        ) {

            const item =
                items[
                    index
                ];


            const file =
                selected[
                    index
                ];


            if (
                !file
            ) {

                continue;

            }


            fileByItemId.set(
                item.id,
                file
            );

        }

    }


    function matchRecoveryFiles(
        selected
    ) {

        if (
            !batch
        ) {

            return 0;

        }


        const missing =
            getMissingItems();


        const used =
            new Set();


        let matched =
            0;


        for (
            const file
            of selected
        ) {

            let target =
                null;


            for (
                const item
                of missing
            ) {

                if (
                    used.has(
                        item.id
                    )
                ) {

                    continue;

                }


                if (
                    item.originalName ===
                        file.name &&

                    Number(
                        item.sizeBytes
                    ) ===
                        Number(
                            file.size
                        )
                ) {

                    target =
                        item;


                    break;

                }

            }


            if (
                target
            ) {

                used.add(
                    target.id
                );


                fileByItemId.set(
                    target.id,
                    file
                );


                clientErrors.delete(
                    target.id
                );


                matched +=
                    1;


                continue;

            }


            /*
             * 如果用户重新选择的是整个原批次，
             * 已经 staged 的文件可以直接忽略。
             */
            const alreadyKnown =
                (
                    batch.items ||
                    []
                )
                    .some(
                        item =>
                            item.status !==
                                "created" &&

                            item.originalName ===
                                file.name &&

                            Number(
                                item.sizeBytes
                            ) ===
                                Number(
                                    file.size
                                )
                    );


            if (
                alreadyKnown
            ) {

                continue;

            }


            throw new Error(
                `文件不属于当前缺失批次：${file.name}`
            );

        }


        return matched;

    }


    async function startNewBatch(
        files
    ) {

        if (
            !await ensureUser()
        ) {

            showToast(
                "请先完成登录。"
            );


            return;

        }


        if (
            isActiveBatch()
        ) {

            showToast(
                "已有批量任务正在处理。"
            );


            return;

        }


        const selected =
            Array.from(
                files
            );


        if (
            selected.length <
            2
        ) {

            return;

        }


        if (
            selected.length >
            MAX_FILES
        ) {

            showToast(
                `一次最多选择 ${MAX_FILES} 个文件。`
            );


            return;

        }


        for (
            const file
            of selected
        ) {

            validateFile(
                file
            );

        }


        batch =
            await createServerBatch(
                selected
            );


        clientErrors =
            new Map();


        clientStaging =
            new Set();


        assignInitialFiles(
            batch,
            selected
        );


        renderPanel();


        showToast(
            `已创建 ${batch.totalCount} 个文件的批次`
        );


        await stageAvailableFiles();

    }


    async function resumeMissingFiles(
        files
    ) {

        const selected =
            Array.from(
                files
            );


        if (
            selected.length ===
            0
        ) {

            return;

        }


        for (
            const file
            of selected
        ) {

            validateFile(
                file
            );

        }


        const matched =
            matchRecoveryFiles(
                selected
            );


        if (
            matched ===
            0
        ) {

            showToast(
                "没有找到需要恢复的文件。"
            );


            return;

        }


        showToast(
            `已匹配 ${matched} 个缺失文件`
        );


        renderPanel();


        await stageAvailableFiles();

    }


    function shouldInterceptSelection(
        files
    ) {

        const selected =
            Array.from(
                files ||
                []
            );


        /*
         * 当前存在 Batch 时，
         * 不允许单文件上传插入正在运行的批次。
         *
         * 如果 Batch 缺文件，则选择文件操作
         * 用于恢复这个 Batch。
         */
        if (
            isActiveBatch()
        ) {

            return selected.length >
                0;

        }


        /*
         * 一个文件仍然交给原 app.js。
         */
        return selected.length >
            1;

    }


    async function handleInterceptedFiles(
        files
    ) {

        const selected =
            Array.from(
                files ||
                []
            );


        if (
            selected.length ===
            0
        ) {

            return;

        }


        try {

            if (
                isActiveBatch()
            ) {

                const missing =
                    getMissingItems();


                if (
                    missing.length ===
                    0
                ) {

                    showToast(
                        "当前批量任务还在处理中，请等待结束后再上传新的文件。"
                    );


                    return;

                }


                await resumeMissingFiles(
                    selected
                );


                return;

            }


            await startNewBatch(
                selected
            );

        } catch (
            error
        ) {

            console.error(
                "Batch V2 error:",
                error
            );


            showToast(
                humanError(
                    error.code ||
                    error.message
                )
            );

        }

    }


    async function restoreBatch() {

        if (
            !await ensureUser()
        ) {

            return;

        }


        try {

            const current =
                await getCurrentBatch();


            if (
                !current
            ) {

                batch =
                    null;


                renderPanel();


                return;

            }


            batch =
                current;


            fileByItemId =
                new Map();


            clientErrors =
                new Map();


            clientStaging =
                new Set();


            renderPanel();


            if (
                batch.status ===
                "ready"
            ) {

                await startBatchPublishing();


                return;

            }


            if (
                [
                    "queued",
                    "processing"
                ].includes(
                    batch.status
                )
            ) {

                pollBatch()
                    .catch(
                        error => {

                            console.error(
                                error
                            );

                        }
                    );

            }

        } catch (
            error
        ) {

            console.error(
                "Unable to restore Batch V2:",
                error
            );

        }

    }


    function installInterceptors() {

        const fileInput =
            document.getElementById(
                "fileInput"
            );


        const dropZone =
            document.getElementById(
                "dropZone"
            );


        if (
            fileInput
        ) {

            fileInput.addEventListener(
                "change",
                event => {

                    const files =
                        Array.from(
                            event.target.files ||
                            []
                        );


                    if (
                        !shouldInterceptSelection(
                            files
                        )
                    ) {

                        return;

                    }


                    event.preventDefault();


                    event.stopImmediatePropagation();


                    fileInput.value =
                        "";


                    handleInterceptedFiles(
                        files
                    );

                },
                true
            );

        }


        if (
            dropZone
        ) {

            dropZone.addEventListener(
                "drop",
                event => {

                    const files =
                        Array.from(
                            event.dataTransfer
                                ?.files ||
                            []
                        );


                    if (
                        !shouldInterceptSelection(
                            files
                        )
                    ) {

                        return;

                    }


                    event.preventDefault();


                    event.stopImmediatePropagation();


                    dropZone.classList.remove(
                        "dragging"
                    );


                    handleInterceptedFiles(
                        files
                    );

                },
                true
            );

        }

    }


    async function init() {

        ensurePanel();


        await ensureUser();


        await restoreBatch();


        installInterceptors();

    }


    window.addEventListener(
        "load",
        () => {

            init()
                .catch(
                    error => {

                        console.error(
                            "Batch V2 init failed:",
                            error
                        );

                    }
                );

        }
    );

})();
