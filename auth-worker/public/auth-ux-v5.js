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


    function createLoginCard(
        {
            id,
            title,
            description,
            action,
            href,
            buttonClass =
                "button button-secondary"
        }
    ) {

        const card =
            createElement(
                "div",
                "mini-card"
            );


        card.id =
            id;


        const heading =
            createElement(
                "strong",
                "",
                title
            );


        const copy =
            createElement(
                "p",
                "",
                description
            );


        const link =
            createLink(
                action,
                href,
                buttonClass
            );


        card.append(
            heading,
            copy,
            link
        );


        return card;
    }


    function enhanceLoginPage() {

        const choices =
            document.getElementById(
                "loginAlternativeChoices"
            );


        if (
            choices &&
            !choices.dataset.recoveryV5
        ) {

            choices.dataset.recoveryV5 =
                "true";


            choices.textContent =
                "";


            choices.append(

                createLoginCard({
                    id:
                        "loginBackupCodeCard",

                    title:
                        "备用登录码 · 你自己保存",

                    description:
                        "由你本人在「账户与安全」提前生成并保存。换手机、换电脑，或者其他已登录设备不在身边时，都可以直接使用。",

                    action:
                        "使用我的备用登录码 →",

                    href:
                        "/recover?mode=backup"
                }),


                createLoginCard({
                    id:
                        "loginOwnerRecoveryCard",

                    title:
                        "Owner 恢复码 · 紧急情况",

                    description:
                        "只有 Passkey、自己的备用登录码和已登录设备都不可用时，再联系 Owner。Owner 会为你的原账户临时签发恢复码。",

                    action:
                        "使用 Owner 恢复码 →",

                    href:
                        "/recover?mode=owner"
                }),


                createLoginCard({
                    id:
                        "loginPairingCardV5",

                    title:
                        "6 位设备配对",

                    description:
                        "另一台已经登录的手机或电脑就在身边时使用。旧设备生成一次性 6 位码，新设备输入后建立自己的登录 Session。",

                    action:
                        "输入 6 位配对码 →",

                    href:
                        "/device"
                }),


                createLoginCard({
                    id:
                        "loginInviteCardV5",

                    title:
                        "第一次加入",

                    description:
                        "只有第一次创建账户时才使用 Owner 发放的邀请码。已经拥有账户后，不要再次用邀请码创建第二个账户。",

                    action:
                        "使用邀请码激活 →",

                    href:
                        "/activate",

                    buttonClass:
                        "button button-soft"
                })

            );
        }


        const guide =
            document.getElementById(
                "loginMethodGuide"
            );


        const guideText =
            guide?.querySelector(
                "p"
            );


        if (
            guideText
        ) {

            guideText.textContent =
                "Passkey 用于日常快捷登录；备用登录码由你本人提前保存；6 位配对适合另一台已登录设备就在身边；Owner 恢复码只用于正常登录方式全部不可用的紧急情况。";
        }


        const advanced =
            document.getElementById(
                "loginAdvancedRecovery"
            );


        if (
            advanced
        ) {

            const summary =
                advanced.querySelector(
                    "summary"
                );


            const description =
                advanced.querySelector(
                    "p"
                );


            const link =
                advanced.querySelector(
                    'a[href="/owner-recover"]'
                );


            if (
                summary
            ) {

                summary.textContent =
                    "Owner 本人账户紧急恢复";
            }


            if (
                description
            ) {

                description.textContent =
                    "这里不是 Owner 给普通成员签发恢复码的入口。它只用于 Owner 自己的账户在所有正常登录方式失效时，通过系统级恢复 Secret 进行最终恢复。";
            }


            if (
                link
            ) {

                link.textContent =
                    "Owner 本人紧急恢复";
            }
        }

    }


    function ensureRecoverySourceGuide(
        mode
    ) {

        if (
            document.getElementById(
                "recoveryCodeSourceGuideV5"
            )
        ) {

            return;
        }


        const form =
            document.querySelector(
                ".flow-form"
            );


        if (
            !form
        ) {

            return;
        }


        const box =
            createElement(
                "div",
                "notice"
            );


        box.id =
            "recoveryCodeSourceGuideV5";


        box.style.marginTop =
            "22px";


        const title =
            createElement(
                "strong",
                "",
                "先确认你手里的代码来源"
            );


        const copy =
            createElement(
                "p"
            );


        copy.style.margin =
            "7px 0 12px";


        if (
            mode ===
            "backup"
        ) {

            copy.textContent =
                "当前选择：你本人提前保存的备用登录码。这个代码是在已经登录时，从「账户与安全」生成的。";

        } else if (
            mode ===
            "owner"
        ) {

            copy.textContent =
                "当前选择：Owner 为你的原账户临时签发的恢复码。它只用于正常登录方式全部丢失的紧急情况。";

        } else {

            copy.textContent =
                "如果代码是你本人以前保存的，选择「我的备用登录码」；如果是刚刚由 Owner 发给你的，选择「Owner 恢复码」。";
        }


        const actions =
            createElement(
                "div",
                "actions"
            );


        actions.style.marginTop =
            "0";


        actions.append(

            createLink(
                "我的备用登录码",
                "/recover?mode=backup",
                mode ===
                    "backup"
                    ? "button button-primary"
                    : "button button-secondary"
            ),

            createLink(
                "Owner 恢复码",
                "/recover?mode=owner",
                mode ===
                    "owner"
                    ? "button button-primary"
                    : "button button-secondary"
            )

        );


        box.append(
            title,
            copy,
            actions
        );


        form.insertAdjacentElement(
            "beforebegin",
            box
        );

    }


    function enhanceRecoverPage() {

        const params =
            new URLSearchParams(
                location.search
            );


        const requestedMode =
            params.get(
                "mode"
            );


        const mode =
            requestedMode ===
                "backup" ||
            requestedMode ===
                "owner"

                ? requestedMode

                : "choose";


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


        const input =
            document.getElementById(
                "flowInput"
            );


        if (
            mode ===
            "backup"
        ) {

            if (
                title
            ) {

                title.textContent =
                    "使用你的备用登录码。";
            }


            if (
                intro
            ) {

                intro.textContent =
                    "输入你本人以前在「账户与安全」生成并保存的备用登录码。它属于你的个人灾备登录方式，不等于 Owner 紧急签发的恢复码。";
            }


            if (
                label
            ) {

                label.textContent =
                    "我的备用登录码";
            }


            if (
                input
            ) {

                input.setAttribute(
                    "aria-label",
                    "我的备用登录码"
                );
            }

        } else if (
            mode ===
            "owner"
        ) {

            if (
                title
            ) {

                title.textContent =
                    "使用 Owner 恢复码。";
            }


            if (
                intro
            ) {

                intro.textContent =
                    "当 Passkey、你自己的备用登录码和已登录设备都不可用时，Owner 可以为你的原账户签发一次性恢复码。输入后仍然恢复原来的用户，不会创建第二个账户。";
            }


            if (
                label
            ) {

                label.textContent =
                    "Owner 恢复码";
            }


            if (
                input
            ) {

                input.setAttribute(
                    "aria-label",
                    "Owner 恢复码"
                );
            }

        } else {

            if (
                title
            ) {

                title.textContent =
                    "恢复已有账户。";
            }


            if (
                intro
            ) {

                intro.textContent =
                    "备用登录码和 Owner 恢复码是两种不同来源的凭据。请选择你手里的代码来源；两者都只恢复原来的账户，不会创建新用户。";
            }


            if (
                label
            ) {

                label.textContent =
                    "备用登录码 / Owner 恢复码";
            }
        }


        ensureRecoverySourceGuide(
            mode
        );


        const alternatives =
            document.getElementById(
                "recoveryLoginAlternatives"
            );


        if (
            alternatives
        ) {

            const strong =
                alternatives.querySelector(
                    "strong"
                );


            const copy =
                alternatives.querySelector(
                    "p"
                );


            if (
                strong
            ) {

                strong.textContent =
                    "还有其他登录方式";
            }


            if (
                copy
            ) {

                copy.textContent =
                    "如果当前设备可以使用 Passkey，可以返回登录页；如果另一台已登录设备就在身边，也可以使用 6 位配对。Owner 恢复码只作为最后的成员账户恢复方案。";
            }
        }

    }


    function enhanceOwnerRecoveryPage() {

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
                "Owner 本人紧急恢复。";
        }


        if (
            intro
        ) {

            intro.textContent =
                "这里只恢复 Owner 自己的账户，并使用系统级 Owner Recovery Secret。它不是 Owner 给普通成员签发恢复码的页面，成员恢复请使用「Owner 恢复码」入口。";
        }

    }


    function enhanceAccountPage() {

        const methods =
            document.getElementById(
                "loginMethodsCard"
            );


        if (
            !methods
        ) {

            return;
        }


        const description =
            methods.querySelector(
                "p"
            );


        if (
            description
        ) {

            description.textContent =
                "建议至少准备两种日常登录方式：Passkey 用于快捷登录；你自己保存的备用登录码用于个人灾备；设备配对适合另一台已登录设备就在身边。Owner 恢复码属于紧急恢复，不是日常登录方式。";
        }


        const selfPanel =
            document.getElementById(
                "selfRecoveryPanel"
            );


        const selfDescription =
            selfPanel
                ?.querySelector(
                    ".pair-panel-copy p"
                );


        if (
            selfDescription
        ) {

            selfDescription.textContent =
                "这是你本人持有的备用登录码。请保存到可信的密码管理器或安全位置。以后没有其他已登录设备时，可以从登录页使用。重新生成只会替换你自己以前的备用登录码，不会删除 Owner 单独为你签发的紧急恢复码。";
        }


        if (
            document.getElementById(
                "ownerRecoveryExplanationV5"
            )
        ) {

            return;
        }


        const note =
            createElement(
                "div"
            );


        note.id =
            "ownerRecoveryExplanationV5";


        Object.assign(
            note.style,
            {
                marginTop:
                    "18px",

                padding:
                    "16px 18px",

                border:
                    "1px solid rgba(124, 80, 233, .14)",

                borderRadius:
                    "16px",

                background:
                    "rgba(247, 244, 255, .78)",

                color:
                    "#5e5275",

                lineHeight:
                    "1.65"
            }
        );


        const heading =
            createElement(
                "strong",
                "",
                "Owner 恢复码 · 仅用于紧急情况"
            );


        heading.style.display =
            "block";


        heading.style.color =
            "#30204f";


        const copy =
            createElement(
                "p"
            );


        copy.style.margin =
            "7px 0 0";


        copy.textContent =
            "这个代码不能由你自己在这里生成。当 Passkey、自己的备用登录码和已登录设备全部不可用时，请联系 Owner。Owner 会为你的原账户签发临时恢复码；它与你自己保存的备用登录码分开管理，不会互相替换。";


        note.append(
            heading,
            copy
        );


        methods.append(
            note
        );

    }


    function enhanceHomeGate() {

        const gate =
            document.getElementById(
                "authGate"
            );


        if (
            !gate
        ) {

            return;
        }


        const copy =
            gate.querySelector(
                ".gate-copy"
            );


        if (
            copy
        ) {

            copy.textContent =
                "第一次使用请用 Owner 发放的邀请码激活。已有账户可以使用 Passkey、6 位设备配对或自己保存的备用登录码；如果这些方式全部不可用，再使用 Owner 为原账户签发的紧急恢复码。";
        }


        const actions =
            gate.querySelector(
                ".action-row"
            );


        if (
            !actions
        ) {

            return;
        }


        const recovery =
            actions.querySelector(
                'a[href^="/recover"]'
            );


        if (
            recovery
        ) {

            recovery.href =
                "/recover?mode=backup";


            recovery.textContent =
                "备用登录码";
        }


        if (
            !document.getElementById(
                "homeOwnerRecoveryLinkV5"
            )
        ) {

            const ownerRecovery =
                createLink(
                    "Owner 恢复码",
                    "/recover?mode=owner",
                    "button secondary"
                );


            ownerRecovery.id =
                "homeOwnerRecoveryLinkV5";


            actions.append(
                ownerRecovery
            );
        }

    }


    function apply() {

        const path =
            location.pathname;


        if (
            path ===
                "/login" ||
            path ===
                "/login/" ||
            path ===
                "/owner-login" ||
            path ===
                "/owner-login/"
        ) {

            enhanceLoginPage();

            return;
        }


        if (
            path ===
                "/recover" ||
            path ===
                "/recover/"
        ) {

            enhanceRecoverPage();

            return;
        }


        if (
            path ===
                "/owner-recover" ||
            path ===
                "/owner-recover/"
        ) {

            enhanceOwnerRecoveryPage();

            return;
        }


        if (
            path ===
                "/account" ||
            path ===
                "/account/"
        ) {

            enhanceAccountPage();

            return;
        }


        if (
            path ===
                "/" ||
            path ===
                "/index.html"
        ) {

            enhanceHomeGate();
        }

    }


    function init() {

        apply();


        /*
         * account-access.js / login-v3.js
         * 也会在 DOMContentLoaded 时增强页面。
         *
         * 这里再做两次轻量保险，
         * 保证我们最后覆盖的是 V5 文案。
         */
        setTimeout(
            apply,
            80
        );


        setTimeout(
            apply,
            450
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
