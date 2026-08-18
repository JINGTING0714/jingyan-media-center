const fs = require("fs");
const path = require("path");

const DEFAULT_REGISTRY_FILE =
    "data/storage-registry.json";

function registryFile(
    config = null
) {
    return (
        config &&
        config.storage &&
        config.storage.registryFile
    ) || DEFAULT_REGISTRY_FILE;
}

function normalizeRegistry(
    input
) {
    const registry =
        input &&
        typeof input === "object" &&
        !Array.isArray(input)
            ? input
            : {};

    if (!registry.version) {
        registry.version = 1;
    }

    if (!registry.system) {
        registry.system =
            "jingyan-media-center";
    }

    if (
        !Array.isArray(
            registry.repositories
        )
    ) {
        registry.repositories = [];
    }

    return registry;
}

function getRepositoryIndex(
    repository
) {
    const idMatch =
        String(
            repository &&
            repository.id ||
            ""
        ).match(
            /-(\d+)$/
        );

    if (idMatch) {
        return Number(
            idMatch[1]
        );
    }

    const repoMatch =
        String(
            repository &&
            repository.repo ||
            ""
        ).match(
            /-(\d+)$/
        );

    return repoMatch
        ? Number(
            repoMatch[1]
        )
        : 0;
}

function inferType(
    repository
) {
    if (
        repository &&
        repository.type
    ) {
        return repository.type;
    }

    const id =
        String(
            repository &&
            repository.id ||
            ""
        );

    if (
        id.startsWith(
            "image-"
        )
    ) {
        return "image";
    }

    if (
        id.startsWith(
            "audio-"
        )
    ) {
        return "audio";
    }

    if (
        id.startsWith(
            "video-"
        )
    ) {
        return "video";
    }

    return null;
}

function inferOwner(
    repository
) {
    return String(
        repository &&
        repository.repo ||
        ""
    ).split("/")[0] || null;
}

function buildFromConfig(
    config
) {
    const repositories = [];

    for (
        const type
        of [
            "image",
            "audio",
            "video"
        ]
    ) {
        const list =
            config &&
            config.storage &&
            config.storage.repositories &&
            Array.isArray(
                config.storage
                    .repositories[type]
            )
                ? config.storage
                    .repositories[type]
                : [];

        for (
            const repository
            of list
        ) {
            repositories.push({
                ...repository,

                type:
                    repository.type ||
                    type,

                owner:
                    repository.owner ||
                    inferOwner(
                        repository
                    ),

                layout:
                    repository.layout ||
                    "legacy-flat",

                bucketSize:
                    repository.bucketSize ||
                    null,

                fileCount:
                    Number(
                        repository.fileCount ||
                        0
                    ),

                firstMediaId:
                    repository.firstMediaId ||
                    null,

                lastMediaId:
                    repository.lastMediaId ||
                    null,

                createdAt:
                    repository.createdAt ||
                    null,

                sealedAt:
                    repository.sealedAt ||
                    null,

                updatedAt:
                    repository.updatedAt ||
                    null,

                health:
                    repository.health ||
                    "unknown"
            });
        }
    }

    return normalizeRegistry({
        version: 1,

        system:
            config &&
            config.system ||
            "jingyan-media-center",

        updatedAt: null,

        repositories
    });
}

function loadRegistry(
    config = null
) {
    const file =
        registryFile(
            config
        );

    if (
        !fs.existsSync(
            file
        )
    ) {
        return buildFromConfig(
            config
        );
    }

    const parsed =
        JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    const registry =
        normalizeRegistry(
            parsed
        );

    if (
        registry.repositories
            .length === 0 &&
        config &&
        config.storage &&
        config.storage.repositories
    ) {
        return buildFromConfig(
            config
        );
    }

    return registry;
}

