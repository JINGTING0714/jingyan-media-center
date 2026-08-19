const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


const {
    getFile
} = require("./github");


const {
    generateCDNPath
} = require("./cdn");



/* =========================================================
 * Config
 * ======================================================= */

function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


function getManifestFile() {

    const config =
        loadConfig();


    return config.cdn
        .manifestFile;

}



/* =========================================================
 * Manifest
 * ======================================================= */

function createEmptyManifest() {

    const config =
        loadConfig();


    return {

        version:
            1,

        worker:
            config.cdn.workerName,

        baseURL:
            config.cdn.baseURL,

        updatedAt:
            null,

        lastPublishedAt:
            null,

        lastVersionId:
            null,

        lastDeploymentId:
            null,

        assets: {}

    };

}


function ensureManifestFile() {

    const file =
        getManifestFile();


    const directory =
        path.dirname(
            file
        );


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive:
                    true
            }
        );

    }


    if (
        !fs.existsSync(
            file
        )
    ) {

        fs.writeFileSync(
            file,
            JSON.stringify(
                createEmptyManifest(),
                null,
                2
            ) + "\n"
        );

    }

}


function readManifest() {

    ensureManifestFile();


    const parsed =
        JSON.parse(
            fs.readFileSync(
                getManifestFile(),
                "utf8"
            )
        );


    if (
        !parsed.assets ||
        typeof parsed.assets !==
            "object" ||
        Array.isArray(
            parsed.assets
        )
    ) {

        parsed.assets = {};

    }


    return {

        ...createEmptyManifest(),

        ...parsed,

        assets:
            parsed.assets

    };

}


function writeManifest(
    manifest
) {

    ensureManifestFile();


    manifest.updatedAt =
        new Date()
            .toISOString();


    fs.writeFileSync(
        getManifestFile(),
        JSON.stringify(
            manifest,
            null,
            2
        ) + "\n"
    );

}



/* =========================================================
 * Hashing
 * ======================================================= */

function computeSHA256(
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


function computeCloudflareAssetHash(
    buffer,
    filePath
) {

    const extension =
        path.extname(
            filePath
        )
        .substring(1);


    return crypto
        .createHash(
            "sha256"
        )
        .update(
            buffer.toString(
                "base64"
            ) +
            extension
        )
        .digest(
            "hex"
        )
        .slice(
            0,
            32
        );

}



/* =========================================================
 * Asset validation
 * ======================================================= */

function getMaxAssetBytes() {

    const config =
        loadConfig();


    return (
        Number(
            config.cdn
                .maxAssetSizeMiB
        ) *
        1024 *
        1024
    );

}


function validateAssetSize(
    size,
    label
) {

    if (
        Number(size) >
        getMaxAssetBytes()
    ) {

        throw new Error(
            `Cloudflare asset too large: ${label} (${size} bytes)`
        );

    }

}



/* =========================================================
 * GitHub source download
 * ======================================================= */

function encodeContentPath(
    filePath
) {

    return String(
        filePath
    )
        .split("/")
        .map(
            part =>
                encodeURIComponent(
                    part
                )
        )
        .join("/");

}


async function downloadSourceBuffer(
    source
) {

    if (
        !source ||
        !source.repo ||
        !source.path
    ) {

        throw new Error(
            "CDN source information missing"
        );

    }


    const token =
        process.env.GH_TOKEN;


    if (!token) {

        throw new Error(
            "GH_TOKEN missing"
        );

    }


    const branch =
        source.branch ||
        "main";


    const url =

        "https://api.github.com/repos/" +
        source.repo +
        "/contents/" +
        encodeContentPath(
            source.path
        ) +
        "?ref=" +
        encodeURIComponent(
            branch
        );


    const response =
        await fetch(
            url,
            {
                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Accept":
                        "application/vnd.github.raw+json",

                    "X-GitHub-Api-Version":
                        "2022-11-28",

                    "User-Agent":
                        "jingyan-media-center"

                }
            }
        );


    if (!response.ok) {

        throw new Error(
            `Failed to download CDN source ${source.repo}/${source.path}: HTTP ${response.status}`
        );

    }


    return Buffer.from(
        await response.arrayBuffer()
    );

}



/* =========================================================
 * Asset records
 * ======================================================= */

