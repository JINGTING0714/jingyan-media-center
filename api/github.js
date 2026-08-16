const https = require("https");
const fs = require("fs");


function getToken() {

    const token = process.env.GH_TOKEN;

    if (!token) {
        throw new Error("GH_TOKEN missing");
    }

    return token;
}


function encodeContentPath(filePath) {

    return filePath
        .split("/")
        .map(part => encodeURIComponent(part))
        .join("/");

}


function githubRequest(
    method,
    requestPath,
    token,
    data = null
) {

    return new Promise((resolve, reject) => {

        const body = data
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


        const options = {

            hostname:
                "api.github.com",

            path:
                requestPath,

            method,

            headers

        };


        const req = https.request(
            options,
            res => {

                let responseBody = "";

                res.on(
                    "data",
                    chunk => {

                        responseBody += chunk;

                    }
                );


                res.on(
                    "end",
                    () => {

                        let result = null;

                        if (responseBody) {

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
                                    typeof result === "string"
                                        ? result
                                        : JSON.stringify(result)
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


        if (body !== null) {

            req.write(body);

        }


        req.end();

    });

}


async function getRepositoryInfo(repo) {

    const token = getToken();

    return githubRequest(
        "GET",
        `/repos/${repo}`,
        token
    );

}


async function repositoryExists(repo) {

    try {

        await getRepositoryInfo(repo);

        return true;

    } catch (error) {

        if (error.statusCode === 404) {

            return false;

        }

        throw error;

    }

}


async function getRepositorySizeMB(repo) {

    const data =
        await getRepositoryInfo(repo);

    const sizeKB =
        Number(data.size || 0);

    return sizeKB / 1024;

}


async function getFile(
    repo,
    filePath,
    branch = "main"
) {

    const token = getToken();

    const encodedPath =
        encodeContentPath(filePath);

    const requestPath =
        `/repos/${repo}/contents/${encodedPath}` +
        `?ref=${encodeURIComponent(branch)}`;


    try {

        const result =
            await githubRequest(
                "GET",
                requestPath,
                token
            );


        const content =
            result.content
                ? Buffer.from(
                    result.content.replace(
                        /\n/g,
                        ""
                    ),
                    "base64"
                ).toString("utf8")
                : "";


        return {

            sha:
                result.sha,

            content,

            path:
                result.path

        };

    } catch (error) {

        if (error.statusCode === 404) {

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

    const result =
        await getFile(
            repo,
            filePath,
            branch
        );

    return Boolean(result);

}


async function upsertTextFile(
    repo,
    filePath,
    content,
    branch = "main",
    message = "Update file"
) {

    const token = getToken();

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
            ).toString("base64"),

        branch

    };


    if (existing) {

        payload.sha =
            existing.sha;

    }


    const encodedPath =
        encodeContentPath(filePath);


    return githubRequest(

        "PUT",

        `/repos/${repo}/contents/${encodedPath}`,

        token,

        payload

    );

}


async function createRepository({
    name,
    description = "",
    privateRepo = false
}) {

    const token = getToken();


    const result =
        await githubRequest(

            "POST",

            "/user/repos",

            token,

            {

                name,

                description,

                private:
                    privateRepo,

                auto_init:
                    true

            }

        );


    return {

        repo:
            result.full_name,

        url:
            result.html_url,

        defaultBranch:
            result.default_branch || "main"

    };

}


async function uploadFile(
    repo,
    localFilePath,
    targetPath,
    branch = "main"
) {

    const token = getToken();


    const existing =
        await getFile(
            repo,
            targetPath,
            branch
        );


    if (existing) {

        throw new Error(
            `Target already exists: ${repo}/${targetPath}`
        );

    }


    const content =
        fs.readFileSync(
            localFilePath
        )
        .toString("base64");


    const encodedPath =
        encodeContentPath(
            targetPath
        );


    const result =
        await githubRequest(

            "PUT",

            `/repos/${repo}/contents/${encodedPath}`,

            token,

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

    getRepositoryInfo,

    getRepositorySizeMB,

    repositoryExists,

    getFile,

    fileExists,

    upsertTextFile,

    createRepository,

    uploadFile

};
