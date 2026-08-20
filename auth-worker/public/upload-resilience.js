(() => {
    "use strict";


    const nativeFetch =
        window.fetch.bind(
            window
        );


    const originalTitle =
        document.title;


    const SAFE_BATCH_STATUSES =
        new Set([
            "queued",
            "processing",
            "complete",
            "partial",
            "failed",
            "cancelled"
        ]);


    let activeLocalTransfers =
        0;


    let cloudTakeoverPending =
        false;


    let pendingNavigation =
        null;


    let takeoverCheckTimer =
        null;


    let bannerHideTimer =
        null;


    let lastTransferFinishedAt =
        0;


    function asUrl(
        input
    ) {

        try {

            if (
                input instanceof Request
            ) {

                return new URL(
                    input.url,
                    location.href
                );

            }


            return new URL(
                String(
                    input
                ),
                location.href
            );

        } catch {

            return null;

        }

    }


    function requestMethod(
        input,
        init
    ) {

        return String(
            init?.method ||
            (
                input instanceof Request
                    ? input.method
                    : "GET"
            )
        )
            .toUpperCase();

    }


    function isLocalUploadRequest(
        input,
        init
    ) {

        const url =
            asUrl(
                input
            );


        if (
            !url ||
            url.origin !==
                location.origin ||
            requestMethod(
                input,
                init
            ) !==
                "PUT"
        ) {

            return false;

        }


        return (
            /^\/api\/uploads\/[^/]+\/content$/
                .test(
                    url.pathname
                ) ||

            /^\/api\/upload-batches\/[^/]+\/items\/[^/]+\/content$/
                .test(
                    url.pathname
                )
        );

    }


    function isBatchStartRequest(
        input,
        init
    ) {

        const url =
            asUrl(
                input
            );


        if (
            !url ||
            url.origin !==
                location.origin ||
            requestMethod(
                input,
                init
            ) !==
                "POST"
        ) {

            return false;

        }


        return /^\/api\/upload-batches\/[^/]+\/start$/
            .test(
                url.pathname
            );

    }


    function ensureBanner() {

        let banner =
            document.getElementById(
                "uploadCloudTakeoverStatus"
            );


        if (
            banner
        ) {

            return banner;

        }


        const uploadCard =
            document.querySelector(
                ".upload-card"
            );


        if (
            !uploadCard
        ) {

            return null;

        }


        banner =
            document.createElement(
                "div"
            );


        banner.id =
            "uploadCloudTakeoverStatus";


        banner.setAttribute(
            "role",
            "status"
        );


        banner.setAttribute(
            "aria-live",
            "polite"
        );


        Object.assign(
            banner.style,
            {
                display:
                    "none",

                margin:
                    "0 0 18px",

                padding:
                    "14px 16px",

                border:
                    "1px solid rgba(124, 92, 255, 0.18)",

                borderRadius:
                    "16px",

                background:
                    "rgba(246, 243, 255, 0.92)",

                color:
                    "#4b3f73",

                fontSize:
                    "14px",

                lineHeight:
                    "1.55"
            }
        );


        const heading =
            uploadCard.querySelector(
                ".section-heading"
            );


        if (
            heading
        ) {

            heading.insertAdjacentElement(
                "afterend",
                banner
            );

        } else {

            uploadCard.prepend(
                banner
            );

        }


        return banner;

    }


    function setBanner(
        state,
        message
    ) {

        const banner =
            ensureBanner();


        if (
            !banner
        ) {

            return;

        }


        clearTimeout(
            bannerHideTimer
        );


        banner.style.display =
            "block";


        banner.textContent =
            message;


        if (
            state ===
            "safe"
        ) {

            banner.style.background =
                "rgba(236, 249, 244, 0.96)";


            banner.style.borderColor =
                "rgba(57, 163, 121, 0.22)";


            banner.style.color =
                "#28785e";


            bannerHideTimer =
                setTimeout(
                    () => {

                        banner.style.display =
                            "none";

                    },
                    4200
                );


            return;

        }


        if (
            state ===
            "warning"
        ) {

            banner.style.background =
                "rgba(255, 248, 235, 0.96)";


            banner.style.borderColor =
                "rgba(194, 137, 45, 0.22)";


            banner.style.color =
                "#7a5a25";


            return;

        }


        banner.style.background =
            "rgba(246, 243, 255, 0.96)";


        banner.style.borderColor =
            "rgba(124, 92, 255, 0.18)";


        banner.style.color =
            "#4b3f73";

    }


    function setUploadingTitle(
        active
    ) {

        document.title =
            active
                ? `上传中 · ${originalTitle}`
                : originalTitle;

    }


    function isUnsafeToLeave() {

        return (
            activeLocalTransfers >
                0 ||

            cloudTakeoverPending
        );

    }


    function beginLocalTransfer() {

        activeLocalTransfers +=
            1;


        cloudTakeoverPending =
            true;


        setUploadingTitle(
            true
        );


        setBanner(
            "uploading",
            "正在把文件传到云端。此阶段请先留在当前页面；完成后系统会自动交给后台继续发布。"
        );

    }


    function endLocalTransfer() {

        activeLocalTransfers =
            Math.max(
                0,
                activeLocalTransfers -
                    1
            );


        if (
            activeLocalTransfers ===
            0
        ) {

            lastTransferFinishedAt =
                Date.now();


            setBanner(
                "uploading",
                "文件内容已传到云端，正在确认后台已经接管。"
            );


            scheduleTakeoverCheck(
                500
            );

        }

    }


    async function getCurrentBatch() {

        const response =
            await nativeFetch(
                "/api/upload-batches/current",
                {
                    credentials:
                        "same-origin",

                    cache:
                        "no-store"
                }
            );


        if (
            response.status ===
                401 ||

            response.status ===
                404
        ) {

            return null;

        }


        if (
            !response.ok
        ) {

            throw new Error(
                `batch_status_${response.status}`
            );

        }


        const data =
            await response.json();


        return (
            data.batch ||
            null
        );

    }


    async function startReadyBatch(
        currentBatch
    ) {

        if (
            !currentBatch?.id ||
            currentBatch.status !==
                "ready"
        ) {

            return false;

        }


        const response =
            await nativeFetch(
                `/api/upload-batches/${encodeURIComponent(currentBatch.id)}/start`,
                {
                    method:
                        "POST",

                    credentials:
                        "same-origin",

                    keepalive:
                        true,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        "{}"
                }
            );


        if (
            response.ok ||
            response.status ===
                409
        ) {

            return true;

        }


        throw new Error(
            `batch_start_${response.status}`
        );

    }


    async function cloudIsSafe() {

        if (
            activeLocalTransfers >
            0
        ) {

            return false;

        }


        let currentBatch =
            await getCurrentBatch();


        if (
            !currentBatch
        ) {

            /*
             * 单文件旧上传路径：
             *
             * PUT /api/uploads/:id/content
             *
             * 返回成功之前，
             * Worker 已经完成 GitHub Workflow dispatch。
             *
             * 所以没有活动 Batch 时，
             * 文件 PUT 完成以后即可认为后台已安全接管。
             */
            return true;

        }


        if (
            SAFE_BATCH_STATUSES
                .has(
                    currentBatch.status
                )
        ) {

            return true;

        }


        if (
            currentBatch.status ===
            "ready"
        ) {

            /*
             * 多文件 Batch 已全部进入临时存储，
             * 但如果用户此刻正准备离开，
             * 这里主动补一次 start。
             *
             * 即使 Batch V2 自己也同时启动，
             * 409 只表示已经启动，不视作失败。
             */
            await startReadyBatch(
                currentBatch
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        350
                    )
            );


            currentBatch =
                await getCurrentBatch();


            if (
                !currentBatch ||

                SAFE_BATCH_STATUSES
                    .has(
                        currentBatch.status
                    )
            ) {

                return true;

            }

        }


        return false;

    }


    function scheduleTakeoverCheck(
        delay = 700
    ) {

        clearTimeout(
            takeoverCheckTimer
        );


        takeoverCheckTimer =
            setTimeout(
                () => {

                    settleCloudTakeover()
                        .catch(
                            () => {

                                scheduleTakeoverCheck(
                                    1500
                                );

                            }
                        );

                },
                delay
            );

    }


    async function settleCloudTakeover() {

        if (
            activeLocalTransfers >
            0
        ) {

            return;

        }


        try {

            const safe =
                await cloudIsSafe();


            if (
                !safe
            ) {

                setBanner(
                    "warning",
                    "仍有文件尚未完成云端接管。系统会继续等待；请暂时不要关闭或刷新页面。"
                );


                scheduleTakeoverCheck(
                    1200
                );


                return;

            }


            cloudTakeoverPending =
                false;


            setUploadingTitle(
                false
            );


            setBanner(
                "safe",
                "已安全交给后台。现在可以离开此页，GitHub 发布、CDN 生成和状态更新会继续运行。"
            );


            if (
                pendingNavigation
            ) {

                const destination =
                    pendingNavigation;


                pendingNavigation =
                    null;


                location.assign(
                    destination
                );

            }

        } catch {

            setBanner(
                "warning",
                "正在确认后台接管状态。网络恢复后会自动继续检查，请暂时不要关闭页面。"
            );


            scheduleTakeoverCheck(
                1600
            );

        }

    }


    window.fetch =
        async function resilientFetch(
            input,
            init = undefined
        ) {

            const localUpload =
                isLocalUploadRequest(
                    input,
                    init
                );


            if (
                localUpload
            ) {

                beginLocalTransfer();

            }


            let nextInit =
                init;


            if (
                isBatchStartRequest(
                    input,
                    init
                )
            ) {

                nextInit = {
                    ...(
                        init ||
                        {}
                    ),

                    keepalive:
                        true
                };

            }


            try {

                return await nativeFetch(
                    input,
                    nextInit
                );

            } finally {

                if (
                    localUpload
                ) {

                    endLocalTransfer();

                }

            }

        };


    function sameOriginNavigation(
        anchor
    ) {

        if (
            !anchor?.href ||
            anchor.target ===
                "_blank" ||
            anchor.hasAttribute(
                "download"
            )
        ) {

            return null;

        }


        try {

            const url =
                new URL(
                    anchor.href,
                    location.href
                );


            if (
                url.origin !==
                location.origin
            ) {

                return null;

            }


            if (
                url.href ===
                location.href
            ) {

                return null;

            }


            return url.href;

        } catch {

            return null;

        }

    }


    document.addEventListener(
        "click",
        event => {

            const anchor =
                event.target
                    .closest?.(
                        "a[href]"
                    );


            const destination =
                sameOriginNavigation(
                    anchor
                );


            if (
                !destination ||
                !isUnsafeToLeave()
            ) {

                return;

            }


            event.preventDefault();


            event.stopPropagation();


            pendingNavigation =
                destination;


            setBanner(
                "uploading",
                "文件仍在传到云端。已记住你要前往的页面，后台安全接管后会自动跳转。"
            );


            scheduleTakeoverCheck(
                450
            );

        },
        true
    );


    window.addEventListener(
        "beforeunload",
        event => {

            if (
                !isUnsafeToLeave()
            ) {

                return;

            }


            event.preventDefault();


            event.returnValue =
                "";

        }
    );


    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                    "visible" &&

                cloudTakeoverPending &&

                activeLocalTransfers ===
                    0
            ) {

                scheduleTakeoverCheck(
                    150
                );

            }

        }
    );


    window.addEventListener(
        "online",
        () => {

            if (
                cloudTakeoverPending
            ) {

                scheduleTakeoverCheck(
                    100
                );

            }

        }
    );


    window.addEventListener(
        "load",
        () => {

            ensureBanner();


            if (
                lastTransferFinishedAt >
                0
            ) {

                scheduleTakeoverCheck(
                    500
                );

            }

        }
    );

})();
