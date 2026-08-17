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
    url
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "same-origin"
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
                "/activate";

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
        value <=
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

    if (!value) {

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
        .toLocaleString();

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
        text.length <=
        18
    ) {

        return text ||
        "—";

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


    link.append(
        createElement(
            "span",
            "user-avatar",
            currentUser
                .displayName
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
            currentUser.displayName
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


function createPreview(
    item
) {

    const preview =
        createElement(
            "div",
            "media-preview"
        );


    preview.append(
        createElement(
            "span",
            "media-type-label",
            item.type
        )
    );


    if (
        item.type ===
        "image"
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            item.url;

        image.alt =
            item.filename;

        image.loading =
            "lazy";

        image.decoding =
            "async";


        image.addEventListener(
            "error",
            () => {

                image.remove();


                preview.append(
                    createElement(
                        "div",
                        "media-symbol",
                        "IMAGE"
                    )
                );

            },
            {
                once:
                    true
            }
        );


        preview.append(
            image
        );


        return preview;

    }


    preview.append(
        createElement(
            "div",
            "media-symbol",
            item.type ===
                "audio"
                ? "AUDIO"
                : "VIDEO"
        )
    );


    return preview;

}


function createMediaCard(
    item
) {

    const card =
        createElement(
            "article",
            "media-card"
        );


    card.append(
        createPreview(
            item
        )
    );


    const body =
        createElement(
            "div",
            "media-body"
        );


    const title =
        createElement(
            "h3",
            "media-title",
            item.filename
        );


    title.title =
        item.filename;


    body.append(
        title,

        createElement(
            "div",
            "media-id",
            item.mediaId ||
            "未记录 Media ID"
        )
    );


    const metadata =
        createElement(
            "div",
            "media-metadata"
        );


    metadata.append(
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
            "源路径",
            item.source
                ?.path ||
            "—",
            item.source
                ?.path ||
            ""
        )
    );


    body.append(
        metadata
    );


    const actions =
        createElement(
            "div",
            "media-actions"
        );


    const open =
        createElement(
            "button",
            "button primary",
            item.type ===
                "image"
                ? "查看"
                : "播放 / 打开"
        );


    open.type =
        "button";


    open.addEventListener(
        "click",
        () => {

            window.open(
                item.url,
                "_blank",
                "noopener,noreferrer"
            );

        }
    );


    const copyCdn =
        createElement(
            "button",
            "button secondary",
            "复制 CDN"
        );


    copyCdn.type =
        "button";


    copyCdn.addEventListener(
        "click",
        () => {

            copyText(
                item.url,
                "CDN 链接已复制"
            );

        }
    );


    actions.append(
        open,
        copyCdn
    );


    if (
        item.source
            ?.path
    ) {

        const copySource =
            createElement(
                "button",
                "button secondary",
                "复制源路径"
            );


        copySource.type =
            "button";


        copySource.addEventListener(
            "click",
            () => {

                copyText(
                    `${item.source.repository}:${item.source.path}`,
                    "源路径已复制"
                );

            }
        );


        actions.append(
            copySource
        );

    }


    body.append(
        actions
    );


    card.append(
        body
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


    resultCount.textContent =
        `${query.filteredTotal || 0} 个结果`;


    mediaGrid.textContent =
        "";


    const items =
        data.items ||
        [];


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
            currentTotalPages <=
            1
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
            "48"
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

    } catch (error) {

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


        loadLibrary();


        window.scrollTo({
            top:
                0,

            behavior:
                "smooth"
        });

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


        loadLibrary();


        window.scrollTo({
            top:
                0,

            behavior:
                "smooth"
        });

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
