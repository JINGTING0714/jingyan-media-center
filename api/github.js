const https = require("https");
const fs = require("fs");


function getToken() {

    const token =
        process.env.GH_TOKEN;

    if (!token) {

        throw new Error(
            "GH_TOKEN missing"
        );

    }

    return token;

}


function encodeContentPath(filePath) {

    return filePath
        .split("/")
        .map(
            part =>
                encodeURIComponent(part)
        )
        .join("/");

}


function githubRequest(
    method,
    requestPath,
    token,
    data = null
) {

    return new Promise(
        (resolve, reject) => {

            const body =
                data !== null
                    ? JSON.stringify(data)
                    : null;


            const headers = {

                "Authorization":
                    `Bearer ${token}`,

                "User-Agent":
                    "jingyan-media-center",

                "Accept":
                    "application/vnd.github+json",

                "X-GitHub-Api-Version":
                    "2022-11-28"

            };


            if (body !== null) {

                headers["Content-Type"] =
                    "application/json";

                headers["Content-Length"] =
                    Buffer.byteLength(body);

            }


            const req =
                https.request(

                    {

                        hostname:
                            "api.github.com",

                        path:
                            requestPath,

                        method,

                        headers

                    },

                    res => {

                        let responseBody = "";


                        res.on(
                            "data",
                            chunk => {

                                responseBody +=
                                    chunk;

                            }
                        );


                        res.on(
                            "end",
                            () => {

                                let result =
                                    null;


                                if (
                                    responseBody
                                ) {

                                    try {

                                        result =
                                            JSON.parse(
                                                responseBody
                                            );

                                    } catch {

                                        result =
                                            responseBody;

                                    }

                                }


                                if (
                                    res.statusCode < 200 ||
                                    res.statusCode >= 300
                                ) {

                                    const error =
                                        new Error(

                                            typeof result ===
                                            "string"

                                                ? result

                                                : JSON.stringify(
                                                    result
                                                )

                                        );


                                    error.statusCode =
                                        res.statusCode;

                                    error.response =
                                        result;


                                    reject(error);

                                    return;

                                }


                                resolve(result);

                            }
                        );

                    }

                );


            req.on(
                "error",
                reject
            );


            if (
                body !== null
            ) {

                req.write(body);

            }


            req.end();

        }
    );

}


async function getAuthenticatedUser() {

    return githubRequest(

        "GET",

        "/user",

        getToken()

    );

}


async function assertAuthenticatedOwner(
    expectedOwner
) {

    const user =
        await getAuthenticatedUser();


    if (

        !user ||

        !user.login ||

        user.login.toLowerCase() !==
        String(
            expectedOwner
        ).toLowerCase()

    ) {

        throw new Error(

            `MEDIA_TOKEN owner mismatch: expected ${expectedOwner}, got ${
                user && user.login
                    ? user.login
                    : "unknown"
            }`

        );

    }


    return user;

}


async function getRepositoryInfo(
    repo
) {

    return githubRequest(

        "GET",

        `/repos/${repo}`,

        getToken()

    );

}


async function repositoryExists(
    repo
) {

    try {

        await getRepositoryInfo(
            repo
        );

        return true;

    } catch (error) {

        if (
            error.statusCode === 404
        ) {

            return false;

        }

        throw error;

    }

}


async function getRepositorySizeMB(
    repo
) {

    const data =
        await getRepositoryInfo(
            repo
        );


    const sizeKB =
        Number(
            data.size || 0
        );


    return (
        sizeKB /
        1024
    );

}


async function getFile(
    repo,
    filePath,
    branch = "main"
) {

    const encodedPath =
        encodeContentPath(
            filePath
        );


    try {

        const result =
            await githubRequest(

                "GET",

                `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
                    branch
                )}`,

                getToken()

            );


        const content =

            result &&

            typeof result.content ===
            "string" &&

            result.content.length > 0

                ? Buffer.from(

                    result.content.replace(
                        /\n/g,
                        ""
                    ),

                    "base64"

                ).toString(
                    "utf8"
                )

                : "";


        return {

            sha:
                result.sha,

            size:
                Number(
                    result.size || 0
                ),

            path:
                result.path,

            content

        };

    } catch (error) {

        if (
            error.statusCode === 404
        ) {

            return null;

        }

        throw error;

    }

}


async function fileExists(
    repo,
    filePath,
    branch = "main"
) {

    return Boolean(

        await getFile(

            repo,

            filePath,

            branch

        )

    );

}


async function upsertTextFile(

    repo,

    filePath,

    content,

    branch = "main",

    message = "Update file"

) {

    const existing =
        await getFile(

            repo,

            filePath,

            branch

        );


    const payload = {

        message,

        content:
            Buffer.from(
                content,
                "utf8"
            ).toString(
                "base64"
            ),

        branch

    };


    if (existing) {

        payload.sha =
            existing.sha;

    }


    const encodedPath =
        encodeContentPath(
            filePath
        );


    return githubRequest(

        "PUT",

        `/repos/${repo}/contents/${encodedPath}`,

        getToken(),

        payload

    );

}


async function createRepository({

    expectedOwner,

    name,

    description = "",

    privateRepo = false

}) {

    await assertAuthenticatedOwner(
        expectedOwner
    );


    const result =
        await githubRequest(

            "POST",

            "/user/repos",

            getToken(),

            {

                name,

                description,

                private:
                    privateRepo,

                auto_init:
                    true

            }

        );


    if (

        !result ||

        !result.full_name ||

        !result.owner ||

        !result.owner.login ||

        result.owner.login
            .toLowerCase() !==

        String(
            expectedOwner
        ).toLowerCase()

    ) {

        throw new Error(

            `Repository created under unexpected owner: ${
                result &&
                result.full_name
                    ? result.full_name
                    : "unknown"
            }`

        );

    }


    return {

        repo:
            result.full_name,

        url:
            result.html_url,

        defaultBranch:
            result.default_branch ||
            "main"

    };

}


async function uploadFile(

    repo,

    localFilePath,

    targetPath,

    branch = "main"

) {

    if (

        await fileExists(

            repo,

            targetPath,

            branch

        )

    ) {

        throw new Error(

            `Target already exists: ${repo}/${targetPath}`

        );

    }


    const content =
        fs.readFileSync(
            localFilePath
        )
        .toString(
            "base64"
        );


    const encodedPath =
        encodeContentPath(
            targetPath
        );


    const result =
        await githubRequest(

            "PUT",

            `/repos/${repo}/contents/${encodedPath}`,

            getToken(),

            {

                message:
                    `Upload ${targetPath}`,

                content,

                branch

            }

        );


    return {

        sha:
            result.content.sha,

        path:
            targetPath

    };

}


module.exports = {

    githubRequest,

    getAuthenticatedUser,

    assertAuthenticatedOwner,

    getRepositoryInfo,

    getRepositorySizeMB,

    repositoryExists,

    getFile,

    fileExists,

    upsertTextFile,

    createRepository,

    uploadFile

};