function buildAssetObject({

    buffer,

    cdnPath,

    source,

    type,

    mediaId = null,

    sha256 = null,

    addedAt = null

}) {

    validateAssetSize(
        buffer.length,
        cdnPath
    );


    return {

        hash:
            computeCloudflareAssetHash(
                buffer,
                cdnPath
            ),

        size:
            buffer.length,

        sha256:
            sha256 ||
            computeSHA256(
                buffer
            ),

        type,

        mediaId,

        source: {

            repo:
                source.repo,

            branch:
                source.branch ||
                "main",

            path:
                source.path

        },

        addedAt:
            addedAt ||
            new Date()
                .toISOString()

    };

}


function registerCDNAsset({

    cdnPath,

    localFilePath,

    source,

    type,

    mediaId = null,

    sha256 = null

}) {

    if (
        !fs.existsSync(
            localFilePath
        )
    ) {

        throw new Error(
            `Local CDN source missing: ${localFilePath}`
        );

    }


    const manifest =
        readManifest();


    const buffer =
        fs.readFileSync(
            localFilePath
        );


    const existing =
        manifest.assets[
            cdnPath
        ];


    const asset =
        buildAssetObject({

            buffer,

            cdnPath,

            source,

            type,

            mediaId,

            sha256,

            addedAt:
                existing &&
                existing.addedAt

        });


    if (
        existing &&
        existing.hash !==
            asset.hash
    ) {

        throw new Error(
            `CDN path collision: ${cdnPath}`
        );

    }


    const before =
        existing
            ? JSON.stringify(
                existing
            )
            : null;


    manifest.assets[
        cdnPath
    ] =
        asset;


    const after =
        JSON.stringify(
            asset
        );


    const changed =
        before !==
        after;


    if (changed) {

        writeManifest(
            manifest
        );

    }


    return {

        changed,

        asset

    };

}


function getManifestAsset(
    cdnPath
) {

    const manifest =
        readManifest();


    return (
        manifest.assets[
            cdnPath
        ] ||
        null
    );

}



/* =========================================================
 * Legacy / Registry normalization
 * ======================================================= */

function getRepositoryFullName(
    record,
    repository
) {

    if (
        record &&
        record.source &&
        typeof record.source ===
            "object" &&
        record.source.repo
    ) {

        return record.source.repo;

    }


    if (
        record &&
        record.repository &&
        typeof record.repository ===
            "object" &&
        record.repository.fullName
    ) {

        return record.repository
            .fullName;

    }


    if (
        record &&
        typeof record.repository ===
            "string"
    ) {

        return record.repository;

    }


    return repository.repo;

}


function getRecordFilename(
    record,
    sourcePath = null
) {

    if (
        record &&
        typeof record.filename ===
            "string"
    ) {

        return record.filename;

    }


    if (
        record &&
        typeof record.file ===
            "string"
    ) {

        return path.posix.basename(
            record.file
        );

    }


    if (
        record &&
        record.file &&
        typeof record.file ===
            "object" &&
        typeof record.file.name ===
            "string"
    ) {

        return record.file.name;

    }


    if (sourcePath) {

        return path.posix.basename(
            sourcePath
        );

    }


    return null;

}


function getRecordSourcePath(
    record,
    repository
) {

    if (
        record &&
        record.source &&
        typeof record.source ===
            "object" &&
        record.source.path
    ) {

        return record.source.path;

    }


    if (
        record &&
        record.path
    ) {

        return record.path;

    }


    const filename =
        getRecordFilename(
            record
        );


    if (
        filename &&
        repository.folder
    ) {

        return (
            repository.folder +
            "/" +
            filename
        );

    }


    return null;

}


function shouldPublishRecord(
    record
) {

    if (!record) {

        return false;

    }


    if (
        record.status ===
            "deleted" ||
        record.deleted ===
            true
    ) {

        return false;

    }


    if (
        typeof record.sourceStatus ===
            "string" &&
        record.sourceStatus !==
            "complete"
    ) {

        return false;

    }


    if (
        !record.sourceStatus &&
        record.status ===
            "pending"
    ) {

        return false;

    }


    return true;

}



/* =========================================================
 * Manifest reconciliation
 * ======================================================= */

