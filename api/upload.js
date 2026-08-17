const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


const {
    renameFile
} = require("./rename");


const {

    reconcileRepositories,

    selectRepository,

    syncRepositoryStatus

} = require("./repository");


const {

    uploadFile,

    fileExists,

    verifyRemoteFileMatchesLocal

} = require("./github");


const {

    generateCDNPath,

    generateCDNURL,

    isUnifiedCDNURL

} = require("./cdn");


const {

    registerCDNAsset,

    getManifestAsset,

    publishCDN

} = require("./cloudflare");


const {

    findRecordByHash,

    reserveSequence,

    upsertPendingRecord,

    markRecordSourceComplete,

    markRecordCDNPending,

    markRecordComplete

} = require("./database");


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


function detectType(
    file
) {

    const config =
        loadConfig();


    const extension =
        path.extname(
            file
        )
        .replace(
            ".",
            ""
        )
        .toLowerCase();


    for (
        const [
            type,
            settings
        ]
        of Object.entries(
            config.mediaTypes
        )
    ) {

        if (
            settings.extensions
                .includes(
                    extension
                )
        ) {

            return type;

        }

    }


    return null;

}


function getFileSizeMB(
    file
) {

    return (
        fs.statSync(
            file
        ).size /
        1024 /
        1024
    );

}


function checkSize(
    file,
    type
) {

    const config =
        loadConfig();


    const sizeMB =
        getFileSizeMB(
            file
        );


    const limit =
        Number(
            config.mediaTypes[type]
                .maxSizeMB
        );


    if (
        sizeMB >
        limit
    ) {

        throw new Error(
            `${type} file too large: ${sizeMB.toFixed(2)}MiB / ${limit}MiB`
        );

    }


    return sizeMB;

}


function getFileSha256(
    file
) {

    const hash =
        crypto.createHash(
            "sha256"
        );


    hash.update(
        fs.readFileSync(
            file
        )
    );


    return hash.digest(
        "hex"
    );

}


function removeTemporaryFile(
    file
) {

    const config =
        loadConfig();


    if (
        config.upload &&
        config.upload
            .deleteTemporaryFile ===
        false
    ) {

        return;

    }


    if (
        fs.existsSync(
            file
        )
    ) {

        fs.unlinkSync(
            file
        );

    }

}


