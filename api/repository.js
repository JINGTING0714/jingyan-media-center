const fs = require("fs");


const {

    createRepository,

    repositoryExists,

    getRepositoryInfo,

    getRepositorySizeMB,

    getDirectorySizeMB,

    getFile,

    upsertTextFile,

    assertRepositoryOwner

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


function getRepositoryIndex(
    repository
) {

    const match =
        String(
            repository.repo ||
            ""
        ).match(
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
    status,
    fallback = "active"
) {

    if (!status) {

        return fallback;

    }


    return (
        status.state ||
        status.status ||
        fallback
    );

}


function assertMarkerMatches(
    marker,
    repository,
    type,
    config
) {

    if (
        !marker ||
        marker.system !==
            config.system ||
        marker.type !==
            type ||
        marker.repositoryId !==
            repository.id ||
        marker.repository !==
            repository.repo
    ) {

        throw new Error(
            `Repository marker mismatch: ${repository.repo}`
        );

    }


    return true;

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
    config,
    options = {}
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


    if (marker) {

        assertMarkerMatches(

            marker,

            repository,

            type,

            config

        );

    } else {

        const info =
            await assertRepositoryOwner(

                repository.repo,

                config.github.owner

            );


        if (
            options.trustedRegistered !==
                true &&
            info.description !==
                `Jingyan automatic ${type} storage`
        ) {

            throw new Error(
                `Unregistered repository cannot be adopted: ${repository.repo}`
            );

        }


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

        const defaultState =
            options.defaultState ===
                "sealed"
                ? "sealed"
                : "active";


        const extra = {};


        if (
            defaultState ===
            "sealed"
        ) {

            extra.sealedAt =
                new Date()
                    .toISOString();

            extra.reason =
                "recovered-from-config";

        }


        await writeRepositoryStatus(

            repository,

            type,

            0,

            config,

            defaultState,

            extra

        );

    }


    return repository;

}


async function inspectAdoptableRepository(
    fullName,
    type,
    index,
    config
) {

    const info =
        await assertRepositoryOwner(

            fullName,

            config.github.owner

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


    if (marker) {

        assertMarkerMatches(

            marker,

            repository,

            type,

            config

        );


        return repository;

    }


    if (
        info.description !==
        `Jingyan automatic ${type} storage`
    ) {

        throw new Error(
            `Reserved repository name is occupied by a non-system repository: ${fullName}`
        );

    }


    return repository;

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


async function refreshRepositorySize(
    repository
) {

    let repositorySize =
        0;


    try {

        repositorySize =
            await getRepositorySizeMB(
                repository.repo
            );

    } catch (error) {

        console.warn(
            `Repository size API warning for ${repository.repo}: ${error.message}`
        );

    }


    const mediaFolderSize =
        await getDirectorySizeMB(

            repository.repo,

            repository.folder,

            repository.branch

        );


    return Math.max(

        Number(
            repositorySize || 0
        ),

        Number(
            mediaFolderSize || 0
        )

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

    const currentStatus =
        await readRepositoryStatus(
            repository
        );


    await writeRepositoryStatus(

        repository,

        type,

        usedMB,

        config,

        "sealed",

        {

            sealedAt:
                (
                    currentStatus &&
                    currentStatus.sealedAt
                ) ||
                new Date()
                    .toISOString(),

            reason:
                (
                    currentStatus &&
                    currentStatus.reason
                ) ||
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


    list.sort(
        (a, b) =>
            getRepositoryIndex(a) -
            getRepositoryIndex(b)
    );


    let changed =
        false;


    const configuredActive =
        list.find(
            repository =>
                repository.id ===
                config.storage
                    .activeRepository[type]
        );


    const configuredActiveIndex =
        configuredActive
            ? getRepositoryIndex(
                configuredActive
            )
            : 0;


    for (
        const repository
        of list
    ) {

        const index =
            getRepositoryIndex(
                repository
            );


        const defaultState =

            repository.state ===
                "sealed" ||

            (
                configuredActiveIndex >
                    0 &&
                index <
                    configuredActiveIndex
            )

                ? "sealed"

                : "active";


        await ensureRepositoryInitialized(

            repository,

            type,

            config,

            {

                trustedRegistered:
                    true,

                defaultState

            }

        );


        const status =
            await readRepositoryStatus(
                repository
            );


        const remoteState =
            getStatusState(
                status,
                defaultState
            );


        if (
            repository.state !==
            remoteState
        ) {

            repository.state =
                remoteState;

            changed =
                true;

        }

    }


    let nextIndex =
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
                nextIndex
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


        const repository =
            await inspectAdoptableRepository(

                fullName,

                type,

                nextIndex,

                config

            );


        await ensureRepositoryInitialized(

            repository,

            type,

            config,

            {

                trustedRegistered:
                    false,

                defaultState:
                    "active"

            }

        );


        const status =
            await readRepositoryStatus(
                repository
            );


        repository.state =
            getStatusState(
                status,
                "active"
            );


        registerRepository(

            config,

            type,

            repository

        );


        changed =
            true;


        nextIndex++;

    }


    const currentList =
        config.storage
            .repositories[type]
            .sort(
                (a, b) =>
                    getRepositoryIndex(a) -
                    getRepositoryIndex(b)
            );


    let active =
        currentList.find(
            repository =>
                repository.id ===
                config.storage
                    .activeRepository[type]
        );


    if (!active) {

        const nonSealed =
            currentList.filter(
                repository =>
                    repository.state !==
                    "sealed"
            );


        active =
            nonSealed[
                nonSealed.length - 1
            ] ||
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

        const activeIndex =
            getRepositoryIndex(
                active
            );


        const higherWritable =
            currentList
                .filter(
                    repository =>
                        getRepositoryIndex(
                            repository
                        ) >
                            activeIndex &&
                        repository.state !==
                            "sealed"
                );


        if (
            higherWritable.length >
            0
        ) {

            active =
                higherWritable[
                    higherWritable.length - 1
                ];


            config.storage
                .activeRepository[type] =
                active.id;


            changed =
                true;

        }


        const selectedIndex =
            getRepositoryIndex(
                active
            );


        for (
            const repository
            of currentList
        ) {

            const index =
                getRepositoryIndex(
                    repository
                );


            if (
                index >=
                    selectedIndex ||
                repository.state ===
                    "sealed"
            ) {

                continue;

            }


            const usedMB =
                await refreshRepositorySize(
                    repository
                );


            const status =
                await readRepositoryStatus(
                    repository
                );


            await writeRepositoryStatus(

                repository,

                type,

                usedMB,

                config,

                "sealed",

                {

                    sealedAt:
                        (
                            status &&
                            status.sealedAt
                        ) ||
                        new Date()
                            .toISOString(),

                    reason:
                        (
                            status &&
                            status.reason
                        ) ||
                        "superseded-by-newer-repository"

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


            changed =
                true;

        }

    }


    if (changed) {

        saveConfig(
            config
        );

    }


    return config;

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


    const index =
        getHighestRepositoryIndex(
            list
        ) + 1;


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
                false,

            repository:
                null

        };

    }


    const repository =
        await inspectAdoptableRepository(

            fullName,

            type,

            index,

            config

        );


    return {

        index,

        name,

        fullName,

        exists:
            true,

        repository

    };

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

        repository =
            slot.repository;


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

        config,

        {

            trustedRegistered:
                false,

            defaultState:
                "active"

        }

    );


    const status =
        await readRepositoryStatus(
            repository
        );


    repository.state =
        getStatusState(
            status,
            "active"
        );


    registerRepository(

        config,

        type,

        repository

    );


    if (
        repository.state ===
        "sealed"
    ) {

        saveConfig(
            config
        );


        return createNewRepository(
            type,
            config
        );

    }


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
        list.length ===
        0
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

        throw new Error(
            `Active repository missing for ${type}`
        );

    }


    const remoteStatus =
        await readRepositoryStatus(
            repository
        );


    const state =
        getStatusState(
            remoteStatus,
            repository.state ||
            "active"
        );


    if (
        state ===
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

            currentStatus,

            repository.state ||
            "active"

        );


    const extra = {};


    if (
        state ===
        "sealed"
    ) {

        extra.sealedAt =
            (
                currentStatus &&
                currentStatus.sealedAt
            ) ||
            new Date()
                .toISOString();


        extra.reason =
            (
                currentStatus &&
                currentStatus.reason
            ) ||
            "sealed";

    }


    await writeRepositoryStatus(

        repository,

        type,

        usedMB,

        config,

        state,

        extra

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
