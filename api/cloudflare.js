const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


const {
    getFile
} = require("./github");


const {
    generateCDNPath
} = require("./cdn");


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

    return config.cdn.manifestFile;

}


function createEmptyManifest() {

    const config =
        loadConfig();


    return {

        version: 1,

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
        path.dirname(file);


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
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

    const maxBytes =
        getMaxAssetBytes();


    if (
        Number(size) >
        maxBytes
    ) {

        throw new Error(
            `Cloudflare asset too large: ${label} (${size} bytes)`
        );

    }

}


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
        before !== after;


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


function getRepositoryFullName(
    record,
    repository
) {

    if (
        record &&
        record.source &&
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

        return record
            .repository
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


function getRecordSourcePath(
    record
) {

    if (
        record &&
        record.source &&
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


    return null;

}


function getRecordFilename(
    record,
    sourcePath
) {

    if (
        record &&
        record.filename
    ) {

        return record.filename;

    }


    if (
        record &&
        record.file
    ) {

        return record.file;

    }


    if (sourcePath) {

        return path.posix.basename(
            sourcePath
        );

    }


    return null;

}


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
                .repositories[type] ||
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
                    record &&
                    (
                        record.status ===
                        "deleted" ||
                        record.deleted ===
                        true
                    )
                ) {

                    continue;

                }


                const sourcePath =
                    getRecordSourcePath(
                        record
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
                    `CDN manifest added legacy record: ${cdnPath}`
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
                asset.hash === hash
        );


    if (!entry) {

        throw new Error(
            `Manifest asset not found for hash: ${hash}`
        );

    }


    const [
        assetPath,
        asset
    ] = entry;


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
        index < buckets.length;
        index++
    ) {

        const bucket =
            buckets[index];


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


function createWorkerScript() {

    return `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Jingyan Media CDN", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
`.trim();

}


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
        assetCount === 0
    ) {

        throw new Error(
            "CDN manifest contains no assets"
        );

    }


    const client =
        await getCloudflareClient();


    const workerName =
        config.cdn
            .workerName;


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
        buckets.length === 0
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

                            run_worker_first:
                                false

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
                    ],

                    annotations: {

                        "workers/message":
                            `Jingyan CDN ${assetCount} assets`,

                        "workers/triggered_by":
                            "jingyan-media-center"

                    }

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
                    ],

                    annotations: {

                        "workers/message":
                            `Jingyan CDN ${assetCount} assets`,

                        "workers/triggered_by":
                            "jingyan-media-center"

                    }

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


if (
    require.main === module
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


module.exports = {

    readManifest,

    writeManifest,

    computeCloudflareAssetHash,

    registerCDNAsset,

    getManifestAsset,

    reconcileManifestFromDatabases,

    publishCDN

};
