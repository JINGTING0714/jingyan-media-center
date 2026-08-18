const https = require("https");
const fs = require("fs");
const crypto = require("crypto");

function getRepositoryOwner(
    repo
) {
    return String(
        repo ||
        ""
    ).split("/")[0] || "";
}

function getStorageOwner() {
    return String(
        process.env
            .STORAGE_GITHUB_OWNER ||
        "jingyan-media-storage"
    ).trim();
}

function getMediaToken() {
    const token =
        process.env.MEDIA_TOKEN ||
        process.env.GH_TOKEN;

    if (!token) {
        throw new Error(
            "MEDIA_TOKEN/GH_TOKEN missing"
        );
    }

    return token;
}

function getStorageToken() {
    const token =
        process.env.STORAGE_TOKEN;

    if (!token) {
        throw new Error(
            "STORAGE_TOKEN missing"
        );
    }

    return token;
}

function getTokenForOwner(
    owner
) {
    if (
        String(owner)
            .toLowerCase() ===
        getStorageOwner()
            .toLowerCase()
    ) {
        return getStorageToken();
    }

    return getMediaToken();
}

function getTokenForRepository(
    repo
) {
    return getTokenForOwner(
        getRepositoryOwner(
            repo
        )
    );
}

function encodeContentPath(
    filePath
) {
    return String(filePath)
        .split("/")
        .map(
            part =>
                encodeURIComponent(
                    part
                )
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
        (
            resolve,
            reject
        ) => {

            const body =
                data !== null
                    ? JSON.stringify(
                        data
                    )
                    : null;

            const headers = {

                "User-Agent":
                    "jingyan-media-center",

                "Accept":
                    "application/vnd.github+json",

                "X-GitHub-Api-Version":
                    "2022-11-28"
            };

            if (token) {
                headers.Authorization =
                    `Bearer ${token}`;
            }

            if (
                body !== null
            ) {
                headers[
                    "Content-Type"
                ] =
                    "application/json";

                headers[
                    "Content-Length"
                ] =
                    Buffer.byteLength(
                        body
                    );
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

                        let responseBody =
                            "";

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
                                    res.statusCode <
                                        200 ||
                                    res.statusCode >=
                                        300
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

                                    reject(
                                        error
                                    );

                                    return;
                                }

                                resolve(
                                    result
                                );
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
                req.write(
                    body
                );
            }

            req.end();
        }
    );
}

async function getAuthenticatedUser(
    token = null
) {
    return githubRequest(

        "GET",

        "/user",

        token ||
            getMediaToken()
    );
}

