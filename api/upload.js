const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


const {

    renameFile

} = require("./rename");


const {

    reconcileRepositories,

    selectRepository,

    updateRepositoryAfterUpload,

    syncRepositoryStatus

} = require("./repository");


const {

    uploadFile,

    fileExists

} = require("./github");


const {

    generateRepositoryCDN

} = require("./cdn");


const {

    findRecordByHash,

    reserveSequence,

    upsertPendingRecord,

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

            `${type} file too large: ` +

            `${sizeMB.toFixed(2)}MB / ` +

            `${limit}MB`

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


async function recoverExistingRecord(

    file,

    type,

    sizeMB,

    sha256,

    found

) {

    const {

        repository,

        record

    } = found;


    if (

        record.status ===
        "complete"

    ) {

        await syncRepositoryStatus(

            type,

            repository.id

        );


        removeTemporaryFile(
            file
        );


        console.log(

            `Already uploaded: ${record.url}`

        );


        return {

            type,

            repository:
                repository.repo,

            filename:
                record.filename,

            cdn:
                record.url,

            id:
                record.id,

            recovered:
                true,

            duplicate:
                true

        };

    }


    const targetExists =
        await fileExists(

            repository.repo,

            record.path,

            repository.branch

        );


    if (!targetExists) {

        console.log(

            `Resuming pending upload: ${record.path}`

        );


        await uploadFile(

            repository.repo,

            file,

            record.path,

            repository.branch

        );

    } else {

        console.log(

            `Pending media already exists remotely: ${record.path}`

        );

    }


    const completed =
        await markRecordComplete(

            repository,

            record.operationId ||

            `${type}:${sha256}`,

            {

                url:
                    record.url,

                sizeMB:
                    Number(

                        Number(

                            record.sizeMB ||

                            sizeMB

                        ).toFixed(
                            3
                        )

                    )

            }

        );


    await updateRepositoryAfterUpload(

        type,

        repository.id,

        Number(

            record.sizeMB ||

            sizeMB

        )

    );


    removeTemporaryFile(
        file
    );


    console.log(

        `Recovered: ${completed.url}`

    );


    return {

        type,

        repository:
            repository.repo,

        filename:
            completed.filename,

        cdn:
            completed.url,

        id:
            completed.id,

        recovered:
            true,

        duplicate:
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

            `Target already exists, advancing sequence: ${filename}`

        );

    }

}


async function processUpload(
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


        console.log(

            `Unsupported file ignored: ${originalName}`

        );


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

            return recoverExistingRecord(

                file,

                type,

                sizeMB,

                sha256,

                found

            );

        }

    }


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


    const cdn =
        generateRepositoryCDN(

            repository,

            targetPath

        );


    const pending =
        await upsertPendingRecord(

            repository,

            type,

            sequence,

            {

                originalName,

                filename,

                path:
                    targetPath,

                cdn,

                sizeMB,

                sha256

            }

        );


    console.log(

        `Uploading: ${originalName}`

    );


    console.log(

        `Type: ${type}`

    );


    console.log(

        `Repository: ${repository.repo}`

    );


    console.log(

        `Target: ${targetPath}`

    );


    console.log(

        `Size: ${sizeMB.toFixed(2)}MB`

    );


    const targetExists =
        await fileExists(

            repository.repo,

            targetPath,

            repository.branch

        );


    if (!targetExists) {

        await uploadFile(

            repository.repo,

            file,

            targetPath,

            repository.branch

        );

    }


    const completed =
        await markRecordComplete(

            repository,

            pending.operationId,

            {

                url:
                    cdn,

                sizeMB:
                    Number(

                        sizeMB.toFixed(
                            3
                        )

                    )

            }

        );


    await updateRepositoryAfterUpload(

        type,

        repository.id,

        sizeMB

    );


    removeTemporaryFile(
        file
    );


    console.log(

        `Uploaded: ${cdn}`

    );


    console.log(

        `Database ID: ${completed.id}`

    );


    console.log(

        `Temporary file removed: ${originalName}`

    );


    return {

        type,

        repository:
            repository.repo,

        filename,

        cdn,

        id:
            completed.id,

        sha256,

        recovered:
            false,

        duplicate:
            false

    };

}


async function run() {

    console.log(

        "Jingyan Media Upload Start"

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


    const results =
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


        const result =
            await processUpload(
                fullPath
            );


        if (result) {

            results.push(
                result
            );

        }

    }


    console.log(

        `Finished: ${results.length} file(s)`

    );


    for (
        const result
        of results
    ) {

        console.log(

            `RESULT ${result.id}: ${result.cdn}`

        );

    }


    return results;

}


if (
    require.main ===
    module
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


                process.exit(
                    1
                );

            }

        );

}


module.exports = {

    detectType,

    getFileSizeMB,

    getFileSha256,

    checkSize,

    processUpload,

    run

};
