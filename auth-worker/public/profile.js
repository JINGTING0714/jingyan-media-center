(() => {
    "use strict";


    const PAGE_SIZE =
        6;


    const TYPES =
        [
            "image",
            "audio",
            "video"
        ];


    const TYPE_META = {

        image: {
            singular:
                "图库",

            plural:
                "图库",

            icon:
                "▧"
        },

        audio: {
            singular:
                "歌单",

            plural:
                "歌单",

            icon:
                "♫"
        },

        video: {
            singular:
                "影集",

            plural:
                "影集",

            icon:
                "▶"
        }

    };


    const state = {

        image: {
            page:
                1,

            totalPages:
                1,

            total:
                0,

            items:
                []
        },

        audio: {
            page:
                1,

            totalPages:
                1,

            total:
                0,

            items:
                []
        },

        video: {
            page:
                1,

            totalPages:
                1,

            total:
                0,

            items:
                []
        }

    };


    let currentUser =
        null;


    let editingCollectionId =
        null;


    let editingCollectionType =
        null;


    let toastTimer =
        null;


    const refs = {};


    class ApiError
    extends Error {

        constructor(
            status,
            code
        ) {
            super(
                code
            );


            this.status =
                status;


            this.code =
                code;
        }

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
            )
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


    function friendlyError(
        code
    ) {

        const errors = {

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
                "你没有权限修改这个分组。",

            collection_delete_conflict:
                "分组状态已经改变，请刷新后再试。",

            authentication_required:
                "登录状态已经失效。",

            active_account_required:
                "当前账号不可用。",

            internal_error:
                "系统暂时出现问题，请稍后重试。",

            request_failed:
                "请求失败，请稍后重试。"

        };


        return (
            errors[
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

        const chars =
            Array.from(
                String(
                    text ||
                    ""
                ).trim()
            );


        return (
            chars[0] ||
            "J"
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

            window.location
                .replace(
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


        refs.adminLink.classList
            .toggle(
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


        empty.classList
            .toggle(
                "hidden",
                typeState.items.length >
                    0
            );


        list.classList
            .toggle(
                "hidden",
                typeState.items.length ===
                    0
            );


        const label =
            TYPE_META[
                type
            ].plural;


        summaryElement(
            type
        ).textContent =
            `${typeState.total} 个${label}`;


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


        pagination.classList
            .toggle(
                "hidden",
                typeState.totalPages <=
                    1
            );


        const prev =
            pagination.querySelector(
                '[data-page-action="prev"]'
            );


        const next =
            pagination.querySelector(
                '[data-page-action="next"]'
            );


        prev.disabled =
            typeState.page <=
            1;


        next.disabled =
            typeState.page >=
            typeState.totalPages;

    }


    async function loadCollections(
        type,
        page =
            state[
                type
            ].page
    ) {

        const data =
            await apiJson(
                `/api/collections?type=${encodeURIComponent(type)}&page=${encodeURIComponent(page)}&pageSize=${PAGE_SIZE}`
            );


        state[
            type
        ] = {

            page:
                Number(
                    data.query?.page ||
                    1
                ),

            totalPages:
                Number(
                    data.query?.totalPages ||
                    1
                ),

            total:
                Number(
                    data.query?.total ||
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


            body.classList
                .toggle(
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

        refs.drawer.classList
            .remove(
                "hidden"
            );


        refs.drawerBackdrop
            .classList
            .remove(
                "hidden"
            );


        refs.drawer.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.style
            .overflow =
                "hidden";

    }


    function closeDrawer() {

        refs.drawer.classList
            .add(
                "hidden"
            );


        refs.drawerBackdrop
            .classList
            .add(
                "hidden"
            );


        refs.drawer.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style
            .overflow =
                "";


        editingCollectionId =
            null;


        editingCollectionType =
            null;


        refs.collectionForm
            .reset();


        refs.drawerMediaList
            .textContent =
                "";


        refs.drawerMediaSection
            .classList
            .add(
                "hidden"
            );

    }


    function openNewCollection(
        type
    ) {

        editingCollectionId =
            null;


        editingCollectionType =
            type;


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


        refs.collectionDelete.classList
            .add(
                "hidden"
            );


        refs.drawerMediaSection
            .classList
            .add(
                "hidden"
            );


        openDrawer();


        requestAnimationFrame(
            () => {

                refs.collectionName
                    .focus();

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


        refs.collectionDelete.classList
            .remove(
                "hidden"
            );


        refs.drawerMediaSection
            .classList
            .remove(
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


        openDrawer();


        try {

            const data =
                await apiJson(
                    `/api/collections/${encodeURIComponent(collection.id)}?page=1&pageSize=12`
                );


            if (
                editingCollectionId !==
                collection.id
            ) {
                return;
            }


            renderCollectionDetail(
                data
            );

        } catch (
            error
        ) {

            refs.drawerItemCount
                .textContent =
                    "—";


            refs.drawerMediaList
                .textContent =
                    "";


            refs.drawerMediaList
                .append(
                    createElement(
                        "div",
                        "drawer-media-empty",
                        friendlyError(
                            error.code ||
                            error.message
                        )
                    )
                );

        }

    }


    function mediaTitle(
        item
    ) {

        return (
            item.displayTitle ||
            item.originalName ||
            item.filename ||
            item.mediaId
        );

    }


    function createMediaPreview(
        item
    ) {

        const preview =
            createElement(
                "div",
                "drawer-media-preview"
            );


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
                "";


            image.loading =
                "lazy";


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


    function renderCollectionDetail(
        data
    ) {

        const collection =
            data.collection;


        const items =
            Array.isArray(
                data.items?.items
            )
                ? data.items.items
                : [];


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
            `${data.items?.total || 0}`;


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
                    "这个分组还没有媒体。下一阶段会把媒体库里的「加入图库 / 歌单 / 影集」按钮直接接到这里。"
                )
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


            const open =
                createElement(
                    "a",
                    "drawer-media-open",
                    "打开"
                );


            open.href =
                item.cdnUrl ||
                "#";


            open.target =
                "_blank";


            open.rel =
                "noopener noreferrer";


            if (
                !item.cdnUrl
            ) {

                open.removeAttribute(
                    "href"
                );

            }


            row.append(
                preview,
                copy,
                open
            );


            refs.drawerMediaList
                .append(
                    row
                );

        }

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


            refs.collectionName
                .focus();


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


            closeDrawer();


            showToast(
                "分组已删除，媒体没有被删除"
            );


            const targetPage =
                Math.max(
                    1,
                    state[
                        refreshType
                    ].page
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


        refs.drawerBackdrop
            .addEventListener(
                "click",
                closeDrawer
            );


        refs.collectionForm
            .addEventListener(
                "submit",
                saveCollection
            );


        refs.collectionDelete
            .addEventListener(
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
