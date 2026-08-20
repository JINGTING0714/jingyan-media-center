(() => {
    "use strict";


    let toastTimer =
        null;


    let currentRecoveryCode =
        "";


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


    function showToast(
        message
    ) {

        const toast =
            document.getElementById(
                "accountToast"
            );


        if (
            !toast
        ) {

            return;
        }


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


    function formatTime(
        seconds
    ) {

        const value =
            Number(
                seconds
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


        return new Date(
            value *
            1000
        )
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


    async function readJson(
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
            response.status ===
            401
        ) {

            location.replace(
                "/login"
            );


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


    function createLoginMethodsCard(
        refs
    ) {

        const section =
            createElement(
                "section",
                "account-card account-security-card"
            );


        section.id =
            "loginMethodsCard";


        const copy =
            createElement(
                "div"
            );


        const kicker =
            createElement(
                "span",
                "section-kicker",
                "LOGIN METHODS"
            );


        const title =
            createElement(
                "h2",
                "",
                "登录方式"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "建议至少准备两种登录方式：Passkey 用于日常快捷登录，备用登录码用于没有其他设备在身边时恢复；设备配对则适合临时换手机。";


        copy.append(
            kicker,
            title,
            description
        );


        const actions =
            createElement(
                "div",
                "account-security-actions"
            );


        const passkeyButton =
            createElement(
                "button",
                "account-button primary",
                "添加 / 管理 Passkey"
            );


        passkeyButton.type =
            "button";


        passkeyButton.addEventListener(
            "click",
            () => {

                location.href =
                    "/passkeys";
            }
        );


        const recoveryButton =
            createElement(
                "button",
                "account-button secondary",
                "生成备用登录码"
            );


        recoveryButton.type =
            "button";


        recoveryButton.id =
            "generateSelfRecoveryButton";


        const pairButton =
            createElement(
                "button",
                "account-button secondary",
                "生成 6 位配对码"
            );


        pairButton.type =
            "button";


        pairButton.addEventListener(
            "click",
            () => {

                refs.legacyPairButton
                    ?.click();


                setTimeout(
                    () => {

                        refs.pairPanel
                            ?.scrollIntoView({
                                behavior:
                                    "smooth",

                                block:
                                    "center"
                            });

                    },
                    100
                );
            }
        );


        actions.append(
            passkeyButton,
            recoveryButton,
            pairButton
        );


        section.append(
            copy,
            actions
        );


        refs.recoveryButton =
            recoveryButton;


        return section;
    }


    function createRecoveryPanel(
        refs
    ) {

        const panel =
            createElement(
                "section",
                "pair-panel hidden"
            );


        panel.id =
            "selfRecoveryPanel";


        const copy =
            createElement(
                "div",
                "pair-panel-copy"
            );


        const kicker =
            createElement(
                "span",
                "section-kicker",
                "BACKUP ACCESS"
            );


        const title =
            createElement(
                "h2",
                "",
                "备用登录码"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "把这枚代码保存到可信的密码管理器或安全位置。以后即使没有另一台已登录设备，也可以从登录页进入「备用登录码」恢复当前账号。每次重新生成都会让旧的未使用备用码失效。";


        copy.append(
            kicker,
            title,
            description
        );


        const codeWrap =
            createElement(
                "div",
                "pair-code-wrap"
            );


        const code =
            createElement(
                "code",
                "",
                "----"
            );


        code.id =
            "selfRecoveryCode";


        const copyButton =
            createElement(
                "button",
                "account-button primary",
                "复制备用码"
            );


        copyButton.type =
            "button";


        codeWrap.append(
            code,
            copyButton
        );


        const expiry =
            createElement(
                "div",
                "pair-expiry"
            );


        const expiryLabel =
            createElement(
                "span",
                "",
                "有效期"
            );


        const expiryValue =
            createElement(
                "strong",
                "",
                "—"
            );


        expiryValue.id =
            "selfRecoveryExpiry";


        expiry.append(
            expiryLabel,
            expiryValue
        );


        const closeButton =
            createElement(
                "button",
                "pair-close",
                "收起"
            );


        closeButton.type =
            "button";


        closeButton.addEventListener(
            "click",
            () => {

                panel.classList.add(
                    "hidden"
                );
            }
        );


        copyButton.addEventListener(
            "click",
            async () => {

                if (
                    !currentRecoveryCode
                ) {

                    return;
                }


                try {

                    await navigator
                        .clipboard
                        .writeText(
                            currentRecoveryCode
                        );


                    showToast(
                        "备用登录码已复制"
                    );

                } catch {

                    const range =
                        document.createRange();


                    range.selectNodeContents(
                        code
                    );


                    const selection =
                        window.getSelection();


                    selection.removeAllRanges();

                    selection.addRange(
                        range
                    );


                    showToast(
                        "备用登录码已选中，请手动复制"
                    );
                }
            }
        );


        panel.append(
            copy,
            codeWrap,
            expiry,
            closeButton
        );


        refs.recoveryPanel =
            panel;


        refs.recoveryCode =
            code;


        refs.recoveryExpiry =
            expiryValue;


        return panel;
    }


    async function generateRecoveryCode(
        refs
    ) {

        if (
            currentRecoveryCode &&
            !confirm(
                "重新生成会让上一枚未使用的备用登录码立即失效。确定继续吗？"
            )
        ) {

            return;
        }


        refs.recoveryButton.disabled =
            true;


        refs.recoveryButton.textContent =
            "正在生成…";


        try {

            const response =
                await fetch(
                    "/api/account/recovery-code",
                    {
                        method:
                            "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            "{}"
                    }
                );


            const data =
                await readJson(
                    response
                );


            currentRecoveryCode =
                String(
                    data.recoveryCode ||
                    ""
                );


            refs.recoveryCode.textContent =
                currentRecoveryCode ||
                "----";


            refs.recoveryExpiry.textContent =
                formatTime(
                    data.expiresAt
                );


            refs.recoveryPanel
                .classList
                .remove(
                    "hidden"
                );


            refs.recoveryPanel
                .scrollIntoView({
                    behavior:
                        "smooth",

                    block:
                        "center"
                });


            showToast(
                "备用登录码已生成，只会在这里显示"
            );

        } catch (
            error
        ) {

            console.error(
                error
            );


            showToast(
                error.message ===
                    "authentication_required"

                    ? "登录状态已经失效"

                    : "备用登录码生成失败，请稍后重试"
            );

        } finally {

            refs.recoveryButton.disabled =
                false;


            refs.recoveryButton.textContent =
                "生成备用登录码";
        }
    }


    function hideDuplicateLegacyActions(
        refs
    ) {

        const passkeyCard =
            document.querySelector(
                '.account-actions-grid a[href="/passkeys"]'
            );


        passkeyCard
            ?.classList
            .add(
                "hidden"
            );


        refs.legacyPairButton
            ?.classList
            .add(
                "hidden"
            );
    }


    function init() {

        if (
            document.getElementById(
                "loginMethodsCard"
            )
        ) {

            return;
        }


        const accountPage =
            document.querySelector(
                ".account-page"
            );


        if (
            !accountPage
        ) {

            return;
        }


        const refs = {

            legacyPairButton:
                document.getElementById(
                    "createPairButton"
                ),

            pairPanel:
                document.getElementById(
                    "pairPanel"
                ),

            recoveryButton:
                null,

            recoveryPanel:
                null,

            recoveryCode:
                null,

            recoveryExpiry:
                null
        };


        const firstAccountCard =
            accountPage.querySelector(
                ".account-card"
            );


        if (
            !firstAccountCard
        ) {

            return;
        }


        const methodsCard =
            createLoginMethodsCard(
                refs
            );


        const recoveryPanel =
            createRecoveryPanel(
                refs
            );


        firstAccountCard
            .insertAdjacentElement(
                "beforebegin",
                methodsCard
            );


        methodsCard
            .insertAdjacentElement(
                "afterend",
                recoveryPanel
            );


        hideDuplicateLegacyActions(
            refs
        );


        refs.recoveryButton
            .addEventListener(
                "click",
                () => {

                    generateRecoveryCode(
                        refs
                    );
                }
            );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();
    }

})();
