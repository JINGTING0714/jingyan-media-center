(() => {
    "use strict";


    const MAX_FILES =
        20;

    const CONCURRENCY =
        3;

    /*
     * 当前 Worker 的上传创建接口共享
     * AUTH_RATE_LIMITER = 10 / 60 秒。
     *
     * Batch V1 主动只使用 8 个名额，
     * 给登录/单文件操作留下安全余量。
     */
    const CREATE_BURST =
        8;

    const CREATE_WINDOW_MS =
        61000;


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


    function injectStyles() {
        if (
            document.getElementById(
                "batchV1Styles"
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "batchV1Styles";


        style.textContent = `
.batch-v1 {
    margin-bottom: 16px;
    padding: 15px;
    border: 1px solid rgba(128,88,232,.16);
    border-radius: 16px;
    background: linear-gradient(145deg,#fff,#f8f4ff);
}

.batch-v1.hidden {
    display: none;
}

.batch-v1-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.batch-v1-head h3 {
    margin: 0;
    font-size: 14px;
}

.batch-v1-head p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 9px;
    line-height: 1.5;
}

.batch-v1-count {
    color: var(--primary);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
}

.batch-v1-progress {
    height: 8px;
    margin-top: 13px;
    overflow: hidden;
    border-radius: 999px;
    background: #ece5fb;
}

.batch-v1-progress-bar {
    width: 0;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg,#9b75ef,#7045df);
    transition: width .2s ease;
}

.batch-v1-stats {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    color: var(--muted);
    font-size: 9px;
}

.batch-v1-actions {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
}

.batch-v1-actions button {
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: 10px;
    color: var(--text);
    background: var(--surface);
    cursor: pointer;
    font-size: 9px;
}

.batch-v1-actions button.primary {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(145deg,#956df0,#6d45dc);
}

.batch-v1-actions button.danger {
    color: #a23d3d;
    background: #fff1f1;
}

.batch-v1-actions button:disabled {
    cursor: default;
    opacity: .45;
}

.batch-v1-list {
    margin-top: 13px;
    display: grid;
    gap: 7px;
}

.batch-v1-item {
    padding: 10px 11px;
    display: grid;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: rgba(255,255,255,.7);
}

.batch-v1-file {
    min-width: 0;
}

.batch-v1-name {
    overflow: hidden;
    font-size: 10px;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.batch-v1-meta {
    margin-top: 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    color: var(--muted);
    font-size: 8px;
}

.batch-v1-right {
    display: flex;
    align-items: center;
    gap: 6px;
}

.batch-v1-status {
    padding: 5px 7px;
    border-radius: 999px;
    color: #69547f;
    background: #f1ebff;
    font-size: 8px;
    font-weight: 750;
    white-space: nowrap;
}

.batch-v1-status.complete {
    color: #24785c;
    background: #e2f7ef;
}

.batch-v1-status.failed {
    color: #a23d3d;
    background: #ffe9e9;
}

.batch-v1-status.cancelled {
    color: #746b7d;
    background: #efedf1;
}

.batch-v1-copy {
    min-height: 27px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--primary);
    background: var(--surface);
    cursor: pointer;
    font-size: 8px;
}

.batch-v1-error {
    grid-column: 1 / -1;
    margin: -3px 0 0;
    color: #ad4949;
    font-size: 8px;
    line-height: 1.45;
}

@media (max-width:560px) {
    .batch-v1-head {
        flex-direction: column;
    }

    .batch-v1-actions {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .batch-v1-actions button {
        width: 100%;
    }

    .batch-v1-item {
        grid-template-columns: minmax(0,1fr);
    }

    .batch-v1-right {
        justify-content: space-between;
    }
}
`;


        document.head.append(
            style
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


    function formatBytes(
        bytes
    ) {
        const value =
            Number(
                bytes
            );


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
                `${file.name} 超过 ${formatBytes(rule.maxBytes)}`
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


    function humanError(
        error
    ) {
        const code =
            error?.code ||
            error?.message ||
            "request_failed";


        const messages = {
            upload_rate_limited:
                "上传频率达到安全上限，将稍后重试",

            unsupported_media_type:
                "不支持的媒体格式",

            media_too_large:
                "文件超过大小限制",

            upload_permission_denied:
                "没有此类型上传权限",

            request_failed:
                "请求失败"
        };


        if (
            String(
                code
            )
                .toLowerCase()
                .includes(
                    "duplicate"
                )
        ) {
            return "检测到重复文件";
        }


        return (
            messages[
                code
            ] ||
            String(
                code
            )
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
                "提交文件",

            queued:
                "等待发布",

            processing:
                "发布中",

            complete:
                "完成",

            failed:
                "失败",

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
            "cancelled"
        ].includes(
            task.status
        );
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


        queueList.parentNode.insertBefore(
            panel,
            queueList
        );


        return panel;
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
                `最多 ${MAX_FILES} 个文件 · 并发 ${CONCURRENCY} · 自动安全节流`
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
                "",
                `✓ 成功 ${complete}`
            ),

            createElement(
                "span",
                "",
                `● 处理中 ${active}`
            ),

            createElement(
                "span",
                "",
                `○ 等待 ${waiting}`
            ),

            createElement(
                "span",
                "",
                `! 失败 ${failed}`
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
                    ? "继续"
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


        const cancelWaiting =
            createElement(
                "button",
                "danger",
                "取消等待任务"
            );


        cancelWaiting.type =
            "button";

        cancelWaiting.disabled =
            waiting ===
            0;


        cancelWaiting.addEventListener(
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


        const retry =
            createElement(
                "button",
                "",
                "重试失败"
            );


        retry.type =
            "button";

        retry.disabled =
            failed ===
            0;


        retry.addEventListener(
            "click",
            () => {
                for (
                    const task
                    of batch.tasks
                ) {
                    if (
                        task.status ===
                        "failed"
                    ) {
                        task.status =
                            "pending";

                        task.error =
                            "";

                        task.jobId =
                            null;

                        task.cdnUrl =
                            null;
                    }
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
            cancelWaiting,
            retry
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
                        "batch-v1-error",
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


            const now =
                Date.now();


            createTimestamps =
                createTimestamps
                    .filter(
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

                return;
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


    async function pollJob(
        task
    ) {
        const started =
            Date.now();


        while (
            Date.now() -
            started <
            30 *
            60 *
            1000
        ) {
            await sleep(
                3000
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

                renderPanel();


                const refreshHistory =
                    document.getElementById(
                        "refreshHistory"
                    );


                if (
                    refreshHistory
                ) {
                    refreshHistory.click();
                }


                return;
            }


            if (
                job.status ===
                "failed"
            ) {
                task.status =
                    "failed";

                task.error =
                    humanError(
                        {
                            message:
                                job.error ||
                                "发布失败"
                        }
                    );

                renderPanel();

                return;
            }


            task.status =
                job.status ===
                    "processing"
                    ? "processing"
                    : "queued";


            renderPanel();
        }


        throw new Error(
            "等待发布超时"
        );
    }


    async function processTask(
        task
    ) {
        try {
            await waitForCreateSlot(
                task
            );


            if (
                task.status ===
                "cancelled"
            ) {
                return;
            }


            task.status =
                "creating";

            renderPanel();


            let created;


            try {
                created =
                    await createJob(
                        task
                    );

            } catch (
                error
            ) {
                if (
                    error.status ===
                    429
                ) {
                    task.status =
                        "waiting_limit";

                    task.error =
                        "服务器限流，65 秒后自动重试";

                    renderPanel();


                    await sleep(
                        65000
                    );


                    task.error =
                        "";


                    created =
                        await createJob(
                            task
                        );

                } else {
                    throw error;
                }
            }


            task.jobId =
                created.id;


            task.status =
                "staging";

            renderPanel();


            const queued =
                await sendContent(
                    task,
                    created
                );


            task.jobId =
                queued.id;


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
            task.status =
                "failed";

            task.error =
                humanError(
                    error
                );

            renderPanel();
        }
    }


    function nextPendingTask() {
        if (
            !batch
        ) {
            return null;
        }


        return batch.tasks.find(
            task =>
                task.status ===
                "pending"
        ) ||
        null;
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
             * 先抢占任务，防止多个 worker
             * 同时拿到同一个 pending task。
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
                    CONCURRENCY
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


                showToast(
                    `批量上传完成：${success} 成功，${failed} 失败`
                );
            }
        }
    }


    async function startBatch(
        files
    ) {
        if (
            batch?.active
        ) {
            showToast(
                "已有批量任务正在进行"
            );

            return;
        }


        if (
            !currentUser
        ) {
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
                    showToast(
                        "请先登录"
                    );

                    return;
                }


                const data =
                    await response.json();


                currentUser =
                    data.user;

            } catch {
                showToast(
                    "无法读取登录状态"
                );

                return;
            }
        }


        const selected =
            Array.from(
                files
            );


        if (
            selected.length >
            MAX_FILES
        ) {
            showToast(
                `一次最多选择 ${MAX_FILES} 个文件`
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

                    jobId:
                        null,

                    cdnUrl:
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

                    jobId:
                        null,

                    cdnUrl:
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
                            "请先等待当前批次完成"
                        );

                        return;
                    }


                    /*
                     * 只有多文件才由 Batch V1 接管。
                     * 单文件仍走原来的稳定上传逻辑。
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
                        files.length <=
                        1 &&
                        !batch?.active
                    ) {
                        return;
                    }


                    event.preventDefault();

                    event.stopImmediatePropagation();


                    dropZone.classList.remove(
                        "dragging"
                    );


                    if (
                        batch?.active
                    ) {
                        showToast(
                            "请先等待当前批次完成"
                        );

                        return;
                    }


                    startBatch(
                        files
                    );
                },
                true
            );
        }
    }


    async function init() {
        injectStyles();

        ensurePanel();


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
                response.ok
            ) {
                const data =
                    await response.json();


                currentUser =
                    data.user;
            }

        } catch {
            currentUser =
                null;
        }


        installInterceptors();
    }


    window.addEventListener(
        "load",
        init
    );
})();
