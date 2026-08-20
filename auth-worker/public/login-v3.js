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


    function browserSupportsPasskey() {

        try {

            return Boolean(

                window
                    .SimpleWebAuthnBrowser &&

                window
                    .SimpleWebAuthnBrowser
                    .browserSupportsWebAuthn &&

                window
                    .SimpleWebAuthnBrowser
                    .browserSupportsWebAuthn()

            );

        } catch {

            return false;
        }
    }


    function createPasskeyPanel(
        originalActions,
        passkeyButton
    ) {

        const supported =
            browserSupportsPasskey();


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
                supported
                    ? "最快 · 推荐"
                    : "Passkey · 当前设备暂不可用"
            );


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


        description.textContent =
            supported

                ? "已经为当前账号创建过 Passkey 时，这是最快的登录方式。手机、电脑、密码管理器或系统凭据可直接完成验证。"

                : "这台设备当前没有可用的 Passkey 能力，但这不会阻止你登录。可以改用备用登录码或设备配对。";


        passkeyButton.className =
            supported
                ? "button button-primary button-large"
                : "button button-soft";


        passkeyButton.textContent =
            supported
                ? "使用 Passkey 登录"
                : "当前设备暂不可用";


        if (
            !supported
        ) {

            passkeyButton.disabled =
                true;
        }


        panel.append(
            badge,
            title,
            description,
            originalActions
        );


        return panel;
    }


    function createRecoveryCard() {

        const card =
            createElement(
                "div",
                "mini-card"
            );


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
            "不依赖另一台设备。登录后可在「账户与安全」生成并保存一枚备用登录码，以后换手机或旧设备不在身边时直接使用。";


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
            "如果另一台已经登录的设备就在身边，可以生成一次性 6 位码。这是临时快捷方式，不是唯一登录方式。";


        const link =
            createLink(
                "输入配对码 →",
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
            "只有第一次创建账号时才使用 Owner 发放的一次性邀请码。已经有账号不要重复激活。";


        const link =
            createLink(
                "使用邀请码 →",
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


        const summary =
            createElement(
                "summary",
                "",
                "高级恢复"
            );


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
            actions
        );


        return details;
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
                "不用绑定某一种设备。Passkey 最快；没有 Passkey 时可以使用事先保存的备用登录码；另一台已登录设备在身边时，也可以使用 6 位配对码。";
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

            hero.append(
                choices
            );
        }


        const advanced =
            createAdvancedRecovery();


        choices.insertAdjacentElement(
            "afterend",
            advanced
        );


        if (
            !browserSupportsPasskey() &&
            status
        ) {

            status.className =
                "status warning";


            status.textContent =
                "当前设备暂不能使用 Passkey。你仍然可以使用备用登录码，或者在另一台设备方便时使用 6 位配对。";
        }
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
                "输入你自己提前保存的备用登录码，或 Owner 为原账号签发的恢复码。这个方式不依赖另一台设备，验证成功后会为当前浏览器建立新的登录 Session。";
        }


        if (
            label
        ) {

            label.textContent =
                "备用 / 恢复登录码";
        }
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
                "当另一台已登录设备就在身边时使用。旧设备生成一次性 6 位码，新设备输入后立即建立自己的 Session；如果旧设备不在身边，请返回登录页使用备用登录码。";
        }
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
