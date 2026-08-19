(() => {
    "use strict";


    let profile =
        null;


    let avatarImages =
        [];


    let selectedAvatarMode =
        "initial";


    let selectedMediaId =
        null;


    let toastTimer =
        null;


    const refs = {};


    function cacheRefs() {

        refs.form =
            document.getElementById(
                "profileSettingsForm"
            );

        refs.displayName =
            document.getElementById(
                "displayNameInput"
            );

        refs.bio =
            document.getElementById(
                "bioInput"
            );

        refs.bioCounter =
            document.getElementById(
                "bioCounter"
            );

        refs.emojiPanel =
            document.getElementById(
                "emojiPanel"
            );

        refs.emojiInput =
            document.getElementById(
                "emojiInput"
            );

        refs.emojiPresets =
            document.getElementById(
                "emojiPresets"
            );

        refs.mediaPanel =
            document.getElementById(
                "mediaPanel"
            );

        refs.avatarImagesLoading =
            document.getElementById(
                "avatarImagesLoading"
            );

        refs.avatarImagesEmpty =
            document.getElementById(
                "avatarImagesEmpty"
            );

        refs.avatarImageGrid =
            document.getElementById(
                "avatarImageGrid"
            );

        refs.previewAvatar =
            document.getElementById(
                "profilePreviewAvatar"
            );

        refs.previewName =
            document.getElementById(
                "profilePreviewName"
            );

        refs.previewRole =
            document.getElementById(
                "profilePreviewRole"
            );

        refs.previewBio =
            document.getElementById(
                "profilePreviewBio"
            );

        refs.userId =
            document.getElementById(
                "userIdValue"
            );

        refs.role =
            document.getElementById(
                "roleValue"
            );

        refs.ownerPermission =
            document.getElementById(
                "ownerPermissionValue"
            );

        refs.save =
            document.getElementById(
                "saveProfileButton"
            );

        refs.toast =
            document.getElementById(
                "profileSettingsToast"
            );

    }


    class ApiError extends Error {

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


    function friendlyError(
        code
    ) {

        const map = {
            authentication_required:
                "登录状态已经失效。",

            active_account_required:
                "当前账户不可用。",

            invalid_display_name:
                "显示名称不能为空，最多 40 个字符，并且不能包含控制字符。",

            profile_bio_too_long:
                "个人简介最多 160 个字符。",

            profile_bio_invalid:
                "个人简介包含不允许的字符。",

            invalid_avatar_mode:
                "头像类型无效。",

            invalid_avatar_emoji:
                "请选择有效的 Emoji。",

            invalid_avatar_media:
                "这张图片不能作为头像，请重新选择。",

            profile_not_found:
                "找不到个人资料。",

            invalid_json:
                "请求数据格式错误。",

            internal_error:
                "系统暂时出现问题。",

            request_failed:
                "请求失败，请稍后重试。"
        };


        return (
            map[
                code
            ] ||
            code ||
            "请求失败"
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
            response.status ===
            401
        ) {

            location.replace(
                "/login"
            );

            throw new ApiError(
                401,
                "authentication_required"
            );

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


    async function api(
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


    function showToast(
        text
    ) {

        refs.toast.textContent =
            text;


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
                2600
            );

    }


    function firstCharacter(
        value
    ) {

        return (
            Array.from(
                String(
                    value ||
                    "J"
                ).trim()
            )[0] ||
            "J"
        );

    }


    function roleText(
        role
    ) {

        return (
            role ===
            "owner"
                ? "Owner"
                : "Member"
        );

    }


    function currentImage() {

        return avatarImages.find(
            item =>
                item.mediaId ===
                selectedMediaId
        ) || null;

    }


    function setPreviewAvatar() {

        refs.previewAvatar.textContent =
            "";


        refs.previewAvatar.style.overflow =
            "hidden";


        if (
            selectedAvatarMode ===
            "emoji"
        ) {

            refs.previewAvatar.textContent =
                refs.emojiInput.value.trim() ||
                "🌙";

            return;

        }


        if (
            selectedAvatarMode ===
            "media"
        ) {

            const image =
                currentImage();


            const url =
                image?.url ||
                (
                    profile?.avatar?.mode ===
                    "media" &&
                    profile?.avatar?.value ===
                    selectedMediaId
                        ? profile?.avatar?.url
                        : null
                );


            if (
                url
            ) {

                const img =
                    document.createElement(
                        "img"
                    );


                img.src =
                    url;

                img.alt =
                    "";

                img.loading =
                    "eager";

                img.decoding =
                    "async";


                img.addEventListener(
                    "error",
                    () => {

                        refs.previewAvatar.textContent =
                            firstCharacter(
                                refs.displayName.value
                            );

                    },
                    {
                        once:
                            true
                    }
                );


                refs.previewAvatar.append(
                    img
                );

                return;

            }

        }


        refs.previewAvatar.textContent =
            firstCharacter(
                refs.displayName.value
            );

    }


    function updatePreview() {

        const name =
            refs.displayName.value.trim() ||
            profile?.displayName ||
            "成员";


        const bio =
            refs.bio.value.trim();


        refs.previewName.textContent =
            name;


        refs.previewBio.textContent =
            bio ||
            "还没有个人简介。";


        refs.previewRole.textContent =
            roleText(
                profile?.role
            );


        refs.bioCounter.textContent =
            `${Array.from(refs.bio.value).length} / 160`;


        setPreviewAvatar();

    }


    function setAvatarMode(
        mode
    ) {

        selectedAvatarMode =
            mode;


        for (
            const radio
            of document.querySelectorAll(
                'input[name="avatarMode"]'
            )
        ) {

            radio.checked =
                radio.value ===
                mode;

        }


        refs.emojiPanel.classList.toggle(
            "hidden",
            mode !==
            "emoji"
        );


        refs.mediaPanel.classList.toggle(
            "hidden",
            mode !==
            "media"
        );


        updatePreview();

    }


    function renderAvatarImages() {

        refs.avatarImageGrid.textContent =
            "";


        refs.avatarImagesLoading.classList.add(
            "hidden"
        );


        const hasImages =
            avatarImages.length >
            0;


        refs.avatarImagesEmpty.classList.toggle(
            "hidden",
            hasImages
        );


        refs.avatarImageGrid.classList.toggle(
            "hidden",
            !hasImages
        );


        for (
            const item
            of avatarImages
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                item.mediaId ===
                selectedMediaId

                    ? "avatar-image-option selected"

                    : "avatar-image-option";


            button.title =
                item.title ||
                item.mediaId;


            const image =
                document.createElement(
                    "img"
                );


            image.src =
                item.url;

            image.alt =
                "";

            image.loading =
                "lazy";

            image.decoding =
                "async";


            button.append(
                image
            );


            button.addEventListener(
                "click",
                () => {

                    selectedMediaId =
                        item.mediaId;


                    setAvatarMode(
                        "media"
                    );


                    renderAvatarImages();

                }
            );


            refs.avatarImageGrid.append(
                button
            );

        }

    }


    function renderProfile() {

        refs.displayName.value =
            profile.displayName ||
            "";


        refs.bio.value =
            profile.bio ||
            "";


        refs.userId.textContent =
            profile.userId ||
            "—";


        refs.role.textContent =
            roleText(
                profile.role
            );


        refs.ownerPermission.textContent =
            profile.role ===
            "owner"
                ? "永久"
                : "不适用";


        if (
            profile.avatar?.mode ===
            "emoji"
        ) {

            refs.emojiInput.value =
                profile.avatar.value ||
                "🌙";

        } else {

            refs.emojiInput.value =
                "🌙";

        }


        if (
            profile.avatar?.mode ===
            "media"
        ) {

            selectedMediaId =
                profile.avatar.value ||
                null;

        }


        setAvatarMode(
            profile.avatar?.mode ||
            "initial"
        );


        updatePreview();

    }


    async function loadProfile() {

        const data =
            await api(
                "/api/profile/settings"
            );


        profile =
            data.profile;


        renderProfile();

    }


    async function loadAvatarImages() {

        refs.avatarImagesLoading.classList.remove(
            "hidden"
        );


        try {

            const data =
                await api(
                    "/api/profile/settings/avatar-images?limit=18"
                );


            avatarImages =
                Array.isArray(
                    data.items
                )
                    ? data.items
                    : [];


            renderAvatarImages();

        } catch (
            error
        ) {

            refs.avatarImagesLoading.classList.add(
                "hidden"
            );


            refs.avatarImagesEmpty.classList.remove(
                "hidden"
            );


            refs.avatarImagesEmpty.textContent =
                friendlyError(
                    error.code ||
                    error.message
                );

        }

    }


    async function saveProfile(
        event
    ) {

        event.preventDefault();


        refs.save.disabled =
            true;


        refs.save.textContent =
            "保存中…";


        let avatarValue =
            null;


        if (
            selectedAvatarMode ===
            "emoji"
        ) {

            avatarValue =
                refs.emojiInput.value.trim();

        }


        if (
            selectedAvatarMode ===
            "media"
        ) {

            avatarValue =
                selectedMediaId;

        }


        try {

            const data =
                await api(
                    "/api/profile/settings",
                    {
                        method:
                            "PATCH",

                        body:
                            JSON.stringify({
                                displayName:
                                    refs.displayName.value,

                                bio:
                                    refs.bio.value,

                                avatarMode:
                                    selectedAvatarMode,

                                avatarValue
                            })
                    }
                );


            profile =
                data.profile;


            showToast(
                "个人资料已保存"
            );


            refs.save.textContent =
                "已保存 ✓";


            setTimeout(
                () => {

                    location.reload();

                },
                700
            );

        } catch (
            error
        ) {

            refs.save.disabled =
                false;


            refs.save.textContent =
                "保存更改";


            showToast(
                friendlyError(
                    error.code ||
                    error.message
                )
            );

        }

    }


    function bindEvents() {

        refs.displayName.addEventListener(
            "input",
            updatePreview
        );


        refs.bio.addEventListener(
            "input",
            updatePreview
        );


        refs.emojiInput.addEventListener(
            "input",
            () => {

                selectedAvatarMode =
                    "emoji";

                updatePreview();

            }
        );


        for (
            const radio
            of document.querySelectorAll(
                'input[name="avatarMode"]'
            )
        ) {

            radio.addEventListener(
                "change",
                () => {

                    if (
                        radio.checked
                    ) {

                        setAvatarMode(
                            radio.value
                        );

                    }

                }
            );

        }


        refs.emojiPresets.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-emoji]"
                    );


                if (
                    !button
                ) {

                    return;

                }


                refs.emojiInput.value =
                    button.dataset.emoji ||
                    "🌙";


                setAvatarMode(
                    "emoji"
                );

            }
        );


        refs.form.addEventListener(
            "submit",
            saveProfile
        );

    }


    async function start() {

        cacheRefs();

        bindEvents();


        try {

            await loadProfile();

            await loadAvatarImages();

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


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:
                    true
            }
        );

    } else {

        start();

    }

})();
