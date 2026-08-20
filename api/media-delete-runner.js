const fs =
    require(
        "fs"
    );


const {
    getFile,
    githubRequest,
    getTokenForRepository,
    upsertTextFile
} =
    require(
        "./github"
    );


const {
    readRepositoryDatabase
} =
    require(
        "./database"
    );


const {
    publishCDN
} =
    require(
        "./cloudflare"
    );


function loadConfig() {
    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );
}


function input(
    name
) {
    const value =
        String(
            process.env[
                name
            ] ||
            ""
        )
            .trim();

    if (
        !value
    ) {
        throw new Error(
            `${name} missing`
        );
    }

    return value;
}


function encodeContentPath(
    filePath
) {
    return String(
        filePath
    )
        .split(
            "/"
        )
        .map(
            part =>
                encodeURIComponent(
                    part
                )
        )
        .join(
            "/"
        );
}


function findRepository(
    config,
    type,
    fullName
) {
    const repositories =
        config.storage
            ?.repositories
            ?.[type] ||
        [];

    const repository =
        repositories.find(
            item =>
                item.repo ===
                fullName
        );

    if (
        !repository
    ) {
        throw new Error(
            `Repository configuration not found: ${fullName}`
        );
    }

    return repository;
}


async function removeDatabaseRecord(
    repository,
    mediaId
) {
    const list =
        await readRepositoryDatabase(
            repository
        );

    const next =
        list.filter(
            record =>
                record?.id !==
                mediaId
        );

    if (
        next.length ===
        list.length
    ) {
        console.log(
            `Source database record already absent: ${mediaId}`
        );

        return;
    }

    await upsertTextFile(
        repository.repo,
        repository.database,
        JSON.stringify(
            next,
            null,
            2
        ) +
        "\n",
        repository.branch ||
        "main",
        `Delete media record ${mediaId}`
    );

    console.log(
        `Source database record removed: ${mediaId}`
    );
}


async function removeSourceFile(
    repository,
    sourcePath
) {
    const branch =
        repository.branch ||
        "main";

    const existing =
        await getFile(
            repository.repo,
            sourcePath,
            branch
        );

    if (
        !existing
    ) {
        console.log(
            `Source file already absent: ${repository.repo}/${sourcePath}`
        );

        return;
    }

    const path =
        encodeContentPath(
            sourcePath
        );

    await githubRequest(
        "DELETE",
        `/repos/${repository.repo}/contents/${path}`,
        getTokenForRepository(
            repository.repo
        ),
        {
            message:
                `Delete media ${sourcePath}`,

            sha:
                existing.sha,

            branch
        }
    );

    console.log(
        `Source file removed: ${repository.repo}/${sourcePath}`
    );
}


function removeManifestEntry(
    publicPath
) {
    const file =
        "data/cdn-manifest.json";

    const manifest =
        JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    if (
        !manifest.assets ||
        typeof manifest.assets !==
            "object"
    ) {
        throw new Error(
            "Invalid CDN manifest"
        );
    }

    if (
        Object.prototype
            .hasOwnProperty
            .call(
                manifest.assets,
                publicPath
            )
    ) {
        delete manifest.assets[
            publicPath
        ];

        manifest.updatedAt =
            new Date()
                .toISOString();

        fs.writeFileSync(
            file,
            JSON.stringify(
                manifest,
                null,
                2
            ) +
            "\n"
        );

        console.log(
            `CDN manifest entry removed: ${publicPath}`
        );

    } else {
        console.log(
            `CDN manifest entry already absent: ${publicPath}`
        );
    }
}


async function main() {
    const mediaId =
        input(
            "DELETE_MEDIA_ID"
        );

    const mediaType =
        input(
            "DELETE_MEDIA_TYPE"
        );

    const sourceRepository =
        input(
            "DELETE_SOURCE_REPOSITORY"
        );

    const sourceBranch =
        input(
            "DELETE_SOURCE_BRANCH"
        );

    const sourcePath =
        input(
            "DELETE_SOURCE_PATH"
        );

    const publicPath =
        input(
            "DELETE_PUBLIC_PATH"
        );


    if (
        ![
            "image",
            "audio",
            "video"
        ].includes(
            mediaType
        )
    ) {
        throw new Error(
            `Invalid media type: ${mediaType}`
        );
    }


    if (
        !publicPath.startsWith(
            `/${mediaType}/`
        )
    ) {
        throw new Error(
            `Invalid public path: ${publicPath}`
        );
    }


    const config =
        loadConfig();


    const repository =
        findRepository(
            config,
            mediaType,
            sourceRepository
        );


    repository.branch =
        sourceBranch;


    /*
     * 先从源数据库移除记录。
     * 避免 publishCDN() reconcile 时又把媒体加回来。
     */
    await removeDatabaseRecord(
        repository,
        mediaId
    );


    /*
     * 再删除真实 GitHub 媒体文件。
     */
    await removeSourceFile(
        repository,
        sourcePath
    );


    /*
     * 删除控制仓 Manifest 中的 CDN 入口。
     */
    removeManifestEntry(
        publicPath
    );


    /*
     * 重新发布 Cloudflare Assets。
     */
    await publishCDN();


    console.log(
        `Permanent media deletion completed: ${mediaId}`
    );
}


main()
    .catch(
        error => {
            console.error(
                error
            );

            process.exit(
                1
            );
        }
    );
