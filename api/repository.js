const fs = require("fs");


const {

    createRepository,

    repositoryExists,

    getRepositoryInfo,

    getRepositorySizeMB,

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


function parseMB(
    value
) {

    if (
        typeof value ===
        "number"
    ) {

        return Number.isFinite(
            value
        )
            ? value
            : 0;

    }


    if (
        typeof value ===
        "string"
    ) {

        const parsed =
            parseFloat(
                value
                    .replace(
                        /mb/ig,
                        ""
                    )
                    .trim()
            );


        return Number.isFinite(
            parsed
        )
            ? parsed
            : 0;

    }


    return 0;

}


function getRepositoryIndex(
    repository
) {

    const match =
        String(
            repository.repo ||
            ""
        )
        .match(
            /-(\d+)$/
        );


    return match
        ? Number(
            match[1]
        )
        : 0;

}


function getHighestRepositoryIndex(
    list
) {

    return list.reduce(

        (
            highest,
            repository
        ) =>
            Math.max(
                highest,
                getRepositoryIndex(
                    repository
                )
            ),

        0

    );

}


function buildRepositoryDescriptor(
    config,
    type,
    index,
    fullName,
    branch = "main"
) {

    const settings =
        getMediaSettings(
            config,
            type
        );


    return {

        id:
            `${type}-${String(
                index
            ).padStart(
                2,
                "0"
            )}`,

        repo:
            fullName,

        branch,

        folder:
            settings.folder,

        database:
            settings.database,

        status:
            settings.status,

        marker:
            settings.marker,

        sizeMB:
            0,

        state:
            "active"

    };

}


async function readJsonFile(
    repo,
    filePath,
    branch = "main"
) {

    const result =
        await getFile(
            repo,
            filePath,
            branch
        );


    if (
        !result ||
        !result.content
    ) {

        return null;

    }


    try {

        return JSON.parse(
            result.content
        );

    } catch {

        return null;

    }

}


async function readRepositoryStatus(
    repository
) {

    return readJsonFile(

        repository.repo,

        repository.status,

        repository.branch

    );

}


async function readRepositoryMarker(
    repository
) {

    return readJsonFile(

        repository.repo,

        repository.marker,

        repository.branch

    );

}


function getStatusState(
    status
) {

    if (!status) {

        return "active";

    }


    return (
        status.state ||
        status.status ||
        "active"
    );

}


async function readDatabaseDeclaredSizeMB(
    repository
) {

    const result =
        await getFile(

            repository.repo,

            repository.database,

            repository.branch

        );


    if (
        !result ||
        !result.content
    ) {

        return 0;

    }


    let list;


    try {

        list =
            JSON.parse(
                result.content
            );

    } catch {

        return 0;

    }


    if (
        !Array.isArray(
            list
        )
    ) {

        return 0;

    }


    const seen =
        new Set();


    let total =
        0;


    for (
        const record
        of list
    ) {

        if (
            !record ||
            record.status ===
                "deleted"
        ) {

            continue;

        }


        const key =
            record.path ||
            record.filename ||
            record.file ||
            record.id;


        if (
            key &&
            seen.has(
                key
            )
        ) {

            continue;

        }


        if (key) {

            seen.add(
                key
            );

        }


        total +=
            parseMB(
                record.sizeMB
            );

    }


    return total;

}


async function writeRepositoryStatus(
    repository,
    type,
    usedMB,
    config,
    state = "active",
    extra = {}
) {

    const status = {

        system:
            config.system,

        repository:
            repository.repo,

        id:
            repository.id,

        type,

        usedMB:
            Number(
                Number(
                    usedMB || 0
                ).toFixed(
                    3
                )
            ),

        targetMB:
            config.storage
                .targetRepositorySizeMB,

        overflowToleranceMB:
            config.storage
                .overflowToleranceMB,

        status:
            state,

        state,

        updatedAt:
            new Date()
                .toISOString(),

        ...extra

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


    return status;

}


async function ensureRepositoryInitialized(
    repository,
    type,
    config
) {

    const settings =
        getMediaSettings(
            config,
            type
        );


    repository.folder =
        repository.folder ||
        settings.folder;


    repository.database =
        repository.database ||
        settings.database;


    repository.status =
        repository.status ||
        settings.status;


    repository.marker =
        repository.marker ||
        settings.marker;


    repository.branch =
        repository.branch ||
        "main";


    const marker =
        await readRepositoryMarker(
            repository
        );


    if (!marker) {

        await upsertTextFile(

            repository.repo,

            repository.marker,

            JSON.stringify(
                {
                    system:
                        config.system,

                    type,

                    repositoryId:
                        repository.id,

                    repository:
                        repository.repo,

                    createdAt:
                        new Date()
                            .toISOString()
                },
                null,
                2
            ) + "\n",

            repository.branch,

            "Initialize repository marker"

        );

    }


    const keepPath =
        `${repository.folder}/.gitkeep`;


    if (
        !await getFile(
            repository.repo,
            keepPath,
            repository.branch
        )
    ) {

        await upsertTextFile(

            repository.repo,

            keepPath,

            "\n",

            repository.branch,

            "Initialize media folder"

        );

    }


    if (
        !await getFile(
            repository.repo,
            repository.database,
            repository.branch
        )
    ) {

        await upsertTextFile(

            repository.repo,

            repository.database,

            "[]\n",

            repository.branch,

            "Initialize media database"

        );

    }


    if (
        !await getFile(
            repository.repo,
            repository.status,
            repository.branch
        )
    ) {

        await writeRepositoryStatus(

            repository,

            type,

            0,

            config,

            "active"

        );

    }


    return repository;

}


async function canAdoptRepository(
    fullName,
    type,
    config
) {

    if (
        !await repositoryExists(
            fullName
        )
    ) {

        return false;

    }


    const indexMatch =
        fullName.match(
            /-(\d+)$/
        );


    const index =
        indexMatch
            ? Number(
                indexMatch[1]
            )
            : 0;


    const info =
        await getRepositoryInfo(
            fullName
        );


    const repository =
        buildRepositoryDescriptor(

            config,

            type,

            index,

            fullName,

            info.default_branch ||
            "main"

        );


    const marker =
        await readRepositoryMarker(
            repository
        );


    if (
        marker &&
        marker.system ===
            config.system &&
        marker.type ===
            type
    ) {

        return true;

    }


    return Boolean(

        info &&

        info.owner &&

        info.owner.login &&

        info.owner.login
            .toLowerCase() ===
        String(
            config.github.owner
        ).toLowerCase() &&

        info.description ===
            `Jingyan automatic ${type} storage`

    );

}


function registerRepository(
    config,
    type,
    repository
) {

    const list =
        config.storage
            .repositories[type];


    const existing =
        list.find(
            item =>
                item.repo ===
                    repository.repo ||
                item.id ===
                    repository.id
        );


    if (existing) {

        Object.assign(
            existing,
            repository
        );


        return existing;

    }


    list.push(
        repository
    );


    list.sort(
        (a, b) =>
            getRepositoryIndex(a) -
            getRepositoryIndex(b)
    );


    return repository;

}


async function reconcileRepositories(
    type
) {

    const config =
        loadConfig();


    const list =
        config.storage
            .repositories[type];


    if (
        !Array.isArray(
            list
        )
    ) {

        throw new Error(
            `Repository list missing: ${type}`
        );

    }


    let changed =
        false;


    for (
        const repository
        of list
    ) {

        await ensureRepositoryInitialized(

            repository,

            type,

            config

        );

    }


    let index =
        getHighestRepositoryIndex(
            list
        ) + 1;


    while (true) {

        const settings =
            getMediaSettings(
                config,
                type
            );


        const name =
            settings.repositoryPrefix +
            String(
                index
            ).padStart(
                2,
                "0"
            );


        const fullName =
            `${config.github.owner}/${name}`;


        if (
            !await repositoryExists(
                fullName
            )
        ) {

            break;

        }


        if (
            await canAdoptRepository(
                fullName,
                type,
                config
            )
        ) {

            const info =
                await getRepositoryInfo(
                    fullName
                );


            const repository =
                buildRepositoryDescriptor(

                    config,

                    type,

                    index,

                    fullName,

                    info.default_branch ||
                    "main"

                );


            await ensureRepositoryInitialized(

                repository,

                type,

                config

            );


            registerRepository(

                config,

                type,

                repository

            );


            changed =
                true;

        }


        index++;

    }


    const currentList =
        config.storage
            .repositories[type];


    let active =
        currentList.find(
            repository =>
                repository.id ===
                config.storage
                    .activeRepository[type]
        );


    if (!active) {

        active =
            currentList[
                currentList.length - 1
            ] ||
            null;


        if (active) {

            config.storage
                .activeRepository[type] =
                active.id;


            changed =
                true;

        }

    }


    if (active) {

        const activeStatus =
            await readRepositoryStatus(
                active
            );


        if (
            getStatusState(
                activeStatus
            ) ===
            "sealed"
        ) {

            for (
                let i =
                    currentList.length - 1;

                i >= 0;

                i--
            ) {

                const candidate =
                    currentList[i];


                if (
                    candidate.id ===
                    active.id
                ) {

                    continue;

                }


                const status =
                    await readRepositoryStatus(
                        candidate
                    );


                if (
                    getStatusState(
                        status
                    ) !==
                    "sealed"
                ) {

                    config.storage
                        .activeRepository[type] =
                        candidate.id;


                    changed =
                        true;


                    break;

                }

            }

        }

    }


    if (changed) {

        saveConfig(
            config
        );

    }


    return config;

}


async function refreshRepositorySize(
    repository
) {

    let apiSize =
        0;


    try {

        apiSize =
            await getRepositorySizeMB(
                repository.repo
            );

    } catch (error) {

        console.warn(
            `Repository size API warning for ${repository.repo}: ${error.message}`
        );

    }


    const status =
        await readRepositoryStatus(
            repository
        );


    const statusSize =
        status
            ? Math.max(
                parseMB(
                    status.usedMB
                ),
                parseMB(
                    status.used
                )
            )
            : 0;


    const savedSize =
        parseMB(
            repository.sizeMB
        );


    const databaseSize =
        await readDatabaseDeclaredSizeMB(
            repository
        );


    return Math.max(

        apiSize,

        statusSize,

        savedSize,

        databaseSize

    );

}


async function sealRepository(
    repository,
    type,
    config,
    usedMB,
    reason =
        "capacity"
) {

    await writeRepositoryStatus(

        repository,

        type,

        usedMB,

        config,

        "sealed",

        {

            sealedAt:
                new Date()
                    .toISOString(),

            reason

        }

    );


    repository.state =
        "sealed";


    repository.sizeMB =
        Number(
            usedMB.toFixed(
                3
            )
        );


    saveConfig(
        config
    );

}


async function findNextRepositorySlot(
    type,
    config
) {

    const list =
        config.storage
            .repositories[type];


    const settings =
        getMediaSettings(
            config,
            type
        );


    let index =
        getHighestRepositoryIndex(
            list
        ) + 1;


    while (true) {

        const name =
            settings.repositoryPrefix +
            String(
                index
            ).padStart(
                2,
                "0"
            );


        const fullName =
            `${config.github.owner}/${name}`;


        if (
            !await repositoryExists(
                fullName
            )
        ) {

            return {

                index,

                name,

                fullName,

                exists:
                    false

            };

        }


        if (
            await canAdoptRepository(
                fullName,
                type,
                config
            )
        ) {

            return {

                index,

                name,

                fullName,

                exists:
                    true

            };

        }


        index++;

    }

}


async function createNewRepository(
    type,
    providedConfig =
        null
) {

    const config =
        providedConfig ||
        await reconcileRepositories(
            type
        );


    const slot =
        await findNextRepositorySlot(

            type,

            config

        );


    let repository;


    if (
        slot.exists
    ) {

        const info =
            await getRepositoryInfo(
                slot.fullName
            );


        repository =
            buildRepositoryDescriptor(

                config,

                type,

                slot.index,

                slot.fullName,

                info.default_branch ||
                "main"

            );


        console.log(
            `Recovering repository: ${slot.fullName}`
        );

    } else {

        if (
            !config.github
                .autoCreateRepository
        ) {

            throw new Error(
                `Automatic repository creation disabled for ${type}`
            );

        }


        const result =
            await createRepository({

                expectedOwner:
                    config.github.owner,

                name:
                    slot.name,

                description:
                    `Jingyan automatic ${type} storage`,

                privateRepo:
                    Boolean(
                        config.github.private
                    )

            });


        repository =
            buildRepositoryDescriptor(

                config,

                type,

                slot.index,

                result.repo,

                result.defaultBranch

            );

    }


    await ensureRepositoryInitialized(

        repository,

        type,

        config

    );


    registerRepository(

        config,

        type,

        repository

    );


    config.storage
        .activeRepository[type] =
        repository.id;


    repository.state =
        "active";


    saveConfig(
        config
    );


    console.log(
        `Repository ready: ${repository.repo}`
    );


    return repository;

}


async function selectRepository(
    type,
    incomingSizeMB
) {

    let config =
        await reconcileRepositories(
            type
        );


    const list =
        config.storage
            .repositories[type];


    if (
        !Array.isArray(
            list
        )
    ) {

        throw new Error(
            `Repository list missing: ${type}`
        );

    }


    if (
        list.length === 0
    ) {

        return createNewRepository(
            type,
            config
        );

    }


    let repository =
        list.find(
            item =>
                item.id ===
                config.storage
                    .activeRepository[type]
        );


    if (!repository) {

        repository =
            list[
                list.length - 1
            ];


        config.storage
            .activeRepository[type] =
            repository.id;


        saveConfig(
            config
        );

    }


    const remoteStatus =
        await readRepositoryStatus(
            repository
        );


    if (
        getStatusState(
            remoteStatus
        ) ===
        "sealed"
    ) {

        return createNewRepository(
            type,
            config
        );

    }


    const usedMB =
        await refreshRepositorySize(
            repository
        );


    repository.sizeMB =
        Number(
            usedMB.toFixed(
                3
            )
        );


    const hardLimitMB =
        Number(
            config.storage
                .targetRepositorySizeMB
        ) +
        Number(
            config.storage
                .overflowToleranceMB
        );


    const predictedMB =
        usedMB +
        Number(
            incomingSizeMB ||
            0
        );


    if (
        predictedMB <=
        hardLimitMB
    ) {

        repository.state =
            "active";


        saveConfig(
            config
        );


        return repository;

    }


    if (
        !config.storage
            .autoSwitchRepository
    ) {

        throw new Error(
            `Repository capacity reached for ${type}: ${repository.repo}`
        );

    }


    await sealRepository(

        repository,

        type,

        config,

        usedMB,

        "next-file-would-exceed-limit"

    );


    config =
        loadConfig();


    return createNewRepository(
        type,
        config
    );

}


async function syncRepositoryStatus(
    type,
    repositoryId
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


    const usedMB =
        await refreshRepositorySize(
            repository
        );


    const currentStatus =
        await readRepositoryStatus(
            repository
        );


    const state =
        getStatusState(
            currentStatus
        ) ===
        "sealed"
            ? "sealed"
            : "active";


    await writeRepositoryStatus(

        repository,

        type,

        usedMB,

        config,

        state

    );


    repository.sizeMB =
        Number(
            usedMB.toFixed(
                3
            )
        );


    repository.state =
        state;


    saveConfig(
        config
    );


    return repository;

}


async function updateRepositoryAfterUpload(
    type,
    repositoryId
) {

    return syncRepositoryStatus(
        type,
        repositoryId
    );

}


module.exports = {

    loadConfig,

    saveConfig,

    reconcileRepositories,

    selectRepository,

    createNewRepository,

    updateRepositoryAfterUpload,

    syncRepositoryStatus,

    readRepositoryStatus

};