async function assertAuthenticatedOwner(
    expectedOwner
) {
    const token =
        getTokenForOwner(
            expectedOwner
        );

    const user =
        await getAuthenticatedUser(
            token
        );

    if (
        !user ||
        !user.login ||
        user.login
            .toLowerCase() !==
        String(
            expectedOwner
        ).toLowerCase()
    ) {
        throw new Error(

            `GitHub token owner mismatch: expected ${expectedOwner}, got ${
                user &&
                user.login
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

        getTokenForRepository(
            repo
        )
    );
}

async function assertRepositoryOwner(
    repo,
    expectedOwner
) {
    const info =
        await getRepositoryInfo(
            repo
        );

    const actualOwner =
        info &&
        info.owner &&
        info.owner.login;

    if (
        !actualOwner ||
        actualOwner
            .toLowerCase() !==
        String(
            expectedOwner
        ).toLowerCase()
    ) {
        throw new Error(
            `Repository owner mismatch: ${repo}`
        );
    }

    return info;
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
            error.statusCode ===
            404
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
            data.size ||
            0
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

                getTokenForRepository(
                    repo
                )
            );

        const content =

            result &&

            typeof result.content ===
                "string" &&

            result.content.length >
                0

                ? Buffer.from(

                    result.content
                        .replace(
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
                    result.size ||
                    0
                ),

            path:
                result.path,

            content
        };

    } catch (error) {

        if (
            error.statusCode ===
            404
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

async function getBranchTreeSha(
    repo,
    branch = "main"
) {
    const token =
        getTokenForRepository(
            repo
        );

    const branchData =
        await githubRequest(

            "GET",

            `/repos/${repo}/branches/${encodeURIComponent(
                branch
            )}`,

            token
        );

    if (
        !branchData ||
        !branchData.commit ||
        !branchData.commit.sha
    ) {
        throw new Error(
            `Unable to resolve branch: ${repo}@${branch}`
        );
    }

    const commit =
        await githubRequest(

            "GET",

            `/repos/${repo}/git/commits/${branchData.commit.sha}`,

            token
        );

    if (
        !commit ||
        !commit.tree ||
        !commit.tree.sha
    ) {
        throw new Error(
            `Unable to resolve Git tree: ${repo}@${branch}`
        );
    }

    return commit
        .tree.sha;
}

async function getGitTree(
    repo,
    treeSha,
    recursive = false
) {
    const query =
        recursive
            ? "?recursive=1"
            : "";

    const tree =
        await githubRequest(

            "GET",

            `/repos/${repo}/git/trees/${treeSha}${query}`,

            getTokenForRepository(
                repo
            )
        );

    if (
        !tree ||
        !Array.isArray(
            tree.tree
        )
    ) {
        throw new Error(
            `Invalid Git tree response: ${repo}`
        );
    }

    if (
        tree.truncated ===
        true
    ) {
        throw new Error(
            `Git tree truncated: ${repo}`
        );
    }

    return tree;
}

async function getDirectoryEntries(
    repo,
    folder,
    branch = "main"
) {
    let treeSha =
        await getBranchTreeSha(
            repo,
            branch
        );

    const parts =
        String(
            folder ||
            ""
        )
            .split("/")
            .filter(
                Boolean
            );

    for (
        const part
        of parts
    ) {
        const tree =
            await getGitTree(
                repo,
                treeSha
            );

        const directory =
            tree.tree.find(
                entry =>
                    entry.type ===
                        "tree" &&
                    entry.path ===
                        part
            );

        if (!directory) {
            return [];
        }

        treeSha =
            directory.sha;
    }

    const tree =
        await getGitTree(
            repo,
            treeSha
        );

    return tree.tree;
}

async function getRecursiveEntries(
    repo,
    branch = "main"
) {
    const treeSha =
        await getBranchTreeSha(
            repo,
            branch
        );

    const tree =
        await getGitTree(
            repo,
            treeSha,
            true
        );

    return tree.tree;
}

function pathIsInsideFolder(
    entryPath,
    folder
) {
    const normalizedFolder =
        String(
            folder ||
            ""
        )
            .replace(
                /^\/+|\/+$/g,
                ""
            );

    if (
        !normalizedFolder
    ) {
        return true;
    }

    return (
        entryPath ===
            normalizedFolder ||
        entryPath.startsWith(
            normalizedFolder +
            "/"
        )
    );
}

async function getMaxFileSequence(
    repo,
    folder,
    branch = "main"
) {
    const entries =
        await getRecursiveEntries(
            repo,
            branch
        );

    let maximum =
        0;

    for (
        const entry
        of entries
    ) {
        if (
            !entry ||
            entry.type !==
                "blob" ||
            !pathIsInsideFolder(
                String(
                    entry.path ||
                    ""
                ),
                folder
            )
        ) {
            continue;
        }

        const basename =
            String(
                entry.path ||
                ""
            )
                .split("/")
                .pop();

        const match =
            basename.match(
                /^(\d+)-/
            );

        if (!match) {
            continue;
        }

        maximum =
            Math.max(

                maximum,

                Number(
                    match[1]
                )
            );
    }

    return maximum;
}

async function getDirectorySizeMB(
    repo,
    folder,
    branch = "main"
) {
    const entries =
        await getRecursiveEntries(
            repo,
            branch
        );

    let totalBytes =
        0;

    for (
        const entry
        of entries
    ) {
        if (
            entry &&
            entry.type ===
                "blob" &&
            pathIsInsideFolder(
                String(
                    entry.path ||
                    ""
                ),
                folder
            )
        ) {
            totalBytes +=
                Number(
                    entry.size ||
                    0
                );
        }
    }

    return (
        totalBytes /
        1024 /
        1024
    );
}

function calculateGitBlobSHA(
    buffer
) {
    const header =
        Buffer.from(

            `blob ${buffer.length}\0`,

            "utf8"
        );

    return crypto
        .createHash(
            "sha1"
        )
        .update(
            header
        )
        .update(
            buffer
        )
        .digest(
            "hex"
        );
}

function calculateFileGitBlobSHA(
    localFilePath
) {
    const buffer =
        fs.readFileSync(
            localFilePath
        );

    return calculateGitBlobSHA(
        buffer
    );
}

async function verifyRemoteFileMatchesLocal(
    repo,
    targetPath,
    localFilePath,
    branch = "main"
) {
    const remote =
        await getFile(
            repo,
            targetPath,
            branch
        );

    const localSize =
        fs.statSync(
            localFilePath
        ).size;

    const localGitSha =
        calculateFileGitBlobSHA(
            localFilePath
        );

    if (!remote) {
        return {

            exists:
                false,

            matches:
                false,

            localGitSha,

            remoteGitSha:
                null,

            localSize,

            remoteSize:
                null
        };
    }

    const matches =

        remote.sha ===
            localGitSha &&

        Number(
            remote.size
        ) ===
            Number(
                localSize
            );

    return {

        exists:
            true,

        matches,

        localGitSha,

        remoteGitSha:
            remote.sha,

        localSize,

        remoteSize:
            remote.size
    };
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

        getTokenForRepository(
            repo
        ),

        payload
    );
}

async function createRepository({
    expectedOwner,
    name,
    description = "",
    privateRepo = false
}) {
    const storageOwner =
        getStorageOwner();

    let endpoint;
    let token;

    if (
        String(
            expectedOwner
        ).toLowerCase() ===
        storageOwner
            .toLowerCase()
    ) {
        endpoint =
            `/orgs/${encodeURIComponent(
                expectedOwner
            )}/repos`;

        token =
            getStorageToken();

    } else {

        await assertAuthenticatedOwner(
            expectedOwner
        );

        endpoint =
            "/user/repos";

        token =
            getMediaToken();
    }

    const result =
        await githubRequest(

            "POST",

            endpoint,

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

    const buffer =
        fs.readFileSync(
            localFilePath
        );

    const expectedGitSha =
        calculateGitBlobSHA(
            buffer
        );

    const encodedPath =
        encodeContentPath(
            targetPath
        );

    const result =
        await githubRequest(

            "PUT",

            `/repos/${repo}/contents/${encodedPath}`,

            getTokenForRepository(
                repo
            ),

            {
                message:
                    `Upload ${targetPath}`,

                content:
                    buffer.toString(
                        "base64"
                    ),

                branch
            }
        );

    const actualGitSha =
        result &&
        result.content &&
        result.content.sha;

    if (
        !actualGitSha ||
        actualGitSha !==
            expectedGitSha
    ) {
        throw new Error(
            `GitHub upload verification failed: ${repo}/${targetPath}`
        );
    }

    return {

        sha:
            actualGitSha,

        path:
            targetPath
    };
}

module.exports = {

    githubRequest,

    getAuthenticatedUser,

    assertAuthenticatedOwner,

    assertRepositoryOwner,

    getRepositoryInfo,

    getRepositorySizeMB,

    repositoryExists,

    getFile,

    fileExists,

    getDirectoryEntries,

    getMaxFileSequence,

    getDirectorySizeMB,

    calculateGitBlobSHA,

    calculateFileGitBlobSHA,

    verifyRemoteFileMatchesLocal,

    upsertTextFile,

    createRepository,

    uploadFile,

    getTokenForRepository,

    getTokenForOwner,

    getRepositoryOwner,

    getStorageOwner
};
