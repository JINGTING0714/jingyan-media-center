const fs =
    require("fs");

const path =
    require("path");

const crypto =
    require("crypto");


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
        ) +
        "\n"
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
        attempt++
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
                409
            ].includes(
                response.status
            )
        ) {
            throw lastError;
        }


        if (
            attempt <
            12
        ) {
            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        3000
                    )
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
            name:
                entry.name,

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


    const reports =
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


        for (
            const item
            of items
        ) {
            preserved.clean();


            console.log(
                `Processing batch item ${item.position + 1}/${items.length}: ${item.originalName}`
            );


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


                const localFile =
                    path.join(
                        preserved.uploadDir,
                        staged.filename
                    );


                fs.writeFileSync(
                    localFile,
                    staged.buffer
                );


                const results =
                    await run();


                const result =
                    results.find(
                        candidate =>
                            candidate.sha256 ===
                            expectedSha
                    );


                if (
                    !result
                ) {
                    throw new Error(
                        "Media pipeline completed without matching batch result"
                    );
                }


                reports.push({
                    itemId:
                        item.id,

                    ok:
                        true,

                    result
                });


                console.log(
                    `Batch item complete: ${result.id}`
                );

            } catch (
                error
            ) {
                const message =
                    String(
                        error?.message ||
                        error
                    )
                    .slice(
                        0,
                        500
                    );


                reports.push({
                    itemId:
                        item.id,

                    ok:
                        false,

                    error:
                        message
                });


                console.error(
                    `Batch item failed: ${item.originalName}: ${message}`
                );
            }
        }


        writeResult(
            batchId,
            {
                ok:
                    true,

                items:
                    reports
            }
        );


        console.log(
            `Batch processing complete: ${reports.length} item(s)`
        );

    } finally {
        preserved.restore();
    }
}


async function sendCallback(
    batchId
) {
    const token =
        await getOidcToken();


    let data =
        readResult(
            batchId
        );


    if (
        !data
    ) {
        let manifest =
            null;


        try {
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
                    JSON.stringify({
                        pipelineOk,

                        items:
                            Array.isArray(
                                data.items
                            )
                                ? data.items
                                : []
                    })
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
            `Batch callback failed (${response.status}): ${text}`
        );
    }


    const result =
        await response.json();


    console.log(
        "Batch callback accepted:"
    );


    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
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

                process.exit(1);
            }
        );
}
