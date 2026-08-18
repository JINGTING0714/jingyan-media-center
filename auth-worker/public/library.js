const libraryIdentity =
    document.getElementById(
        "libraryIdentity"
    );

const manifestUpdated =
    document.getElementById(
        "manifestUpdated"
    );

const countAll =
    document.getElementById(
        "countAll"
    );

const countImage =
    document.getElementById(
        "countImage"
    );

const countAudio =
    document.getElementById(
        "countAudio"
    );

const countVideo =
    document.getElementById(
        "countVideo"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const refreshLibrary =
    document.getElementById(
        "refreshLibrary"
    );

const resultCount =
    document.getElementById(
        "resultCount"
    );

const libraryLoading =
    document.getElementById(
        "libraryLoading"
    );

const libraryEmpty =
    document.getElementById(
        "libraryEmpty"
    );

const mediaGrid =
    document.getElementById(
        "mediaGrid"
    );

const pagination =
    document.getElementById(
        "pagination"
    );

const previousPage =
    document.getElementById(
        "previousPage"
    );

const nextPage =
    document.getElementById(
        "nextPage"
    );

const pageText =
    document.getElementById(
        "pageText"
    );

const toast =
    document.getElementById(
        "toast"
    );

const toolbarActions =
    document.querySelector(
        ".toolbar-actions"
    );

const libraryToolbar =
    document.querySelector(
        ".library-toolbar"
    );

const typeButtons =
    Array.from(
        document.querySelectorAll(
            ".library-stat[data-type]"
        )
    );


let currentUser =
    null;

let currentType =
    "all";

let currentPage =
    1;

let currentTotalPages =
    1;

let currentPageSize =
    window.matchMedia(
        "(max-width: 760px)"
    ).matches
        ? 12
        : 24;

let searchTimer =
    null;

let toastTimer =
    null;


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


function showToast(
    message
) {

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2600
        );

}


async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                ...options,

                credentials:
                    "same-origin",

                headers: {
                    ...(options.headers || {})
                }
            }
        );

    let data =
        {};

    try {

        data =
            await response.json();

    } catch {

        data =
            {};

    }

    if (
        !response.ok
    ) {

        if (
            response.status ===
            401
        ) {

            location.href =
                "/login";

        }

        throw new ApiError(
            response.status,
            data.error ||
            "request_failed"
        );

    }

    return data;

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


