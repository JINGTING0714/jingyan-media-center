const fs =
    require(
        "fs"
    );

const path =
    require(
        "path"
    );


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


const CHUNK_SIZE =
    160;


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
        requestUrl.includes(
            "?"
        )

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


async function postJson(
    token,
    endpoint,
    body
) {

    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= 4;
        attempt += 1
    ) {

        const response =
            await fetch(

                `${APP_URL}${endpoint}`,

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

            return response.json();

        }


        const text =
            (
                await response.text()
            )
            .slice(
                0,
                800
            );


        lastError =
            new Error(
                `${endpoint} failed (${response.status}): ${text}`
            );


        const retryable =
            response.status ===
                429 ||
            response.status >=
                500;


        if (
            !retryable ||
            attempt ===
                4
        ) {

            throw lastError;

        }


        await sleep(
            attempt *
            2000
        );

    }


    throw lastError ||
        new Error(
            "Media index request failed"
        );

}


function loadManifest() {

    const file =
        path.resolve(
            "data/cdn-manifest.json"
        );


    if (
        !fs.existsSync(
            file
        )
    ) {

        throw new Error(
            "data/cdn-manifest.json missing"
        );

    }


    const manifest =
        JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );


    if (
        !manifest ||
        typeof manifest !==
            "object" ||
        !manifest.assets ||
        typeof manifest.assets !==
            "object" ||
        Array.isArray(
            manifest.assets
        )
    ) {

        throw new Error(
            "Invalid CDN manifest"
        );

    }


    return manifest;

}


function manifestMeta(
    manifest
) {

    return {

        version:
            manifest.version ??
            null,

        worker:
            manifest.worker ||
            null,

        baseURL:
            manifest.baseURL ||
            null,

        updatedAt:
            manifest.updatedAt ||
            null,

        lastPublishedAt:
            manifest.lastPublishedAt ||
            null,

        lastVersionId:
            manifest.lastVersionId ||
            null,

        lastDeploymentId:
            manifest.lastDeploymentId ||
            null,

        totalAssets:
            Object.keys(
                manifest.assets
            )
            .length

    };

}


function manifestAssets(
    manifest
) {

    return Object.entries(
        manifest.assets
    )
    .map(
        ([
            publicPath,
            entry
        ]) => ({

            path:
                publicPath,

            entry

        })
    );

}


function chunks(
    list,
    size
) {

    const result =
        [];


    for (
        let index = 0;
        index < list.length;
        index += size
    ) {

        result.push(
            list.slice(
                index,
                index +
                size
            )
        );

    }


    return result;

}


async function fullSync() {

    const manifest =
        loadManifest();


    const assets =
        manifestAssets(
            manifest
        );


    const token =
        await getOidcToken();


    const start =
        await postJson(

            token,

            "/api/internal/media-sync/full/start",

            {
                manifest:
                    manifestMeta(
                        manifest
                    )
            }

        );


    const syncId =
        start.syncId;


    if (!syncId) {

        throw new Error(
            "Media sync ID missing"
        );

    }


    console.log(
        `Media index full sync started: ${assets.length} assets`
    );


    let written =
        0;


    for (
        const group
        of chunks(
            assets,
            CHUNK_SIZE
        )
    ) {

        const response =
            await postJson(

                token,

                "/api/internal/media-sync/full/chunk",

                {
                    syncId,
                    assets:
                        group
                }

            );


        written +=
            Number(
                response.written ||
                0
            );


        console.log(
            `Media index sync progress: ${written}/${assets.length}`
        );

    }


    const finalized =
        await postJson(

            token,

            "/api/internal/media-sync/full/finalize",

            {
                syncId
            }

        );


    console.log(
        `Media index full sync complete: ${finalized.syncedCount} assets`
    );

}


function resultFile(
    jobId
) {

    return path.join(

        process.env.RUNNER_TEMP ||
        process.cwd(),

        `jingyan-web-upload-${jobId}.json`

    );

}


async function syncWebUpload(
    jobId
) {

    const file =
        resultFile(
            jobId
        );


    if (
        !fs.existsSync(
            file
        )
    ) {

        throw new Error(
            "Web upload result missing"
        );

    }


    const result =
        JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );


    if (
        result.ok !==
        true
    ) {

        throw new Error(
            "Web upload did not complete successfully"
        );

    }


    const token =
        await getOidcToken();


    const response =
        await postJson(

            token,

            "/api/internal/media-sync/upload",

            {
                jobId
            }

        );


    console.log(
        `Media index updated for ${response.mediaId}`
    );

}


async function main() {

    const mode =
        process.argv[2];


    if (
        mode ===
        "full"
    ) {

        await fullSync();

        return;

    }


    if (
        mode ===
        "upload"
    ) {

        const jobId =
            process.argv[3];


        if (!jobId) {

            throw new Error(
                "Usage: node api/media-index-sync.js upload <job-id>"
            );

        }


        await syncWebUpload(
            jobId
        );

        return;

    }


    throw new Error(
        "Usage: node api/media-index-sync.js <full|upload> [job-id]"
    );

}


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
