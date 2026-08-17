const fs = require("fs");
const path = require("path");


const {

    getFile,

    upsertTextFile,

    getMaxFileSequence

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


function getLegacyFilename(
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

        return record.file;

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


    return "";

}


function getRecordSequence(
    record
) {

    const direct =
        Number(
            record.sequence
        );


    if (
        Number.isInteger(
            direct
        ) &&
        direct > 0
    ) {

        return direct;

    }


    const filename =
        getLegacyFilename(
            record
        );


    const fileMatch =
        String(
            filename
        ).match(
            /^(\d+)-/
        );


    if (fileMatch) {

        return Number(
            fileMatch[1]
        );

    }


    const idMatch =
        String(
            record.id ||
            ""
        ).match(
            /-(\d+)$/
        );


    if (idMatch) {

        return Number(
            idMatch[1]
        );

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
        config.mediaTypes[
            type
        ];


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


    let fallback =
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
                !record ||
                record.status ===
                    "deleted" ||
                record.deleted ===
                    true
            ) {

                continue;

            }


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
                    "complete" &&
                record.cdnStatus ===
                    "published"
            ) {

                return result;

            }


            if (!fallback) {

                fallback =
                    result;

            }

        }

    }


    return fallback;

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


    let maximum =
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

            maximum =
                Math.max(

                    maximum,

                    getRecordSequence(
                        record
                    )

                );

        }


        const fileMaximum =
            await getMaxFileSequence(

                repository.repo,

                repository.folder,

                repository.branch

            );


        maximum =
            Math.max(
                maximum,
                fileMaximum
            );

    }


    return maximum;

}


async function reserveSequence(
    type
) {

    const maximum =
        await getRemoteMaxSequence(
            type
        );


    return maximum + 1;

}


function commitCounter(
    type,
    sequence
) {

    const config =
        loadConfig();


    if (
        !config.counters ||
        typeof config.counters !==
        "object"
    ) {

        config.counters = {};

    }


    config.counters[type] =
        Math.max(

            Number(
                config.counters[type] ||
                0
            ),

            Number(
                sequence
            )

        );


    saveConfig(
        config
    );

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

        sourceStatus:
            "pending",

        cdnStatus:
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

        source: {

            repositoryId:
                repository.id,

            repo:
                repository.repo,

            branch:
                repository.branch,

            path:
                item.path

        },

        path:
            item.path,

        cdnPath:
            item.cdnPath,

        url:
            null,

        createdAt:
            new Date()
                .toISOString(),

        sourceCompletedAt:
            null,

        cdnPublishedAt:
            null,

        uploadedAt:
            null,

        uploader:
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


    const existing =
        list.find(
            record =>
                record &&
                record.sha256 ===
                    item.sha256 &&
                record.status !==
                    "deleted" &&
                record.deleted !==
                    true
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
                record &&
                record.id ===
                    id
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


    commitCounter(
        type,
        sequence
    );


    return record;

}


async function patchRecord(
    repository,
    identity,
    patch,
    message
) {

    const list =
        await readRepositoryDatabase(
            repository
        );


    const index =
        list.findIndex(
            record =>
                record &&
                (
                    record.operationId ===
                        identity ||
                    record.sha256 ===
                        identity ||
                    record.id ===
                        identity
                )
        );


    if (
        index === -1
    ) {

        throw new Error(
            `Database record not found: ${identity}`
        );

    }


    const current =
        list[index];


    const changes =
        typeof patch ===
        "function"

            ? patch(
                current
            )

            : patch;


    const updated = {

        ...current,

        ...changes

    };


    list[index] =
        updated;


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(
            list,
            null,
            2
        ) + "\n",

        repository.branch,

        message

    );


    return updated;

}


async function markRecordSourceComplete(
    repository,
    identity,
    patch = {}
) {

    const now =
        new Date()
            .toISOString();


    return patchRecord(

        repository,

        identity,

        current => {

            const alreadyPublished =

                current.status ===
                    "complete" &&

                current.cdnStatus ===
                    "published";


            return {

                ...patch,

                status:
                    alreadyPublished
                        ? "complete"
                        : "source-complete",

                sourceStatus:
                    "complete",

                cdnStatus:
                    alreadyPublished

                        ? "published"

                        : (
                            patch.cdnStatus ||
                            current.cdnStatus ||
                            "pending"
                        ),

                sourceCompletedAt:
                    current.sourceCompletedAt ||
                    now

            };

        },

        `Source complete ${identity}`

    );

}


async function markRecordCDNPending(
    repository,
    identity,
    patch = {}
) {

    return patchRecord(

        repository,

        identity,

        {

            ...patch,

            status:
                "cdn-pending",

            sourceStatus:
                "complete",

            cdnStatus:
                "pending"

        },

        `CDN pending ${identity}`

    );

}


async function markRecordComplete(
    repository,
    identity,
    patch = {}
) {

    const now =
        new Date()
            .toISOString();


    return patchRecord(

        repository,

        identity,

        current => ({

            ...patch,

            status:
                "complete",

            sourceStatus:
                "complete",

            cdnStatus:
                "published",

            sourceCompletedAt:
                current.sourceCompletedAt ||
                now,

            cdnPublishedAt:
                current.cdnPublishedAt ||
                now,

            uploadedAt:
                current.uploadedAt ||
                now

        }),

        `Complete ${identity}`

    );

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
                item.id !==
                id
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

    getRemoteMaxSequence,

    reserveSequence,

    upsertPendingRecord,

    markRecordSourceComplete,

    markRecordCDNPending,

    markRecordComplete,

    removeMedia,

    generateMediaID

};
