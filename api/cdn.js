const fs = require("fs");
const path = require("path");


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}


function normalizeType(type) {

    if (type === "music") {
        return "audio";
    }

    return type;

}


function getCDNBaseURL() {

    const config =
        loadConfig();


    if (
        !config.cdn ||
        !config.cdn.enabled
    ) {

        return null;

    }


    if (
        config.cdn.provider !==
        "cloudflare-static-assets"
    ) {

        throw new Error(
            `Unsupported CDN provider: ${config.cdn.provider}`
        );

    }


    return String(
        config.cdn.baseURL
    ).replace(
        /\/+$/,
        ""
    );

}


function generateCDNPath(
    type,
    filename
) {

    const config =
        loadConfig();


    const normalizedType =
        normalizeType(type);


    const settings =
        config.mediaTypes[
            normalizedType
        ];


    if (!settings) {

        throw new Error(
            `Invalid CDN media type: ${type}`
        );

    }


    const cleanFilename =
        path.posix.basename(
            String(filename)
        );


    return (
        "/" +
        settings.cdnFolder +
        "/" +
        cleanFilename
    );

}


function generateCDNURL(
    type,
    filename
) {

    const baseURL =
        getCDNBaseURL();


    if (!baseURL) {

        return null;

    }


    return (
        baseURL +
        generateCDNPath(
            type,
            filename
        )
    );

}


function isUnifiedCDNURL(
    url
) {

    if (!url) {
        return false;
    }


    const baseURL =
        getCDNBaseURL();


    return String(url)
        .startsWith(
            baseURL + "/"
        );

}


module.exports = {

    getCDNBaseURL,

    generateCDNPath,

    generateCDNURL,

    isUnifiedCDNURL

};
