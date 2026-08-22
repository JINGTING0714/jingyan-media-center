const rules = {

    image: {
        extensions: [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
        ],

        maxBytes:
            15 *
            1024 *
            1024
    },

    audio: {
        extensions: [
            "mp3",
            "wav",
            "flac",
            "aac"
        ],

        maxBytes:
            24 *
            1024 *
            1024
    },

    video: {
        extensions: [
            "mp4",
            "webm"
        ],

        maxBytes:
            24 *
            1024 *
            1024
    }

};


const extensionMap =
    new Map();


for (
    const [
        type,
        rule
    ]
    of Object.entries(
        rules
    )
) {

    for (
        const extension
        of rule.extensions
    ) {

        extensionMap.set(
            extension,
            type
        );

    }

}


const identity =
    document.getElementById(
        "identity"
    );

const authGate =
    document.getElementById(
        "authGate"
    );

const authenticatedArea =
    document.getElementById(
        "authenticatedArea"
    );

const adminLink =
    document.getElementById(
        "adminLink"
    );

const accountLink =
    document.getElementById(
        "accountLink"
    );

const welcomeName =
    document.getElementById(
        "welcomeName"
    );

const roleBadge =
    document.getElementById(
        "roleBadge"
    );

const permissionList =
    document.getElementById(
        "permissionList"
    );

const dropZone =
    document.getElementById(
        "dropZone"
    );

const selectButton =
    document.getElementById(
        "selectButton"
    );

const fileInput =
    document.getElementById(
        "fileInput"
    );

const queueEmpty =
    document.getElementById(
        "queueEmpty"
    );

const queueList =
    document.getElementById(
        "queueList"
    );

const historyEmpty =
    document.getElementById(
        "historyEmpty"
    );

const historyList =
    document.getElementById(
        "historyList"
    );

const refreshHistory =
    document.getElementById(
        "refreshHistory"
    );

const toast =
    document.getElementById(
        "toast"
    );


let currentUser =
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


async function parseResponse(
    response
) {

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

    const response =
        await fetch(

            url,

            {
                credentials:
                    "same-origin",

                ...options,

                headers: {

                    ...(
                        options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                              }
                            : {}
                    ),

                    ...(
                        options.headers ||
                        {}
                    )

                }

            }

        );


    return parseResponse(
        response
    );

}


function extensionOf(
    filename
) {

    const index =
        filename.lastIndexOf(
            "."
        );


    if (
        index <= 0
    ) {

        return "";

    }


    return filename
        .slice(
            index + 1
        )
        .toLowerCase();

}


function validateFile(
    file
) {

    const extension =
        extensionOf(
            file.name
        );


    const type =
        extensionMap.get(
            extension
        );


    if (!type) {

        throw new Error(
            `不支持的格式：${file.name}`
        );

    }


    const rule =
        rules[
            type
        ];


    if (
        file.size <=
        0
    ) {

        throw new Error(
            `文件为空：${file.name}`
        );

    }


    if (
        file.size >
        rule.maxBytes
    ) {

        throw new Error(
            `${file.name} 超过 ${formatBytes(rule.maxBytes)} 限制`
        );

    }


    const permissionName = {

        image:
            "uploadImage",

        audio:
            "uploadAudio",

        video:
            "uploadVideo"

    }[
        type
    ];


    if (
        !currentUser
            ?.permissions
            ?.[permissionName]
    ) {

        throw new Error(
            `你没有 ${type} 上传权限`
        );

    }


    return {
        type,
        extension
    };

}


function formatBytes(
    bytes
) {

    const value =
        Number(
            bytes
        );


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
        .toFixed(1) +
        " KiB";

    }


    return (
        value /
        1024 /
        1024
    )
    .toFixed(2) +
    " MiB";

}


function statusText(
    status
) {

    return {

        local:
            "本地检查",

        creating:
            "创建任务",

        staging:
            "提交文件",

        created:
            "等待文件",

        staged:
            "准备调度",

        queued:
            "等待自动处理",

        processing:
            "正在发布",

        complete:
            "完成",

        failed:
            "失败"

    }[
        status
    ] ||
    status;

}


function uploadErrorText(
    error
) {

    const value =
        String(
            error ||
            ""
        );


    const known = {
        background_dispatch_failed:
            "后台发布任务启动失败，请稍后重试。",

        pipeline_state_not_saved:
            "发布结果尚未安全保存，请先检查媒体库。",

        staging_not_ready:
            "云端文件尚未准备完成。"
    }[
        value
    ];


    if (
        known
    ) {

        return known;

    }


    return currentUser
        ?.role ===
        "owner"
        ? value
        : "发布未完成，请稍后重试或联系 Owner。";

}


