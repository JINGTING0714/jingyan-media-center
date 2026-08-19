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

    return loadConfig()
        .cdn
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
 * Hash
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
 * Limits
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
 * GitHub source
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
 * CDN Asset
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
 * Storage compatibility
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
 * Reconcile databases -> CDN
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
 * Cloudflare Manifest
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
 * Direct link:
 *
 * Browser navigation
 *     -> lightweight media player page
 *
 * <audio>, <video>, Range, API
 *     -> original raw media stream
 *
 * Therefore the same CDN URL works both as:
 *
 * 1. a shareable direct browser link
 * 2. a real audio/video source URL
 * ======================================================= */

function createWorkerScript() {

    return String.raw`
const MEDIA_PREFIXES = [
    "/audio/",
    "/music/",
    "/video/"
];


const MIME_TYPES = {

    ".mp3":
        "audio/mpeg",

    ".wav":
        "audio/wav",

    ".flac":
        "audio/flac",

    ".aac":
        "audio/aac",

    ".m4a":
        "audio/mp4",

    ".ogg":
        "audio/ogg",

    ".oga":
        "audio/ogg",

    ".mp4":
        "video/mp4",

    ".m4v":
        "video/mp4",

    ".webm":
        "video/webm",

    ".mov":
        "video/quicktime"

};


function isMediaPath(
    pathname
) {

    const lower =
        String(
            pathname ||
            ""
        )
        .toLowerCase();


    return MEDIA_PREFIXES
        .some(
            prefix =>
                lower.startsWith(
                    prefix
                )
        );

}


function getExtension(
    pathname
) {

    const filename =
        String(
            pathname ||
            ""
        )
        .split("/")
        .pop() ||
        "";


    const dot =
        filename.lastIndexOf(
            "."
        );


    if (
        dot <
        0
    ) {

        return "";

    }


    return filename
        .substring(
            dot
        )
        .toLowerCase();

}


function getMimeType(
    pathname
) {

    return (
        MIME_TYPES[
            getExtension(
                pathname
            )
        ] ||
        "application/octet-stream"
    );

}


function getMediaKind(
    pathname
) {

    const mime =
        getMimeType(
            pathname
        );


    if (
        mime.startsWith(
            "video/"
        )
    ) {

        return "video";

    }


    if (
        mime.startsWith(
            "audio/"
        )
    ) {

        return "audio";

    }


    return "file";

}


function getFilename(
    pathname
) {

    const raw =
        String(
            pathname ||
            ""
        )
        .split("/")
        .pop() ||
        "media";


    try {

        return decodeURIComponent(
            raw
        );

    } catch {

        return raw;

    }

}


function escapeHtml(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#39;"
    );

}


function shouldRenderPlayer(
    request,
    url
) {

    if (
        request.method !==
        "GET"
    ) {

        return false;

    }


    if (
        url.searchParams.get(
            "raw"
        ) ===
        "1"
    ) {

        return false;

    }


    const fetchMode =
        request.headers.get(
            "Sec-Fetch-Mode"
        ) ||
        "";


    const fetchDest =
        request.headers.get(
            "Sec-Fetch-Dest"
        ) ||
        "";


    const accept =
        request.headers.get(
            "Accept"
        ) ||
        "";


    return (
        fetchMode ===
            "navigate" ||

        fetchDest ===
            "document" ||

        accept.includes(
            "text/html"
        )
    );

}


function buildRawMediaUrl(
    request
) {

    const rawUrl =
        new URL(
            request.url
        );


    rawUrl.searchParams.set(
        "raw",
        "1"
    );


    return (
        rawUrl.pathname +
        rawUrl.search
    );

}


function buildPlayerHtml(
    request,
    url
) {

    const kind =
        getMediaKind(
            url.pathname
        );


    const mime =
        getMimeType(
            url.pathname
        );


    const filename =
        getFilename(
            url.pathname
        );


    const mediaSource =
        buildRawMediaUrl(
            request
        );


    const safeFilename =
        escapeHtml(
            filename
        );


    const safeSource =
        escapeHtml(
            mediaSource
        );


    const safeMime =
        escapeHtml(
            mime
        );


    let player;


    if (
        kind ===
        "video"
    ) {

        player =
            '<video class="media video" controls playsinline preload="metadata">' +
                '<source src="' +
                    safeSource +
                    '" type="' +
                    safeMime +
                    '">' +
                '当前浏览器无法播放这个视频。' +
            '</video>';

    } else {

        player =
            '<div class="audio-art">' +
                '<span>♫</span>' +
            '</div>' +

            '<audio class="media audio" controls preload="metadata">' +
                '<source src="' +
                    safeSource +
                    '" type="' +
                    safeMime +
                    '">' +
                '当前浏览器无法播放这个音频。' +
            '</audio>';

    }


    return [
        '<!doctype html>',

        '<html lang="zh-CN">',

        '<head>',

        '<meta charset="utf-8">',

        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',

        '<meta name="color-scheme" content="light">',

        '<title>',
        safeFilename,
        ' · Jingyan Media',
        '</title>',

        '<style>',

        ':root{',
            'color-scheme:light;',
            '--bg:#f8f7fb;',
            '--surface:rgba(255,255,255,.92);',
            '--text:#2c1c4d;',
            '--muted:#887d9c;',
            '--purple:#8058e8;',
            '--purple-soft:#eee8ff;',
            '--mint:#43b88c;',
            '--sky:#58a7e8;',
            '--line:rgba(91,65,129,.12);',
        '}',

        '*{box-sizing:border-box}',

        'html,body{',
            'margin:0;',
            'min-height:100%;',
        '}',

        'body{',
            'min-height:100svh;',
            'display:grid;',
            'place-items:center;',
            'padding:clamp(16px,4vw,40px);',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
            'color:var(--text);',
            'background:',
                'radial-gradient(circle at 10% 5%,rgba(128,88,232,.11),transparent 30%),',
                'radial-gradient(circle at 90% 18%,rgba(88,167,232,.07),transparent 26%),',
                'radial-gradient(circle at 82% 90%,rgba(67,184,140,.05),transparent 24%),',
                'var(--bg);',
        '}',

        '.shell{',
            'width:min(980px,100%);',
        '}',

        '.brand{',
            'margin:0 0 14px;',
            'display:flex;',
            'align-items:center;',
            'gap:10px;',
            'color:var(--muted);',
            'font-size:12px;',
        '}',

        '.mark{',
            'width:32px;',
            'height:32px;',
            'display:grid;',
            'place-items:center;',
            'border-radius:10px;',
            'color:#fff;',
            'font-weight:800;',
            'background:linear-gradient(145deg,#956df0,#7045df);',
            'box-shadow:0 8px 20px rgba(112,69,223,.18);',
        '}',

        '.card{',
            'padding:clamp(14px,2.4vw,24px);',
            'border:1px solid var(--line);',
            'border-radius:24px;',
            'background:var(--surface);',
            'box-shadow:0 24px 70px rgba(62,40,94,.09);',
            'backdrop-filter:blur(16px);',
        '}',

        '.video{',
            'width:100%;',
            'max-height:78svh;',
            'display:block;',
            'border-radius:18px;',
            'background:#09070c;',
        '}',

        '.audio-art{',
            'height:min(260px,42svh);',
            'margin-bottom:18px;',
            'display:grid;',
            'place-items:center;',
            'border-radius:18px;',
            'background:',
                'radial-gradient(circle at 30% 25%,rgba(255,255,255,.55),transparent 28%),',
                'linear-gradient(145deg,#eee8ff,#edf7ff 60%,#edf9f4);',
        '}',

        '.audio-art span{',
            'width:78px;',
            'height:78px;',
            'display:grid;',
            'place-items:center;',
            'border-radius:24px;',
            'color:#fff;',
            'font-size:32px;',
            'background:linear-gradient(145deg,#956df0,#7045df);',
            'box-shadow:0 18px 35px rgba(112,69,223,.22);',
        '}',

        '.audio{',
            'width:100%;',
            'display:block;',
        '}',

        '.info{',
            'margin-top:16px;',
            'display:flex;',
            'align-items:center;',
            'justify-content:space-between;',
            'gap:14px;',
        '}',

        '.copy{min-width:0}',

        '.name{',
            'margin:0;',
            'overflow:hidden;',
            'font-size:14px;',
            'font-weight:700;',
            'text-overflow:ellipsis;',
            'white-space:nowrap;',
        '}',

        '.meta{',
            'margin:5px 0 0;',
            'color:var(--muted);',
            'font-size:10px;',
        '}',

        '.badge{',
            'flex:0 0 auto;',
            'padding:6px 9px;',
            'border-radius:999px;',
            'color:var(--purple);',
            'background:var(--purple-soft);',
            'font-size:9px;',
            'font-weight:800;',
        '}',

        '@media(max-width:600px){',
            'body{',
                'padding:12px;',
                'place-items:center;',
            '}',

            '.card{',
                'padding:12px;',
                'border-radius:20px;',
            '}',

            '.video{',
                'max-height:72svh;',
                'border-radius:14px;',
            '}',

            '.audio-art{',
                'height:34svh;',
                'min-height:180px;',
                'border-radius:14px;',
            '}',

            '.brand{',
                'margin-left:4px;',
            '}',
        '}',

        '</style>',

        '</head>',

        '<body>',

        '<main class="shell">',

        '<div class="brand">',
            '<span class="mark">J</span>',
            '<span>Jingyan Media CDN</span>',
        '</div>',

        '<section class="card">',

        player,

        '<div class="info">',

        '<div class="copy">',
            '<p class="name">',
                safeFilename,
            '</p>',
            '<p class="meta">',
                kind === "video"
                    ? "视频直链 · 支持拖动进度"
                    : "音频直链 · 支持拖动进度",
            '</p>',
        '</div>',

        '<span class="badge">',
            kind === "video"
                ? "VIDEO"
                : "AUDIO",
        '</span>',

        '</div>',

        '</section>',

        '</main>',

        '</body>',

        '</html>'

    ].join("");

}


function playerResponse(
    request,
    url
) {

    const html =
        buildPlayerHtml(
            request,
            url
        );


    return new Response(
        html,
        {
            status:
                200,

            headers: {

                "Content-Type":
                    "text/html; charset=utf-8",

                "Cache-Control":
                    "no-store",

                "Content-Security-Policy":
                    "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; base-uri 'none'; frame-ancestors 'none'",

                "Referrer-Policy":
                    "no-referrer",

                "X-Content-Type-Options":
                    "nosniff",

                "X-Frame-Options":
                    "DENY"

            }
        }
    );

}


function corsHeaders() {

    return {

        "Access-Control-Allow-Origin":
            "*",

        "Access-Control-Allow-Methods":
            "GET, HEAD, OPTIONS",

        "Access-Control-Allow-Headers":
            "Range, If-Range, Content-Type",

        "Access-Control-Expose-Headers":
            [
                "Accept-Ranges",
                "Content-Length",
                "Content-Range",
                "Content-Type",
                "Content-Disposition",
                "ETag",
                "Last-Modified"
            ].join(", ")

    };

}


function applyRawMediaHeaders(
    originalHeaders,
    pathname
) {

    const headers =
        new Headers(
            originalHeaders
        );


    headers.set(
        "Content-Type",
        getMimeType(
            pathname
        )
    );


    headers.set(
        "Content-Disposition",
        "inline"
    );


    headers.set(
        "Accept-Ranges",
        "bytes"
    );


    /*
     * While the site is still being completed, do not keep
     * final media response headers frozen in browser cache
     * for one year.
     *
     * After V1 stabilizes we can increase this safely.
     */
    headers.set(
        "Cache-Control",
        "public, max-age=3600, must-revalidate"
    );


    headers.set(
        "Access-Control-Allow-Origin",
        "*"
    );


    headers.set(
        "Access-Control-Allow-Methods",
        "GET, HEAD, OPTIONS"
    );


    headers.set(
        "Access-Control-Allow-Headers",
        "Range, If-Range, Content-Type"
    );


    headers.set(
        "Access-Control-Expose-Headers",
        [
            "Accept-Ranges",
            "Content-Length",
            "Content-Range",
            "Content-Type",
            "Content-Disposition",
            "ETag",
            "Last-Modified"
        ].join(", ")
    );


    headers.set(
        "Cross-Origin-Resource-Policy",
        "cross-origin"
    );


    headers.set(
        "X-Content-Type-Options",
        "nosniff"
    );


    return headers;

}


async function rawMediaResponse(
    request,
    env,
    url
) {

    const assetUrl =
        new URL(
            request.url
        );


    /*
     * raw=1 exists only to prevent the player shell from
     * recursively loading itself.
     *
     * The actual static asset does not need this parameter.
     */
    assetUrl.searchParams.delete(
        "raw"
    );


    const assetRequest =
        new Request(
            assetUrl.toString(),
            request
        );


    const response =
        await env.ASSETS.fetch(
            assetRequest
        );


    if (
        response.status ===
        404
    ) {

        return response;

    }


    const headers =
        applyRawMediaHeaders(
            response.headers,
            url.pathname
        );


    return new Response(
        request.method ===
            "HEAD"
            ? null
            : response.body,
        {
            status:
                response.status,

            statusText:
                response.statusText,

            headers
        }
    );

}


async function serveMedia(
    request,
    env,
    url
) {

    const method =
        request.method
            .toUpperCase();


    if (
        method ===
        "OPTIONS"
    ) {

        return new Response(
            null,
            {
                status:
                    204,

                headers:
                    corsHeaders()
            }
        );

    }


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
                    ...corsHeaders(),

                    "Allow":
                        "GET, HEAD, OPTIONS"
                }
            }
        );

    }


    /*
     * Someone actually opens the direct CDN URL in a browser.
     *
     * Give that person a player instead of leaving the
     * browser free to decide whether the MP4 should download.
     */
    if (
        shouldRenderPlayer(
            request,
            url
        )
    ) {

        return playerResponse(
            request,
            url
        );

    }


    /*
     * <audio>, <video>, Range requests, external players,
     * API clients and raw=1 all receive the real file.
     */
    return rawMediaResponse(
        request,
        env,
        url
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
            isMediaPath(
                url.pathname
            )
        ) {

            return serveMedia(
                request,
                env,
                url
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

        completionJwt =
            uploadSession.jwt;


        console.log(
            "Cloudflare already has all required assets"
        );

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

                    compatibility_flags: [
                        "assets_navigation_has_no_effect"
                    ],

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

                            run_worker_first: [

                                "/audio/*",

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
        "Direct media navigation player: enabled"
    );


    console.log(
        "Raw audio/video Range delivery: enabled"
    );


    console.log(
        "Desktop + Mobile media routing: enabled"
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