async function reconcileManifestFromDatabases() {

    const config =
        loadConfig();


    const manifest =
        readManifest();


    let changed =
        false;


    for (
        const type
        of [
            "image",
            "audio",
            "video"
        ]
    ) {

        const repositories =
            config.storage
                .repositories[
                    type
                ] ||
            [];


        for (
            const repository
            of repositories
        ) {

            const remoteDatabase =
                await getFile(

                    repository.repo,

                    repository.database,

                    repository.branch ||
                    "main"

                );


            if (
                !remoteDatabase ||
                !remoteDatabase.content
            ) {

                continue;

            }


            let records;


            try {

                records =
                    JSON.parse(
                        remoteDatabase.content
                    );

            } catch {

                throw new Error(
                    `Invalid database JSON: ${repository.repo}/${repository.database}`
                );

            }


            if (
                !Array.isArray(
                    records
                )
            ) {

                throw new Error(
                    `Database must be an array: ${repository.repo}/${repository.database}`
                );

            }


            for (
                const record
                of records
            ) {

                if (
                    !shouldPublishRecord(
                        record
                    )
                ) {

                    continue;

                }


                const sourcePath =
                    getRecordSourcePath(
                        record,
                        repository
                    );


                const filename =
                    getRecordFilename(
                        record,
                        sourcePath
                    );


                if (
                    !sourcePath ||
                    !filename
                ) {

                    continue;

                }


                const cdnPath =
                    record.cdnPath ||
                    generateCDNPath(
                        type,
                        filename
                    );


                if (
                    manifest.assets[
                        cdnPath
                    ]
                ) {

                    continue;

                }


                const source = {

                    repo:
                        getRepositoryFullName(
                            record,
                            repository
                        ),

                    branch:
                        (
                            record.source &&
                            typeof record.source ===
                                "object" &&
                            record.source.branch
                        ) ||
                        repository.branch ||
                        "main",

                    path:
                        sourcePath

                };


                const buffer =
                    await downloadSourceBuffer(
                        source
                    );


                manifest.assets[
                    cdnPath
                ] =
                    buildAssetObject({

                        buffer,

                        cdnPath,

                        source,

                        type,

                        mediaId:
                            record.id ||
                            null,

                        sha256:
                            record.sha256 ||
                            null

                    });


                console.log(
                    `CDN manifest added database record: ${cdnPath}`
                );


                changed =
                    true;

            }

        }

    }


    if (changed) {

        writeManifest(
            manifest
        );

    }


    return manifest;

}



/* =========================================================
 * Cloudflare manifest
 * ======================================================= */

function buildCloudflareManifest(
    manifest
) {

    const output = {};


    for (
        const [
            assetPath,
            asset
        ]
        of Object.entries(
            manifest.assets
        )
    ) {

        output[
            assetPath
        ] = {

            hash:
                asset.hash,

            size:
                asset.size

        };

    }


    return output;

}


function validateManifestLimits(
    manifest
) {

    const config =
        loadConfig();


    const count =
        Object.keys(
            manifest.assets
        ).length;


    if (
        count >
        Number(
            config.cdn.maxAssets
        )
    ) {

        throw new Error(
            `Cloudflare asset limit exceeded: ${count}/${config.cdn.maxAssets}`
        );

    }


    if (
        count >=
        Number(
            config.cdn.warningAssets
        )
    ) {

        console.warn(
            `CDN asset warning: ${count}/${config.cdn.maxAssets}`
        );

    }


    return count;

}



/* =========================================================
 * Cloudflare SDK
 * ======================================================= */

async function getCloudflareClient() {

    const apiToken =
        process.env
            .CLOUDFLARE_API_TOKEN;


    if (!apiToken) {

        throw new Error(
            "CLOUDFLARE_API_TOKEN missing"
        );

    }


    const module =
        await import(
            "cloudflare"
        );


    const Cloudflare =
        module.default ||
        module.Cloudflare;


    return new Cloudflare({
        apiToken
    });

}



/* =========================================================
 * Asset upload
 * ======================================================= */

async function getBufferForHash(
    manifest,
    hash
) {

    const entry =
        Object.entries(
            manifest.assets
        )
        .find(
            (
                [
                    ,
                    asset
                ]
            ) =>
                asset.hash ===
                hash
        );


    if (!entry) {

        throw new Error(
            `Manifest asset not found for hash: ${hash}`
        );

    }


    const [
        assetPath,
        asset
    ] =
        entry;


    const buffer =
        await downloadSourceBuffer(
            asset.source
        );


    if (
        buffer.length !==
        Number(
            asset.size
        )
    ) {

        throw new Error(
            `CDN source size mismatch: ${assetPath}`
        );

    }


    const calculatedHash =
        computeCloudflareAssetHash(
            buffer,
            assetPath
        );


    if (
        calculatedHash !==
        hash
    ) {

        throw new Error(
            `CDN source hash mismatch: ${assetPath}`
        );

    }


    return buffer;

}


