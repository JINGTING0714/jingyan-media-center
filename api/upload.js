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
    fileExists
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
        config.mediaTypes[type]
            .maxSizeMB;


    if (
        sizeMB > limit
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
            renameFile(
                originalName,
                sequence
            );


        const targetPath =
            `${repository.folder}/${filename}`;


        const exists =
            await fileExists(

                repository.repo,

                targetPath,

                repository.branch

            );


        if (!exists) {

            return {

                sequence,

                filename,

                targetPath

            };

        }


        console.log(
            `Target exists, advancing sequence: ${filename}`
        );

    }

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


async function ensureSourceComplete({

    file,

    type,

    sha256,

    repository,

    record

}) {

    if (
        !record.path
    ) {

        throw new Error(
            `Database record source path missing: ${record.id}`
        );

    }


    const targetExists =
        await fileExists(

            repository.repo,

            record.path,

            repository.branch

        );


    if (!targetExists) {

        console.log(
            `Uploading GitHub source: ${repository.repo}/${record.path}`
        );


        await uploadFile(

            repository.repo,

            file,

            record.path,

            repository.branch

        );

    }


    const identity =
        getRecordIdentity(
            record,
            sha256
        );


    const cdnPath =
        record.cdnPath ||
        generateCDNPath(
            type,
            record.filename
        );


    const source = {

        repositoryId:
            repository.id,

        repo:
            repository.repo,

        branch:
            repository.branch,

        path:
            record.path

    };


    const updated =
        await markRecordSourceComplete(

            repository,

            identity,

            {

                cdnPath,

                source,

                repository: {

                    id:
                        repository.id,

                    name:
                        repository.repo
                            .split("/")[1],

                    fullName:
                        repository.repo

                }

            }

        );


    await syncRepositoryStatus(

        type,

        repository.id

    );


    return updated;

}


async function prepareExistingRecord({

    file,

    type,

    sizeMB,

    sha256,

    found

}) {

    const repository =
        found.repository;


    let record =
        found.record;


    record =
        await ensureSourceComplete({

            file,

            type,

            sha256,

            repository,

            record

        });


    const cdnPath =
        record.cdnPath ||
        generateCDNPath(
            type,
            record.filename
        );


    const cdnURL =
        generateCDNURL(
            type,
            record.filename
        );


    const registration =
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
                    record.path

            },

            type,

            mediaId:
                record.id,

            sha256

        });


    const alreadyPublished =

        record.status ===
            "complete" &&

        record.cdnStatus ===
            "published" &&

        isUnifiedCDNURL(
            record.url
        );


    if (
        alreadyPublished &&
        !registration.changed
    ) {

        removeTemporaryFile(
            file
        );


        return {

            completed:
                true,

            result: {

                type,

                repository:
                    repository.repo,

                filename:
                    record.filename,

                cdn:
                    cdnURL,

                id:
                    record.id,

                sha256,

                recovered:
                    true,

                duplicate:
                    true

            }

        };

    }


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

            sizeMB,

            sha256,

            repository,

            record,

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


    record =
        await ensureSourceComplete({

            file,

            type,

            sha256,

            repository,

            record

        });


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

            sizeMB,

            sha256,

            repository,

            record,

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

                sizeMB,

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


    return {

        type:
            publication.type,

        repository:
            publication.repository.repo,

        filename:
            completed.filename,

        cdn:
            publication.cdnURL,

        id:
            completed.id,

        sha256:
            publication.sha256,

        recovered:
            publication.recovered,

        duplicate:
            publication.duplicate

    };

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
        );


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
