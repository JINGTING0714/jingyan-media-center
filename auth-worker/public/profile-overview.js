(() => {
    "use strict";


    const refs = {
        recentCount:
            document.getElementById(
                "recentUploadCount"
            ),

        recentList:
            document.getElementById(
                "recentUploadList"
            ),

        recentEmpty:
            document.getElementById(
                "recentUploadEmpty"
            ),

        favoriteCount:
            document.getElementById(
                "favoriteCount"
            ),

        favoriteList:
            document.getElementById(
                "favoriteList"
            ),

        favoriteEmpty:
            document.getElementById(
                "favoriteEmpty"
            )
    };


    let loading =
        false;


    function createElement(
        tag,
        className = "",
        text = undefined
    ) {
        const element =
            document.createElement(
                tag
            );


        if (
            className
        ) {
            element.className =
                className;
        }


        if (
            text !==
            undefined
        ) {
            element.textContent =
                text;
        }


        return element;
    }


    function mediaTitle(
        item
    ) {
        return (
            item.displayTitle ||
            item.originalName ||
            item.filename ||
            item.mediaId ||
            "未命名媒体"
        );
    }


    function formatBytes(
        bytes
    ) {
        const value =
            Number(
                bytes
            );


        if (
            !Number.isFinite(
                value
            ) ||
            value <
                0
        ) {
            return "—";
        }


        if (
            value <
            1024
        ) {
            return `${value} B`;
        }


        if (
            value <
            1024 *
            1024
        ) {
            return (
                value /
                1024
            )
                .toFixed(
                    1
                ) +
                " KiB";
        }


        return (
            value /
            1024 /
            1024
        )
            .toFixed(
                2
            ) +
            " MiB";
    }


    function typeLabel(
        type
    ) {
        if (
            type ===
            "image"
        ) {
            return "图片";
        }


        if (
            type ===
            "audio"
        ) {
            return "音乐";
        }


        if (
            type ===
            "video"
        ) {
            return "视频";
        }


        return "媒体";
    }


    async function api(
        url,
        options = {}
    ) {
        const response =
            await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    ...options
                }
            );


        let data = {};


        try {
            data =
                await response.json();

        } catch {
            data = {};
        }


        if (
            response.status ===
            401
        ) {
            location.href =
                "/login";

            throw new Error(
                "authentication_required"
            );
        }


        if (
            !response.ok
        ) {
            throw new Error(
                data.error ||
                "request_failed"
            );
        }


        return data;
    }


    function prepareVideoFrame(
        video
    ) {
        video.addEventListener(
            "loadedmetadata",
            () => {
                try {
                    if (
                        Number.isFinite(
                            video.duration
                        ) &&
                        video.duration >
                            0.15
                    ) {
                        video.currentTime =
                            Math.min(
                                0.12,
                                Math.max(
                                    0,
                                    video.duration -
                                        0.05
                                )
                            );
                    }

                } catch {
                    // 浏览器不允许预 seek 时，
                    // 使用浏览器自己的首帧。
                }
            },
            {
                once:
                    true
            }
        );
    }


    function createPreview(
        item
    ) {
        const preview =
            createElement(
                item.url
                    ? "a"
                    : "div",
                "profile-media-preview"
            );


        if (
            item.url
        ) {
            preview.href =
                item.url;

            preview.target =
                "_blank";

            preview.rel =
                "noopener noreferrer";

            preview.title =
                "打开媒体";
        }


        if (
            item.type ===
                "image" &&
            item.url
        ) {
            const image =
                document.createElement(
                    "img"
                );


            image.src =
                item.url;

            image.alt =
                mediaTitle(
                    item
                );

            image.loading =
                "lazy";

            image.decoding =
                "async";


            preview.append(
                image
            );


            return preview;
        }


        if (
            item.type ===
                "video" &&
            item.url
        ) {
            const video =
                document.createElement(
                    "video"
                );


            video.src =
                item.url;

            video.muted =
                true;

            video.playsInline =
                true;

            video.preload =
                "metadata";


            prepareVideoFrame(
                video
            );


            preview.append(
                video
            );


            preview.append(
                createElement(
                    "span",
                    "profile-media-play",
                    "▶"
                )
            );


            return preview;
        }


        preview.append(
            createElement(
                "span",
                "profile-media-fallback",
                item.type ===
                    "audio"
                    ? "♫"
                    : "◆"
            )
        );


        return preview;
    }


    async function toggleFavorite(
        item,
        button
    ) {
        if (
            loading
        ) {
            return;
        }


        button.disabled =
            true;


        const shouldFavorite =
            !Boolean(
                item.favorite
            );


        button.textContent =
            "处理中…";


        try {
            await api(
                `/api/favorites/${encodeURIComponent(item.mediaId)}`,
                {
                    method:
                        shouldFavorite
                            ? "POST"
                            : "DELETE"
                }
            );


            await loadOverview();

        } catch (
            error
        ) {
            console.error(
                "Favorite update failed:",
                error
            );


            button.disabled =
                false;


            button.textContent =
                item.favorite
                    ? "★ 已收藏"
                    : "☆ 收藏";
        }
    }


    function createMediaItem(
        item,
        mode
    ) {
        const card =
            createElement(
                "article",
                "profile-media-item"
            );


        const preview =
            createPreview(
                item
            );


        const copy =
            createElement(
                "div",
                "profile-media-copy"
            );


        const title =
            createElement(
                "strong",
                "",
                mediaTitle(
                    item
                )
            );


        title.title =
            mediaTitle(
                item
            );


        const meta =
            createElement(
                "small",
                "",
                `${typeLabel(item.type)} · ${formatBytes(item.sizeBytes)}`
            );


        const mediaId =
            createElement(
                "small",
                "profile-media-id",
                item.mediaId ||
                "—"
            );


        copy.append(
            title,
            meta,
            mediaId
        );


        const action =
            createElement(
                "button",
                item.favorite
                    ? "profile-favorite active"
                    : "profile-favorite",
                item.favorite
                    ? "★ 已收藏"
                    : "☆ 收藏"
            );


        action.type =
            "button";


        if (
            mode ===
            "favorites"
        ) {
            action.textContent =
                "取消收藏";
        }


        action.addEventListener(
            "click",
            () => {
                toggleFavorite(
                    item,
                    action
                );
            }
        );


        card.append(
            preview,
            copy,
            action
        );


        return card;
    }


    function renderList(
        list,
        empty,
        items,
        mode
    ) {
        list.textContent =
            "";


        const hasItems =
            Array.isArray(
                items
            ) &&
            items.length >
                0;


        empty.classList.toggle(
            "hidden",
            hasItems
        );


        list.classList.toggle(
            "hidden",
            !hasItems
        );


        if (
            !hasItems
        ) {
            return;
        }


        for (
            const item
            of items
        ) {
            list.append(
                createMediaItem(
                    item,
                    mode
                )
            );
        }
    }


    async function loadOverview() {
        if (
            loading
        ) {
            return;
        }


        loading =
            true;


        try {
            const data =
                await api(
                    "/api/profile/overview"
                );


            refs.recentCount.textContent =
                String(
                    data.recentUploads
                        ?.total ||
                    0
                );


            refs.favoriteCount.textContent =
                String(
                    data.favorites
                        ?.total ||
                    0
                );


            renderList(
                refs.recentList,
                refs.recentEmpty,
                data.recentUploads
                    ?.items ||
                [],
                "recent"
            );


            renderList(
                refs.favoriteList,
                refs.favoriteEmpty,
                data.favorites
                    ?.items ||
                [],
                "favorites"
            );

        } finally {
            loading =
                false;
        }
    }


    window.addEventListener(
        "load",
        () => {
            loadOverview()
                .catch(
                    error => {
                        console.error(
                            "Profile overview failed:",
                            error
                        );


                        refs.recentEmpty
                            ?.classList
                            .remove(
                                "hidden"
                            );


                        if (
                            refs.recentEmpty
                        ) {
                            refs.recentEmpty.textContent =
                                "最近上传读取失败。";
                        }


                        refs.favoriteEmpty
                            ?.classList
                            .remove(
                                "hidden"
                            );


                        if (
                            refs.favoriteEmpty
                        ) {
                            refs.favoriteEmpty.textContent =
                                "收藏读取失败。";
                        }
                    }
                );
        }
    );

})();
