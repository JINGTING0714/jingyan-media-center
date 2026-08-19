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


    function browserHasPasskeySupport() {
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


    function createPairingPanel() {
        const panel =
            createElement(
                "section",
                "recommended"
            );


        panel.id =
            "mobilePairingLogin";


        const badge =
            createElement(
                "span",
                "recommended-badge",
                "推荐 · 新手机 / 没有 Passkey"
            );


        const title =
            createElement(
                "h3",
                "",
                "使用 6 位配对码登录"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "如果电脑或旧设备还保持登录，在那台设备打开「账户 → 新设备配对」，生成一次性 6 位配对码。然后在这台手机输入即可进入原账号，不会重新注册，也不会创建第二个用户。";


        const actions =
            createElement(
                "div",
                "actions"
            );


        const pairing =
            createLink(
                "输入配对码",
                "/device",
                "button button-primary button-large"
            );


        const recovery =
            createLink(
                "普通成员：恢复码",
                "/recover",
                "button button-soft"
            );


        actions.append(
            pairing,
            recovery
        );


        panel.append(
            badge,
            title,
            description,
            actions
        );


        return panel;
    }


    function createPasskeyPanel(
        originalActions,
        passkeyButton
    ) {
        const panel =
            createElement(
                "section",
                "mini-card"
            );


        panel.id =
            "optionalPasskeyLogin";


        const title =
            createElement(
                "strong",
                "",
                "Passkey · 可选快捷登录"
            );


        const description =
            createElement(
                "p"
            );


        description.textContent =
            "只有这台设备已经能正常使用 Passkey 时才需要这个入口。没有 Passkey 不影响设备配对登录。";


        passkeyButton.className =
            "button button-secondary";


        passkeyButton.textContent =
            "使用 Passkey（可选）";


        panel.append(
            title,
            description,
            originalActions
        );


        return panel;
    }


    function createOtherEntrances() {
        const wrapper =
            createElement(
                "div"
            );


        const details =
            createElement(
                "details"
            );


        const summary =
            createElement(
                "summary",
                "",
                "其他登录与恢复入口"
            );


        const actions =
            createElement(
                "div",
                "fallback-actions"
            );


        const activate =
            createLink(
                "第一次加入 · 邀请码",
                "/activate",
                "button button-soft"
            );


        const recover =
            createLink(
                "恢复已有账号",
                "/recover",
                "button button-soft"
            );


        const ownerRecover =
            createLink(
                "Owner 紧急恢复",
                "/owner-recover",
                "button button-soft"
            );


        actions.append(
            activate,
            recover,
            ownerRecover
        );


        details.append(
            summary,
            actions
        );


        wrapper.append(
            details
        );


        return wrapper;
    }


    function updateUnsupportedStatus() {
        const status =
            document.getElementById(
                "status"
            );


        if (
            !status
        ) {
            return;
        }


        status.className =
            "status warning";


        status.textContent =
            "这台设备不支持或无法使用 Passkey，不影响登录。直接使用上面的「输入配对码」即可；如果所有旧设备都不可用了，再使用恢复入口。";
    }


    function init() {
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


        /*
         * 防止重复执行。
         */
        if (
            document.getElementById(
                "mobilePairingLogin"
            )
        ) {
            return;
        }


        const title =
            hero.querySelector(
                "h1"
            );


        if (
            title
        ) {
            title.textContent =
                "欢迎回来。";
        }


        const intro =
            hero.querySelector(
                "p.muted"
            );


        if (
            intro
        ) {
            intro.textContent =
                "选择现在最方便的方式登录。没有 Passkey 也没有关系：新手机优先使用设备配对，登录的仍然是原来的账号。";
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


        const pairingPanel =
            createPairingPanel();


        originalActions.insertAdjacentElement(
            "beforebegin",
            pairingPanel
        );


        const passkeyPanel =
            createPasskeyPanel(
                originalActions,
                passkeyButton
            );


        pairingPanel.insertAdjacentElement(
            "afterend",
            passkeyPanel
        );


        /*
         * 原登录页下面有：
         * 第一次加入
         * 新设备
         * 恢复
         * Owner Recovery
         *
         * 现在主路径已经在上面明确展示，
         * 再保留 4 张大卡只会制造重复信息。
         */
        const oldGrid =
            hero.querySelector(
                ".grid"
            );


        if (
            oldGrid
        ) {
            oldGrid.remove();
        }


        const divider =
            hero.querySelector(
                ".divider"
            );


        const otherEntrances =
            createOtherEntrances();


        if (
            divider
        ) {
            divider.insertAdjacentElement(
                "afterend",
                otherEntrances
            );

        } else {
            hero.append(
                otherEntrances
            );
        }


        const supported =
            browserHasPasskeySupport();


        if (
            !supported
        ) {
            /*
             * 手机没有 Passkey 时，
             * 直接隐藏完全用不到的 Passkey 区域。
             *
             * 不再给用户一个不能工作的主按钮。
             */
            passkeyPanel.hidden =
                true;


            /*
             * 原始登录脚本会把“不支持 Passkey”
             * 标成 error。
             *
             * 实际上在我们的系统里这并不是错误，
             * 因为设备配对仍然可以正常登录。
             */
            setTimeout(
                updateUnsupportedStatus,
                0
            );
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