function getRecordFilename(
    record
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


    if (
        record &&
        record.source &&
        typeof record.source ===
        "object" &&
        record.source.path
    ) {

        return path.posix.basename(
            record.source.path
        );

    }


    if (
        record &&
        record.path
    ) {

        return path.posix.basename(
            record.path
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


function getRecordIdentity(
    record,
    sha256
) {

    return (
        record.operationId ||
        record.id ||
        sha256
    );

}


function buildSourceMetadata(
    repository,
    sourcePath
) {

    return {

        repositoryId:
            repository.id,

        repo:
            repository.repo,

        branch:
            repository.branch,

        path:
            sourcePath

    };

}


function buildRepositoryMetadata(
    repository
) {

    return {

        id:
            repository.id,

        name:
            repository.repo
                .split("/")[1],

        fullName:
            repository.repo

    };

}


function manifestMatchesSource(
    manifestAsset,
    sha256,
    repository,
    sourcePath
) {

    if (
        !manifestAsset ||
        manifestAsset.sha256 !==
            sha256
    ) {

        return false;

    }


    if (
        !manifestAsset.source ||
        manifestAsset.source.repo !==
            repository.repo ||
        manifestAsset.source.path !==
            sourcePath
    ) {

        return false;

    }


    return true;

}


async function ensureSourceReady({

    file,

    repository,

    sourcePath

}) {

    const verification =
        await verifyRemoteFileMatchesLocal(

            repository.repo,

            sourcePath,

            file,

            repository.branch

        );


    if (
        !verification.exists
    ) {

        console.log(
            `Uploading GitHub source: ${repository.repo}/${sourcePath}`
        );


        await uploadFile(

            repository.repo,

            file,

            sourcePath,

            repository.branch

        );


        return {

            repaired:
                true,

            uploaded:
                true

        };

    }


    if (
        !verification.matches
    ) {

        throw new Error(
            `Remote source content mismatch: ${repository.repo}/${sourcePath}`
        );

    }


    return {

        repaired:
            false,

        uploaded:
            false

    };

}


async function allocateUniqueTarget(
    repository,
    originalName,
    type
) {

    while (true) {

        const sequence =
            await reserveSequence(
                type
            );


        const filename =
            await renameFile(
                originalName,
                sequence
            );


        const targetPath =
            `${repository.folder}/${filename}`;


        if (
            !await fileExists(

                repository.repo,

                targetPath,

                repository.branch

            )
        ) {

            return {

                sequence,

                filename,

                targetPath

            };

        }


        console.log(
            `Target exists, recalculating sequence: ${filename}`
        );

    }

}


function buildResult({

    type,

    repository,

    filename,

    cdnURL,

    id,

    sha256,

    recovered,

    duplicate

}) {

    return {

        type,

        repository:
            repository.repo,

        filename,

        cdn:
            cdnURL,

        id,

        sha256,

        recovered,

        duplicate

    };

}


async function prepareExistingRecord({

    file,

    type,

    sha256,

    found

}) {

    const repository =
        found.repository;


    let record =
        found.record;


    const filename =
        getRecordFilename(
            record
        );


    const sourcePath =
        getRecordSourcePath(
            record,
            repository
        );


    if (
        !filename ||
        !sourcePath
    ) {

        throw new Error(
            `Existing database record is missing source information: ${
                record.id || sha256
            }`
        );

    }


    const cdnPath =
        record.cdnPath ||
        generateCDNPath(
            type,
            filename
        );


    const cdnURL =
        generateCDNURL(
            type,
            filename
        );


    const sourceState =
        await ensureSourceReady({

            file,

            repository,

            sourcePath

        });


    const manifestAsset =
        getManifestAsset(
            cdnPath
        );


    const alreadyPublished =

        record.status ===
            "complete" &&

        record.sourceStatus ===
            "complete" &&

        record.cdnStatus ===
            "published" &&

        isUnifiedCDNURL(
            record.url
        ) &&

        manifestMatchesSource(

            manifestAsset,

            sha256,

            repository,

            sourcePath

        );


    if (alreadyPublished) {

        if (
            sourceState.repaired ||
            !record.source ||
            typeof record.source !==
                "object"
        ) {

            record =
                await markRecordSourceComplete(

                    repository,

                    getRecordIdentity(
                        record,
                        sha256
                    ),

                    {

                        filename,

                        path:
                            sourcePath,

                        cdnPath,

                        source:
                            buildSourceMetadata(
                                repository,
                                sourcePath
                            ),

                        repository:
                            buildRepositoryMetadata(
                                repository
                            )

                    }

                );

        }


        if (
            sourceState.repaired
        ) {

            await syncRepositoryStatus(

                type,

                repository.id

            );

        }


        removeTemporaryFile(
            file
        );


        return {

            completed:
                true,

            result:
                buildResult({

                    type,

                    repository,

                    filename,

                    cdnURL,

                    id:
                        record.id,

                    sha256,

                    recovered:
                        sourceState.repaired,

                    duplicate:
                        true

                })

        };

    }


    record =
        await markRecordSourceComplete(

            repository,

            getRecordIdentity(
                record,
                sha256
            ),

            {

                filename,

                path:
                    sourcePath,

                cdnPath,

                source:
                    buildSourceMetadata(
                        repository,
                        sourcePath
                    ),

                repository:
                    buildRepositoryMetadata(
                        repository
                    )

            }

        );


    await syncRepositoryStatus(

        type,

        repository.id

    );


    registerCDNAsset({

        cdnPath,

        localFilePath:
            file,

        source: {

            repo:
                repository.repo,

            branch:
                repository.branch,

            path:
                sourcePath

        },

        type,

        mediaId:
            record.id,

        sha256

    });


    record =
        await markRecordCDNPending(

            repository,

            getRecordIdentity(
                record,
                sha256
            ),

            {

                cdnPath,

                url:
                    null

            }

        );


    return {

        completed:
            false,

        publication: {

            file,

            type,

            sha256,

            repository,

            record,

            filename,

            cdnPath,

            cdnURL,

            duplicate:
                true,

            recovered:
                true

        }

    };

}


async function prepareNewRecord({

    file,

    type,

    sizeMB,

    sha256

}) {

    const originalName =
        path.basename(
            file
        );


    const repository =
        await selectRepository(

            type,

            sizeMB

        );


    const {

        sequence,

        filename,

        targetPath

    } =
        await allocateUniqueTarget(

            repository,

            originalName,

            type

        );


    const cdnPath =
        generateCDNPath(
            type,
            filename
        );


    const cdnURL =
        generateCDNURL(
            type,
            filename
        );


    let record =
        await upsertPendingRecord(

            repository,

            type,

            sequence,

            {

                originalName,

                filename,

                path:
                    targetPath,

                cdnPath,

                sizeMB,

                sha256

            }

        );


    await ensureSourceReady({

        file,

        repository,

        sourcePath:
            targetPath

    });


    record =
        await markRecordSourceComplete(

            repository,

            getRecordIdentity(
                record,
                sha256
            ),

            {

                filename,

                path:
                    targetPath,

                cdnPath,

                source:
                    buildSourceMetadata(
                        repository,
                        targetPath
                    ),

                repository:
                    buildRepositoryMetadata(
                        repository
                    )

            }

        );


    await syncRepositoryStatus(

        type,

        repository.id

    );


    registerCDNAsset({

        cdnPath,

        localFilePath:
            file,

        source: {

            repo:
                repository.repo,

            branch:
                repository.branch,

            path:
                targetPath

        },

        type,

        mediaId:
            record.id,

        sha256

    });


    record =
        await markRecordCDNPending(

            repository,

            getRecordIdentity(
                record,
                sha256
            ),

            {

                cdnPath,

                url:
                    null

            }

        );


    return {

        completed:
            false,

        publication: {

            file,

            type,

            sha256,

            repository,

            record,

            filename,

            cdnPath,

            cdnURL,

            duplicate:
                false,

            recovered:
                false

        }

    };

}


async function prepareUpload(
    file
) {

    const originalName =
        path.basename(
            file
        );


    if (
        originalName ===
        ".gitkeep"
    ) {

        return null;

    }


    const type =
        detectType(
            file
        );


    if (!type) {

        const config =
            loadConfig();


        if (
            !config.upload ||
            config.upload
                .failOnUnsupported !==
            false
        ) {

            throw new Error(
                `Unsupported file type: ${originalName}`
            );

        }


        return null;

    }


    const sizeMB =
        checkSize(
            file,
            type
        );


    const sha256 =
        getFileSha256(
            file
        );


    await reconcileRepositories(
        type
    );


    const config =
        loadConfig();


    if (
        !config.upload ||
        config.upload
            .deduplicateByHash !==
        false
    ) {

        const found =
            await findRecordByHash(

                type,

                sha256

            );


        if (found) {

            return prepareExistingRecord({

                file,

                type,

                sha256,

                found

            });

        }

    }


    return prepareNewRecord({

        file,

        type,

        sizeMB,

        sha256

    });

}


async function finalizePublication(
    publication
) {

    const completed =
        await markRecordComplete(

            publication.repository,

            getRecordIdentity(
                publication.record,
                publication.sha256
            ),

            {

                cdnPath:
                    publication.cdnPath,

                url:
                    publication.cdnURL

            }

        );


    removeTemporaryFile(
        publication.file
    );


    console.log(
        `Published: ${publication.cdnURL}`
    );


    return buildResult({

        type:
            publication.type,

        repository:
            publication.repository,

        filename:
            publication.filename,

        cdnURL:
            publication.cdnURL,

        id:
            completed.id,

        sha256:
            publication.sha256,

        recovered:
            publication.recovered,

        duplicate:
            publication.duplicate

    });

}


async function run() {

    console.log(
        "Jingyan Media Upload V10 Start"
    );


    const uploadDir =
        "upload";


    if (
        !fs.existsSync(
            uploadDir
        )
    ) {

        console.log(
            "Upload folder missing"
        );

        return [];

    }


    const files =
        fs.readdirSync(
            uploadDir
        )
        .sort();


    const publications =
        [];


    const results =
        [];


    const failures =
        [];


    for (
        const filename
        of files
    ) {

        if (
            filename ===
            ".gitkeep"
        ) {

            continue;

        }


        const fullPath =
            path.join(
                uploadDir,
                filename
            );


        if (
            !fs.statSync(
                fullPath
            ).isFile()
        ) {

            continue;

        }


        try {

            const prepared =
                await prepareUpload(
                    fullPath
                );


            if (!prepared) {

                continue;

            }


            if (
                prepared.completed
            ) {

                results.push(
                    prepared.result
                );

            } else {

                publications.push(
                    prepared.publication
                );

            }

        } catch (error) {

            console.error(
                `Failed to prepare ${filename}: ${error.message}`
            );


            failures.push({

                filename,

                error

            });

        }

    }


    if (
        publications.length >
        0
    ) {

        console.log(
            `Publishing ${publications.length} prepared upload(s) to unified CDN`
        );


        await publishCDN();


        for (
            const publication
            of publications
        ) {

            const result =
                await finalizePublication(
                    publication
                );


            results.push(
                result
            );

        }

    }


    console.log(
        `Finished: ${results.length} successful file(s)`
    );


    for (
        const result
        of results
    ) {

        console.log(
            `RESULT ${result.id}: ${result.cdn}`
        );

    }


    if (
        failures.length >
        0
    ) {

        throw new Error(

            failures
                .map(
                    item =>
                        `${item.filename}: ${item.error.message}`
                )
                .join(
                    " | "
                )

        );

    }


    return results;

}


if (
    require.main === module
) {

    run()
        .catch(
            error => {

                console.error(
                    "Upload failed:"
                );

                console.error(
                    error
                );

                process.exit(1);

            }
        );

}


module.exports = {

    detectType,

    getFileSizeMB,

    getFileSha256,

    checkSize,

    prepareUpload,

    run

};