function createElement(
    tag,
    className,
    text
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


function createJobElement(
    {
        name,
        type,
        size,
        status,
        cdnUrl,
        error
    }
) {

    const item =
        createElement(
            "div",
            "job-item"
        );


    const main =
        createElement(
            "div",
            "job-main"
        );


    const title =
        createElement(
            "div",
            "job-name",
            name
        );


    const meta =
        createElement(
            "div",
            "job-meta"
        );


    meta.append(

        createElement(
            "span",
            "",
            type ||
            "—"
        ),

        createElement(
            "span",
            "",
            size
                ? formatBytes(
                    size
                  )
                : "—"
        )

    );


    if (
        error
    ) {

        meta.append(
            createElement(
                "span",
                "",
                uploadErrorText(
                    error
                )
            )
        );

    }


    main.append(
        title,
        meta
    );


    const actions =
        createElement(
            "div",
            "job-actions"
        );


    const badge =
        createElement(
            "span",
            `job-status ${status}`,
            statusText(
                status
            )
        );


    actions.append(
        badge
    );


    if (
        cdnUrl
    ) {

        const copy =
            createElement(
                "button",
                "copy-button",
                "复制 CDN"
            );


        copy.type =
            "button";


        copy.addEventListener(
            "click",
            async () => {

                await navigator.clipboard
                    .writeText(
                        cdnUrl
                    );


                showToast(
                    "CDN 链接已复制"
                );

            }
        );


        actions.append(
            copy
        );

    }


    item.append(
        main,
        actions
    );


    return {
        item,
        badge,
        meta,
        actions
    };

}


function updateJobElement(
    view,
    job
) {

    view.badge.className =
        `job-status ${job.status}`;


    view.badge.textContent =
        statusText(
            job.status
        );


    if (
        job.error
    ) {

        const existing =
            Array.from(
                view.meta.children
            )
            .find(
                element =>
                    element.dataset.error ===
                    "true"
            );


        if (!existing) {

            const error =
                createElement(
                    "span",
                    "",
                    uploadErrorText(
                        job.error
                    )
                );


            error.dataset.error =
                "true";


            view.meta.append(
                error
            );

        }

    }


    if (
        job.status ===
            "complete" &&
        job.cdnUrl &&
        !view.actions.querySelector(
            ".copy-button"
        )
    ) {

        const copy =
            createElement(
                "button",
                "copy-button",
                "复制 CDN"
            );


        copy.type =
            "button";


        copy.addEventListener(
            "click",
            async () => {

                await navigator.clipboard
                    .writeText(
                        job.cdnUrl
                    );


                showToast(
                    "CDN 链接已复制"
                );

            }
        );


        view.actions.append(
            copy
        );

    }

}


function renderIdentity() {

    identity.textContent =
        "";


    if (!currentUser) {

        const link =
            createElement(
                "a",
                "user-chip"
            );


        link.href =
            "/activate";


        link.append(

            createElement(
                "span",
                "user-avatar",
                "?"
            ),

            createElement(
                "strong",
                "",
                "未登录"
            )

        );


        identity.append(
            link
        );


        return;

    }


    const link =
        createElement(
            "a",
            "user-chip"
        );


    link.href =
        "/account";


    const avatar =
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
            currentUser.role
        )

    );


    link.append(
        avatar,
        text
    );


    identity.append(
        link
    );

}


function renderPermissions() {

    permissionList.textContent =
        "";


    const labels = {

        uploadImage:
            "图片上传",

        uploadAudio:
            "音频上传",

        uploadVideo:
            "视频上传"

    };


    for (
        const [
            key,
            label
        ]
        of Object.entries(
            labels
        )
    ) {

        const row =
            createElement(
                "div",
                "permission-item"
            );


        row.append(

            createElement(
                "span",
                "",
                label
            ),

            createElement(
                "strong",
                "",
                currentUser
                    ?.permissions
                    ?.[key]
                    ? "允许"
                    : "禁止"
            )

        );


        permissionList.append(
            row
        );

    }

}


async function loadAuthentication() {

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

        currentUser =
            null;


        renderIdentity();


        authGate.classList
            .remove(
                "hidden"
            );


        authenticatedArea
            .classList
            .add(
                "hidden"
            );


        return;

    }


    const data =
        await parseResponse(
            response
        );


    currentUser =
        data.user;


    renderIdentity();


    authGate.classList
        .add(
            "hidden"
        );


    authenticatedArea
        .classList
        .remove(
            "hidden"
        );


    welcomeName.textContent =
        currentUser.displayName;


    roleBadge.textContent =
        currentUser.role ===
            "owner"
            ? "Owner"
            : "Uploader";


    adminLink.classList
        .toggle(
            "hidden",
            currentUser.role !==
                "owner"
        );


    document
        .getElementById(
            "ownerPipelineDetails"
        )
        ?.classList
        .toggle(
            "hidden",
            currentUser.role !==
                "owner"
        );


    accountLink.classList
        .remove(
            "hidden"
        );


    renderPermissions();


    await loadHistory();

}


