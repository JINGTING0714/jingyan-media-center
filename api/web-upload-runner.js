"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    run
} = require("./upload");


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


const SOURCE_ATTEMPTS =
    24;


const SOURCE_RETRY_MS =
    5000;


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
    jobId
) {

    const temp =
        process.env.RUNNER_TEMP ||
        process.cwd();


    return path.join(
        temp,
        `jingyan-web-upload-${jobId}.json`
    );

}


function writeResult(
    jobId,
    data
) {

    fs.writeFileSync(
        resultPath(
            jobId
        ),
        JSON.stringify(
            data,
            null,
            2
        ) + "\n"
    );

}


function readResult(
    jobId
) {

    const file =
        resultPath(
            jobId
        );


    if (
        !fs.existsSync(
            file
        )
    ) {

        return {
            ok: false,
            error:
                "web_upload_result_missing"
        };

    }


    try {

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    } catch {

        return {
            ok: false,
            error:
                "web_upload_result_invalid"
        };

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


async function downloadSource(
    jobId
) {

    const token =
        await getOidcToken();


    const url =
        `${APP_URL}/api/internal/uploads/${encodeURIComponent(jobId)}/source`;


    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= SOURCE_ATTEMPTS;
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
                SOURCE_ATTEMPTS
            ) {

                await sleep(
                    SOURCE_RETRY_MS
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
                    "Staged upload filename missing"
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
                    "Invalid staged upload filename"
                );

            }


            filename =
                path.basename(
                    filename
                );


            if (
                !filename ||
                filename === ".gitkeep"
            ) {

                throw new Error(
                    "Invalid staged filename"
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
                `Staging source unavailable (${response.status}): ${text}`
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
            SOURCE_ATTEMPTS
        ) {

            await sleep(
                SOURCE_RETRY_MS
            );

        }

    }


    throw (
        lastError ||
        new Error(
            "Unable to retrieve staged upload"
        )
    );

}


function preserveUploadFolder(
    jobId
) {

    const uploadDir =
        path.resolve(
            "upload"
        );


    fs.mkdirSync(
        uploadDir,
        {
            recursive: true
        }
    );


    const preserveDir =
        path.join(
            process.env.RUNNER_TEMP ||
            process.cwd(),
            `preserved-upload-${jobId}`
        );


    fs.rmSync(
        preserveDir,
        {
            recursive: true,
            force: true
        }
    );


    fs.mkdirSync(
        preserveDir,
        {
            recursive: true
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

        restore() {

            for (
                const item
                of moved
            ) {

                if (
                    fs.existsSync(
                        item.original
                    )
                ) {

                    fs.rmSync(
                        item.original,
                        {
                            force:
                                true
                        }
                    );

                }


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


async function runWebUpload(
    jobId
) {

    const preserved =
        preserveUploadFolder(
            jobId
        );


    let localFile =
        null;


    try {

        const staged =
            await downloadSource(
                jobId
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


        const expectedSha256 =
            sha256(
                staged.buffer
            );


        const results =
            await run();


        const result =
            results.find(
                item =>
                    item.sha256 ===
                    expectedSha256
            );


        if (
            !result
        ) {

            throw new Error(
                "Media pipeline completed without matching upload result"
            );

        }


        writeResult(
            jobId,
            {
                ok: true,
                result
            }
        );


        console.log(
            `Web upload completed: ${result.id}`
        );

    } catch (
        error
    ) {

        writeResult(
            jobId,
            {
                ok: false,

                error:
                    String(
                        error?.message ||
                        error
                    )
                        .slice(
                            0,
                            500
                        )
            }
        );


        throw error;

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


async function postCallback(
    jobId,
    data
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
            delay > 0
        ) {

            await sleep(
                delay
            );

        }


        try {

            /*
             * 每次尝试重新申请 OIDC Token。
             * 避免第一次 Token/网络异常把已经完成的媒体
             * 永久留在 queued / processing。
             */
            const token =
                await getOidcToken();


            const response =
                await fetch(
                    `${APP_URL}/api/internal/uploads/${encodeURIComponent(jobId)}/callback`,
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
                                data
                            )
                    }
                );


            if (
                response.ok
            ) {

                console.log(
                    `Upload callback accepted for ${jobId} on attempt ${attempt}`
                );


                return;

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
                    `Upload callback failed (${response.status}): ${text}`
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
                `Upload callback attempt ${attempt} failed: ${String(
                    error?.message ||
                    error
                )}`
            );

        }

    }


    throw (
        lastError ||
        new Error(
            "Upload callback failed"
        )
    );

}


async function callback(
    jobId
) {

    let data =
        readResult(
            jobId
        );


    if (
        String(
            process.env.PIPELINE_OK ||
            ""
        )
            .toLowerCase() !==
        "true"
    ) {

        data = {
            ok:
                false,

            error:
                data.ok
                    ? "pipeline_state_not_saved"
                    : (
                        data.error ||
                        "pipeline_failed"
                    )
        };

    }


    await postCallback(
        jobId,
        data
    );

}


async function main() {

    const mode =
        process.argv[2];


    const jobId =
        process.argv[3];


    if (
        !mode ||
        !jobId
    ) {

        throw new Error(
            "Usage: node api/web-upload-runner.js <run|callback> <job-id>"
        );

    }


    if (
        mode ===
        "run"
    ) {

        await runWebUpload(
            jobId
        );

        return;

    }


    if (
        mode ===
        "callback"
    ) {

        await callback(
            jobId
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
