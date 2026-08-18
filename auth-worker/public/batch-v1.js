(() => {
    "use strict";


    const MAX_FILES =
        20;

    /*
     * 同时最多有 3 个任务进入 GitHub 流水线。
     *
     * GitHub Workflow 本身使用 concurrency
     * 做真正串行发布，因此这里的 3 指的是：
     *
     * 1 个执行
     * +
     * 最多 2 个等待
     *
     * 而不是同时修改 Registry。
     */
    const MAX_IN_FLIGHT =
        3;


    const CREATE_BURST =
        8;

    const CREATE_WINDOW_MS =
        61000;

    const POLL_INTERVAL_MS =
        4000;

    const TASK_TIMEOUT_MS =
        40 *
        60 *
        1000;


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


    let currentUser =
        null;

    let batch =
        null;

    let schedulerRunning =
        false;

    let paused =
        false;

    let createTimestamps =
        [];

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
                `没有 ${type} 上传权限`
            );

        }


        return {
            type,
            extension
        };

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


    async function createJob(
        task
    ) {

        const response =
            await fetch(
                "/api/uploads",
                {
                    method:
                        "POST",

                    credentials:
                        "same-origin",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            originalName:
                                task.file.name,

                            sizeBytes:
                                task.file.size,

                            contentType:
                                task.file.type ||
                                "application/octet-stream"
                        })
                }
            );


        const data =
            await readResponse(
                response
            );


        return data.job;

    }


    async function sendContent(
        task,
        job
    ) {

        const response =
            await fetch(
                `/api/uploads/${encodeURIComponent(job.id)}/content`,
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
                        task.file
                }
            );


        const data =
            await readResponse(
                response
            );


        return data.job;

    }


    async function getJob(
        jobId
    ) {

        const response =
            await fetch(
                `/api/uploads/${encodeURIComponent(jobId)}`,
                {
                    credentials:
                        "same-origin"
                }
            );


        const data =
            await readResponse(
                response
            );


        return data.job;

    }


    function isUnsafeRetryCode(
        code
    ) {

        const value =
            String(
                code ||
                ""
            )
                .toLowerCase();


        return (
            value.includes(
                "pipeline_state_not_saved"
            ) ||

            value.includes(
                "duplicate"
            )
        );

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

            upload_rate_limited:
                "上传频率达到安全上限，将自动等待后重试。",

            unsupported_media_type:
                "不支持这种媒体格式。",

            media_too_large:
                "文件超过允许大小。",

            upload_permission_denied:
                "当前账号没有这种媒体的上传权限。",

            pipeline_state_not_saved:
                "媒体处理可能已经完成，但 Pipeline 状态提交发生冲突。请先到媒体库确认，不要直接重试。",

            pipeline_failed:
                "GitHub 媒体流水线失败。",

            request_failed:
                "请求失败。"

        };


        if (
            value
                .toLowerCase()
                .includes(
                    "duplicate"
                )
        ) {

            return "检测到重复媒体。请到媒体库搜索原文件，不要重复上传。";

        }


        return (
            messages[
                value
            ] ||
            value
        );

    }


    function statusText(
        status
    ) {

        return {

            pending:
                "等待",

            waiting_limit:
                "安全排队",

            creating:
                "创建任务",

            staging:
                "临时上传",

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
            status
        ] ||
        status;

    }


    function isSettled(
        task
    ) {

        return [
            "complete",
            "failed",
            "review",
            "cancelled"
        ].includes(
            task.status
        );

    }


    function statusNote(
        task
    ) {

        if (
            task.status !==
            "queued" ||
            !task.queuedAt
        ) {

            return "";

        }


        const seconds =
            Math.max(
                0,
                Math.floor(
                    (
                        Date.now() -
                        task.queuedAt
                    ) /
                    1000
                )
            );


        if (
            seconds <
            60
        ) {

            return `已排队 ${seconds} 秒`;

        }


        return `已排队 ${Math.floor(seconds / 60)} 分钟`;

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


    function renderPanel() {

        const panel =
            ensurePanel();


        if (
            !panel ||
            !batch
        ) {

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


        const settled =
            batch.tasks.filter(
                isSettled
            ).length;


        const complete =
            batch.tasks.filter(
                task =>
                    task.status ===
                    "complete"
            ).length;


        const failed =
            batch.tasks.filter(
                task =>
                    task.status ===
                    "failed"
            ).length;


        const review =
            batch.tasks.filter(
                task =>
                    task.status ===
                    "review"
            ).length;


        const waiting =
            batch.tasks.filter(
                task =>
                    [
                        "pending",
                        "waiting_limit"
                    ].includes(
                        task.status
                    )
            ).length;


        const active =
            batch.tasks.filter(
                task =>
                    [
                        "creating",
                        "staging",
                        "queued",
                        "processing"
                    ].includes(
                        task.status
                    )
            ).length;


        const progress =
            batch.tasks.length
                ? (
                    settled /
                    batch.tasks.length
                ) *
                100

                : 0;


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
                "批量上传"
            ),

            createElement(
                "p",
                "",
                `最多 ${MAX_FILES} 个文件 · 同时跟踪 ${MAX_IN_FLIGHT} 个 · GitHub 发布严格串行`
            )
        );


        head.append(
            title,

            createElement(
                "div",
                "batch-v1-count",
                `${settled} / ${batch.tasks.length}`
            )
        );


        const progressWrap =
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
            `${progress}%`;


        progressWrap.append(
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
                `● 处理中 ${active}`
            ),

            createElement(
                "span",
                "batch-v1-stat",
                `○ 等待 ${waiting}`
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


        const actions =
            createElement(
                "div",
                "batch-v1-actions"
            );


        const pauseButton =
            createElement(
                "button",
                "primary",
                paused
                    ? "继续新任务"
                    : "暂停新任务"
            );


        pauseButton.type =
            "button";

        pauseButton.disabled =
            !batch.active;


        pauseButton.addEventListener(
            "click",
            () => {

                paused =
                    !paused;


                renderPanel();

            }
        );


        const cancelButton =
            createElement(
                "button",
                "danger",
                "取消等待任务"
            );


        cancelButton.type =
            "button";

        cancelButton.disabled =
            waiting ===
            0;


        cancelButton.addEventListener(
            "click",
            () => {

                for (
                    const task
                    of batch.tasks
                ) {

                    if (
                        [
                            "pending",
                            "waiting_limit"
                        ].includes(
                            task.status
                        )
                    ) {

                        task.status =
                            "cancelled";

                    }

                }


                renderPanel();

            }
        );


        const retryable =
            batch.tasks.filter(
                task =>
                    task.status ===
                        "failed" &&
                    task.retryable ===
                        true
            );


        const retryButton =
            createElement(
                "button",
                "",
                "重试安全失败"
            );


        retryButton.type =
            "button";

        retryButton.disabled =
            retryable.length ===
            0;


        retryButton.addEventListener(
            "click",
            () => {

                for (
                    const task
                    of retryable
                ) {

                    task.status =
                        "pending";

                    task.error =
                        "";

                    task.errorCode =
                        "";

                    task.jobId =
                        null;

                    task.cdnUrl =
                        null;

                    task.queuedAt =
                        null;

                }


                batch.active =
                    true;

                paused =
                    false;


                renderPanel();


                runScheduler();

            }
        );


        actions.append(
            pauseButton,
            cancelButton,
            retryButton
        );


        const list =
            createElement(
                "div",
                "batch-v1-list"
            );


        for (
            const task
            of batch.tasks
        ) {

            const item =
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
                    task.file.name
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
                    task.type
                ),

                createElement(
                    "span",
                    "",
                    formatBytes(
                        task.file.size
                    )
                )
            );


            const note =
                statusNote(
                    task
                );


            if (
                note
            ) {

                meta.append(
                    createElement(
                        "span",
                        "",
                        note
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


            right.append(
                createElement(
                    "span",
                    `batch-v1-status ${task.status}`,
                    statusText(
                        task.status
                    )
                )
            );


            if (
                task.status ===
                    "complete" &&
                task.cdnUrl
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
                                    task.cdnUrl
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


            item.append(
                file,
                right
            );


            if (
                task.error
            ) {

                item.append(
                    createElement(
                        "div",
                        task.status ===
                            "review"
                            ? "batch-v1-error review"
                            : "batch-v1-error",
                        task.error
                    )
                );

            }


            list.append(
                item
            );

        }


        panel.append(
            head,
            progressWrap,
            stats,
            actions,
            list
        );

    }


    async function waitUntilResumed() {

        while (
            paused
        ) {

            await sleep(
                300
            );

        }

    }


    async function waitForCreateSlot(
        task
    ) {

        while (
            true
        ) {

            await waitUntilResumed();


            if (
                task.status ===
                "cancelled"
            ) {

                return false;

            }


            const now =
                Date.now();


            createTimestamps =
                createTimestamps.filter(
                    timestamp =>
                        now -
                        timestamp <
                        CREATE_WINDOW_MS
                );


            if (
                createTimestamps.length <
                CREATE_BURST
            ) {

                createTimestamps.push(
                    now
                );


                return true;

            }


            task.status =
                "waiting_limit";


            renderPanel();


            const wait =
                Math.max(
                    1000,

                    CREATE_WINDOW_MS -
                    (
                        now -
                        createTimestamps[0]
                    ) +
                    250
                );


            await sleep(
                wait
            );

        }

    }


    async function createWithRateRetry(
        task
    ) {

        for (
            let attempt = 1;
            attempt <= 2;
            attempt += 1
        ) {

            const slot =
                await waitForCreateSlot(
                    task
                );


            if (
                !slot
            ) {

                return null;

            }


            task.status =
                "creating";

            task.error =
                "";


            renderPanel();


            try {

                return await createJob(
                    task
                );

            } catch (
                error
            ) {

                if (
                    error.status !==
                        429 ||
                    attempt >=
                        2
                ) {

                    throw error;

                }


                task.status =
                    "waiting_limit";

                task.error =
                    "服务器上传创建频率达到安全上限，65 秒后自动重试。";


                renderPanel();


                await sleep(
                    65000
                );

            }

        }


        return null;

    }


    function applyFailedJob(
        task,
        code
    ) {

        const normalized =
            String(
                code ||
                "pipeline_failed"
            );


        task.errorCode =
            normalized;


        task.error =
            humanError(
                normalized
            );


        if (
            isUnsafeRetryCode(
                normalized
            )
        ) {

            task.status =
                "review";

            task.retryable =
                false;

        } else {

            task.status =
                "failed";

            task.retryable =
                true;

        }


        renderPanel();

    }


    async function pollJob(
        task
    ) {

        const started =
            Date.now();


        while (
            Date.now() -
            started <
            TASK_TIMEOUT_MS
        ) {

            await sleep(
                POLL_INTERVAL_MS
            );


            const job =
                await getJob(
                    task.jobId
                );


            if (
                job.status ===
                "complete"
            ) {

                task.status =
                    "complete";

                task.cdnUrl =
                    job.cdnUrl ||
                    null;

                task.error =
                    "";

                task.errorCode =
                    "";

                task.retryable =
                    false;


                renderPanel();


                refreshHistory();


                return;

            }


            if (
                job.status ===
                "failed"
            ) {

                applyFailedJob(
                    task,
                    job.error ||
                    "pipeline_failed"
                );


                refreshHistory();


                return;

            }


            if (
                job.status ===
                "processing"
            ) {

                task.status =
                    "processing";

            } else {

                task.status =
                    "queued";


                if (
                    !task.queuedAt
                ) {

                    task.queuedAt =
                        Date.now();

                }

            }


            renderPanel();

        }


        task.status =
            "failed";

        task.retryable =
            true;

        task.errorCode =
            "upload_wait_timeout";

        task.error =
            "等待 GitHub 发布超过 40 分钟。请先刷新上传历史确认状态，再决定是否重试。";


        renderPanel();

    }


    async function processTask(
        task
    ) {

        try {

            const created =
                await createWithRateRetry(
                    task
                );


            if (
                !created ||
                task.status ===
                "cancelled"
            ) {

                return;

            }


            task.jobId =
                created.id;


            task.status =
                "staging";

            task.error =
                "";


            renderPanel();


            const queued =
                await sendContent(
                    task,
                    created
                );


            task.jobId =
                queued.id;


            task.queuedAt =
                Date.now();


            task.status =
                queued.status ===
                    "processing"

                    ? "processing"

                    : "queued";


            renderPanel();


            await pollJob(
                task
            );

        } catch (
            error
        ) {

            const code =
                error?.code ||
                error?.message ||
                "request_failed";


            task.errorCode =
                String(
                    code
                );


            task.error =
                humanError(
                    code
                );


            if (
                isUnsafeRetryCode(
                    code
                )
            ) {

                task.status =
                    "review";

                task.retryable =
                    false;

            } else {

                task.status =
                    "failed";

                task.retryable =
                    true;

            }


            renderPanel();

        }

    }


    function nextPendingTask() {

        if (
            !batch
        ) {

            return null;

        }


        return (
            batch.tasks.find(
                task =>
                    task.status ===
                    "pending"
            ) ||
            null
        );

    }


    async function worker() {

        while (
            true
        ) {

            await waitUntilResumed();


            const task =
                nextPendingTask();


            if (
                !task
            ) {

                return;

            }


            /*
             * 立即抢占任务，避免多个 Worker
             * 拿到同一个 pending task。
             */
            task.status =
                "waiting_limit";


            renderPanel();


            await processTask(
                task
            );

        }

    }


    async function runScheduler() {

        if (
            schedulerRunning ||
            !batch
        ) {

            return;

        }


        schedulerRunning =
            true;

        batch.active =
            true;


        try {

            await Promise.all(
                new Array(
                    MAX_IN_FLIGHT
                )
                    .fill(
                        null
                    )
                    .map(
                        () =>
                            worker()
                    )
            );

        } finally {

            schedulerRunning =
                false;


            const remaining =
                batch.tasks.some(
                    task =>
                        [
                            "pending",
                            "waiting_limit",
                            "creating",
                            "staging",
                            "queued",
                            "processing"
                        ].includes(
                            task.status
                        )
                );


            batch.active =
                remaining;


            renderPanel();


            if (
                !remaining
            ) {

                const success =
                    batch.tasks.filter(
                        task =>
                            task.status ===
                            "complete"
                    ).length;


                const failed =
                    batch.tasks.filter(
                        task =>
                            task.status ===
                            "failed"
                    ).length;


                const review =
                    batch.tasks.filter(
                        task =>
                            task.status ===
                            "review"
                    ).length;


                showToast(
                    `批量任务结束：${success} 成功，${failed} 失败，${review} 需确认`
                );


                refreshHistory();

            }

        }

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
                data.user;


            return Boolean(
                currentUser
            );

        } catch {

            return false;

        }

    }


    async function startBatch(
        files
    ) {

        if (
            batch?.active
        ) {

            showToast(
                "已有一个批量任务正在运行。"
            );


            return;

        }


        if (
            !await ensureUser()
        ) {

            showToast(
                "请先完成登录。"
            );


            return;

        }


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


        if (
            selected.length >
            MAX_FILES
        ) {

            showToast(
                `一次最多选择 ${MAX_FILES} 个文件。`
            );


            return;

        }


        const tasks =
            [];


        for (
            const file
            of selected
        ) {

            try {

                const validation =
                    validateFile(
                        file
                    );


                tasks.push({

                    file,

                    type:
                        validation.type,

                    status:
                        "pending",

                    error:
                        "",

                    errorCode:
                        "",

                    retryable:
                        true,

                    jobId:
                        null,

                    cdnUrl:
                        null,

                    queuedAt:
                        null

                });

            } catch (
                error
            ) {

                tasks.push({

                    file,

                    type:
                        "unknown",

                    status:
                        "failed",

                    error:
                        error.message,

                    errorCode:
                        "local_validation_failed",

                    /*
                     * 文件本身不合法时，
                     * 点重试也不会变合法。
                     */
                    retryable:
                        false,

                    jobId:
                        null,

                    cdnUrl:
                        null,

                    queuedAt:
                        null

                });

            }

        }


        batch = {

            tasks,

            active:
                true,

            createdAt:
                Date.now()

        };


        paused =
            false;


        renderPanel();


        runScheduler();

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
                        batch?.active
                    ) {

                        event.preventDefault();

                        event.stopImmediatePropagation();


                        fileInput.value =
                            "";


                        showToast(
                            "请先等待当前批次结束。"
                        );


                        return;

                    }


                    /*
                     * 一个文件继续走原来的稳定单文件逻辑。
                     *
                     * 两个以上才由 Batch V1 接管。
                     */
                    if (
                        files.length <=
                        1
                    ) {

                        return;

                    }


                    event.preventDefault();

                    event.stopImmediatePropagation();


                    fileInput.value =
                        "";


                    startBatch(
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
                        batch?.active
                    ) {

                        event.preventDefault();

                        event.stopImmediatePropagation();


                        showToast(
                            "请先等待当前批次结束。"
                        );


                        return;

                    }


                    if (
                        files.length <=
                        1
                    ) {

                        return;

                    }


                    event.preventDefault();

                    event.stopImmediatePropagation();


                    dropZone.classList.remove(
                        "dragging"
                    );


                    startBatch(
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


        installInterceptors();

    }


    window.addEventListener(
        "load",
        init
    );

})();
