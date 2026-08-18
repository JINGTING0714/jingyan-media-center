const fs = require("fs");

const {
    createRepository,
    repositoryExists,
    getRepositorySizeMB,
    getDirectorySizeMB,
    getFile,
    upsertTextFile,
    assertRepositoryOwner
} = require("./github");

const {
    loadRegistry,
    getRepositoryIndex,
    getRepositories,
    findRepository,
    upsertRepository,
    patchRepository,
    summarizeRecords
} = require("./storage-registry");

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

function getControlOwner(
    config
) {
    return (
        config.github
            .controlOwner ||
        config.github.owner
    );
}

function getStorageOwner(
