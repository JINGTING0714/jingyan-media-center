const fs = require("fs");


const {
    createRepository,
    repositoryExists,
    getRepositorySizeMB,
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


function saveConfig(config) {

    fs.writeFileSync(

        CONFIG_FILE,

        JSON.stringify(
            config,
            null,
            2
        ) + "\n"

    );

}


function getMediaSettings(
    config,
    type
) {

    const settings =
        config.mediaTypes[type];

    if (!settings) {

        throw new Error(
            `Invalid media type: ${type}`
        );

    }

    return settings;

}


function getRepositoryStatus(
    usedMB,
    targetMB,
    toleranceMB
) {

    if (
        usedMB >
        targetMB + toleranceMB
    ) {

        return "full";

    }


    if (
        usedMB >=
        targetMB
    ) {

        return "near-limit";

    }


    return "active";

}


async function writeRepositoryStatus(
    repository,
    type,
    usedMB,
    config
) {

    const targetMB =
        config.storage
            .targetRepositorySizeMB;

    const toleranceMB =
        config.storage
            .overflowToleranceMB;


    const status = {

        repository:
            repository.repo,

        id:
            repository.id,

        type,

        usedMB:
            Number(
                usedMB.toFixed(2)
            ),

        targetMB,

        overflowToleranceMB:
            toleranceMB,

        status:
            getRepositoryStatus(
                usedMB,
                targetMB,
                toleranceMB
            ),

        updatedAt:
            new Date()
                .toISOString()

    };


    await upsertTextFile(

        repository.repo,

        repository.status,

        JSON.stringify(
            status,
            null,
            2
        ) + "\n",

        repository.branch,

        "Update repository status"

    );

}


function getNextRepositoryIndex(
    list
) {

    let highest = 0;


    for (
        const repository
        of list
    ) {

        const match =
            String(
                repository.repo
            ).match(
                /-(\d+)$/
            );


        if (match) {

            highest =
                Math.max(
                    highest,
                    Number(match[1])
                );

        }

    }


    return highest + 1;

}


async function findAvailableRepositoryName(
    type,
    config
) {

    const settings =
        getMediaSettings(
            config,
            type
        );


    const owner =
        config.github.owner;


    const list =
        config.storage
            .repositories[type];


    let index =
        getNextRepositoryIndex(
            list
        );


    while (true) {

        const name =
            settings.repositoryPrefix +
            String(index)
                .padStart(
                    2,
                    "0"
                );


        const fullName =
            `${owner}/${name}`;


        const exists =
            await repositoryExists(
                fullName
            );


        if (!exists) {

            return {
                index,
                name
            };

        }


        index++;

    }

}


async function createNewRepository(
    type,
    config
) {

    const settings =
        getMediaSettings(
            config,
            type
        );


    const {
        index,
        name
    } =
        await findAvailableRepositoryName(
            type,
            config
        );


    console.log(
        `Creating repository: ${name}`
    );


    const result =
        await createRepository({

            name,

            description:
                `Jingyan automatic ${type} storage`,

            privateRepo:
                Boolean(
                    config.github.private
                )

        });


    const repository = {

        id:
            `${type}-${String(index)
                .padStart(2, "0")}`,

        repo:
            result.repo,

        branch:
            result.defaultBranch,

        folder:
            settings.folder,

        database:
            settings.database,

        status:
            settings.status,

        sizeMB:
            0

    };


    await upsertTextFile(

        repository.repo,

        `${repository.folder}/.gitkeep`,

        "",

        repository.branch,

        "Initialize media folder"

    );


    await upsertTextFile(

        repository.repo,

        repository.database,

        "[]\n",

        repository.branch,

        "Initialize media database"

    );


    await writeRepositoryStatus(

        repository,

        type,

        0,

        config

    );


    config.storage
        .repositories[type]
        .push(repository);


    saveConfig(config);


    console.log(
        `Repository ready: ${repository.repo}`
    );


    return repository;

}


async function refreshRepositorySize(
    repository
) {

    try {

        const apiSize =
            await getRepositorySizeMB(
                repository.repo
            );


        const savedSize =
            Number(
                repository.sizeMB || 0
            );


        return Math.max(
            apiSize,
            savedSize
        );

    } catch (error) {

        console.warn(
            `Could not read repository size for ${repository.repo}: ${error.message}`
        );


        return Number(
            repository.sizeMB || 0
        );

    }

}


async function selectRepository(
    type,
    incomingSizeMB
) {

    const config =
        loadConfig();


    const list =
        config.storage
            .repositories[type];


    if (!Array.isArray(list)) {

        throw new Error(
            `Repository list missing: ${type}`
        );

    }


    const targetMB =
        config.storage
            .targetRepositorySizeMB;


    const toleranceMB =
        config.storage
            .overflowToleranceMB;


    const hardLimitMB =
        targetMB +
        toleranceMB;


    for (
        const repository
        of list
    ) {

        const usedMB =
            await refreshRepositorySize(
                repository
            );


        repository.sizeMB =
            Number(
                usedMB.toFixed(3)
            );


        const predicted =
            usedMB +
            incomingSizeMB;


        if (
            predicted <=
            hardLimitMB
        ) {

            saveConfig(config);

            return repository;

        }

    }


    saveConfig(config);


    if (
        config.storage
            .autoSwitchRepository &&
        config.github
            .autoCreateRepository
    ) {

        return createNewRepository(
            type,
            config
        );

    }


    throw new Error(
        `No available repository for ${type}`
    );

}


function reserveSequence(type) {

    const config =
        loadConfig();


    if (
        typeof config.counters[type]
        !== "number"
    ) {

        config.counters[type] = 0;

    }


    config.counters[type]++;


    const sequence =
        config.counters[type];


    saveConfig(config);


    return sequence;

}


async function updateRepositoryAfterUpload(
    type,
    repositoryId,
    fileSizeMB
) {

    const config =
        loadConfig();


    const repository =
        config.storage
            .repositories[type]
            .find(
                item =>
                    item.id ===
                    repositoryId
            );


    if (!repository) {

        throw new Error(
            `Repository not found: ${repositoryId}`
        );

    }


    repository.sizeMB =
        Number(
            (
                Number(
                    repository.sizeMB || 0
                ) +
                Number(fileSizeMB || 0)
            ).toFixed(3)
        );


    saveConfig(config);


    try {

        await writeRepositoryStatus(

            repository,

            type,

            repository.sizeMB,

            config

        );

    } catch (error) {

        console.warn(
            `Status update warning: ${error.message}`
        );

    }


    return repository;

}


module.exports = {

    selectRepository,

    reserveSequence,

    updateRepositoryAfterUpload,

    createNewRepository

};
