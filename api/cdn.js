const fs = require("fs");


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


function generateCDN(
    repo,
    branch,
    filePath
) {

    const config =
        loadConfig();


    if (
        !config.cdn ||
        !config.cdn.enabled
    ) {

        return null;

    }


    if (
        config.cdn.provider
        !== "jsdelivr"
    ) {

        throw new Error(
            `Unsupported CDN provider: ${config.cdn.provider}`
        );

    }


    if (
        config.cdn.includeBranch
    ) {

        return (
            "https://cdn.jsdelivr.net/gh/" +
            repo +
            "@" +
            branch +
            "/" +
            filePath
        );

    }


    return (
        "https://cdn.jsdelivr.net/gh/" +
        repo +
        "/" +
        filePath
    );

}


function generateRepositoryCDN(
    repository,
    filePath
) {

    return generateCDN(

        repository.repo,

        repository.branch || "main",

        filePath

    );

}


module.exports = {

    generateCDN,

    generateRepositoryCDN

};