async function uploadMissingAssets({

    client,

    accountId,

    manifest,

    buckets,

    uploadJwt

}) {

    let completionJwt =
        null;


    for (
        let index = 0;
        index <
        buckets.length;
        index++
    ) {

        const bucket =
            buckets[
                index
            ];


        const payload = {};


        for (
            const hash
            of bucket
        ) {

            const buffer =
                await getBufferForHash(
                    manifest,
                    hash
                );


            payload[
                hash
            ] =
                buffer.toString(
                    "base64"
                );

        }


        console.log(
            `Uploading Cloudflare asset bucket ${index + 1}/${buckets.length}`
        );


        const result =
            await client
                .workers
                .assets
                .upload
                .create(
                    {
                        account_id:
                            accountId,

                        base64:
                            true,

                        body:
                            payload
                    },
                    {
                        headers: {
                            Authorization:
                                `Bearer ${uploadJwt}`
                        }
                    }
                );


        if (
            result &&
            result.jwt
        ) {

            completionJwt =
                result.jwt;

        }

    }


    if (
        !completionJwt
    ) {

        throw new Error(
            "Cloudflare asset upload finished without completion JWT"
        );

    }


    return completionJwt;

}



/* =========================================================
 * CDN Worker
 *
 * Important:
 *
 * Images stay on Cloudflare's normal static-asset path.
 *
 * /music/* and /video/* are routed through this Worker so
 * Range requests can always return proper 206 responses.
 *
 * Cloudflare Static Assets currently limit an individual
 * asset to 25 MiB, so the temporary in-memory slicing used
 * here remains comfortably below the Worker memory limit.
 * ======================================================= */

