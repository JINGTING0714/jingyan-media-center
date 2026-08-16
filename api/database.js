const path = require("path");
const fs = require("fs");


const {
    getFile,
    upsertTextFile
} = require("./github");


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


async function readRepositoryDatabase(
    repository
) {

    const result =
        await getFile(

            repository.repo,

            repository.database,

            repository.branch

        );


    if (!result) {

        return [];

    }


    const data =
        JSON.parse(
            result.content || "[]"
        );


    if (!Array.isArray(data)) {

        throw new Error(
            `Database must be an array: ${repository.repo}/${repository.database}`
        );

    }


    return data;

}


function generateMediaID(
    type,
    sequence
) {

    const config =
        loadConfig();


    const settings =
        config.mediaTypes[type];


    const prefix =
        settings.idPrefix;


    return (
        prefix +
        "-" +
        String(sequence)
            .padStart(
                6,
                "0"
            )
    );

}


function buildRecord(
    repository,
    type,
    sequence,
    item
) {

    const extension =
        path.extname(
            item.filename
        )
        .replace(".", "")
        .toLowerCase();


    const originalTitle =
        path.basename(
            item.originalName,
            path.extname(
                item.originalName
            )
        );


    return {

        id:
            generateMediaID(
                type,
                sequence
            ),

        sequence,

        title:
            originalTitle,

        originalName:
            item.originalName,

        filename:
            item.filename,

        type,

        format:
            extension,

        sizeMB:
            Number(
                item.sizeMB
                    .toFixed(3)
            ),

        repository: {

            id:
                repository.id,

            name:
                repository.repo
                    .split("/")[1],

            fullName:
                repository.repo

        },

        path:
            item.path,

        url:
            item.cdn,

        createdAt:
            new Date()
                .toISOString(),

        source:
            "upload"

    };

}


async function addRecord(
    repository,
    type,
    sequence,
    item
) {

    const list =
        await readRepositoryDatabase(
            repository
        );


    const record =
        buildRecord(
            repository,
            type,
            sequence,
            item
        );


    list.push(record);


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(
            list,
            null,
            2
        ) + "\n",

        repository.branch,

        `Update ${type} database`

    );


    return record;

}


async function removeMedia(
    repository,
    id
) {

    const list =
        await readRepositoryDatabase(
            repository
        );


    const newList =
        list.filter(
            item =>
                item.id !== id
        );


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(
            newList,
            null,
            2
        ) + "\n",

        repository.branch,

        `Remove media ${id}`

    );


    return true;

}


module.exports = {

    readRepositoryDatabase,

    addRecord,

    removeMedia,

    generateMediaID

};
