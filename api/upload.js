const fs = require("fs");
const path = require("path");


const {
    renameFile
} = require("./rename");


const {
    selectRepository,
    reserveSequence,
    updateRepositoryAfterUpload
} = require("./repository");


const {
    uploadFile,
    fileExists
} = require("./github");


const {
    generateRepositoryCDN
} = require("./cdn");


const {
    addRecord
} = require("./database");


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


function detectType(file) {

    const config =
        loadConfig();


    const extension =
        path.extname(file)
            .replace(".", "")
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
                .includes(extension)
        ) {

            return type;

        }

    }


    return null;

}


function getFileSizeMB(file) {

    return (
        fs.statSync(file).size /
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


async function createUniqueFilename(
    repository,
    originalName,
    type
) {

    while (true) {

        const sequence =
            reserveSequence(
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
            `Filename already exists, trying next number: ${filename}`
        );

    }

}


async function processUpload(
    file
) {

    const originalName =
        path.basename(file);


    if (
        originalName === ".gitkeep"
    ) {

        return null;

    }


    const type =
        detectType(file);


    if (!type) {

        console.log(
            `Unsupported file: ${originalName}`
        );

        return null;

    }


    const sizeMB =
        checkSize(
            file,
            type
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
        await createUniqueFilename(

            repository,

            originalName,

            type

        );


    console.log(
        `Uploading ${originalName}`
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


    await uploadFile(

        repository.repo,

        file,

        targetPath,

        repository.branch

    );


    const cdn =
        generateRepositoryCDN(

            repository,

            targetPath

        );


    const record =
        await addRecord(

            repository,

            type,

            sequence,

            {

                originalName,

                filename,

                path:
                    targetPath,

                cdn,

                sizeMB

            }

        );


    await updateRepositoryAfterUpload(

        type,

        repository.id,

        sizeMB

    );


    fs.unlinkSync(file);


    console.log(
        `Uploaded: ${cdn}`
    );


    console.log(
        `Database ID: ${record.id}`
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
            record.id

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

        return;

    }


    const files =
        fs.readdirSync(
            uploadDir
        );


    const results = [];


    for (
        const filename
        of files
    ) {

        if (
            filename === ".gitkeep"
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
    require.main === module
) {

    run()
        .catch(error => {

            console.error(
                "Upload failed:"
            );

            console.error(
                error
            );

            process.exit(1);

        });

}


module.exports = {

    detectType,

    getFileSizeMB,

    checkSize,

    processUpload,

    run

};