function createWorkerScript() {

    return `
const MEDIA_PATH_PREFIXES = [
    "/music/",
    "/video/"
];


function isMediaPath(pathname) {

    return MEDIA_PATH_PREFIXES.some(
        prefix =>
            pathname.startsWith(
                prefix
            )
    );

}


function addSharedHeaders(
    headers
) {

    headers.set(
        "Accept-Ranges",
        "bytes"
    );

    headers.set(
        "Access-Control-Allow-Origin",
        "*"
    );

    headers.set(
        "Access-Control-Expose-Headers",
        [
            "Accept-Ranges",
            "Content-Length",
            "Content-Range",
            "Content-Type",
            "ETag",
            "Last-Modified"
        ].join(", ")
    );

    return headers;

}


function parseRange(
    rangeHeader,
    totalSize
) {

    if (
        !rangeHeader ||
        typeof rangeHeader !==
            "string"
    ) {

        return null;

    }


    const match =
        rangeHeader
            .trim()
            .match(
                /^bytes=(\\d*)-(\\d*)$/i
            );


    if (!match) {

        return {
            valid:
                false
        };

    }


    const startText =
        match[1];

    const endText =
        match[2];


    if (
        !startText &&
        !endText
    ) {

        return {
            valid:
                false
        };

    }


    let start;
    let end;


    if (!startText) {

        const suffixLength =
            Number(
                endText
            );


        if (
            !Number.isSafeInteger(
                suffixLength
            ) ||
            suffixLength <=
                0
        ) {

            return {
                valid:
                    false
            };

        }


        const actualLength =
            Math.min(
                suffixLength,
                totalSize
            );


        start =
            totalSize -
            actualLength;

        end =
            totalSize -
            1;

    } else {

        start =
            Number(
                startText
            );


        if (
            !Number.isSafeInteger(
                start
            ) ||
            start <
                0 ||
            start >=
                totalSize
        ) {

            return {
                valid:
                    false
            };

        }


        if (!endText) {

            end =
                totalSize -
                1;

        } else {

            end =
                Number(
                    endText
                );


            if (
                !Number.isSafeInteger(
                    end
                ) ||
                end <
                    start
            ) {

                return {
                    valid:
                        false
                };

            }


            end =
                Math.min(
                    end,
                    totalSize -
                    1
                );

        }

    }


    return {

        valid:
            true,

        start,

        end,

        length:
            end -
            start +
            1

    };

}


async function fetchFullAsset(
    request,
    env
) {

    const headers =
        new Headers(
            request.headers
        );


    /*
     * Do not forward the client's Range header to ASSETS.
     * We want the complete source object and then create a
     * deterministic 206 response ourselves.
     */
    headers.delete(
        "Range"
    );


    headers.delete(
        "If-Range"
    );


    const assetRequest =
        new Request(
            request.url,
            {
                method:
                    "GET",

                headers
            }
        );


    return env.ASSETS.fetch(
        assetRequest
    );

}


async function serveMedia(
    request,
    env
) {

    const method =
        request.method
            .toUpperCase();


    if (
        method !==
            "GET" &&
        method !==
            "HEAD"
    ) {

        return new Response(
            "Method Not Allowed",
            {
                status:
                    405,

                headers: {
                    "Allow":
                        "GET, HEAD"
                }
            }
        );

    }


    const assetResponse =
        await fetchFullAsset(
            request,
            env
        );


    if (
        !assetResponse.ok
    ) {

        return assetResponse;

    }


    const responseHeaders =
        addSharedHeaders(
            new Headers(
                assetResponse.headers
            )
        );


    /*
     * Filenames in Jingyan Media Center are immutable once
     * published. Long-lived public caching is therefore safe.
     */
    responseHeaders.set(
        "Cache-Control",
        "public, max-age=31536000, immutable"
    );


    const buffer =
        await assetResponse
            .arrayBuffer();


    const totalSize =
        buffer.byteLength;


    responseHeaders.set(
        "Content-Length",
        String(
            totalSize
        )
    );


    if (
        method ===
            "HEAD"
    ) {

        return new Response(
            null,
            {
                status:
                    200,

                headers:
                    responseHeaders
            }
        );

    }


    const rangeHeader =
        request.headers.get(
            "Range"
        );


    if (!rangeHeader) {

        return new Response(
            buffer,
            {
                status:
                    200,

                headers:
                    responseHeaders
            }
        );

    }


    const range =
        parseRange(
            rangeHeader,
            totalSize
        );


    if (
        !range ||
        !range.valid
    ) {

        const headers =
            new Headers(
                responseHeaders
            );


        headers.set(
            "Content-Range",
            \`bytes */\${totalSize}\`
        );


        headers.set(
            "Content-Length",
            "0"
        );


        return new Response(
            null,
            {
                status:
                    416,

                headers
            }
        );

    }


    const chunk =
        buffer.slice(
            range.start,
            range.end +
            1
        );


    const headers =
        new Headers(
            responseHeaders
        );


    headers.set(
        "Content-Range",
        \`bytes \${range.start}-\${range.end}/\${totalSize}\`
    );


    headers.set(
        "Content-Length",
        String(
            range.length
        )
    );


    return new Response(
        chunk,
        {
            status:
                206,

            headers
        }
    );

}


export default {

    async fetch(
        request,
        env
    ) {

        const url =
            new URL(
                request.url
            );


        if (
            url.pathname ===
                "/"
        ) {

            return new Response(
                "Jingyan Media CDN",
                {
                    status:
                        200,

                    headers: {
                        "Content-Type":
                            "text/plain; charset=utf-8",

                        "Cache-Control":
                            "no-store"
                    }
                }
            );

        }


        if (
            isMediaPath(
                url.pathname
            )
        ) {

            return serveMedia(
                request,
                env
            );

        }


        return env.ASSETS.fetch(
            request
        );

    }

};
`.trim();

}



/* =========================================================
 * Publish
 * ======================================================= */