function saveRegistry(
    registry,
    config = null
) {
    const file =
        registryFile(
            config
        );

    const normalized =
        normalizeRegistry(
            registry
        );

    normalized.updatedAt =
        new Date()
            .toISOString();

    fs.mkdirSync(
        path.dirname(
            file
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        file,
        JSON.stringify(
            normalized,
            null,
            2
        ) + "\n"
    );

    return normalized;
}

function getRepositories(
    type = null,
    config = null
) {
    const registry =
        loadRegistry(
            config
        );

    const list =
        type
            ? registry.repositories
                .filter(
                    repository =>
                        repository &&
                        inferType(
                            repository
                        ) === type
                )
            : registry.repositories
                .slice();

    return list.sort(
        (a, b) => {

            const typeCompare =
                String(
                    inferType(a) ||
                    ""
                ).localeCompare(
                    String(
                        inferType(b) ||
                        ""
                    )
                );

            if (
                typeCompare !==
                0
            ) {
                return typeCompare;
            }

            return (
                getRepositoryIndex(a) -
                getRepositoryIndex(b)
            );
        }
    );
}

function findRepository(
    identity,
    config = null
) {
    const registry =
        loadRegistry(
            config
        );

    return (
        registry.repositories
            .find(
                repository =>
                    repository &&
                    (
                        repository.id ===
                            identity ||
                        repository.repo ===
                            identity
                    )
            ) ||
        null
    );
}

function upsertRepository(
    repository,
    config = null
) {
    const registry =
        loadRegistry(
            config
        );

    const normalized = {
        ...repository,

        type:
            inferType(
                repository
            ),

        owner:
            repository.owner ||
            inferOwner(
                repository
            )
    };

    const index =
        registry.repositories
            .findIndex(
                item =>
                    item &&
                    (
                        item.id ===
                            normalized.id ||
                        item.repo ===
                            normalized.repo
                    )
            );

    if (
        index >=
        0
    ) {
        registry.repositories[index] = {
            ...registry.repositories[index],
            ...normalized
        };
    } else {
        registry.repositories.push(
            normalized
        );
    }

    saveRegistry(
        registry,
        config
    );

    return findRepository(
        normalized.id ||
        normalized.repo,
        config
    );
}

function patchRepository(
    identity,
    patch,
    config = null
) {
    const registry =
        loadRegistry(
            config
        );

    const index =
        registry.repositories
            .findIndex(
                repository =>
                    repository &&
                    (
                        repository.id ===
                            identity ||
                        repository.repo ===
                            identity
                    )
            );

    if (
        index <
        0
    ) {
        throw new Error(
            `Storage registry repository not found: ${identity}`
        );
    }

    registry.repositories[index] = {
        ...registry.repositories[index],
        ...patch
    };

    saveRegistry(
        registry,
        config
    );

    return registry
        .repositories[index];
}

function getRecordSequence(
    record
) {
    const direct =
        Number(
            record &&
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
        String(
            record &&
            (
                record.filename ||
                (
                    typeof record.file ===
                    "string"
                        ? record.file
                        : record.file &&
                            record.file.name
                ) ||
                record.path ||
                ""
            )
        );

    const filenameMatch =
        path.posix
            .basename(
                filename
            )
            .match(
                /^(\d+)-/
            );

    if (
        filenameMatch
    ) {
        return Number(
            filenameMatch[1]
        );
    }

    const idMatch =
        String(
            record &&
            record.id ||
            ""
        ).match(
            /-(\d+)$/
        );

    return idMatch
        ? Number(
            idMatch[1]
        )
        : 0;
}

function summarizeRecords(
    records
) {
    const active =
        (
            Array.isArray(
                records
            )
                ? records
                : []
        )
        .filter(
            record =>
                record &&
                record.status !==
                    "deleted" &&
                record.deleted !==
                    true
        );

    const ordered =
        active
            .map(
                record => ({
                    id:
                        record.id ||
                        null,

                    sequence:
                        getRecordSequence(
                            record
                        )
                })
            )
            .filter(
                item =>
                    item.sequence >
                    0
            )
            .sort(
                (a, b) =>
                    a.sequence -
                    b.sequence
            );

    return {

        fileCount:
            active.length,

        firstMediaId:
            ordered.length
                ? ordered[0].id
                : null,

        lastMediaId:
            ordered.length
                ? ordered[
                    ordered.length -
                    1
                ].id
                : null
    };
}

function buildSourcePath(
    repository,
    sequence,
    filename
) {
    if (
        repository &&
        repository.layout ===
            "bucket-v1"
    ) {
        const bucketSize =
            Math.max(
                100,

                Number(
                    repository
                        .bucketSize ||
                    1000
                )
            );

        const bucket =
            Math.floor(
                Math.max(
                    0,

                    Number(
                        sequence ||
                        1
                    ) - 1
                ) /
                bucketSize
            );

        return [
            repository.folder,

            String(
                bucket
            ).padStart(
                4,
                "0"
            ),

            filename
        ].join("/");
    }

    return (
        `${repository.folder}/` +
        filename
    );
}

module.exports = {

    DEFAULT_REGISTRY_FILE,

    loadRegistry,

    saveRegistry,

    getRepositoryIndex,

    getRepositories,

    findRepository,

    upsertRepository,

    patchRepository,

    summarizeRecords,

    buildSourcePath
};
