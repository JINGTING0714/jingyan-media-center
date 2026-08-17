const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    getDirectoryEntries,
    upsertTextFile
} = require("./github");

const {
    readRepositoryDatabase,
    generateMediaID
} = require("./database");

const {
    readManifest,
    publishCDN
} = require("./cloudflare");

const {
    generateCDNPath,
    generateCDNURL
} = require("./cdn");


const CONFIG_FILE =
    "config.json";

const REPORT_FILE =
    "data/history-report.json";

const LEGACY_INDEX_FILES = {

    audio:
        "data/music.json",

    image:
        "data/image.json",

    video:
        "data/video.json"

};


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


function readLocalJsonArray(
    file
) {

    if (
        !fs.existsSync(
            file
        )
    ) {

        return [];

    }


    const data =
        JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );


    if (
        !Array.isArray(
            data
        )
    ) {

        throw new Error(
            `Legacy index must be an array: ${file}`
        );

    }


    return data;

}


function writeReport(
    report
) {

    fs.mkdirSync(

        path.dirname(
            REPORT_FILE
        ),

        {
            recursive:
                true
        }

    );


    fs.writeFileSync(

        REPORT_FILE,

        JSON.stringify(
            report,
            null,
            2
        ) + "\n"

    );

}


function createReport(
    mode
) {

    return {

        version:
            1,

        status:
            "running",

        mode,

        destructive:
            false,

        generatedAt:
            new Date()
                .toISOString(),

        completedAt:
            null,

        publication: {

            attempted:
                false,

            publishedAt:
                null,

            versionId:
                null,

            deploymentId:
                null

        },

        summary: {

            repositoriesScanned:
                0,

            mediaFilesScanned:
                0,

            sourceDatabaseRecords:
                0,

            legacyIndexRecords:
                0,

            normalizedSourceRecords:
                0,

            migratedLegacyRecords:
                0,

            duplicateGroups:
                0,

            deletionCandidates:
                0,

            orphanFiles:
                0,

            conflicts:
                0,

            missingSourceRecords:
                0

        },

        migrations: {

            normalizedSourceRecords:
                [],

            migratedLegacyRecords:
                [],

            alreadyRepresentedLegacyRecords:
                [],

            duplicateLegacyRecords:
                []

        },

        duplicateGroups:
            [],

        deletionCandidates:
            [],

        orphanFiles:
            [],

        conflicts:
            [],

        missingSourceRecords:
            [],

        warnings:
            [],

        retainedLegacyIndexes:
            Object
                .values(
                    LEGACY_INDEX_FILES
                )
                .filter(
                    file =>
                        fs.existsSync(
                            file
                        )
                ),

        notes: [

            "This migration is non-destructive.",

            "No media file is deleted automatically.",

            "Legacy center indexes are retained for audit until manual cleanup is approved."

        ]

    };

}


function roundMB(
    bytes
) {

    return Number(

        (
            Number(
                bytes || 0
            ) /
            1024 /
            1024
        ).toFixed(
            3
        )

    );

}


function sha256(
    buffer
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            buffer
        )
        .digest(
            "hex"
        );

}


function encodeContentPath(
    filePath
) {

    return String(
        filePath
    )
        .split("/")
        .map(
            encodeURIComponent
        )
        .join("/");

}


