(() => {
    "use strict";


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


    function createLink(
        text,
        href,
        className
    ) {

        const link =
            createElement(
                "a",
                className,
                text
            );


        link.href =
            href;


        return link;
    }


    function getPasskeySupport() {

        let libraryReady =
            false;


        let nativeReady =
            false;


        try {

            libraryReady =
                Boolean(
                    window
                        .SimpleWebAuthnBrowser &&
                    typeof window
                        .SimpleWebAuthnBrowser
                        .browserSupportsWebAuthn ===
                        "function" &&
                    typeof window
                        .SimpleWebAuthnBrowser
                        .startAuthentication ===
                        "function" &&
                    window
                        .SimpleWebAuthnBrowser
                        .browserSupportsWebAuthn()
                );

        } catch {

            libraryReady =
                false;
        }


        try {

            nativeReady =
                Boolean(
                    window.isSecureContext &&
                    window.PublicKeyCredential &&
                    navigator.credentials
                );

        } catch {

            nativeReady =
                false;
        }


        return {
            libraryReady,
            nativeReady,

            supported:
                libraryReady &&
                nativeReady
        };
    }


    function browserSupportsPasskey() {

        return getPasskeySupport()
            .supported;
    }


    async function getPlatformPasskeyAvailability() {

        if (
            !browserSupportsPasskey()
        ) {

            return {
                checked:
                    true,

                available:
                    false
            };
        }


        try {

            if (
                typeof PublicKeyCredential
                    .isUserVerifyingPlatformAuthenticatorAvailable !==
                    "function"
            ) {

                return {
                    checked:
                        false,

                    available:
                        null
                };
            }


            const available =
                await PublicKeyCredential
                    .isUserVerifyingPlatformAuthenticatorAvailable();


            return {
                checked:
                    true,

                available:
                    Boolean(
                        available
                    )
            };

        } catch {

            return {
                checked:
                    false,

                available:
                    null
            };
        }
    }


    function createPasskeyPanel(
        originalActions,
        passkeyButton
    ) {

        const support =
            getPasskeySupport();


        const panel =
            createElement(
                "section",
                "recommended"
            );


        panel.id =
            "loginPasskeyPanel";


        const badge =
            createElement(
                "span",
                "recommended-badge",
                support.supported
                    ? "最快 · 推荐"
                    : "Passkey · 当前设备暂不可用"
            );


        badge.id =
            "loginPasskeyBadge";


        const title =
            createElement(
                "h3",
                "",
                "Passkey 登录"
            );


        const description =
            createElement(
                "p"
            );


        description.id =
            "loginPasskeyDescription";


        description.textContent =
            support.supported

                ? "已经为当前账号创建过 Passkey 时，这是最快的登录方式。系统 Passkey、密码管理器、安全密钥或支持的跨设备验证都可以尝试。"

                : "这台设备当前没有检测到可用的 Passkey 能力，但不会影响账号登录。请直接使用备用登录码；如果另一台已登录设备就在身边，也可以使用 6 位配对码。";


        passkeyButton.className =
            support.supported
                ? "button button-primary button-large"
                : "button button-soft";


        passkeyButton.textContent =
            support.supported
                ? "使用 Passkey 登录"
                : "当前设备暂不能使用 Passkey";


        /*
         * 显式重设 disabled。
         *
         * 基础登录页本身也会做一次 WebAuthn 检测。
         * 如果前一个脚本临时把按钮禁用了，而这里确认
         * SimpleWebAuthn + 浏览器原生 WebAuthn 都正常，
         * 必须重新开启按钮。
         */
        passkeyButton.disabled =
            !support.supported;


        panel.append(
            badge,
            title,
            description,
            originalActions
        );


        return panel;
    }


    function createLoginGuide() {

        const guide =
            createElement(
                "div",
                "notice"
            );


        guide.id =
            "loginMethodGuide";


        const strong =
            createElement(
                "strong",
                "",
                "选择最方便的登录方式"
            );


        const text =
            createElement(
                "p"
            );


        text.style.margin =
            "7px 0 0";


        text.textContent =
            "Passkey 最快；备用登录码不依赖其他设备；6 位配对码适合另一台已登录设备就在身边的情况。三种方式互相独立，不需要强制绑定某一种设备。";


        guide.append(
            strong,
            text
        );


        return guide;
    }


    function createRecoveryCard() {

        const card =
            createElement(
                "div",
                "mini-card"
            );


        card.id =
            "loginRecoveryCard";


        const title =
            createElement(
                "strong",
                "",
                "备用登录码"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "不依赖另一台设备。登录后可以在「账户与安全」提前生成并保存。换手机、换电脑或其他设备不在身边时，都可以直接恢复当前账号。";


        const link =
            createLink(
                "使用备用登录码 →",
                "/recover",
                "button button-secondary"
            );


        card.append(
            title,
            description,
            link
        );


        return card;
    }


    function createPairingCard() {

        const card =
            createElement(
                "div",
                "mini-card"
            );


        card.id =
            "loginPairingCard";


        const title =
            createElement(
                "strong",
                "",
                "6 位设备配对"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "另一台已经登录的手机或电脑就在身边时使用。旧设备生成一次性 6 位码，新设备输入后建立自己的登录 Session。";


        const link =
            createLink(
                "输入 6 位配对码 →",
                "/device",
                "button button-secondary"
            );


        card.append(
            title,
            description,
            link
        );


        return card;
    }


    function createInviteCard() {

        const card =
            createElement(
                "div",
                "mini-card"
            );


        card.id =
            "loginInviteCard";


        const title =
            createElement(
                "strong",
                "",
                "第一次加入"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "只有第一次创建账号时才使用 Owner 发放的一次性邀请码。已经拥有账号后，不要再次使用邀请码创建新账号。";


        const link =
            createLink(
                "使用邀请码激活 →",
                "/activate",
                "button button-soft"
            );


        card.append(
            title,
            description,
            link
        );


        return card;
    }


    function createAdvancedRecovery() {

        const details =
            createElement(
                "details"
            );


        details.id =
            "loginAdvancedRecovery";


        const summary =
            createElement(
                "summary",
                "",
                "高级恢复"
            );


        const description =
            createElement(
                "p",
                "muted"
            );


        description.textContent =
            "只有 Owner 在 Passkey、备用登录码、已登录设备等正常方式全部不可用时，才需要使用紧急恢复。";


        const actions =
            createElement(
                "div",
                "fallback-actions"
            );


        const owner =
            createLink(
                "Owner 紧急恢复",
                "/owner-recover",
                "button button-soft"
            );


        actions.append(
            owner
        );


        details.append(
            summary,
            description,
            actions
        );


        return details;
    }


    async function refinePasskeyStatus(
        passkeyButton,
        status
    ) {

        const support =
            getPasskeySupport();


        const badge =
            document.getElementById(
                "loginPasskeyBadge"
            );


        const description =
            document.getElementById(
                "loginPasskeyDescription"
            );


        if (
            !support.supported
        ) {

            passkeyButton.disabled =
                true;


            if (
                status
            ) {

                status.className =
                    "status warning";


                status.textContent =
                    "当前设备暂不能使用 Passkey。你仍然可以使用备用登录码；如果另一台设备就在身边，也可以使用 6 位设备配对。";
            }


            return;
        }


        /*
         * 这里不能因为“平台验证器 = false”就禁用 Passkey。
         *
         * 原因：
         * 密码管理器、USB / NFC 安全密钥、跨设备 Passkey
         * 都可能在本机平台验证器不可用时继续工作。
         */
        passkeyButton.disabled =
            false;


        if (
            status &&
            (
                status.textContent.includes(
                    "不支持 Passkey"
                ) ||
                status.textContent.includes(
                    "暂不能使用 Passkey"
                )
            )
        ) {

            status.className =
                "status";


            status.textContent =
                "";
        }


        const platform =
            await getPlatformPasskeyAvailability();


        if (
            !platform.checked
        ) {

            return;
        }


        if (
            platform.available
        ) {

            if (
                badge
            ) {

                badge.textContent =
                    "最快 · 当前设备可用";
            }


            if (
                description
            ) {

                description.textContent =
                    "当前设备检测到可用的 Passkey 能力。已经为账号创建过 Passkey 时，可以直接使用系统凭据、指纹、面容、设备 PIN 或密码管理器登录。";
            }


            return;
        }


        if (
            badge
        ) {

            badge.textContent =
                "Passkey · 可以尝试";
        }


        if (
            description
        ) {

            description.textContent =
                "当前浏览器支持 Passkey，但没有检测到本机平台验证器。密码管理器、安全密钥或跨设备 Passkey 仍可能可用，所以登录按钮继续保留。";
        }
    }


    function enhanceLogin() {

        const hero =
            document.querySelector(
                ".card.hero"
            );


        const passkeyButton =
            document.getElementById(
                "loginButton"
            );


        if (
            !hero ||
            !passkeyButton
        ) {

            return;
        }


        if (
            document.getElementById(
                "loginPasskeyPanel"
            )
        ) {

            return;
        }


        const title =
            hero.querySelector(
                "h1"
            );


        const intro =
            hero.querySelector(
                "p.muted"
            );


        if (
            title
        ) {

            title.textContent =
                "欢迎回来。";
        }


        if (
            intro
        ) {

            intro.textContent =
                "不强制绑定某一种设备。优先使用最方便的方式进入同一个账号。";
        }


        const originalActions =
            passkeyButton.closest(
                ".actions"
            );


        if (
            !originalActions
        ) {

            return;
        }


        const oldGrid =
            hero.querySelector(
                ".grid"
            );


        oldGrid
            ?.remove();


        const passkeyPanel =
            createPasskeyPanel(
                originalActions,
                passkeyButton
            );


        const status =
            document.getElementById(
                "status"
            );


        if (
            status
        ) {

            status.insertAdjacentElement(
                "beforebegin",
                passkeyPanel
            );

        } else {

            hero.append(
                passkeyPanel
            );
        }


        const guide =
            createLoginGuide();


        passkeyPanel.insertAdjacentElement(
            "afterend",
            guide
        );


        const divider =
            hero.querySelector(
                ".divider"
            );


        const choices =
            createElement(
                "div",
                "grid"
            );


        choices.id =
            "loginAlternativeChoices";


        /*
         * 顺序固定：
         *
         * 1. 备用码
         * 2. 设备配对
         * 3. 第一次激活
         *
         * 已经有账号的人优先看到真正的登录恢复方式，
         * 不让邀请码入口抢在前面。
         */
        choices.append(
            createRecoveryCard(),
            createPairingCard(),
            createInviteCard()
        );


        if (
            divider
        ) {

            divider.insertAdjacentElement(
                "afterend",
                choices
            );

        } else {

            guide.insertAdjacentElement(
                "afterend",
                choices
            );
        }


        const advanced =
            createAdvancedRecovery();


        choices.insertAdjacentElement(
            "afterend",
            advanced
        );


        refinePasskeyStatus(
            passkeyButton,
            status
        )
            .catch(
                () => {
                    /*
                     * 能力探测只是 UX。
                     * 失败不能阻塞任何登录路线。
                     */
                }
            );
    }


    function ensureRecoveryNavigation() {

        if (
            document.getElementById(
                "recoveryLoginAlternatives"
            )
        ) {

            return;
        }


        const mainCard =
            document.querySelector(
                "main .card, .card.hero, main"
            );


        if (
            !mainCard
        ) {

            return;
        }


        const box =
            createElement(
                "div",
                "notice"
            );


        box.id =
            "recoveryLoginAlternatives";


        const strong =
            createElement(
                "strong",
                "",
                "还有其他登录方式"
            );


        const text =
            createElement(
                "p"
            );


        text.style.margin =
            "7px 0 12px";


        text.textContent =
            "如果当前设备已经可以使用 Passkey，可以返回登录页；如果另一台已登录设备就在身边，也可以改用 6 位配对码。";


        const actions =
            createElement(
                "div",
                "actions"
            );


        actions.style.marginTop =
            "0";


        actions.append(
            createLink(
                "返回登录",
                "/login",
                "button button-secondary"
            ),

            createLink(
                "使用 6 位配对",
                "/device",
                "button button-soft"
            )
        );


        box.append(
            strong,
            text,
            actions
        );


        mainCard.append(
            box
        );
    }


    function enhanceRecover() {

        const title =
            document.querySelector(
                "h1"
            );


        const intro =
            document.querySelector(
                ".intro"
            );


        const label =
            document.querySelector(
                'label[for="flowInput"]'
            );


        if (
            title
        ) {

            title.textContent =
                "使用备用登录码。";
        }


        if (
            intro
        ) {

            intro.textContent =
                "输入你自己提前保存的备用登录码，或 Owner 为原账号签发的恢复码。这个方式不依赖另一台设备，成功后会为当前浏览器建立新的登录 Session。";
        }


        if (
            label
        ) {

            label.textContent =
                "备用 / 恢复登录码";
        }


        ensureRecoveryNavigation();
    }


    function ensureDeviceNavigation() {

        if (
            document.getElementById(
                "deviceLoginAlternatives"
            )
        ) {

            return;
        }


        const mainCard =
            document.querySelector(
                "main .card, .card.hero, main"
            );


        if (
            !mainCard
        ) {

            return;
        }


        const box =
            createElement(
                "div",
                "notice"
            );


        box.id =
            "deviceLoginAlternatives";


        const strong =
            createElement(
                "strong",
                "",
                "旧设备不在身边？"
            );


        const text =
            createElement(
                "p"
            );


        text.style.margin =
            "7px 0 12px";


        text.textContent =
            "设备配对不是强制登录方式。如果你提前保存过备用登录码，可以直接使用备用登录码恢复，不需要另一台设备在线。";


        const actions =
            createElement(
                "div",
                "actions"
            );


        actions.style.marginTop =
            "0";


        actions.append(
            createLink(
                "使用备用登录码",
                "/recover",
                "button button-secondary"
            ),

            createLink(
                "返回登录",
                "/login",
                "button button-soft"
            )
        );


        box.append(
            strong,
            text,
            actions
        );


        mainCard.append(
            box
        );
    }


    function enhanceDevice() {

        const title =
            document.querySelector(
                "h1"
            );


        const intro =
            document.querySelector(
                ".intro"
            );


        if (
            title
        ) {

            title.textContent =
                "使用 6 位配对码。";
        }


        if (
            intro
        ) {

            intro.textContent =
                "当另一台已登录设备就在身边时使用。旧设备生成一次性 6 位码，新设备输入以后建立自己的 Session。它只是快捷登录方式，不是账号必须依赖的绑定关系。";
        }


        ensureDeviceNavigation();
    }


    function normalizePath() {

        let path =
            window.location.pathname;


        if (
            path.length >
                1 &&
            path.endsWith(
                "/"
            )
        ) {

            path =
                path.slice(
                    0,
                    -1
                );
        }


        return path;
    }


    function init() {

        const path =
            normalizePath();


        if (
            path ===
                "/login" ||
            path ===
                "/owner-login"
        ) {

            enhanceLogin();

            return;
        }


        if (
            path ===
            "/recover"
        ) {

            enhanceRecover();

            return;
        }


        if (
            path ===
            "/device"
        ) {

            enhanceDevice();
        }
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
