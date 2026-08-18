(() => {
    "use strict";


    const COLLECTION_PAGE_SIZE = 6;
    const MEDIA_PAGE_SIZE = 12;

    const TYPES = [
        "image",
        "audio",
        "video"
    ];

    const TYPE_META = {
        image: {
            singular: "图库",
            plural: "图库",
            icon: "▧"
        },

        audio: {
            singular: "歌单",
            plural: "歌单",
            icon: "♫"
        },

        video: {
            singular: "影集",
            plural: "影集",
            icon: "▶"
        }
    };


    const state = {
        image: createTypeState(),
        audio: createTypeState(),
        video: createTypeState()
    };


    let currentUser = null;

    let editingCollectionId = null;
    let editingCollectionType = null;
    let editingCollectionPage = 1;

    let currentCollection = null;

    let toastTimer = null;

    const refs = {};


    class ApiError extends Error {
        constructor(
            status,
            code
        ) {
            super(
                code
            );

            this.name =
                "ApiError";

            this.status =
                status;

            this.code =
                code;
        }
    }


    function createTypeState() {
        return {
            page: 1,
            totalPages: 1,
            total: 0,
            items: []
        };
    }


    function cacheRefs() {
        refs.identity =
            document.getElementById(
                "identity"
            );

        refs.adminLink =
            document.getElementById(
                "adminLink"
            );

        refs.profileAvatar =
            document.getElementById(
                "profileAvatar"
            );

        refs.profileName =
            document.getElementById(
                "profileName"
            );

        refs.profileRole =
            document.getElementById(
                "profileRole"
            );

        refs.profileSubtitle =
            document.getElementById(
                "profileSubtitle"
            );

        refs.imageCount =
            document.getElementById(
                "imageCount"
            );

        refs.audioCount =
            document.getElementById(
                "audioCount"
            );

        refs.videoCount =
            document.getElementById(
                "videoCount"
            );


        refs.drawer =
            document.getElementById(
                "collectionDrawer"
            );

        refs.drawerBackdrop =
            document.getElementById(
                "drawerBackdrop"
            );

        refs.drawerClose =
            document.getElementById(
                "drawerClose"
            );

        refs.drawerKicker =
            document.getElementById(
                "drawerKicker"
            );

        refs.drawerTitle =
            document.getElementById(
                "drawerTitle"
            );


        refs.collectionForm =
            document.getElementById(
                "collectionForm"
            );

        refs.collectionName =
            document.getElementById(
                "collectionName"
            );

        refs.collectionDescription =
            document.getElementById(
                "collectionDescription"
            );

        refs.collectionVisibility =
            document.getElementById(
                "collectionVisibility"
            );

        refs.collectionPinned =
            document.getElementById(
                "collectionPinned"
            );

        refs.collectionSave =
            document.getElementById(
                "collectionSave"
            );

        refs.collectionDelete =
            document.getElementById(
                "collectionDelete"
            );


        refs.drawerMediaSection =
            document.getElementById(
                "drawerMediaSection"
            );

        refs.drawerMediaList =
            document.getElementById(
                "drawerMediaList"
            );

        refs.drawerItemCount =
            document.getElementById(
                "drawerItemCount"
            );


        refs.toast =
            document.getElementById(
                "toast"
            );
    }


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


    function friendlyError(
        code
    ) {
        const messages = {
            collection_name_required:
                "请输入分组名称。",

            collection_name_too_long:
                "名称最多 60 个字符。",

            collection_name_invalid:
                "名称包含不允许的字符。",

            collection_name_exists:
                "已经存在同名分组。",

            collection_description_too_long:
                "描述最多 500 个字符。",

            collection_description_invalid:
                "描述包含不允许的字符。",

            invalid_collection_visibility:
                "可见范围无效。",

            invalid_collection_type:
                "Collection 类型无效。",

            collection_not_found:
                "找不到这个分组。",

            collection_permission_denied:
                "你没有权限管理这个分组。",

            collection_delete_conflict:
                "分组状态已经改变，请刷新后重试。",

            collection_item_not_found:
                "这个媒体已经不在该分组中。",

            collection_media_type_mismatch:
                "媒体类型与分组类型不一致。",

            collection_cover_media_not_found:
                "找不到可以作为封面的媒体。",

            collection_cover_type_mismatch:
                "这个媒体不能作为当前分组封面。",

            collection_cover_must_be_item:
                "只有已经加入分组的媒体才能成为封面。",

            audio_collection_cover_not_supported:
                "歌单暂时使用系统封面，不需要指定媒体封面。",

            media_not_found:
                "找不到这个媒体。",

            authentication_required:
                "登录状态已经失效。",

            active_account_required:
                "当前账号不可用。",

            invalid_json:
                "请求数据格式错误。",

            internal_error:
                "系统暂时出现问题，请稍后再试。",

            request_failed:
                "请求失败，请稍后再试。"
        };


        return (
            messages[
                code
            ] ||
            code ||
            "请求失败"
        );
    }


    function showToast(
        message
    ) {
        if (
            !refs.toast
        ) {
            return;
        }


        refs.toast.textContent =
            message;

        refs.toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {
                    refs.toast.classList.remove(
                        "show"
                    );
                },
                3000
            );
    }


    async function parseResponse(
        response
    ) {
        let data = {};


        try {
            data =
                await response.json();

        } catch {
            data = {};
        }


        if (
            !response.ok
        ) {
            if (
                response.status ===
                401
            ) {
                window.location.replace(
                    "/login"
                );
            }


            throw new ApiError(
                response.status,
                data.error ||
                "request_failed"
            );
        }


        return data;
    }


    async function apiJson(
        url,
        options = {}
    ) {
        const headers =
            new Headers(
                options.headers ||
                {}
            );


        if (
            options.body &&
            !headers.has(
                "Content-Type"
            )
        ) {
            headers.set(
                "Content-Type",
                "application/json"
            );
        }


        const response =
            await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    ...options,

                    headers
                }
            );


        return parseResponse(
            response
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


    function roleText(
        role
    ) {
        return (
            role ===
                "owner"
                ? "Owner"
                : "Uploader"
        );
    }


    function firstCharacter(
        text
    ) {
        const characters =
            Array.from(
                String(
                    text ||
                    ""
                ).trim()
            );


        return (
            characters[0] ||
            "J"
        );
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


    async function loadCurrentUser() {
        const response =
            await fetch(
                "/api/auth/me",
                {
                    credentials:
                        "same-origin"
                }
            );


        if (
            response.status ===
            401
        ) {
            window.location.replace(
                "/login"
            );

            return false;
        }


        const data =
            await parseResponse(
                response
            );


        currentUser =
            data.user;


        renderUser();


        return true;
    }


    function renderUser() {
        const displayName =
            currentUser
                ?.displayName ||
            "成员";


        refs.profileName.textContent =
            displayName;

        refs.profileAvatar.textContent =
            firstCharacter(
                displayName
            );

        refs.profileRole.textContent =
            roleText(
                currentUser
                    ?.role
            );

        refs.profileSubtitle.textContent =
            currentUser
                ?.role ===
                "owner"
                ? "Owner · 我的私人媒体空间"
                : "我的私人媒体空间";


        refs.adminLink.classList.toggle(
            "hidden",
            currentUser
                ?.role !==
                "owner"
        );


        refs.identity.textContent =
            "";


        const link =
            createElement(
                "a",
                "identity-link"
            );

        link.href =
            "/account";


        const avatar =
            createElement(
                "span",
                "identity-avatar",
                firstCharacter(
                    displayName
                )
            );


        const copy =
            createElement(
                "span",
                "identity-copy"
            );


        copy.append(
            createElement(
                "strong",
                "",
                displayName
            ),

            createElement(
                "small",
                "",
                roleText(
                    currentUser
                        ?.role
                )
            )
        );


        link.append(
            avatar,
            copy
        );


        refs.identity.append(
            link
        );
    }


    function listElement(
        type
    ) {
        return document.getElementById(
            `${type}List`
        );
    }


    function emptyElement(
        type
    ) {
        return document.getElementById(
            `${type}Empty`
        );
    }


    function summaryElement(
        type
    ) {
        return document.getElementById(
            `${type}Summary`
        );
    }


    function countElement(
        type
    ) {
        return refs[
            `${type}Count`
        ];
    }


    function pageInfoElement(
        type
    ) {
        return document.getElementById(
            `${type}PageInfo`
        );
    }


    function paginationElement(
        type
    ) {
        return document.getElementById(
            `${type}Pagination`
        );
    }


    function createCover(
        collection
    ) {
        const cover =
            createElement(
                "div",
                "collection-cover"
            );


        const url =
            collection
                ?.cover
                ?.cdnUrl;


        if (
            url &&
            collection.type ===
                "image"
        ) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                url;

            image.alt =
                "";

            image.loading =
                "lazy";

            image.decoding =
                "async";


            cover.append(
                image
            );


            return cover;
        }


        if (
            url &&
            collection.type ===
                "video"
        ) {
            const video =
                document.createElement(
                    "video"
                );

            video.src =
                url;

            video.muted =
                true;

            video.preload =
                "metadata";

            video.playsInline =
                true;


            prepareVideoFrame(
                video
            );


            cover.append(
                video
            );


            return cover;
        }


        cover.append(
            createElement(
                "div",
                "collection-cover-fallback",
                TYPE_META[
                    collection.type
                ]?.icon ||
                "◆"
            )
        );


        return cover;
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
                    // 某些浏览器不允许提前 seek。
                    // 这种情况直接使用浏览器默认首帧。
                }
            },
            {
                once:
                    true
            }
        );
    }


    function createCollectionCard(
        collection
    ) {
        const card =
            createElement(
                "button",
                "collection-card"
            );

        card.type =
            "button";


        const cover =
            createCover(
                collection
            );


        const content =
            createElement(
                "div",
                "collection-card-content"
            );


        const top =
            createElement(
                "div",
                "collection-card-top"
            );


        const name =
            createElement(
                "div",
                "collection-card-name",
                collection.name
            );


        const visibility =
            createElement(
                "span",
                "collection-visibility",
                collection.visibility ===
                    "private"
                    ? "仅自己"
                    : "成员可见"
            );


        top.append(
            name,
            visibility
        );


        const description =
            createElement(
                "div",
                "collection-card-description",
                collection.description ||
                "暂无描述"
            );


        const meta =
            createElement(
                "div",
                "collection-card-meta"
            );


        meta.append(
            createElement(
                "span",
                "",
                `${collection.itemCount || 0} 个媒体`
            )
        );


        if (
            collection.pinned
        ) {
            meta.append(
                createElement(
                    "span",
                    "collection-pinned",
                    "★ 已置顶"
                )
            );
        }


        content.append(
            top,
            description,
            meta
        );


        card.append(
            cover,
            content
        );


        card.addEventListener(
            "click",
            () => {
                openExistingCollection(
                    collection
                );
            }
        );


        return card;
    }


    function renderType(
        type
    ) {
        const typeState =
            state[
                type
            ];


        const list =
            listElement(
                type
            );

        const empty =
            emptyElement(
                type
            );


        list.textContent =
            "";


        for (
            const collection
            of typeState.items
        ) {
            list.append(
                createCollectionCard(
                    collection
                )
            );
        }


        empty.classList.toggle(
            "hidden",
            typeState.items.length >
                0
        );

        list.classList.toggle(
            "hidden",
            typeState.items.length ===
                0
        );


        summaryElement(
            type
        ).textContent =
            `${typeState.total} 个${TYPE_META[type].plural}`;


        countElement(
            type
        ).textContent =
            String(
                typeState.total
            );


        pageInfoElement(
            type
        ).textContent =
            `${typeState.page} / ${typeState.totalPages}`;


        const pagination =
            paginationElement(
                type
            );


        pagination.classList.toggle(
            "hidden",
            typeState.totalPages <=
                1
        );


        const previous =
            pagination.querySelector(
                '[data-page-action="prev"]'
            );

        const next =
            pagination.querySelector(
                '[data-page-action="next"]'
            );


        previous.disabled =
            typeState.page <=
            1;

        next.disabled =
            typeState.page >=
            typeState.totalPages;
    }


    async function loadCollections(
        type,
        page =
            state[type].page
    ) {
        const data =
            await apiJson(
                `/api/collections?type=${encodeURIComponent(type)}&page=${encodeURIComponent(page)}&pageSize=${COLLECTION_PAGE_SIZE}`
            );


        state[
            type
        ] = {
            page:
                Number(
                    data.query
                        ?.page ||
                    1
                ),

            totalPages:
                Number(
                    data.query
                        ?.totalPages ||
                    1
                ),

            total:
                Number(
                    data.query
                        ?.total ||
                    0
                ),

            items:
                Array.isArray(
                    data.collections
                )
                    ? data.collections
                    : []
        };


        renderType(
            type
        );
    }


    function setOpenType(
        openType
    ) {
        for (
            const type
            of TYPES
        ) {
            const body =
                document.getElementById(
                    `${type}Body`
                );


            const toggle =
                document.querySelector(
                    `[data-toggle-type="${type}"]`
                );


            const toggleText =
                toggle.querySelector(
                    ".collection-toggle-text"
                );


            const open =
                type ===
                openType;


            body.classList.toggle(
                "hidden",
                !open
            );


            toggle.setAttribute(
                "aria-expanded",
                open
                    ? "true"
                    : "false"
            );


            toggleText.textContent =
                open
                    ? "收起"
                    : "展开";
        }
    }


    function openDrawer() {
        refs.drawer.classList.remove(
            "hidden"
        );

        refs.drawerBackdrop.classList.remove(
            "hidden"
        );

        refs.drawer.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.style.overflow =
            "hidden";
    }


    function removeDrawerPagination() {
        document
            .getElementById(
                "drawerMediaPagination"
            )
            ?.remove();
    }


    function closeDrawer() {
        refs.drawer.classList.add(
            "hidden"
        );

        refs.drawerBackdrop.classList.add(
            "hidden"
        );

        refs.drawer.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";


        editingCollectionId =
            null;

        editingCollectionType =
            null;

        editingCollectionPage =
            1;

        currentCollection =
            null;


        refs.collectionForm.reset();


        refs.drawerMediaList.textContent =
            "";

        refs.drawerMediaSection.classList.add(
            "hidden"
        );


        removeDrawerPagination();
    }


    function openNewCollection(
        type
    ) {
        editingCollectionId =
            null;

        editingCollectionType =
            type;

        editingCollectionPage =
            1;

        currentCollection =
            null;


        const label =
            TYPE_META[
                type
            ].singular;


        refs.drawerKicker.textContent =
            "NEW COLLECTION";

        refs.drawerTitle.textContent =
            `新建${label}`;


        refs.collectionName.value =
            "";

        refs.collectionDescription.value =
            "";

        refs.collectionVisibility.value =
            "members";

        refs.collectionPinned.checked =
            false;


        refs.collectionDelete.classList.add(
            "hidden"
        );

        refs.drawerMediaSection.classList.add(
            "hidden"
        );


        removeDrawerPagination();


        openDrawer();


        requestAnimationFrame(
            () => {
                refs.collectionName.focus();
            }
        );
    }


    async function openExistingCollection(
        collection
    ) {
        editingCollectionId =
            collection.id;

        editingCollectionType =
            collection.type;

        editingCollectionPage =
            1;

        currentCollection =
            collection;


        refs.drawerKicker.textContent =
            TYPE_META[
                collection.type
            ].singular.toUpperCase();

        refs.drawerTitle.textContent =
            collection.name;


        refs.collectionName.value =
            collection.name ||
            "";

        refs.collectionDescription.value =
            collection.description ||
            "";

        refs.collectionVisibility.value =
            collection.visibility ||
            "members";

        refs.collectionPinned.checked =
            Boolean(
                collection.pinned
            );


        refs.collectionDelete.classList.remove(
            "hidden"
        );

        refs.drawerMediaSection.classList.remove(
            "hidden"
        );


        refs.drawerItemCount.textContent =
            "读取中";


        refs.drawerMediaList.textContent =
            "";

        refs.drawerMediaList.append(
            createElement(
                "div",
                "drawer-media-empty",
                "正在读取分组内容…"
            )
        );


        removeDrawerPagination();


        openDrawer();


        await loadCollectionDetail(
            1
        );
    }


    async function loadCollectionDetail(
        page =
            editingCollectionPage
    ) {
        if (
            !editingCollectionId
        ) {
            return;
        }


        const targetCollectionId =
            editingCollectionId;


        try {
            const data =
                await apiJson(
                    `/api/collections/${encodeURIComponent(targetCollectionId)}?page=${encodeURIComponent(page)}&pageSize=${MEDIA_PAGE_SIZE}`
                );


            if (
                editingCollectionId !==
                targetCollectionId
            ) {
                return;
            }


            currentCollection =
                data.collection ||
                currentCollection;


            editingCollectionPage =
                Number(
                    data.items
                        ?.page ||
                    1
                );


            renderCollectionDetail(
                data
            );

        } catch (
            error
        ) {
            if (
                editingCollectionId !==
                targetCollectionId
            ) {
                return;
            }


            refs.drawerItemCount.textContent =
                "—";

            refs.drawerMediaList.textContent =
                "";

            refs.drawerMediaList.append(
                createElement(
                    "div",
                    "drawer-media-empty",
                    friendlyError(
                        error.code ||
                        error.message
                    )
                )
            );


            removeDrawerPagination();
        }
    }


    function createMediaPreview(
        item
    ) {
        const hasUrl =
            Boolean(
                item.cdnUrl
            );


        const preview =
            createElement(
                hasUrl
                    ? "a"
                    : "div",
                "drawer-media-preview"
            );


        if (
            hasUrl
        ) {
            preview.href =
                item.cdnUrl;

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
            item.cdnUrl
        ) {
            const image =
                document.createElement(
                    "img"
                );


            image.src =
                item.cdnUrl;

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
            item.cdnUrl
        ) {
            const video =
                document.createElement(
                    "video"
                );


            video.src =
                item.cdnUrl;

            video.muted =
                true;

            video.preload =
                "metadata";

            video.playsInline =
                true;


            prepareVideoFrame(
                video
            );


            preview.append(
                video
            );


            return preview;
        }


        preview.textContent =
            item.type ===
                "audio"
                ? "♫"
                : "◆";


        return preview;
    }


    function createSmallAction(
        text,
        handler,
        disabled =
            false
    ) {
        const button =
            createElement(
                "button",
                "drawer-media-open",
                text
            );


        button.type =
            "button";

        button.disabled =
            disabled;


        if (
            !disabled
        ) {
            button.addEventListener(
                "click",
                handler
            );
        }


        return button;
    }


    async function setCollectionCover(
        item,
        button
    ) {
        if (
            !editingCollectionId ||
            !editingCollectionType
        ) {
            return;
        }


        if (
            ![
                "image",
                "video"
            ].includes(
                editingCollectionType
            )
        ) {
            showToast(
                "歌单暂时使用系统封面。"
            );

            return;
        }


        button.disabled =
            true;

        const previousText =
            button.textContent;

        button.textContent =
            "设置中…";


        try {
            await apiJson(
                `/api/collections/${encodeURIComponent(editingCollectionId)}`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            coverMediaId:
                                item.mediaId
                        })
                }
            );


            showToast(
                "分组封面已更新"
            );


            await Promise.all([
                loadCollectionDetail(
                    editingCollectionPage
                ),

                loadCollections(
                    editingCollectionType,
                    state[
                        editingCollectionType
                    ].page
                )
            ]);

        } catch (
            error
        ) {
            button.disabled =
                false;

            button.textContent =
                previousText;


            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    async function removeMediaFromCollection(
        item,
        button
    ) {
        if (
            !editingCollectionId ||
            !editingCollectionType
        ) {
            return;
        }


        const confirmed =
            window.confirm(
                `把「${mediaTitle(item)}」移出这个${TYPE_META[editingCollectionType].singular}吗？\n\n只会取消分组关系，媒体本身不会被删除，也不会进入回收站。`
            );


        if (
            !confirmed
        ) {
            return;
        }


        button.disabled =
            true;

        const previousText =
            button.textContent;

        button.textContent =
            "移出中…";


        try {
            const result =
                await apiJson(
                    `/api/collections/${encodeURIComponent(editingCollectionId)}/items/${encodeURIComponent(item.mediaId)}`,
                    {
                        method:
                            "DELETE"
                    }
                );


            if (
                result.removed ===
                false
            ) {
                showToast(
                    "这个媒体已经不在该分组中。"
                );

            } else {
                showToast(
                    "已移出分组，媒体本身没有删除"
                );
            }


            await Promise.all([
                loadCollectionDetail(
                    editingCollectionPage
                ),

                loadCollections(
                    editingCollectionType,
                    state[
                        editingCollectionType
                    ].page
                )
            ]);

        } catch (
            error
        ) {
            button.disabled =
                false;

            button.textContent =
                previousText;


            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    function renderDrawerPagination(
        itemState
    ) {
        removeDrawerPagination();


        const totalPages =
            Number(
                itemState
                    ?.totalPages ||
                1
            );

        const page =
            Number(
                itemState
                    ?.page ||
                1
            );


        if (
            totalPages <=
            1
        ) {
            return;
        }


        const pagination =
            createElement(
                "div",
                "collection-pagination"
            );


        pagination.id =
            "drawerMediaPagination";


        const previous =
            createElement(
                "button",
                "",
                "‹ 上一页"
            );

        previous.type =
            "button";

        previous.disabled =
            page <=
            1;


        const info =
            createElement(
                "span",
                "",
                `${page} / ${totalPages}`
            );


        const next =
            createElement(
                "button",
                "",
                "下一页 ›"
            );

        next.type =
            "button";

        next.disabled =
            page >=
            totalPages;


        previous.addEventListener(
            "click",
            () => {
                if (
                    page >
                    1
                ) {
                    loadCollectionDetail(
                        page -
                        1
                    );
                }
            }
        );


        next.addEventListener(
            "click",
            () => {
                if (
                    page <
                    totalPages
                ) {
                    loadCollectionDetail(
                        page +
                        1
                    );
                }
            }
        );


        pagination.append(
            previous,
            info,
            next
        );


        refs.drawerMediaSection.append(
            pagination
        );
    }


    function renderCollectionDetail(
        data
    ) {
        const collection =
            data.collection ||
            currentCollection;


        const itemState =
            data.items ||
            {};


        const items =
            Array.isArray(
                itemState.items
            )
                ? itemState.items
                : [];


        currentCollection =
            collection ||
            currentCollection;


        if (
            collection
        ) {
            refs.drawerTitle.textContent =
                collection.name;

            refs.collectionName.value =
                collection.name ||
                "";

            refs.collectionDescription.value =
                collection.description ||
                "";

            refs.collectionVisibility.value =
                collection.visibility ||
                "members";

            refs.collectionPinned.checked =
                Boolean(
                    collection.pinned
                );
        }


        refs.drawerItemCount.textContent =
            String(
                Number(
                    itemState.total ||
                    0
                )
            );


        refs.drawerMediaList.textContent =
            "";


        if (
            items.length ===
            0
        ) {
            refs.drawerMediaList.append(
                createElement(
                    "div",
                    "drawer-media-empty",
                    `这个${TYPE_META[editingCollectionType]?.singular || "分组"}还没有媒体。请前往媒体库，在对应媒体上点击「加入${TYPE_META[editingCollectionType]?.singular || "分组"}」。`
                )
            );


            renderDrawerPagination(
                itemState
            );


            return;
        }


        for (
            const item
            of items
        ) {
            const row =
                createElement(
                    "div",
                    "drawer-media-item"
                );


            const preview =
                createMediaPreview(
                    item
                );


            const copy =
                createElement(
                    "div",
                    "drawer-media-copy"
                );


            copy.append(
                createElement(
                    "strong",
                    "",
                    mediaTitle(
                        item
                    )
                ),

                createElement(
                    "small",
                    "",
                    `${item.mediaId} · ${formatBytes(item.sizeBytes)}`
                )
            );


            const actions =
                createElement(
                    "div",
                    "drawer-actions"
                );


            if (
                [
                    "image",
                    "video"
                ].includes(
                    item.type
                )
            ) {
                const isCover =
                    currentCollection
                        ?.cover
                        ?.mediaId ===
                    item.mediaId;


                const coverButton =
                    createSmallAction(
                        isCover
                            ? "当前封面"
                            : "设封面",

                        () => {
                            setCollectionCover(
                                item,
                                coverButton
                            );
                        },

                        isCover
                    );


                actions.append(
                    coverButton
                );
            }


            const removeButton =
                createSmallAction(
                    "移出",

                    () => {
                        removeMediaFromCollection(
                            item,
                            removeButton
                        );
                    }
                );


            actions.append(
                removeButton
            );


            row.append(
                preview,
                copy,
                actions
            );


            refs.drawerMediaList.append(
                row
            );
        }


        renderDrawerPagination(
            itemState
        );
    }


    async function saveCollection(
        event
    ) {
        event.preventDefault();


        const name =
            refs.collectionName
                .value
                .trim();


        if (
            !name
        ) {
            showToast(
                "请输入名称。"
            );

            refs.collectionName.focus();

            return;
        }


        const body = {
            name,

            description:
                refs.collectionDescription
                    .value
                    .trim() ||
                null,

            visibility:
                refs.collectionVisibility
                    .value,

            pinned:
                refs.collectionPinned
                    .checked
        };


        refs.collectionSave.disabled =
            true;


        const previousText =
            refs.collectionSave
                .textContent;

        refs.collectionSave.textContent =
            "保存中…";


        try {
            if (
                editingCollectionId
            ) {
                await apiJson(
                    `/api/collections/${encodeURIComponent(editingCollectionId)}`,
                    {
                        method:
                            "PATCH",

                        body:
                            JSON.stringify(
                                body
                            )
                    }
                );


                showToast(
                    "分组已更新"
                );

            } else {
                await apiJson(
                    "/api/collections",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                ...body,

                                type:
                                    editingCollectionType
                            })
                    }
                );


                showToast(
                    `${TYPE_META[editingCollectionType].singular}已创建`
                );
            }


            const refreshType =
                editingCollectionType;


            closeDrawer();


            await loadCollections(
                refreshType,
                1
            );


            setOpenType(
                refreshType
            );

        } catch (
            error
        ) {
            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );

        } finally {
            refs.collectionSave.disabled =
                false;

            refs.collectionSave.textContent =
                previousText;
        }
    }


    async function deleteCurrentCollection() {
        if (
            !editingCollectionId ||
            !editingCollectionType
        ) {
            return;
        }


        const name =
            refs.collectionName
                .value
                .trim() ||
            "这个分组";


        const confirmed =
            window.confirm(
                `删除「${name}」？\n\n只会删除这个分组，不会删除里面的媒体。`
            );


        if (
            !confirmed
        ) {
            return;
        }


        refs.collectionDelete.disabled =
            true;


        const previousText =
            refs.collectionDelete
                .textContent;

        refs.collectionDelete.textContent =
            "删除中…";


        try {
            await apiJson(
                `/api/collections/${encodeURIComponent(editingCollectionId)}`,
                {
                    method:
                        "DELETE"
                }
            );


            const refreshType =
                editingCollectionType;

            const targetPage =
                Math.max(
                    1,
                    state[
                        refreshType
                    ].page
                );


            closeDrawer();


            showToast(
                "分组已删除，媒体没有被删除"
            );


            await loadCollections(
                refreshType,
                targetPage
            );


            setOpenType(
                refreshType
            );

        } catch (
            error
        ) {
            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );

        } finally {
            refs.collectionDelete.disabled =
                false;

            refs.collectionDelete.textContent =
                previousText;
        }
    }


    async function changePage(
        type,
        direction
    ) {
        const current =
            state[
                type
            ];


        const nextPage =
            Math.min(
                current.totalPages,

                Math.max(
                    1,
                    current.page +
                    direction
                )
            );


        if (
            nextPage ===
            current.page
        ) {
            return;
        }


        try {
            await loadCollections(
                type,
                nextPage
            );


            document
                .querySelector(
                    `[data-collection-type="${type}"]`
                )
                ?.scrollIntoView({
                    behavior:
                        "smooth",

                    block:
                        "start"
                });

        } catch (
            error
        ) {
            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    function bindEvents() {
        for (
            const toggle
            of document.querySelectorAll(
                "[data-toggle-type]"
            )
        ) {
            toggle.addEventListener(
                "click",
                () => {
                    const type =
                        toggle.dataset
                            .toggleType;


                    const expanded =
                        toggle.getAttribute(
                            "aria-expanded"
                        ) ===
                        "true";


                    setOpenType(
                        expanded
                            ? null
                            : type
                    );
                }
            );
        }


        for (
            const button
            of document.querySelectorAll(
                "[data-create-type]"
            )
        ) {
            button.addEventListener(
                "click",
                () => {
                    openNewCollection(
                        button.dataset
                            .createType
                    );
                }
            );
        }


        for (
            const button
            of document.querySelectorAll(
                "[data-page-action]"
            )
        ) {
            button.addEventListener(
                "click",
                () => {
                    const type =
                        button.dataset
                            .pageType;


                    const direction =
                        button.dataset
                            .pageAction ===
                            "prev"
                            ? -1
                            : 1;


                    changePage(
                        type,
                        direction
                    );
                }
            );
        }


        refs.drawerClose.addEventListener(
            "click",
            closeDrawer
        );


        refs.drawerBackdrop.addEventListener(
            "click",
            closeDrawer
        );


        refs.collectionForm.addEventListener(
            "submit",
            saveCollection
        );


        refs.collectionDelete.addEventListener(
            "click",
            deleteCurrentCollection
        );


        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !refs.drawer
                        .classList
                        .contains(
                            "hidden"
                        )
                ) {
                    closeDrawer();
                }
            }
        );
    }


    async function init() {
        cacheRefs();

        bindEvents();


        const authenticated =
            await loadCurrentUser();


        if (
            !authenticated
        ) {
            return;
        }


        setOpenType(
            "image"
        );


        try {
            await Promise.all(
                TYPES.map(
                    type =>
                        loadCollections(
                            type,
                            1
                        )
                )
            );

        } catch (
            error
        ) {
            console.error(
                "Profile collections load failed:",
                error
            );


            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );
        }
    }


    window.addEventListener(
        "load",
        () => {
            init()
                .catch(
                    error => {
                        console.error(
                            "Profile init failed:",
                            error
                        );


                        showToast(
                            "个人主页加载失败。"
                        );
                    }
                );
        }
    );

})();