async function createJob(
    file
) {

    const response =
        await apiJson(

            "/api/uploads",

            {
                method:
                    "POST",

                body:
                    JSON.stringify({

                        originalName:
                            file.name,

                        sizeBytes:
                            file.size,

                        contentType:
                            file.type ||
                            "application/octet-stream"

                    })

            }

        );


    return response.job;

}


async function sendContent(
    job,
    file
) {

    const response =
        await fetch(

            `/api/uploads/${encodeURIComponent(job.id)}/content`,

            {
                method:
                    "PUT",

                credentials:
                    "same-origin",

                headers: {
                    "Content-Type":
                        "application/octet-stream"
                },

                body:
                    file
            }

        );


    const data =
        await parseResponse(
            response
        );


    return data.job;

}


async function getJob(
    jobId
) {

    const data =
        await apiJson(
            `/api/uploads/${encodeURIComponent(jobId)}`
        );


    return data.job;

}


async function pollJob(
    jobId,
    view
) {

    const started =
        Date.now();


    while (
        Date.now() -
        started <
        30 *
        60 *
        1000
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    3000
                )
        );


        const job =
            await getJob(
                jobId
            );


        updateJobElement(
            view,
            job
        );


        if (
            job.status ===
            "complete"
        ) {

            showToast(
                `${job.originalName} 发布完成`
            );


            await loadHistory();

            return;

        }


        if (
            job.status ===
            "failed"
        ) {

            showToast(
                `${job.originalName} 上传失败`
            );


            await loadHistory();

            return;

        }

    }


    updateJobElement(
        view,
        {
            status:
                "failed",

            error:
                "等待时间过长，请稍后在历史记录中查看"
        }
    );

}


async function submitFile(
    file
) {

    const validation =
        validateFile(
            file
        );


    queueEmpty.classList
        .add(
            "hidden"
        );


    const view =
        createJobElement({

            name:
                file.name,

            type:
                validation.type,

            size:
                file.size,

            status:
                "creating"

        });


    queueList.prepend(
        view.item
    );


    try {

        const created =
            await createJob(
                file
            );


        updateJobElement(
            view,
            {
                status:
                    "staging"
            }
        );


        const queued =
            await sendContent(
                created,
                file
            );


        updateJobElement(
            view,
            queued
        );


        pollJob(
            queued.id,
            view
        )
        .catch(
            error => {

                updateJobElement(
                    view,
                    {
                        status:
                            "failed",

                        error:
                            error.message
                    }
                );

            }
        );

    } catch (error) {

        updateJobElement(
            view,
            {
                status:
                    "failed",

                error:
                    error.code ||
                    error.message
            }
        );


        showToast(
            `${file.name} 提交失败`
        );

    }

}


async function handleFiles(
    files
) {

    if (!currentUser) {

        showToast(
            "请先完成身份验证"
        );

        return;

    }


    const selected =
        Array.from(
            files
        );


    if (
        selected.length >
        10
    ) {

        showToast(
            "一次最多选择 10 个文件"
        );

        return;

    }


    for (
        const file
        of selected
    ) {

        try {

            validateFile(
                file
            );

        } catch (error) {

            showToast(
                error.message
            );

            continue;

        }


        await submitFile(
            file
        );

    }


    fileInput.value =
        "";

}


function renderHistoryJob(
    job
) {

    return createJobElement({

        name:
            job.filename ||
            job.originalName,

        type:
            job.mediaType,

        size:
            job.sizeBytes,

        status:
            job.status,

        cdnUrl:
            job.cdnUrl,

        error:
            job.error

    })
    .item;

}


async function loadHistory() {

    if (!currentUser) {

        return;

    }


    try {

        const data =
            await apiJson(
                "/api/uploads"
            );


        historyList.textContent =
            "";


        const jobs =
            data.jobs ||
            [];


        historyEmpty.classList
            .toggle(
                "hidden",
                jobs.length >
                0
            );


        for (
            const job
            of jobs
        ) {

            historyList.append(
                renderHistoryJob(
                    job
                )
            );

        }

    } catch (error) {

        showToast(
            `无法读取上传记录：${error.code || error.message}`
        );

    }

}


selectButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        fileInput.click();

    }
);


dropZone.addEventListener(
    "click",
    () => {

        fileInput.click();

    }
);


dropZone.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
                "Enter" ||
            event.key ===
                " "
        ) {

            event.preventDefault();

            fileInput.click();

        }

    }
);


fileInput.addEventListener(
    "change",
    event => {

        handleFiles(
            event.target.files
        );

    }
);


dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );

    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );

    }
);


dropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );


        handleFiles(
            event.dataTransfer.files
        );

    }
);


refreshHistory.addEventListener(
    "click",
    loadHistory
);


loadAuthentication()
    .catch(
        error => {

            console.error(
                error
            );


            currentUser =
                null;


            renderIdentity();


            authGate.classList
                .remove(
                    "hidden"
                );


            authenticatedArea
                .classList
                .add(
                    "hidden"
                );


            showToast(
                "登录状态检查失败"
            );

        }
    );
