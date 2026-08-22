(() => {
    "use strict";


    const ACTIVE_STATUSES =
        new Set([
            "created",
            "staged",
            "ready",
            "queued",
            "processing"
        ]);


    const TERMINAL_STATUSES =
        new Set([
            "complete",
            "failed",
            "cancelled"
        ]);


    const STATUS_TEXT = {

        local:
            "本地检查",

        creating:
            "创建任务",

        staging:
            "提交文件",

        created:
            "等待文件",

        staged:
            "准备调度",

        ready:
            "准备后台处理",

        queued:
            "等待自动处理",

        processing:
            "正在发布",

        complete:
            "完成",

        failed:
            "失败",

        cancelled:
            "已取消"

    };


    let pollTimer =
        null;


    let syncTimer =
        null;


    let syncRunning =
        false;


    let pendingSync =
        false;


    let lastHistorySignature =
        "";


    function statusText(
        status
    ) {

        return (
            STATUS_TEXT[
                status
            ] ||
            status ||
            "—"
        );

    }


    function uploadErrorText(
        error
    ) {

        const value =
            String(
                error ||
                ""
            );


        return {
            background_dispatch_failed:
                "后台发布任务启动失败，请稍后重试。",

            pipeline_state_not_saved:
                "发布结果尚未安全保存，请先检查媒体库。",

            staging_not_ready:
                "云端文件尚未准备完成。"
        }[
            value
        ] ||
        value;

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
            value <=
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


    function jobName(
        job
    ) {

        return String(
            job?.filename ||
            job?.originalName ||
            ""
        );

    }


    function originalJobName(
        job
    ) {

        return String(
            job?.originalName ||
            job?.filename ||
            ""
        );

    }


    function jobSignature(
        jobs
    ) {

        return jobs
            .slice(
                0,
                8
            )
            .map(
                job => [
                    job.id,
                    job.status,
                    job.cdnUrl ||
                        "",
                    job.completedAt ||
                        ""
                ]
                    .join(
                        ":"
                    )
            )
            .join(
                "|"
            );

    }


    async function copyText(
        text
    ) {

        if (
            navigator.clipboard
                ?.writeText
        ) {

            await navigator.clipboard
                .writeText(
                    text
                );


            return;
        }


        const textarea =
            document.createElement(
                "textarea"
            );


        textarea.value =
            text;


        textarea.style.position =
            "fixed";

        textarea.style.left =
            "-9999px";


        document.body.append(
            textarea
        );


        textarea.select();


        document.execCommand(
            "copy"
        );


        textarea.remove();

    }


    function ensureCopyButton(
        row,
        job
    ) {

        if (
            job.status !==
                "complete" ||
            !job.cdnUrl
        ) {

            return;
        }


        const actions =
            row.querySelector(
                ".job-actions"
            );


        if (
            !actions
        ) {

            return;
        }


        if (
            actions.querySelector(
                ".copy-button"
            )
        ) {

            return;
        }


        const button =
            createElement(
                "button",
                "copy-button",
                "复制 CDN"
            );


        button.type =
            "button";


        button.dataset.autoCdn =
            "true";


        button.addEventListener(
            "click",
            async () => {

                try {

                    await copyText(
                        job.cdnUrl
                    );


                    const toast =
                        document.getElementById(
                            "toast"
                        );


                    if (
                        toast
                    ) {

                        toast.textContent =
                            "CDN 链接已复制";


                        toast.classList.add(
                            "show"
                        );


                        setTimeout(
                            () => {
                                toast.classList.remove(
                                    "show"
                                );
                            },
                            2200
                        );
                    }

                } catch (
                    error
                ) {

                    console.error(
                        error
                    );
                }
            }
        );


        actions.append(
            button
        );

    }


    function updateError(
        row,
        job
    ) {

        const meta =
            row.querySelector(
                ".job-meta"
            );


        if (
            !meta
        ) {

            return;
        }


        const old =
            meta.querySelector(
                "[data-auto-job-error]"
            );


        if (
            old
        ) {

            old.remove();
        }


        if (
            !job.error
        ) {

            return;
        }


        const error =
            createElement(
                "span",
                "",
                uploadErrorText(
                    job.error
                )
            );


        error.dataset.autoJobError =
            "true";


        meta.append(
            error
        );

    }


    function updateRow(
        row,
        job
    ) {

        if (
            !row ||
            !job
        ) {

            return;
        }


        row.dataset.uploadJobId =
            String(
                job.id ||
                ""
            );


        row.dataset.uploadJobStatus =
            String(
                job.status ||
                ""
            );


        const badge =
            row.querySelector(
                ".job-status"
            );


        if (
            badge
        ) {

            badge.className =
                `job-status ${job.status || ""}`;


            badge.textContent =
                statusText(
                    job.status
                );
        }


        updateError(
            row,
            job
        );


        ensureCopyButton(
            row,
            job
        );

    }


    function createServerRow(
        job
    ) {

        const row =
            createElement(
                "div",
                "job-item"
            );


        row.dataset.serverResumeRow =
            "true";


        row.dataset.uploadJobId =
            String(
                job.id ||
                ""
            );


        row.dataset.uploadJobStatus =
            String(
                job.status ||
                ""
            );


        const main =
            createElement(
                "div",
                "job-main"
            );


        const title =
            createElement(
                "div",
                "job-name",
                jobName(
                    job
                )
            );


        const meta =
            createElement(
                "div",
                "job-meta"
            );


        meta.append(

            createElement(
                "span",
                "",
                job.mediaType ||
                "—"
            ),

            createElement(
                "span",
                "",
                formatBytes(
                    job.sizeBytes
                )
            )

        );


        main.append(
            title,
            meta
        );


        const actions =
            createElement(
                "div",
                "job-actions"
            );


        const badge =
            createElement(
                "span",
                `job-status ${job.status || ""}`,
                statusText(
                    job.status
                )
            );


        actions.append(
            badge
        );


        row.append(
            main,
            actions
        );


        updateError(
            row,
            job
        );


        ensureCopyButton(
            row,
            job
        );


        return row;
    }


    function existingRows() {

        const queueList =
            document.getElementById(
                "queueList"
            );


        if (
            !queueList
        ) {

            return [];
        }


        return Array
            .from(
                queueList.children
            )
            .filter(
                element =>
                    element.classList
                        ?.contains(
                            "job-item"
                        )
            );

    }


    function findJobForRow(
        row,
        jobs,
        claimed
    ) {

        const existingId =
            row.dataset.uploadJobId;


        if (
            existingId
        ) {

            const byId =
                jobs.find(
                    job =>
                        String(
                            job.id
                        ) ===
                        existingId
                );


            if (
                byId
            ) {

                claimed.add(
                    String(
                        byId.id
                    )
                );


                return byId;
            }
        }


        const title =
            row.querySelector(
                ".job-name"
            )
                ?.textContent
                ?.trim() ||
            "";


        if (
            !title
        ) {

            return null;
        }


        const match =
            jobs.find(
                job => {

                    const id =
                        String(
                            job.id ||
                            ""
                        );


                    if (
                        claimed.has(
                            id
                        )
                    ) {

                        return false;
                    }


                    return (
                        title ===
                            jobName(
                                job
                            ) ||
                        title ===
                            originalJobName(
                                job
                            )
                    );
                }
            );


        if (
            match
        ) {

            claimed.add(
                String(
                    match.id
                )
            );
        }


        return (
            match ||
            null
        );

    }


    function reconcileQueue(
        jobs
    ) {

        const queueList =
            document.getElementById(
                "queueList"
            );


        const queueEmpty =
            document.getElementById(
                "queueEmpty"
            );


        if (
            !queueList ||
            !queueEmpty
        ) {

            return;
        }


        const rows =
            existingRows();


        const claimed =
            new Set();


        /*
         * 先把当前 DOM 中已经存在的卡片
         * 与服务器真实 Job 对上。
         *
         * 这正是修复：
         *
         * 等待自动处理
         * ↓
         * 用户离开页面
         * ↓
         * GitHub 已经完成
         * ↓
         * 返回后 DOM 仍停留旧状态
         */
        for (
            const row
            of rows
        ) {

            const job =
                findJobForRow(
                    row,
                    jobs,
                    claimed
                );


            if (
                job
            ) {

                updateRow(
                    row,
                    job
                );
            }
        }


        /*
         * 如果是一次完整的新页面加载，
         * DOM 里可能已经没有旧的 Queue 卡片。
         *
         * 只把服务器仍在处理中的 Job
         * 恢复到“当前上传”。
         *
         * 已经 complete 的内容留在历史记录，
         * 不重新塞进当前队列。
         */
        const activeJobs =
            jobs.filter(
                job =>
                    ACTIVE_STATUSES
                        .has(
                            job.status
                        )
            );


        for (
            const job
            of activeJobs
                .slice(
                    0,
                    10
                )
        ) {

            const id =
                String(
                    job.id ||
                    ""
                );


            const alreadyExists =
                existingRows()
                    .some(
                        row =>
                            row.dataset
                                .uploadJobId ===
                            id
                    );


            if (
                alreadyExists
            ) {

                continue;
            }


            const name =
                originalJobName(
                    job
                );


            const sameName =
                existingRows()
                    .some(
                        row =>
                            row
                                .querySelector(
                                    ".job-name"
                                )
                                ?.textContent
                                ?.trim() ===
                            name
                    );


            if (
                sameName
            ) {

                continue;
            }


            queueList.prepend(
                createServerRow(
                    job
                )
            );
        }


        const hasRows =
            existingRows()
                .length >
            0;


        queueEmpty.classList
            .toggle(
                "hidden",
                hasRows
            );

    }


    function refreshHistoryIfNeeded(
        jobs
    ) {

        const signature =
            jobSignature(
                jobs
            );


        if (
            signature ===
            lastHistorySignature
        ) {

            return;
        }


        lastHistorySignature =
            signature;


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


    async function fetchJobs() {

        const response =
            await fetch(
                "/api/uploads",
                {
                    method:
                        "GET",

                    credentials:
                        "same-origin",

                    cache:
                        "no-store",

                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (
            response.status ===
            401
        ) {

            return {
                authenticated:
                    false,

                jobs:
                    []
            };
        }


        if (
            !response.ok
        ) {

            throw new Error(
                `upload_status_${response.status}`
            );
        }


        const data =
            await response
                .json();


        return {
            authenticated:
                true,

            jobs:
                Array.isArray(
                    data.jobs
                )

                    ? data.jobs

                    : []
        };

    }


    function clearPollTimer() {

        clearTimeout(
            pollTimer
        );


        pollTimer =
            null;

    }


    function schedulePoll(
        active
    ) {

        clearPollTimer();


        if (
            !active ||
            document.visibilityState !==
                "visible"
        ) {

            return;
        }


        pollTimer =
            setTimeout(
                () => {

                    syncNow(
                        "poll"
                    );

                },
                4000
            );

    }


    async function syncNow(
        reason =
            "manual"
    ) {

        if (
            syncRunning
        ) {

            pendingSync =
                true;

            return;
        }


        if (
            document.visibilityState ===
                "hidden"
        ) {

            return;
        }


        syncRunning =
            true;


        try {

            const result =
                await fetchJobs();


            if (
                !result.authenticated
            ) {

                clearPollTimer();

                return;
            }


            const jobs =
                result.jobs;


            reconcileQueue(
                jobs
            );


            refreshHistoryIfNeeded(
                jobs
            );


            const active =
                jobs.some(
                    job =>
                        ACTIVE_STATUSES
                            .has(
                                job.status
                            )
                );


            schedulePoll(
                active
            );


            /*
             * 如果一个旧 DOM 卡片此前是 queued / processing，
             * 现在已经 complete / failed，
             * 上面的 reconcileQueue 已经直接改成服务器状态。
             *
             * 无需用户手动刷新。
             */
            if (
                reason ===
                "resume"
            ) {

                const staleRows =
                    existingRows()
                        .filter(
                            row =>
                                TERMINAL_STATUSES
                                    .has(
                                        row.dataset
                                            .uploadJobStatus
                                    )
                        );


                for (
                    const row
                    of staleRows
                ) {

                    row.dataset
                        .statusRecovered =
                        "true";
                }
            }

        } catch (
            error
        ) {

            console.warn(
                "Upload status auto-sync failed:",
                error
            );


            /*
             * 网络瞬时失败时不把 Job 标记失败。
             * 过几秒继续尝试。
             */
            schedulePoll(
                true
            );

        } finally {

            syncRunning =
                false;


            if (
                pendingSync
            ) {

                pendingSync =
                    false;


                requestSync(
                    160,
                    "resume"
                );
            }
        }

    }


    function requestSync(
        delay =
            120,
        reason =
            "resume"
    ) {

        clearTimeout(
            syncTimer
        );


        syncTimer =
            setTimeout(
                () => {

                    syncNow(
                        reason
                    );

                },
                delay
            );

    }


    window.addEventListener(
        "pageshow",
        () => {

            requestSync(
                120,
                "resume"
            );

        }
    );


    window.addEventListener(
        "focus",
        () => {

            requestSync(
                180,
                "resume"
            );

        }
    );


    window.addEventListener(
        "online",
        () => {

            requestSync(
                120,
                "resume"
            );

        }
    );


    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                requestSync(
                    120,
                    "resume"
                );

            } else {

                clearPollTimer();
            }

        }
    );


    /*
     * app.js 会先完成登录状态初始化。
     * 这里稍后做第一次服务器同步。
     */
    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => {

                requestSync(
                    850,
                    "initial"
                );

            },
            {
                once:
                    true
            }
        );

    } else {

        requestSync(
            850,
            "initial"
        );
    }

})();
