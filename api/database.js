const fs = require("fs");
const path = require("path");


const {

    getFile,

    upsertTextFile

} = require("./github");


const CONFIG_FILE =
    "config.json";


function loadConfig() {

    return JSON.parse(

        fs.readFileSync(

            CONFIG_FILE,

            "utf8"

        )

    );

}


function saveConfig(
    config
) {

    fs.writeFileSync(

        CONFIG_FILE,

        JSON.stringify(

            config,

            null,

            2

        ) + "\n"

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

            result.content ||
            "[]"

        );


    if (
        !Array.isArray(
            data
        )
    ) {

        throw new Error(

            `Database must be an array: ${repository.repo}/${repository.database}`

        );

    }


    return data;

}


function getRecordSequence(
    record
) {

    if (

        Number.isInteger(
            Number(
                record.sequence
            )
        ) &&

        Number(
            record.sequence
        ) > 0

    ) {

        return Number(
            record.sequence
        );

    }


    if (
        record.filename
    ) {

        const match =
            String(
                record.filename
            ).match(
                /^(\d+)-/
            );


        if (match) {

            return Number(
                match[1]
            );

        }

    }


    if (
        record.id
    ) {

        const match =
            String(
                record.id
            ).match(
                /-(\d+)$/
            );


        if (match) {

            return Number(
                match[1]
            );

        }

    }


    return 0;

}


function generateMediaID(

    type,

    sequence

) {

    const config =
        loadConfig();


    const settings =
        config.mediaTypes[type];


    if (!settings) {

        throw new Error(
            `Invalid media type: ${type}`
        );

    }


    return (

        settings.idPrefix +

        "-" +

        String(
            sequence
        ).padStart(
            6,
            "0"
        )

    );

}


async function findRecordByHash(

    type,

    sha256

) {

    const config =
        loadConfig();


    const repositories =

        config.storage
            .repositories[type] ||

        [];


    let pending =
        null;


    for (
        const repository
        of repositories
    ) {

        const list =
            await readRepositoryDatabase(
                repository
            );


        for (
            const record
            of list
        ) {

            if (

                record.sha256 !==
                sha256

            ) {

                continue;

            }


            const result = {

                repository,

                record

            };


            if (

                record.status ===
                "complete"

            ) {

                return result;

            }


            if (!pending) {

                pending =
                    result;

            }

        }

    }


    return pending;

}


async function getRemoteMaxSequence(
    type
) {

    const config =
        loadConfig();


    const repositories =

        config.storage
            .repositories[type] ||

        [];


    let maxSequence =
        Number(

            config.counters[type] ||
            0

        );


    for (
        const repository
        of repositories
    ) {

        const list =
            await readRepositoryDatabase(
                repository
            );


        for (
            const record
            of list
        ) {

            maxSequence =
                Math.max(

                    maxSequence,

                    getRecordSequence(
                        record
                    )

                );

        }

    }


    return maxSequence;

}


async function reserveSequence(
    type
) {

    const maxSequence =
        await getRemoteMaxSequence(
            type
        );


    const next =
        maxSequence + 1;


    const config =
        loadConfig();


    config.counters[type] =
        next;


    saveConfig(
        config
    );


    return next;

}


function buildPendingRecord(

    repository,

    type,

    sequence,

    item

) {

    const extension =
        path.extname(
            item.filename
        )
        .replace(
            ".",
            ""
        )
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

        operationId:
            `${type}:${item.sha256}`,

        sha256:
            item.sha256,

        sequence,

        status:
            "pending",

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

                Number(
                    item.sizeMB
                ).toFixed(
                    3
                )

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

        source:
            "upload",

        createdAt:
            new Date()
                .toISOString(),

        uploadedAt:
            null

    };

}


async function upsertPendingRecord(

    repository,

    type,

    sequence,

    item

) {

    const list =
        await readRepositoryDatabase(
            repository
        );


    const operationId =
        `${type}:${item.sha256}`;


    const existing =
        list.find(

            record =>

                record.operationId ===
                operationId ||

                record.sha256 ===
                item.sha256

        );


    if (existing) {

        return existing;

    }


    const id =
        generateMediaID(

            type,

            sequence

        );


    const conflictingId =
        list.find(

            record =>
                record.id === id

        );


    if (conflictingId) {

        throw new Error(

            `Database ID already exists: ${id}`

        );

    }


    const record =
        buildPendingRecord(

            repository,

            type,

            sequence,

            item

        );


    list.push(
        record
    );


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(

            list,

            null,

            2

        ) + "\n",

        repository.branch,

        `Create pending ${type} record ${record.id}`

    );


    return record;

}


async function markRecordComplete(

    repository,

    operationId,

    patch = {}

) {

    const list =
        await readRepositoryDatabase(
            repository
        );


    const index =
        list.findIndex(

            record =>

                record.operationId ===
                operationId

        );


    if (
        index === -1
    ) {

        throw new Error(

            `Pending database record not found: ${operationId}`

        );

    }


    const current =
        list[index];


    const completed = {

        ...current,

        ...patch,

        status:
            "complete",

        uploadedAt:

            current.uploadedAt ||

            new Date()
                .toISOString()

    };


    list[index] =
        completed;


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(

            list,

            null,

            2

        ) + "\n",

        repository.branch,

        `Complete ${completed.id}`

    );


    return completed;

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

    findRecordByHash,

    reserveSequence,

    upsertPendingRecord,

    markRecordComplete,

    removeMedia,

    generateMediaID

};
