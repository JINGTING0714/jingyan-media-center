"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


const {
    prepareUpload
} = require("./upload");


const {
    publishCDN
} = require("./cloudflare");


const {
    markRecordComplete
} = require("./database");


const {
    syncRepositoryStatus
} = require("./repository");


const APP_URL =
    String(
        process.env.APP_URL ||
        "https://jingyan-media-app.jingyancdn.workers.dev"
    )
        .replace(
            /\/+$/,
            ""
        );


const AUDIENCE =
    "jingyan-media-upload";


const CALLBACK_ATTEMPTS =
    6;


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


function resultPath(
    batchId
) {

    const temp =
        process.env.RUNNER_TEMP ||
        process.cwd();


    return path.join(
        temp,
        `jingyan-batch-upload-${batchId}.json`
    );

}


function writeResult(
    batchId,
    data
) {

    fs.writeFileSync(
        resultPath(
            batchId
        ),
        JSON.stringify(
            data,
            null,
            2
        ) + "\n"
    );

}


function readResult(
    batchId
) {

    const file =
        resultPath(
            batchId
        );


    if (
        !fs.existsSync(
            file
        )
    ) {

        return null;

    }


    try {

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch {

        return null;

    }

}


async function getOidcToken() {

    const requestUrl =
        process.env
            .ACTIONS_ID_TOKEN_REQUEST_URL;


    const requestToken =
        process.env
            .ACTIONS_ID_TOKEN_REQUEST_TOKEN;


    if (
        !requestUrl ||
        !requestToken
    ) {

        throw new Error(
            "GitHub OIDC environment missing"
        );

    }


    const separator =
        requestUrl.includes("?")
            ? "&"
            : "?";


    const response =
        await fetch(
            requestUrl +
            separator +
            "audience=" +
            encodeURIComponent(
                AUDIENCE
            ),
            {
                headers: {
                    Authorization:
                        `Bearer ${requestToken}`
                }
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Unable to obtain GitHub OIDC token: ${response.status}`
        );

    }


    const data =
        await response.json();


    if (
        !data.value
    ) {

        throw new Error(
            "GitHub OIDC token missing"
        );

    }


    return data.value;

}


async function fetchJson(
    url,
    token
) {

    const response =
        await fetch(
            url,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );


    if (
        !response.ok
    ) {

        const text =
            (
                await response.text()
            )
                .slice(
                    0,
                    500
                );


        throw new Error(
            `Request failed (${response.status}): ${text}`
        );

    }


    return response.json();

}


async function fetchManifest(
    batchId,
    token
) {

    const data =
        await fetchJson(
            `${APP_URL}/api/internal/upload-batches/${encodeURIComponent(batchId)}/manifest`,
            token
        );


    if (
        !data?.batch ||
        !Array.isArray(
            data.batch.items
        )
    ) {

        throw new Error(
            "Invalid batch manifest"
        );

    }


    return data.batch;

}


async function downloadItem(
    batchId,
    item,
    token
) {

    const url =
        `${APP_URL}/api/internal/upload-batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(item.id)}/source`;


    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= 12;
        attempt += 1
    ) {

        let response;


        try {

            response =
                await fetch(
                    url,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

        } catch (
            error
        ) {

            lastError =
                error;


            if (
                attempt <
                12
            ) {

                await sleep(
                    attempt *
                    1000
                );

                continue;

            }


            throw error;

        }


        if (
            response.ok
        ) {

            const encodedName =
                response.headers.get(
                    "X-Upload-Filename"
                );


            if (
                !encodedName
            ) {

                throw new Error(
                    "Batch item filename missing"
                );

            }


            let filename;


            try {

                filename =
                    decodeURIComponent(
                        encodedName
                    );

            } catch {

                throw new Error(
                    "Invalid batch item filename"
                );

            }


            filename =
                path.basename(
                    filename
                );


            if (
                !filename ||
                filename ===
                    ".gitkeep"
            ) {

                throw new Error(
                    "Invalid batch item filename"
                );

            }


            const buffer =
                Buffer.from(
                    await response.arrayBuffer()
                );


            return {
                filename,
                buffer
            };

        }


        const text =
            (
                await response.text()
            )
                .slice(
                    0,
                    300
                );


        lastError =
            new Error(
                `Batch source unavailable (${response.status}): ${text}`
            );


        if (
            ![
                404,
                409,
                425,
                429
            ].includes(
                response.status
            ) &&
            response.status <
                500
        ) {

            throw lastError;

        }


        if (
            attempt <
            12
        ) {

            await sleep(
                attempt *
                1000
            );

        }

    }


    throw (
        lastError ||
        new Error(
            "Unable to retrieve batch source"
        )
    );

}


function sha256(
    buffer
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            buffer
        )
        .digest(
            "hex"
        );

}


function preserveUploadFolder(
    batchId
) {

    const uploadDir =
        path.resolve(
            "upload"
        );


    fs.mkdirSync(
        uploadDir,
        {
            recursive:
                true
        }
    );


    const preserveDir =
        path.join(
            process.env.RUNNER_TEMP ||
            process.cwd(),
            `preserved-batch-upload-${batchId}`
        );


    fs.rmSync(
        preserveDir,
        {
            recursive:
                true,

            force:
                true
        }
    );


    fs.mkdirSync(
        preserveDir,
        {
            recursive:
                true
        }
    );


    const moved =
        [];


    for (
        const entry
        of fs.readdirSync(
            uploadDir,
            {
                withFileTypes:
                    true
            }
        )
    ) {

        if (
            !entry.isFile() ||
            entry.name ===
                ".gitkeep"
        ) {

            continue;

        }


        const source =
            path.join(
                uploadDir,
                entry.name
            );


        const destination =
            path.join(
                preserveDir,
                entry.name
            );


        fs.renameSync(
            source,
            destination
        );


        moved.push({
            preserved:
                destination,

            original:
                source
        });

    }


    return {

        uploadDir,

        clean() {

            for (
                const entry
                of fs.readdirSync(
                    uploadDir,
                    {
                        withFileTypes:
                            true
                    }
                )
            ) {

                if (
                    entry.isFile() &&
                    entry.name !==
                        ".gitkeep"
                ) {

                    fs.rmSync(
                        path.join(
                            uploadDir,
                            entry.name
                        ),
                        {
                            force:
                                true
                        }
                    );

                }

            }

        },


        restore() {

            this.clean();


            for (
                const item
                of moved
            ) {

                if (
                    fs.existsSync(
                        item.preserved
                    )
                ) {

                    fs.renameSync(
                        item.preserved,
                        item.original
                    );

                }

            }


            fs.rmSync(
                preserveDir,
                {
                    recursive:
                        true,

                    force:
                        true
                }
            );

        }

    };

}


function publicationIdentity(
    publication
) {

    return (
        publication.record?.operationId ||
        publication.record?.id ||
        publication.sha256
    );

}


async function finalizePublication(
    publication
) {

    const completed =
        await markRecordComplete(
            publication.repository,
            publicationIdentity(
                publication
            ),
            {
                cdnPath:
                    publication.cdnPath,

                url:
                    publication.cdnURL
            }
        );


    await syncRepositoryStatus(
        publication.type,
        publication.repository.id
    );


    return {
        type:
            publication.type,

        repository:
            publication.repository.repo,

        filename:
            publication.filename,

        cdn:
            publication.cdnURL,

        id:
            completed.id,

        sha256:
            publication.sha256,

        recovered:
            Boolean(
                publication.recovered
            ),

        duplicate:
            Boolean(
                publication.duplicate
            )
    };

}


function reportFailure(
    item,
    error
) {

    return {
        itemId:
            item.id,

        ok:
            false,

        error:
            String(
                error?.message ||
                error ||
                "batch_item_pipeline_failed"
            )
                .slice(
                    0,
                    500
                )
    };

}


async function runBatch(
    batchId
) {

    const token =
        await getOidcToken();


    const manifest =
        await fetchManifest(
            batchId,
            token
        );


    const preserved =
        preserveUploadFolder(
            batchId
        );


    const reportMap =
        new Map();


    const pending =
        [];


    try {

        const items =
            [...manifest.items]
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


        /*
         * 第一阶段：
         *
         * 每个文件只完成：
         * - 从 staging 拉回
         * - 去重/命名
         * - GitHub Storage 写入
         * - CDN Manifest 注册
         *
         * 不在每个文件后面重新发布 CDN。
         */
        for (
            const item
            of items
        ) {

            preserved.clean();


            console.log(
                `Preparing batch item ${Number(item.position) + 1}/${items.length}: ${item.originalName}`
            );


            let localFile =
                null;


            try {

                const staged =
                    await downloadItem(
                        batchId,
                        item,
                        token
                    );


                const expectedSha =
                    sha256(
                        staged.buffer
                    );


                localFile =
                    path.join(
                        preserved.uploadDir,
                        staged.filename
                    );


                fs.writeFileSync(
                    localFile,
                    staged.buffer
                );


                const prepared =
                    await prepareUpload(
                        localFile
                    );


                if (
                    !prepared
                ) {

                    throw new Error(
                        "Media pipeline skipped batch item"
                    );

                }


                if (
                    prepared.completed
                ) {

                    if (
                        prepared.result?.sha256 !==
                        expectedSha
                    ) {

                        throw new Error(
                            "Existing media hash mismatch"
                        );

                    }


                    reportMap.set(
                        item.id,
                        {
                            itemId:
                                item.id,

                            ok:
                                true,

                            result:
                                prepared.result
                        }
                    );


                    console.log(
                        `Batch item already complete: ${prepared.result.id}`
                    );


                    continue;

                }


                if (
                    prepared.publication?.sha256 !==
                    expectedSha
                ) {

                    throw new Error(
                        "Prepared media hash mismatch"
                    );

                }


                pending.push({
                    item,
                    publication:
                        prepared.publication
                });


                console.log(
                    `Batch item prepared: ${item.originalName}`
                );

            } catch (
                error
            ) {

                reportMap.set(
                    item.id,
                    reportFailure(
                        item,
                        error
                    )
                );


                console.error(
                    `Batch item preparation failed: ${item.originalName}: ${String(
                        error?.message ||
                        error
                    )}`
                );

            } finally {

                if (
                    localFile &&
                    fs.existsSync(
                        localFile
                    )
                ) {

                    fs.rmSync(
                        localFile,
                        {
                            force:
                                true
                        }
                    );

                }

            }

        }


        /*
         * 第二阶段：
         *
         * 所有新资源一次性发布到 Cloudflare。
         *
         * 旧版是在每个文件中调用 run()，
         * 因此可能重复进行完整 CDN deployment。
         */
        if (
            pending.length >
            0
        ) {

            console.log(
                `Publishing ${pending.length} prepared batch item(s) to unified CDN in one deployment`
            );


            let publishError =
                null;


            try {

                await publishCDN();

            } catch (
                error
            ) {

                publishError =
                    error;


                console.error(
                    "Unified batch CDN publication failed:",
                    error
                );

            }


            if (
                publishError
            ) {

                for (
                    const {
                        item
                    }
                    of pending
                ) {

                    reportMap.set(
                        item.id,
                        reportFailure(
                            item,
                            publishError
                        )
                    );

                }

            } else {

                /*
                 * 第三阶段：
                 * CDN 发布成功以后逐个把 Storage DB
                 * 从 cdn-pending 收口到 complete。
                 */
                for (
                    const {
                        item,
                        publication
                    }
                    of pending
                ) {

                    try {

                        const result =
                            await finalizePublication(
                                publication
                            );


                        reportMap.set(
                            item.id,
                            {
                                itemId:
                                    item.id,

                                ok:
                                    true,

                                result
                            }
                        );


                        console.log(
                            `Batch item complete: ${result.id}`
                        );

                    } catch (
                        error
                    ) {

                        reportMap.set(
                            item.id,
                            reportFailure(
                                item,
                                error
                            )
                        );


                        console.error(
                            `Batch item finalize failed: ${item.originalName}: ${String(
                                error?.message ||
                                error
                            )}`
                        );

                    }

                }

            }

        }


        const reports =
            items.map(
                item =>
                    reportMap.get(
                        item.id
                    ) ||
                    {
                        itemId:
                            item.id,

                        ok:
                            false,

                        error:
                            "batch_item_result_missing"
                    }
            );


        writeResult(
            batchId,
            {
                ok:
                    true,

                items:
                    reports
            }
        );


        const successCount =
            reports.filter(
                item =>
                    item.ok ===
                    true
            ).length;


        console.log(
            `Batch processing complete: ${successCount}/${reports.length} successful`
        );

    } finally {

        preserved.restore();

    }

}


function callbackDelay(
    attempt
) {

    return [
        0,
        1200,
        2500,
        5000,
        9000,
        15000
    ][
        Math.min(
            attempt - 1,
            5
        )
    ];

}


function callbackRetryable(
    status
) {

    return (
        status === 408 ||
        status === 409 ||
        status === 425 ||
        status === 429 ||
        status >= 500
    );

}


async function postCallbackWithRetry(
    batchId,
    body
) {

    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= CALLBACK_ATTEMPTS;
        attempt += 1
    ) {

        const delay =
            callbackDelay(
                attempt
            );


        if (
            delay >
            0
        ) {

            await sleep(
                delay
            );

        }


        try {

            const token =
                await getOidcToken();


            const response =
                await fetch(
                    `${APP_URL}/api/internal/upload-batches/${encodeURIComponent(batchId)}/callback`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                body
                            )
                    }
                );


            if (
                response.ok
            ) {

                const result =
                    await response.json();


                console.log(
                    `Batch callback accepted on attempt ${attempt}`
                );


                console.log(
                    JSON.stringify(
                        result,
                        null,
                        2
                    )
                );


                return result;

            }


            const text =
                (
                    await response.text()
                )
                    .slice(
                        0,
                        500
                    );


            lastError =
                new Error(
                    `Batch callback failed (${response.status}): ${text}`
                );


            if (
                !callbackRetryable(
                    response.status
                )
            ) {

                throw lastError;

            }

        } catch (
            error
        ) {

            lastError =
                error;


            if (
                attempt ===
                CALLBACK_ATTEMPTS
            ) {

                break;

            }


            console.warn(
                `Batch callback attempt ${attempt} failed: ${String(
                    error?.message ||
                    error
                )}`
            );

        }

    }


    throw (
        lastError ||
        new Error(
            "Batch callback failed"
        )
    );

}


async function sendCallback(
    batchId
) {

    let data =
        readResult(
            batchId
        );


    /*
     * 如果主流水线甚至没能生成结果文件，
     * 尽量获取 Batch Manifest，
     * 把所有 Item 安全标为待确认，
     * 而不是让网页永远 processing。
     */
    if (
        !data
    ) {

        let manifest =
            null;


        try {

            const token =
                await getOidcToken();


            manifest =
                await fetchManifest(
                    batchId,
                    token
                );

        } catch {

            manifest =
                null;

        }


        data = {
            ok:
                false,

            items:
                Array.isArray(
                    manifest?.items
                )
                    ? manifest.items.map(
                        item => ({
                            itemId:
                                item.id,

                            ok:
                                false,

                            error:
                                "batch_pipeline_result_missing"
                        })
                    )
                    : []
        };

    }


    const pipelineOk =
        String(
            process.env.PIPELINE_OK ||
            ""
        )
            .toLowerCase() ===
        "true";


    return postCallbackWithRetry(
        batchId,
        {
            pipelineOk,

            items:
                Array.isArray(
                    data.items
                )
                    ? data.items
                    : []
        }
    );

}


async function main() {

    const mode =
        process.argv[2];


    const batchId =
        process.argv[3];


    if (
        !mode ||
        !batchId
    ) {

        throw new Error(
            "Usage: node api/batch-upload-runner.js <run|callback> <batch-id>"
        );

    }


    if (
        mode ===
        "run"
    ) {

        await runBatch(
            batchId
        );

        return;

    }


    if (
        mode ===
        "callback"
    ) {

        await sendCallback(
            batchId
        );

        return;

    }


    throw new Error(
        `Unknown mode: ${mode}`
    );

}


if (
    require.main ===
    module
) {

    main()
        .catch(
            error => {

                console.error(
                    error
                );

                process.exit(
                    1
                );

            }
        );

}