async function downloadRemoteBuffer(
    repo,
    sourcePath,
    branch = "main"
) {

    const token =
        process.env.GH_TOKEN;


    if (!token) {

        throw new Error(
            "GH_TOKEN missing"
        );

    }


    const url =
        `https://api.github.com/repos/${repo}/contents/${encodeContentPath(
            sourcePath
        )}?ref=${encodeURIComponent(
            branch
        )}`;


    const response =
        await fetch(

            url,

            {

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    Accept:
                        "application/vnd.github.raw+json",

                    "X-GitHub-Api-Version":
                        "2022-11-28",

                    "User-Agent":
                        "jingyan-media-center-history"

                }

            }

        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Failed to download ${repo}/${sourcePath}: HTTP ${response.status}`
        );

    }


    return Buffer.from(
        await response.arrayBuffer()
    );

}


function getRecordFilename(
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

        return path.posix.basename(
            record.file
        );

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


    if (
        record &&
        record.path
    ) {

        return path.posix.basename(
            record.path
        );

    }


    if (
        record &&
        record.source &&
        typeof record.source ===
            "object" &&
        record.source.path
    ) {

        return path.posix.basename(
            record.source.path
        );

    }


    return null;

}


function getRecordSourcePath(
    record,
    repository
) {

    if (
        record &&
        record.source &&
        typeof record.source ===
            "object" &&
        record.source.path
    ) {

        return record.source.path;

    }


    if (
        record &&
        record.path
    ) {

        return record.path;

    }


    const filename =
        getRecordFilename(
            record
        );


    return filename

        ? `${repository.folder}/${filename}`

        : null;

}


function parseSequence(
    record,
    filename = null
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


    const name =
        filename ||
        getRecordFilename(
            record
        ) ||
        "";


    const fileMatch =
        String(
            name
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
            (
                record &&
                record.id
            ) ||
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


function getLegacyRepositoryName(
    record
) {

    if (
        record &&
        typeof record.repository ===
            "string"
    ) {

        return record.repository;

    }


    if (
        record &&
        record.repository &&
        typeof record.repository ===
            "object"
    ) {

        return (
            record.repository.fullName ||
            record.repository.repo ||
            null
        );

    }


    return null;

}


function recordNeedsMigration(
    record,
    type,
    repository,
    filename,
    sourcePath,
    sequence
) {

    const expectedId =
        generateMediaID(
            type,
            sequence
        );


    const expectedPath =
        generateCDNPath(
            type,
            filename
        );


    const expectedURL =
        generateCDNURL(
            type,
            filename
        );


    return (

        record.id !==
            expectedId ||

        !record.operationId ||

        !record.sha256 ||

        Number(
            record.sequence
        ) !==
            sequence ||

        record.status !==
            "complete" ||

        record.sourceStatus !==
            "complete" ||

        record.cdnStatus !==
            "published" ||

        record.filename !==
            filename ||

        record.path !==
            sourcePath ||

        record.cdnPath !==
            expectedPath ||

        record.url !==
            expectedURL ||

        !record.repository ||

        typeof record.repository !==
            "object" ||

        record.repository.fullName !==
            repository.repo ||

        !record.source ||

        typeof record.source !==
            "object" ||

        record.source.repo !==
            repository.repo ||

        record.source.path !==
            sourcePath

    );

}


function buildLegacyMetadata(
    record,
    sourceLabel,
    migratedAt
) {

    const existing =

        record &&
        record.legacy &&
        typeof record.legacy ===
            "object"

            ? record.legacy

            : {};


    const legacy = {

        ...existing,

        migrationVersion:
            1,

        migratedAt:
            existing.migratedAt ||
            migratedAt,

        migratedFrom:
            existing.migratedFrom ||
            sourceLabel

    };


    if (
        record &&
        record.url &&
        !legacy.previousUrl
    ) {

        legacy.previousUrl =
            record.url;

    }


    if (
        record &&
        record.source !==
            undefined &&
        typeof record.source !==
            "object" &&
        !legacy.previousSource
    ) {

        legacy.previousSource =
            record.source;

    }


    if (
        record &&
        record.id &&
        !legacy.previousId
    ) {

        legacy.previousId =
            record.id;

    }


    return legacy;

}


async function normalizeSourceRecord({

    record,

    type,

    repository,

    inventoryItem,

    migratedAt

}) {

    const filename =
        inventoryItem.filename;


    const sourcePath =
        inventoryItem.path;


    const sequence =
        parseSequence(
            record,
            filename
        );


    if (
        !Number.isInteger(
            sequence
        ) ||
        sequence <= 0
    ) {

        throw new Error(
            `Invalid sequence for ${repository.repo}/${sourcePath}`
        );

    }


    const expectedId =
        generateMediaID(
            type,
            sequence
        );


    if (
        record.id &&
        record.id !==
            expectedId
    ) {

        throw new Error(
            `Record ID mismatch for ${repository.repo}/${sourcePath}: ${record.id} != ${expectedId}`
        );

    }


    const buffer =
        await downloadRemoteBuffer(

            repository.repo,

            sourcePath,

            repository.branch

        );


    const digest =
        sha256(
            buffer
        );


    const extension =
        path.extname(
            filename
        )
        .slice(1)
        .toLowerCase();


    return {

        ...record,

        id:
            expectedId,

        operationId:
            `${type}:${digest}`,

        sha256:
            digest,

        sequence,

        status:
            "cdn-pending",

        sourceStatus:
            "complete",

        cdnStatus:
            "pending",

        title:
            record.title ||
            path.basename(
                filename,
                path.extname(
                    filename
                )
            ),

        originalName:
            record.originalName ||
            filename,

        filename,

        type,

        format:
            extension,

        sizeMB:
            roundMB(
                inventoryItem.size
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
                sourcePath

        },

        path:
            sourcePath,

        cdnPath:
            generateCDNPath(
                type,
                filename
            ),

        url:
            record.url ||
            null,

        createdAt:
            record.createdAt ||
            null,

        sourceCompletedAt:
            record.sourceCompletedAt ||
            migratedAt,

        cdnPublishedAt:
            record.cdnPublishedAt ||
            null,

        uploadedAt:
            record.uploadedAt ||
            null,

        uploader:
            record.uploader ===
                undefined

                ? null

                : record.uploader,

        legacy:
            buildLegacyMetadata(

                record,

                "source-database",

                migratedAt

            )

    };

}


async function buildMigratedLegacyRecord({

    legacyRecord,

    type,

    repository,

    inventoryItem,

    legacyIndexFile,

    migratedAt

}) {

    const filename =
        inventoryItem.filename;


    const sequence =
        parseSequence(
            legacyRecord,
            filename
        );


    if (
        !Number.isInteger(
            sequence
        ) ||
        sequence <= 0
    ) {

        throw new Error(
            `Legacy record has no stable numeric sequence: ${repository.repo}/${inventoryItem.path}`
        );

    }


    const buffer =
        await downloadRemoteBuffer(

            repository.repo,

            inventoryItem.path,

            repository.branch

        );


    const digest =
        sha256(
            buffer
        );


    const extension =
        path.extname(
            filename
        )
        .slice(1)
        .toLowerCase();


    return {

        id:
            generateMediaID(
                type,
                sequence
            ),

        operationId:
            `${type}:${digest}`,

        sha256:
            digest,

        sequence,

        status:
            "cdn-pending",

        sourceStatus:
            "complete",

        cdnStatus:
            "pending",

        title:
            legacyRecord.title ||
            path.basename(

                legacyRecord.name ||
                filename,

                path.extname(
                    legacyRecord.name ||
                    filename
                )

            ),

        originalName:
            legacyRecord.originalName ||
            legacyRecord.name ||
            filename,

        filename,

        type,

        format:
            extension,

        sizeMB:
            roundMB(
                inventoryItem.size
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
                inventoryItem.path

        },

        path:
            inventoryItem.path,

        cdnPath:
            generateCDNPath(
                type,
                filename
            ),

        url:
            legacyRecord.cdn ||
            legacyRecord.url ||
            null,

        createdAt:
            legacyRecord.createdAt ||
            null,

        sourceCompletedAt:
            migratedAt,

        cdnPublishedAt:
            null,

        uploadedAt:
            legacyRecord.createdAt ||
            null,

        uploader:
            null,

        legacy: {

            migrationVersion:
                1,

            migratedAt,

            migratedFrom:
                legacyIndexFile,

            previousId:
                legacyRecord.id ||
                null,

            previousUrl:
                legacyRecord.cdn ||
                legacyRecord.url ||
                null

        }

    };

}


async function buildRepositoryState(
    type,
    repository
) {

    const entries =
        await getDirectoryEntries(

            repository.repo,

            repository.folder,

            repository.branch

        );


    const inventory =
        entries

            .filter(
                entry =>
                    entry &&
                    entry.type ===
                        "blob" &&
                    entry.path !==
                        ".gitkeep"
            )

            .map(
                entry => ({

                    type,

                    repositoryId:
                        repository.id,

                    repo:
                        repository.repo,

                    branch:
                        repository.branch,

                    filename:
                        entry.path,

                    path:
                        `${repository.folder}/${entry.path}`,

                    gitBlobSha:
                        entry.sha,

                    size:
                        Number(
                            entry.size ||
                            0
                        ),

                    sequence:
                        parseSequence(
                            null,
                            entry.path
                        )

                })
            );


    const database =
        await readRepositoryDatabase(
            repository
        );


    return {

        type,

        repository,

        inventory,

        database,

        changed:
            false,

        touchedIds:
            new Set(),

        registeredPaths:
            new Set(),

        registeredByBlob:
            new Map(),

        inventoryByPath:
            new Map(
                inventory.map(
                    item => [
                        item.path,
                        item
                    ]
                )
            )

    };

}


function addRegisteredItem(
    state,
    item
) {

    state.registeredPaths.add(
        item.path
    );


    if (
        !state.registeredByBlob
            .has(
                item.gitBlobSha
            )
    ) {

        state.registeredByBlob.set(
            item.gitBlobSha,
            []
        );

    }


    state.registeredByBlob
        .get(
            item.gitBlobSha
        )
        .push(
            item
        );

}


function findState(
    states,
    type,
    repositoryName
) {

    return states.find(
        state =>
            state.type ===
                type &&
            state.repository.repo ===
                repositoryName
    ) || null;

}


async function buildPlan(
    mode
) {

    const config =
        loadConfig();


    const report =
        createReport(
            mode
        );


    const migratedAt =
        report.generatedAt;


    const states =
        [];


    for (
        const type
        of [
            "image",
            "audio",
            "video"
        ]
    ) {

        for (
            const repository
            of (
                config.storage
                    .repositories[type] ||
                []
            )
        ) {

            const state =
                await buildRepositoryState(
                    type,
                    repository
                );


            states.push(
                state
            );


            report.summary
                .repositoriesScanned++;


            report.summary
                .mediaFilesScanned +=
                state.inventory.length;


            report.summary
                .sourceDatabaseRecords +=
                state.database.length;

        }

    }


    for (
        const state
        of states
    ) {

        const sequenceOwners =
            new Map();


        const idOwners =
            new Map();


        for (
            let index = 0;

            index <
            state.database.length;

            index++
        ) {

            const record =
                state.database[index];


            const filename =
                getRecordFilename(
                    record
                );


            const sourcePath =
                getRecordSourcePath(

                    record,

                    state.repository

                );


            if (
                !filename ||
                !sourcePath
            ) {

                report.conflicts.push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    recordId:
                        (
                            record &&
                            record.id
                        ) ||
                        null,

                    reason:
                        "database-record-missing-filename-or-path"

                });


                continue;

            }


            const inventoryItem =
                state.inventoryByPath
                    .get(
                        sourcePath
                    );


            if (!inventoryItem) {

                report
                    .missingSourceRecords
                    .push({

                        type:
                            state.type,

                        repository:
                            state.repository.repo,

                        recordId:
                            record.id ||
                            null,

                        path:
                            sourcePath

                    });


                continue;

            }


            const sequence =
                parseSequence(
                    record,
                    filename
                );


            const expectedId =
                sequence > 0

                    ? generateMediaID(
                        state.type,
                        sequence
                    )

                    : null;


            if (
                !sequence ||
                !expectedId
            ) {

                report.conflicts.push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    recordId:
                        record.id ||
                        null,

                    path:
                        sourcePath,

                    reason:
                        "invalid-sequence"

                });


                continue;

            }


            if (
                record.id &&
                record.id !==
                    expectedId
            ) {

                report.conflicts.push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    recordId:
                        record.id,

                    expectedId,

                    path:
                        sourcePath,

                    reason:
                        "record-id-does-not-match-sequence"

                });


                continue;

            }


            if (
                sequenceOwners.has(
                    sequence
                ) &&
                sequenceOwners.get(
                    sequence
                ) !==
                    sourcePath
            ) {

                report.conflicts.push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    sequence,

                    paths: [

                        sequenceOwners.get(
                            sequence
                        ),

                        sourcePath

                    ],

                    reason:
                        "duplicate-sequence-in-source-database"

                });


                continue;

            }


            if (
                idOwners.has(
                    expectedId
                ) &&
                idOwners.get(
                    expectedId
                ) !==
                    sourcePath
            ) {

                report.conflicts.push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    id:
                        expectedId,

                    paths: [

                        idOwners.get(
                            expectedId
                        ),

                        sourcePath

                    ],

                    reason:
                        "duplicate-id-in-source-database"

                });


                continue;

            }


            sequenceOwners.set(
                sequence,
                sourcePath
            );


            idOwners.set(
                expectedId,
                sourcePath
            );


            addRegisteredItem(
                state,
                inventoryItem
            );


            if (
                recordNeedsMigration(

                    record,

                    state.type,

                    state.repository,

                    filename,

                    sourcePath,

                    sequence

                )
            ) {

                try {

                    const normalized =
                        await normalizeSourceRecord({

                            record,

                            type:
                                state.type,

                            repository:
                                state.repository,

                            inventoryItem,

                            migratedAt

                        });


                    state.database[index] =
                        normalized;


                    state.changed =
                        true;


                    state.touchedIds.add(
                        normalized.id
                    );


                    report
                        .migrations
                        .normalizedSourceRecords
                        .push({

                            type:
                                state.type,

                            repository:
                                state.repository.repo,

                            id:
                                normalized.id,

                            path:
                                normalized.path,

                            sha256:
                                normalized.sha256,

                            previousUrl:
                                record.url ||
                                null,

                            targetUrl:
                                generateCDNURL(

                                    state.type,

                                    normalized.filename

                                )

                        });

                } catch (error) {

                    report.conflicts.push({

                        type:
                            state.type,

                        repository:
                            state.repository.repo,

                        recordId:
                            record.id ||
                            null,

                        path:
                            sourcePath,

                        reason:
                            error.message

                    });

                }

            }

        }

    }


    const legacyRecords =
        [];


    for (
        const [
            type,
            legacyIndexFile
        ]
        of Object.entries(
            LEGACY_INDEX_FILES
        )
    ) {

        const records =
            readLocalJsonArray(
                legacyIndexFile
            );


        report.summary
            .legacyIndexRecords +=
            records.length;


        for (
            const record
            of records
        ) {

            legacyRecords.push({

                type,

                legacyIndexFile,

                record

            });

        }

    }


    const legacyReferencedPaths =
        new Set();


    for (
        const item
        of legacyRecords
    ) {

        const repositoryName =
            getLegacyRepositoryName(
                item.record
            );


        const legacyPath =

            item.record &&
            typeof item.record.path ===
                "string"

                ? item.record.path

                : null;


        if (
            !repositoryName ||
            !legacyPath
        ) {

            report.warnings.push({

                source:
                    item.legacyIndexFile,

                legacyId:
                    (
                        item.record &&
                        item.record.id
                    ) ||
                    null,

                reason:
                    "legacy-record-missing-repository-or-path"

            });


            continue;

        }


        const state =
            findState(

                states,

                item.type,

                repositoryName

            );


        if (!state) {

            report.warnings.push({

                source:
                    item.legacyIndexFile,

                legacyId:
                    item.record.id ||
                    null,

                repository:
                    repositoryName,

                path:
                    legacyPath,

                reason:
                    "legacy-repository-not-in-current-config"

            });


            continue;

        }


        const inventoryItem =
            state.inventoryByPath
                .get(
                    legacyPath
                );


        if (!inventoryItem) {

            report.warnings.push({

                source:
                    item.legacyIndexFile,

                legacyId:
                    item.record.id ||
                    null,

                repository:
                    repositoryName,

                path:
                    legacyPath,

                reason:
                    "legacy-source-file-missing"

            });


            continue;

        }


        legacyReferencedPaths.add(
            `${repositoryName}:${legacyPath}`
        );


        if (
            state.registeredPaths.has(
                legacyPath
            )
        ) {

            report
                .migrations
                .alreadyRepresentedLegacyRecords
                .push({

                    source:
                        item.legacyIndexFile,

                    legacyId:
                        item.record.id ||
                        null,

                    repository:
                        repositoryName,

                    path:
                        legacyPath

                });


            continue;

        }


        const canonicalMatches =
            state.registeredByBlob.get(
                inventoryItem.gitBlobSha
            ) ||
            [];


        if (
            canonicalMatches.length >
            0
        ) {

            report
                .migrations
                .duplicateLegacyRecords
                .push({

                    source:
                        item.legacyIndexFile,

                    legacyId:
                        item.record.id ||
                        null,

                    repository:
                        repositoryName,

                    path:
                        legacyPath,

                    duplicateOf:
                        canonicalMatches[0]
                            .path,

                    gitBlobSha:
                        inventoryItem
                            .gitBlobSha

                });


            continue;

        }


        const sequence =
            parseSequence(

                item.record,

                inventoryItem.filename

            );


        if (
            !Number.isInteger(
                sequence
            ) ||
            sequence <= 0
        ) {

            report.conflicts.push({

                type:
                    item.type,

                source:
                    item.legacyIndexFile,

                repository:
                    repositoryName,

                path:
                    legacyPath,

                reason:
                    "legacy-record-has-no-stable-sequence"

            });


            continue;

        }


        const expectedId =
            generateMediaID(
                item.type,
                sequence
            );


        const sequenceConflict =
            state.database.find(
                record =>
                    parseSequence(
                        record
                    ) ===
                        sequence
            );


        const idConflict =
            state.database.find(
                record =>
                    record &&
                    record.id ===
                        expectedId
            );


        if (
            sequenceConflict ||
            idConflict
        ) {

            report.conflicts.push({

                type:
                    item.type,

                source:
                    item.legacyIndexFile,

                repository:
                    repositoryName,

                path:
                    legacyPath,

                sequence,

                expectedId,

                reason:
                    "legacy-sequence-or-id-conflicts-with-source-database"

            });


            continue;

        }


        try {

            const migrated =
                await buildMigratedLegacyRecord({

                    legacyRecord:
                        item.record,

                    type:
                        item.type,

                    repository:
                        state.repository,

                    inventoryItem,

                    legacyIndexFile:
                        item.legacyIndexFile,

                    migratedAt

                });


            state.database.push(
                migrated
            );


            state.changed =
                true;


            state.touchedIds.add(
                migrated.id
            );


            addRegisteredItem(
                state,
                inventoryItem
            );


            report
                .migrations
                .migratedLegacyRecords
                .push({

                    type:
                        item.type,

                    source:
                        item.legacyIndexFile,

                    legacyId:
                        item.record.id ||
                        null,

                    repository:
                        repositoryName,

                    id:
                        migrated.id,

                    path:
                        migrated.path,

                    sha256:
                        migrated.sha256,

                    targetUrl:
                        generateCDNURL(

                            item.type,

                            migrated.filename

                        )

                });

        } catch (error) {

            report.conflicts.push({

                type:
                    item.type,

                source:
                    item.legacyIndexFile,

                repository:
                    repositoryName,

                path:
                    legacyPath,

                reason:
                    error.message

            });

        }

    }


    for (
        const state
        of states
    ) {

        state.database.sort(
            (a, b) =>
                parseSequence(a) -
                parseSequence(b)
        );

    }


    for (
        const state
        of states
    ) {

        const groups =
            new Map();


        for (
            const media
            of state.inventory
        ) {

            if (
                !groups.has(
                    media.gitBlobSha
                )
            ) {

                groups.set(
                    media.gitBlobSha,
                    []
                );

            }


            groups.get(
                media.gitBlobSha
            ).push(
                media
            );

        }


        for (
            const [
                gitBlobSha,
                files
            ]
            of groups
        ) {

            if (
                files.length <
                2
            ) {

                continue;

            }


            const registered =
                files.filter(
                    file =>
                        state.registeredPaths
                            .has(
                                file.path
                            )
                );


            const canonical =
                (
                    registered.length

                        ? registered

                        : files
                )
                .slice()
                .sort(
                    (a, b) =>
                        a.path.localeCompare(
                            b.path
                        )
                )[0];


            const copies =
                files

                    .filter(
                        file =>
                            file.path !==
                            canonical.path
                    )

                    .map(
                        file => ({

                            path:
                                file.path,

                            registered:
                                state.registeredPaths
                                    .has(
                                        file.path
                                    ),

                            legacyIndexed:
                                legacyReferencedPaths
                                    .has(
                                        `${state.repository.repo}:${file.path}`
                                    )

                        })
                    );


            report
                .duplicateGroups
                .push({

                    type:
                        state.type,

                    repository:
                        state.repository.repo,

                    gitBlobSha,

                    canonical: {

                        path:
                            canonical.path,

                        registered:
                            state.registeredPaths
                                .has(
                                    canonical.path
                                )

                    },

                    copies

                });


            for (
                const copy
                of copies
            ) {

                if (
                    copy.registered
                ) {

                    continue;

                }


                report
                    .deletionCandidates
                    .push({

                        type:
                            state.type,

                        repository:
                            state.repository.repo,

                        path:
                            copy.path,

                        duplicateOf:
                            canonical.path,

                        gitBlobSha,

                        legacyIndexed:
                            copy.legacyIndexed,

                        reason:
                            "exact-byte-duplicate"

                    });

            }

        }


        for (
            const media
            of state.inventory
        ) {

            const key =
                `${state.repository.repo}:${media.path}`;


            if (
                state.registeredPaths
                    .has(
                        media.path
                    ) ||
                legacyReferencedPaths
                    .has(
                        key
                    )
            ) {

                continue;

            }


            if (
                report
                    .deletionCandidates
                    .some(
                        candidate =>
                            candidate.repository ===
                                state.repository.repo &&
                            candidate.path ===
                                media.path
                    )
            ) {

                continue;

            }


            report.orphanFiles.push({

                type:
                    state.type,

                repository:
                    state.repository.repo,

                path:
                    media.path,

                gitBlobSha:
                    media.gitBlobSha,

                size:
                    media.size,

                reason:
                    "not-in-source-database-or-legacy-index"

            });

        }

    }


    report.summary
        .normalizedSourceRecords =
        report
            .migrations
            .normalizedSourceRecords
            .length;


    report.summary
        .migratedLegacyRecords =
        report
            .migrations
            .migratedLegacyRecords
            .length;


    report.summary
        .duplicateGroups =
        report
            .duplicateGroups
            .length;


    report.summary
        .deletionCandidates =
        report
            .deletionCandidates
            .length;


    report.summary
        .orphanFiles =
        report
            .orphanFiles
            .length;


    report.summary
        .conflicts =
        report
            .conflicts
            .length;


    report.summary
        .missingSourceRecords =
        report
            .missingSourceRecords
            .length;


    return {

        config,

        report,

        states

    };

}


function updateCountersFromPlan(
    config,
    states
) {

    let changed =
        false;


    for (
        const type
        of [
            "image",
            "audio",
            "video"
        ]
    ) {

        let maximum =
            Number(
                config.counters[type] ||
                0
            );


        for (
            const state
            of states.filter(
                item =>
                    item.type ===
                        type
            )
        ) {

            for (
                const media
                of state.inventory
            ) {

                maximum =
                    Math.max(

                        maximum,

                        Number(
                            media.sequence ||
                            0
                        )

                    );

            }


            for (
                const record
                of state.database
            ) {

                maximum =
                    Math.max(

                        maximum,

                        parseSequence(
                            record
                        )

                    );

            }

        }


        if (
            Number(
                config.counters[type] ||
                0
            ) !==
            maximum
        ) {

            config.counters[type] =
                maximum;


            changed =
                true;

        }

    }


    if (changed) {

        saveConfig(
            config
        );

    }


    return changed;

}


async function writeChangedDatabases(
    states,
    phase
) {

    for (
        const state
        of states
    ) {

        if (
            !state.changed
        ) {

            continue;

        }


        await upsertTextFile(

            state.repository.repo,

            state.repository.database,

            JSON.stringify(
                state.database,
                null,
                2
            ) + "\n",

            state.repository.branch,

            `History migration ${phase}`

        );

    }

}


function finalizeTouchedRecords(
    state,
    publishedAt
) {

    for (
        let index = 0;

        index <
        state.database.length;

        index++
    ) {

        const record =
            state.database[index];


        if (
            !record ||
            !state.touchedIds.has(
                record.id
            )
        ) {

            continue;

        }


        const filename =
            getRecordFilename(
                record
            );


        if (!filename) {

            throw new Error(
                `Cannot finalize record without filename: ${record.id}`
            );

        }


        state.database[index] = {

            ...record,

            status:
                "complete",

            sourceStatus:
                "complete",

            cdnStatus:
                "published",

            cdnPath:
                generateCDNPath(
                    state.type,
                    filename
                ),

            url:
                generateCDNURL(
                    state.type,
                    filename
                ),

            cdnPublishedAt:
                record.cdnPublishedAt ||
                publishedAt

        };

    }

}


async function runReport() {

    const plan =
        await buildPlan(
            "report"
        );


    plan.report.status =

        plan.report
            .conflicts
            .length ||

        plan.report
            .missingSourceRecords
            .length

            ? "blocked"

            : "ready";


    plan.report.completedAt =
        new Date()
            .toISOString();


    writeReport(
        plan.report
    );


    console.log(
        JSON.stringify(
            plan.report.summary,
            null,
            2
        )
    );


    return plan.report;

}


async function runMigration() {

    const plan =
        await buildPlan(
            "migrate"
        );


    if (
        plan.report
            .conflicts
            .length ||

        plan.report
            .missingSourceRecords
            .length
    ) {

        plan.report.status =
            "blocked";


        plan.report.completedAt =
            new Date()
                .toISOString();


        writeReport(
            plan.report
        );


        throw new Error(
            "History migration blocked by conflicts or missing registered source files"
        );

    }


    const touchedCount =
        plan.states.reduce(

            (
                total,
                state
            ) =>
                total +
                state.touchedIds.size,

            0

        );


    updateCountersFromPlan(

        plan.config,

        plan.states

    );


    if (
        touchedCount ===
        0
    ) {

        plan.report.status =
            "complete-no-changes";


        plan.report.completedAt =
            new Date()
                .toISOString();


        writeReport(
            plan.report
        );


        console.log(
            "History migration already complete; no changes required."
        );


        return plan.report;

    }


    try {

        await writeChangedDatabases(

            plan.states,

            "prepare"

        );


        plan.report
            .publication
            .attempted =
            true;


        const publication =
            await publishCDN();


        const manifest =
            readManifest();


        const publishedAt =
            manifest.lastPublishedAt ||
            new Date()
                .toISOString();


        for (
            const state
            of plan.states
        ) {

            finalizeTouchedRecords(
                state,
                publishedAt
            );

        }


        await writeChangedDatabases(

            plan.states,

            "complete"

        );


        plan.report.status =
            "complete";


        plan.report
            .publication
            .publishedAt =
            publishedAt;


        plan.report
            .publication
            .versionId =
            publication.versionId ||
            manifest.lastVersionId ||
            null;


        plan.report
            .publication
            .deploymentId =
            publication.deploymentId ||
            manifest.lastDeploymentId ||
            null;


        plan.report.completedAt =
            new Date()
                .toISOString();


        writeReport(
            plan.report
        );


        console.log(
            "History migration complete."
        );


        console.log(
            JSON.stringify(
                plan.report.summary,
                null,
                2
            )
        );


        return plan.report;

    } catch (error) {

        plan.report.status =
            "failed";


        plan.report.completedAt =
            new Date()
                .toISOString();


        plan.report.warnings.push({

            reason:
                "migration-execution-failed",

            message:
                error.message

        });


        writeReport(
            plan.report
        );


        throw error;

    }

}


async function run() {

    const command =
        process.argv[2] ||
        "report";


    if (
        command ===
        "report"
    ) {

        return runReport();

    }


    if (
        command ===
        "migrate"
    ) {

        return runMigration();

    }


    throw new Error(
        `Unknown history command: ${command}`
    );

}


if (
    require.main ===
    module
) {

    run()
        .catch(
            error => {

                console.error(
                    "History task failed:"
                );


                console.error(
                    error
                );


                process.exit(1);

            }
        );

}


module.exports = {

    buildPlan,

    runReport,

    runMigration

};