async function publishCDN() {

    const config =
        loadConfig();


    if (
        !config.cdn ||
        !config.cdn.enabled
    ) {

        throw new Error(
            "CDN is disabled"
        );

    }


    const accountId =
        process.env
            .CLOUDFLARE_ACCOUNT_ID;


    if (!accountId) {

        throw new Error(
            "CLOUDFLARE_ACCOUNT_ID missing"
        );

    }


    const manifest =

        config.cdn
            .reconcileDatabasesOnPublish

            ? await reconcileManifestFromDatabases()

            : readManifest();


    const assetCount =
        validateManifestLimits(
            manifest
        );


    if (
        assetCount ===
        0
    ) {

        throw new Error(
            "CDN manifest contains no assets"
        );

    }


    const client =
        await getCloudflareClient();


    const workerName =
        config.cdn.workerName;


    const worker =
        await client
            .workers
            .beta
            .workers
            .get(
                workerName,
                {
                    account_id:
                        accountId
                }
            );


    if (
        !worker ||
        !worker.id
    ) {

        throw new Error(
            `Cloudflare Worker not found: ${workerName}`
        );

    }


    console.log(
        `Publishing ${assetCount} CDN asset(s)`
    );


    const uploadSession =
        await client
            .workers
            .scripts
            .assets
            .upload
            .create(
                workerName,
                {
                    account_id:
                        accountId,

                    manifest:
                        buildCloudflareManifest(
                            manifest
                        )
                }
            );


    if (
        !uploadSession ||
        !uploadSession.jwt ||
        !Array.isArray(
            uploadSession.buckets
        )
    ) {

        throw new Error(
            "Failed to start Cloudflare asset upload session"
        );

    }


    const buckets =
        uploadSession.buckets;


    let completionJwt;


    if (
        buckets.length ===
        0
    ) {

        console.log(
            "Cloudflare already has all required asset hashes"
        );


        completionJwt =
            uploadSession.jwt;

    } else {

        completionJwt =
            await uploadMissingAssets({

                client,

                accountId,

                manifest,

                buckets,

                uploadJwt:
                    uploadSession.jwt

            });

    }


    const workerScript =
        createWorkerScript();


    const version =
        await client
            .workers
            .beta
            .workers
            .versions
            .create(
                worker.id,
                {
                    account_id:
                        accountId,

                    main_module:
                        "jingyan-media-cdn.mjs",

                    compatibility_date:
                        config.cdn
                            .compatibilityDate,

                    bindings: [
                        {
                            type:
                                "assets",

                            name:
                                "ASSETS"
                        }
                    ],

                    assets: {

                        jwt:
                            completionJwt,

                        config: {

                            html_handling:
                                "none",

                            not_found_handling:
                                "none",

                            /*
                             * Only audio/video go through the
                             * Worker first.
                             *
                             * Images remain direct static assets.
                             */
                            run_worker_first: [
                                "/music/*",
                                "/video/*"
                            ]

                        }

                    },

                    modules: [
                        {
                            name:
                                "jingyan-media-cdn.mjs",

                            content_type:
                                "application/javascript+module",

                            content_base64:
                                Buffer
                                    .from(
                                        workerScript,
                                        "utf8"
                                    )
                                    .toString(
                                        "base64"
                                    )
                        }
                    ]
                }
            );


    if (
        !version ||
        !version.id
    ) {

        throw new Error(
            "Cloudflare Worker version creation failed"
        );

    }


    const deployment =
        await client
            .workers
            .scripts
            .deployments
            .create(
                workerName,
                {
                    account_id:
                        accountId,

                    strategy:
                        "percentage",

                    versions: [
                        {
                            percentage:
                                100,

                            version_id:
                                version.id
                        }
                    ]
                }
            );


    if (
        !deployment ||
        !deployment.id
    ) {

        throw new Error(
            "Cloudflare deployment failed"
        );

    }


    manifest.lastPublishedAt =
        new Date()
            .toISOString();


    manifest.lastVersionId =
        version.id;


    manifest.lastDeploymentId =
        deployment.id;


    writeManifest(
        manifest
    );


    console.log(
        `Cloudflare CDN published: ${config.cdn.baseURL}`
    );


    console.log(
        "Range / Seek support enabled for /music/* and /video/*"
    );


    return {

        assetCount,

        versionId:
            version.id,

        deploymentId:
            deployment.id,

        baseURL:
            config.cdn.baseURL

    };

}



/* =========================================================
 * CLI
 * ======================================================= */

if (
    require.main ===
    module
) {

    const command =
        process.argv[2] ||
        "publish";


    let task;


    if (
        command ===
        "publish"
    ) {

        task =
            publishCDN();

    } else if (
        command ===
        "reconcile"
    ) {

        task =
            reconcileManifestFromDatabases();

    } else {

        console.error(
            `Unknown Cloudflare command: ${command}`
        );

        process.exit(1);

    }


    Promise.resolve(
        task
    )
        .then(
            result => {

                if (result) {

                    console.log(
                        "Cloudflare task complete"
                    );

                }

            }
        )
        .catch(
            error => {

                console.error(
                    "Cloudflare task failed:"
                );

                console.error(
                    error
                );

                process.exit(1);

            }
        );

}



/* =========================================================
 * Exports
 * ======================================================= */

module.exports = {

    readManifest,

    writeManifest,

    computeCloudflareAssetHash,

    registerCDNAsset,

    getManifestAsset,

    reconcileManifestFromDatabases,

    publishCDN

};