function formatDate(
    value
) {

    if (
        !value
    ) {

        return "—";

    }

    const date =
        new Date(
            value
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }

    return date
        .toLocaleString(
            "zh-CN",
            {
                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

}


function shortHash(
    value
) {

    const text =
        String(
            value ||
            ""
        );

    if (
        !text
    ) {

        return "—";

    }

    if (
        text.length <=
        18
    ) {

        return text;

    }

    return (
        text.slice(
            0,
            10
        ) +
        "…" +
        text.slice(
            -6
        )
    );

}


async function copyText(
    value,
    successMessage
) {

    try {

        await navigator
            .clipboard
            .writeText(
                value
            );

        showToast(
            successMessage
        );

    } catch {

        showToast(
            "复制失败，请手动复制"
        );

    }

}


function renderIdentity() {

    libraryIdentity.textContent =
        "";

    const link =
        createElement(
            "a",
            "user-chip"
        );

    link.href =
        "/account";

    const displayName =
        currentUser
            ?.displayName ||
        "Owner";

    link.append(
        createElement(
            "span",
            "user-avatar",
            displayName
                .slice(
                    0,
                    1
                )
                .toUpperCase()
        )
    );

    const text =
        createElement(
            "span"
        );

    text.append(
        createElement(
            "strong",
            "",
            displayName
        ),

        createElement(
            "small",
            "",
            "Owner"
        )
    );

    link.append(
        text
    );

    libraryIdentity.append(
        link
    );

}


function metaRow(
    label,
    value,
    title = ""
) {

    const row =
        createElement(
            "div",
            "media-meta-row"
        );

    row.append(
        createElement(
            "span",
            "",
            label
        )
    );

    const strong =
        createElement(
            "strong",
            "",
            value ||
            "—"
        );

    if (
        title
    ) {

        strong.title =
            title;

    }

    row.append(
        strong
    );

    return row;

}


function createBadge(
    text,
    extraClass = ""
) {

    return createElement(
        "span",
        `media-badge ${extraClass}`.trim(),
        text
    );

}


function createOpenButton(
    item
) {

    const button =
        createElement(
            "button",
            "button primary",
            item.type ===
            "audio"
                ? "播放 / 打开"
                : "打开"
        );

    button.type =
        "button";

    button.addEventListener(
        "click",
        () => {

            window.open(
                item.url,
                "_blank",
                "noopener,noreferrer"
            );

        }
    );

    return button;

}


function createCopyCdnButton(
    item
) {

    const button =
        createElement(
            "button",
            "button secondary",
            "复制 CDN"
        );

    button.type =
        "button";

    button.addEventListener(
        "click",
        () => {

            copyText(
                item.url,
                "CDN 链接已复制"
            );

        }
    );

    return button;

}


function createCopySourceButton(
    item
) {

    if (
        !item.source
            ?.repository ||
        !item.source
            ?.path
    ) {

        return null;

    }

    const button =
        createElement(
            "button",
            "button secondary",
            "复制源路径"
        );

    button.type =
        "button";

    button.addEventListener(
        "click",
        () => {

            copyText(
                `${item.source.repository}:${item.source.path}`,
                "源路径已复制"
            );

        }
    );

    return button;

}


function createMediaCard(
    item
) {

    const card =
        createElement(
            "article",
            "media-card"
        );


    const header =
        createElement(
            "div",
            "media-card-header"
        );


    const titleBlock =
        createElement(
            "div",
            "media-title-block"
        );


    const title =
        createElement(
            "h3",
            "media-title",
            item.displayTitle ||
            item.filename ||
            "未命名媒体"
        );

    title.title =
        item.filename ||
        "";


    const mediaId =
        createElement(
            "div",
            "media-id",
            item.mediaId ||
            "未记录 Media ID"
        );


    titleBlock.append(
        title,
        mediaId
    );


    const badges =
        createElement(
            "div",
            "media-badges"
        );


    badges.append(
        createBadge(
            String(
                item.type ||
                "unknown"
            ).toUpperCase()
        )
    );


    if (
        item.protected
    ) {

        badges.append(
            createBadge(
                "已保护",
                "protected"
            )
        );

    }


    header.append(
        titleBlock,
        badges
    );


    const essentials =
        createElement(
            "div",
            "media-essentials"
        );


    essentials.append(
        metaRow(
            "类型",
            item.type
        ),

        metaRow(
            "大小",
            formatBytes(
                item.sizeBytes
            )
        ),

        metaRow(
            "上传时间",
            formatDate(
                item.addedAt
            )
        ),

        metaRow(
            "上传者",
            item.uploader
                ?.displayName ||
            "—"
        )
    );


    const actions =
        createElement(
            "div",
            "media-actions"
        );


    actions.append(
        createOpenButton(
            item
        ),

        createCopyCdnButton(
            item
        )
    );


    const sourceButton =
        createCopySourceButton(
            item
        );


    if (
        sourceButton
    ) {

        actions.append(
            sourceButton
        );

    }


    const details =
        createElement(
            "details",
            "media-details"
        );


    const summary =
        createElement(
            "summary",
            "",
            "高级信息"
        );


    const advanced =
        createElement(
            "div",
            "media-advanced"
        );


    advanced.append(
        metaRow(
            "文件名",
            item.filename ||
            "—",
            item.filename ||
            ""
        ),

        metaRow(
            "原始名称",
            item.originalName ||
            "—",
            item.originalName ||
            ""
        ),

        metaRow(
            "SHA256",
            shortHash(
                item.sha256
            ),
            item.sha256 ||
            ""
        ),

        metaRow(
            "源仓库",
            item.source
                ?.repository ||
            "—",
            item.source
                ?.repository ||
            ""
        ),

        metaRow(
            "源分支",
            item.source
                ?.branch ||
            "—"
        ),

        metaRow(
            "源路径",
            item.source
                ?.path ||
            "—",
            item.source
                ?.path ||
            ""
        ),

        metaRow(
            "CDN Shard",
            item.cdnShard ||
            "—"
        ),

        metaRow(
            "发布时间",
            formatDate(
                item.publishedAt
            )
        )
    );


    details.append(
        summary,
        advanced
    );


    card.append(
        header,
        essentials,
        actions,
        details
    );


    return card;

}


function updateTypeButtons() {

    for (
        const button
        of typeButtons
    ) {

        button.classList
            .toggle(
                "active",
                button.dataset.type ===
                currentType
            );

    }

}


function createPageSizeControl() {

    if (
        !toolbarActions ||
        document.getElementById(
            "pageSizeSelect"
        )
    ) {

        return;

    }


    const wrapper =
        createElement(
            "label",
            "page-size-control"
        );


    wrapper.append(
        createElement(
            "span",
            "",
            "每页"
        )
    );


    const select =
        createElement(
            "select"
        );


    select.id =
        "pageSizeSelect";


    for (
        const value
        of [
            12,
            24,
            48
        ]
    ) {

        const option =
            createElement(
                "option",
                "",
                String(
                    value
                )
            );


        option.value =
            String(
                value
            );


        if (
            value ===
            currentPageSize
        ) {

            option.selected =
                true;

        }


        select.append(
            option
        );

    }


    select.addEventListener(
        "change",
        () => {

            currentPageSize =
                Number(
                    select.value
                ) ||
                12;

            currentPage =
                1;

            loadLibrary();

        }
    );


    wrapper.append(
        select
    );


    toolbarActions.insertBefore(
        wrapper,
        resultCount
    );

}


function setLoading(
    loading
) {

    libraryLoading.classList
        .toggle(
            "hidden",
            !loading
        );

    refreshLibrary.disabled =
        loading;

}


function renderData(
    data
) {

    const summary =
        data.summary ||
        {};


    countAll.textContent =
        String(
            summary.total ||
            0
        );

    countImage.textContent =
        String(
            summary.image ||
            0
        );

    countAudio.textContent =
        String(
            summary.audio ||
            0
        );

    countVideo.textContent =
        String(
            summary.video ||
            0
        );


    manifestUpdated.textContent =
        data.manifest
            ?.lastPublishedAt

            ? (
                "最后发布：" +
                formatDate(
                    data.manifest
                        .lastPublishedAt
                )
            )

            : "尚无发布时间";


    const query =
        data.query ||
        {};


    currentPage =
        Number(
            query.page
        ) ||
        1;


    currentTotalPages =
        Number(
            query.totalPages
        ) ||
        1;


    const filteredTotal =
        Number(
            query.filteredTotal
        ) ||
        0;


    resultCount.textContent =
        `${filteredTotal} 个结果`;


    mediaGrid.textContent =
        "";


    const items =
        Array.isArray(
            data.items
        )
            ? data.items
            : [];


    libraryEmpty.classList
        .toggle(
            "hidden",
            items.length >
            0
        );


    mediaGrid.classList
        .toggle(
            "hidden",
            items.length ===
            0
        );


    for (
        const item
        of items
    ) {

        mediaGrid.append(
            createMediaCard(
                item
            )
        );

    }


    pagination.classList
        .toggle(
            "hidden",
            filteredTotal ===
            0
        );


    pageText.textContent =
        `第 ${currentPage} / ${currentTotalPages} 页`;


    previousPage.disabled =
        currentPage <=
        1;


    nextPage.disabled =
        currentPage >=
        currentTotalPages;

}


async function loadLibrary() {

    setLoading(
        true
    );


    try {

        const params =
            new URLSearchParams();


        params.set(
            "type",
            currentType
        );


        params.set(
            "page",
            String(
                currentPage
            )
        );


        params.set(
            "pageSize",
            String(
                currentPageSize
            )
        );


        const search =
            searchInput.value
                .trim();


        if (
            search
        ) {

            params.set(
                "q",
                search
            );

        }


        const data =
            await api(
                `/api/admin/media?${params.toString()}`
            );


        renderData(
            data
        );

    } catch (
        error
    ) {

        console.error(
            error
        );


        showToast(
            `媒体库读取失败：${error.code || error.message}`
        );

    } finally {

        setLoading(
            false
        );

    }

}


function scrollToLibrary() {

    if (
        !libraryToolbar
    ) {

        return;

    }


    libraryToolbar
        .scrollIntoView({
            behavior:
                "smooth",

            block:
                "start"
        });

}


for (
    const button
    of typeButtons
) {

    button.addEventListener(
        "click",
        () => {

            currentType =
                button.dataset.type;

            currentPage =
                1;

            updateTypeButtons();

            loadLibrary();

        }
    );

}


searchInput.addEventListener(
    "input",
    () => {

        clearTimeout(
            searchTimer
        );


        searchTimer =
            setTimeout(
                () => {

                    currentPage =
                        1;

                    loadLibrary();

                },
                350
            );

    }
);


refreshLibrary.addEventListener(
    "click",
    () => {

        loadLibrary();

    }
);


previousPage.addEventListener(
    "click",
    () => {

        if (
            currentPage <=
            1
        ) {

            return;

        }


        currentPage -=
            1;


        loadLibrary()
            .then(
                scrollToLibrary
            );

    }
);


nextPage.addEventListener(
    "click",
    () => {

        if (
            currentPage >=
            currentTotalPages
        ) {

            return;

        }


        currentPage +=
            1;


        loadLibrary()
            .then(
                scrollToLibrary
            );

    }
);


async function bootstrap() {

    const data =
        await api(
            "/api/auth/me"
        );


    currentUser =
        data.user;


    if (
        currentUser?.role !==
            "owner" ||

        currentUser?.status !==
            "active" ||

        currentUser
            ?.permissions
            ?.manageSystem !==
            true
    ) {

        location.href =
            "/";

        return;

    }


    renderIdentity();

    updateTypeButtons();

    createPageSizeControl();


    await loadLibrary();

}


bootstrap()
    .catch(
        error => {

            console.error(
                error
            );


            showToast(
                `媒体库初始化失败：${error.code || error.message}`
            );

        }
    );
