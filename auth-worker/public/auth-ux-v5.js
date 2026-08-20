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


    function setText(
        element,
        text
    ) {

        if (
            element &&
            element.textContent !==
            text
        ) {

            element.textContent =
                text;
        }

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


        card.append(
            createElement(
                "strong",
                "",
                title
            ),

            createElement(
                "p",
                "",
                description
            ),

            createLink(
                action,
                href,
                buttonClass
            )
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
            choices.dataset
                .recoveryUiVersion !==
                "6"
        ) {

            choices.dataset
                .recoveryUiVersion =
                "6";


            choices.textContent =
                "";


            choices.append(

                createLoginCard({
                    id:
                        "loginBackupCodeCard",

                    title:
                        "备用登录码 · 你自己保存",

                    description:
                        "由你本人在「账户与安全」提前生成并保存。换手机、换电脑，或者其他已登录设备不在身边时，可以直接使用。",

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
                        "Passkey、自己的备用登录码和已登录设备都不可用时，再联系 Owner。Owner 会为你的原账户临时签发恢复码。",

                    action:
                        "使用 Owner 恢复码 →",

                    href:
                        "/recover?mode=owner"
                }),


                createLoginCard({
                    id:
                        "loginPairingCardV6",

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
                        "loginInviteCardV6",

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


        setText(
            guide?.querySelector(
                "p"
            ),
            "Passkey 用于日常快捷登录；备用登录码由你本人提前保存；6 位配对适合另一台已登录设备就在身边；Owner 恢复码只用于正常登录方式全部不可用的紧急情况。"
        );


        const advanced =
            document.getElementById(
                "loginAdvancedRecovery"
            );


        if (
            advanced
        ) {

            setText(
                advanced.querySelector(
                    "summary"
                ),
                "Owner 本人账户紧急恢复"
            );


            setText(
                advanced.querySelector(
                    "p"
                ),
                "这里不是 Owner 给普通成员签发恢复码的入口。它只用于 Owner 自己的账户在所有正常登录方式失效时，通过系统级恢复 Secret 进行最终恢复。"
            );


            const link =
                advanced.querySelector(
                    'a[href="/owner-recover"]'
                );


            setText(
                link,
                "Owner 本人紧急恢复"
            );
        }

    }


    function recoveryMode() {

        const value =
            new URLSearchParams(
                window.location.search
            )
                .get(
                    "mode"
                );


        return (
            value ===
            "owner"

                ? "owner"

                : "backup"
        );

    }


    function findRecoveryElements() {

        const main =
            document.querySelector(
                "main"
            ) ||
            document.body;


        const hero =
            main.querySelector(
                ".card.hero"
            ) ||
            main.querySelector(
                ".card"
            ) ||
            main;


        const title =
            hero.querySelector(
                "h1"
            );


        let intro =
            hero.querySelector(
                ".intro"
            ) ||
            hero.querySelector(
                "h1 + p"
            );


        if (
            !intro &&
            title
        ) {

            let node =
                title.nextElementSibling;


            while (
                node
            ) {

                if (
                    node.tagName ===
                    "P"
                ) {

                    intro =
                        node;

                    break;
                }


                node =
                    node.nextElementSibling;
            }
        }


        const form =
            hero.querySelector(
                ".flow-form"
            ) ||
            hero.querySelector(
                "form"
            ) ||
            main.querySelector(
                "form"
            );


        const input =
            form?.querySelector(
                "#flowInput"
            ) ||
            form?.querySelector(
                'input[placeholder*="JYR"]'
            ) ||
            form?.querySelector(
                'input[name="code"]'
            ) ||
            form?.querySelector(
                'input[type="text"]'
            );


        let label =
            null;


        if (
            input
        ) {

            label =
                input.closest(
                    ".field"
                )
                    ?.querySelector(
                        "label"
                    ) ||
                input.parentElement
                    ?.querySelector(
                        "label"
                    ) ||
                form?.querySelector(
                    "label"
                );
        }


        const submit =
            form?.querySelector(
                'button[type="submit"]'
            ) ||
            form?.querySelector(
                ".button-primary"
            );


        const eyebrow =
            hero.querySelector(
                ".eyebrow"
            ) ||
            hero.querySelector(
                ".kicker"
            );


        return {
            main,
            hero,
            title,
            intro,
            form,
            input,
            label,
            submit,
            eyebrow
        };

    }


    function recoveryCard(
        mode
    ) {

        const existing =
            document.getElementById(
                "recoveryModeCardV6"
            );


        if (
            existing &&
            existing.dataset.mode ===
                mode
        ) {

            return existing;
        }


        existing
            ?.remove();


        const card =
            createElement(
                "div"
            );


        card.id =
            "recoveryModeCardV6";


        card.dataset.mode =
            mode;


        Object.assign(
            card.style,
            {
                margin:
                    "22px 0",

                padding:
                    "18px 20px",

                borderRadius:
                    "18px",

                border:
                    mode ===
                    "owner"

                        ? "1px solid rgba(205, 139, 57, .22)"

                        : "1px solid rgba(124, 80, 233, .20)",

                background:
                    mode ===
                    "owner"

                        ? "linear-gradient(135deg, rgba(255,249,235,.94), rgba(250,245,255,.92))"

                        : "linear-gradient(135deg, rgba(246,241,255,.96), rgba(243,248,255,.94))",

                lineHeight:
                    "1.65"
            }
        );


        const badge =
            createElement(
                "span",
                "",
                mode ===
                "owner"

                    ? "OWNER 签发 · 紧急恢复"

                    : "个人备份 · 自己保存"
            );


        Object.assign(
            badge.style,
            {
                display:
                    "inline-flex",

                padding:
                    "6px 10px",

                marginBottom:
                    "10px",

                borderRadius:
                    "999px",

                fontSize:
                    "13px",

                fontWeight:
                    "700",

                color:
                    mode ===
                    "owner"

                        ? "#8c5a16"

                        : "#6840d9",

                background:
                    mode ===
                    "owner"

                        ? "rgba(246, 205, 126, .22)"

                        : "rgba(124, 80, 233, .10)"
            }
        );


        const heading =
            createElement(
                "strong",
                "",
                mode ===
                "owner"

                    ? "这是 Owner 为你的原账户签发的恢复凭据"

                    : "这是你本人提前保存的备用登录凭据"
            );


        Object.assign(
            heading.style,
            {
                display:
                    "block",

                marginBottom:
                    "5px",

                fontSize:
                    "17px",

                color:
                    "#30204f"
            }
        );


        const description =
            createElement(
                "p"
            );


        description.style.margin =
            "0";


        description.style.color =
            "#76688f";


        description.textContent =
            mode ===
            "owner"

                ? "只在 Passkey、你的备用登录码和已登录设备全部不可用时使用。恢复成功后仍然进入原来的账户，不会重新注册，也不会创建第二个用户。"

                : "它由你自己在已登录状态下生成，适合换设备或身边没有其他已登录设备时使用。重新生成备用登录码不会删除 Owner 单独签发的紧急恢复码。";


        card.append(
            badge,
            heading,
            description
        );


        return card;
    }


    function ensureModeSwitch(
        elements,
        mode
    ) {

        let switcher =
            document.getElementById(
                "recoveryModeSwitchV6"
            );


        if (
            !switcher
        ) {

            switcher =
                createElement(
                    "div"
                );


            switcher.id =
                "recoveryModeSwitchV6";


            Object.assign(
                switcher.style,
                {
                    marginTop:
                        "20px",

                    paddingTop:
                        "18px",

                    borderTop:
                        "1px solid rgba(111,91,148,.14)"
                }
            );


            elements.form
                ?.insertAdjacentElement(
                    "afterend",
                    switcher
                );
        }


        switcher.textContent =
            "";


        const copy =
            createElement(
                "span",
                "",
                mode ===
                "owner"

                    ? "你手里的是自己以前保存的备用登录码？"

                    : "你手里的是 Owner 刚刚签发的恢复码？"
            );


        copy.style.display =
            "block";


        copy.style.marginBottom =
            "9px";


        copy.style.color =
            "#84779a";


        const link =
            createLink(
                mode ===
                "owner"

                    ? "改用我的备用登录码 →"

                    : "改用 Owner 恢复码 →",

                mode ===
                "owner"

                    ? "/recover?mode=backup"

                    : "/recover?mode=owner",

                "button button-soft"
            );


        switcher.append(
            copy,
            link
        );

    }


    function replaceRecoveryNotice(
        elements,
        mode
    ) {

        const paragraphs =
            Array.from(
                elements.hero
                    .querySelectorAll(
                        "p"
                    )
            );


        const notice =
            paragraphs.find(
                paragraph =>
                    paragraph.textContent
                        ?.includes(
                            "验证信息只用于当前登录流程"
                        )
            );


        if (
            !notice
        ) {

            return;
        }


        setText(
            notice,
            mode ===
            "owner"

                ? "Owner 恢复码属于一次性紧急凭据。验证成功后只会为原账户建立新的登录 Session，不会修改你的媒体、图库、歌单或影集。"

                : "备用登录码只用于验证你对原账户的访问权。成功后会为当前浏览器建立新的登录 Session，不会修改你的媒体、图库、歌单或影集。"
        );

    }


    function replaceRecoveryGuide(
        elements,
        mode
    ) {

        const headings =
            Array.from(
                elements.main
                    .querySelectorAll(
                        "h2, h3"
                    )
            );


        const heading =
            headings.find(
                element => {

                    const text =
                        element.textContent ||
                        "";


                    return (
                        text.includes(
                            "恢复已有账户"
                        ) ||
                        text.includes(
                            "恢复账户"
                        ) ||
                        text.includes(
                            "备用登录"
                        ) ||
                        text.includes(
                            "紧急恢复"
                        )
                    );
                }
            );


        if (
            heading
        ) {

            setText(
                heading,
                mode ===
                "owner"

                    ? "Owner 紧急恢复说明"

                    : "备用登录码说明"
            );
        }

    }


    function applyRecoveryMode() {

        const path =
            window.location.pathname;


        if (
            path !==
                "/recover" &&
            path !==
                "/recover/"
        ) {

            return;
        }


        const mode =
            recoveryMode();


        const elements =
            findRecoveryElements();


        if (
            !elements.title
        ) {

            return;
        }


        if (
            mode ===
            "owner"
        ) {

            document.title =
                "Owner 恢复码 · Jingyan Media Center";


            setText(
                elements.eyebrow,
                "OWNER RECOVERY"
            );


            setText(
                elements.title,
                "使用 Owner 恢复码。"
            );


            setText(
                elements.intro,
                "输入 Owner 为你的原账户临时签发的一次性恢复码。这个入口只用于正常登录方式全部不可用的紧急情况。"
            );


            setText(
                elements.label,
                "Owner 恢复码"
            );


            if (
                elements.input
            ) {

                elements.input.setAttribute(
                    "aria-label",
                    "Owner 恢复码"
                );


                elements.input.setAttribute(
                    "autocomplete",
                    "one-time-code"
                );
            }


            setText(
                elements.submit,
                "恢复原账户"
            );

        } else {

            document.title =
                "备用登录码 · Jingyan Media Center";


            setText(
                elements.eyebrow,
                "BACKUP ACCESS"
            );


            setText(
                elements.title,
                "使用备用登录码。"
            );


            setText(
                elements.intro,
                "输入你本人以前在「账户与安全」生成并保存的备用登录码。它是你的个人灾备登录方式，不需要另一台设备。"
            );


            setText(
                elements.label,
                "备用登录码"
            );


            if (
                elements.input
            ) {

                elements.input.setAttribute(
                    "aria-label",
                    "备用登录码"
                );


                elements.input.setAttribute(
                    "autocomplete",
                    "one-time-code"
                );
            }


            setText(
                elements.submit,
                "使用备用登录码登录"
            );
        }


        if (
            elements.form
        ) {

            const card =
                recoveryCard(
                    mode
                );


            if (
                card.parentElement !==
                elements.hero
            ) {

                elements.form
                    .insertAdjacentElement(
                        "beforebegin",
                        card
                    );
            }
        }


        replaceRecoveryNotice(
            elements,
            mode
        );


        replaceRecoveryGuide(
            elements,
            mode
        );


        ensureModeSwitch(
            elements,
            mode
        );

    }


    function enhanceOwnerRecoveryPage() {

        const title =
            document.querySelector(
                "h1"
            );


        const intro =
            document.querySelector(
                ".intro"
            ) ||
            document.querySelector(
                "h1 + p"
            );


        setText(
            title,
            "Owner 本人紧急恢复。"
        );


        setText(
            intro,
            "这里只恢复 Owner 自己的账户，并使用系统级 Owner Recovery Secret。它不是 Owner 给普通成员签发恢复码的页面。"
        );

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


        setText(
            methods.querySelector(
                "p"
            ),
            "建议至少准备两种日常登录方式：Passkey 用于快捷登录；你自己保存的备用登录码用于个人灾备；设备配对适合另一台已登录设备就在身边。Owner 恢复码属于紧急恢复，不是日常登录方式。"
        );


        const selfPanel =
            document.getElementById(
                "selfRecoveryPanel"
            );


        setText(
            selfPanel
                ?.querySelector(
                    ".pair-panel-copy p"
                ),
            "这是你本人持有的备用登录码。请保存到可信的密码管理器或安全位置。重新生成只会替换你自己以前的备用登录码，不会删除 Owner 单独为你签发的紧急恢复码。"
        );


        if (
            document.getElementById(
                "ownerRecoveryExplanationV6"
            )
        ) {

            return;
        }


        const note =
            createElement(
                "div"
            );


        note.id =
            "ownerRecoveryExplanationV6";


        Object.assign(
            note.style,
            {
                marginTop:
                    "18px",

                padding:
                    "16px 18px",

                border:
                    "1px solid rgba(124,80,233,.14)",

                borderRadius:
                    "16px",

                background:
                    "rgba(247,244,255,.78)",

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
            "这个代码不能由你自己在这里生成。当 Passkey、自己的备用登录码和已登录设备全部不可用时，请联系 Owner。Owner 会为你的原账户签发临时恢复码；它与你自己的备用登录码分开管理。";


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


        setText(
            gate.querySelector(
                ".gate-copy"
            ),
            "第一次使用请用 Owner 发放的邀请码激活。已有账户可以使用 Passkey、6 位设备配对或自己保存的备用登录码；如果这些方式全部不可用，再使用 Owner 为原账户签发的紧急恢复码。"
        );


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


            setText(
                recovery,
                "备用登录码"
            );
        }


        if (
            !document.getElementById(
                "homeOwnerRecoveryLinkV6"
            )
        ) {

            const ownerRecovery =
                createLink(
                    "Owner 恢复码",
                    "/recover?mode=owner",
                    "button secondary"
                );


            ownerRecovery.id =
                "homeOwnerRecoveryLinkV6";


            actions.append(
                ownerRecovery
            );
        }

    }


    function apply() {

        const path =
            window.location.pathname;


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

            applyRecoveryMode();

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


    function installRecoveryObserver() {

        const path =
            window.location.pathname;


        if (
            path !==
                "/recover" &&
            path !==
                "/recover/"
        ) {

            return;
        }


        const root =
            document.querySelector(
                "main"
            ) ||
            document.body;


        if (
            !root
        ) {

            return;
        }


        let scheduled =
            false;


        const observer =
            new MutationObserver(
                () => {

                    if (
                        scheduled
                    ) {

                        return;
                    }


                    scheduled =
                        true;


                    requestAnimationFrame(
                        () => {

                            scheduled =
                                false;


                            applyRecoveryMode();
                        }
                    );
                }
            );


        observer.observe(
            root,
            {
                childList:
                    true,

                subtree:
                    true,

                characterData:
                    true
            }
        );

    }


    function init() {

        apply();


        installRecoveryObserver();


        /*
         * 基础页面的 login-v3 / account 脚本
         * 可能会稍后再次修改 DOM。
         *
         * 多做几次轻量重绘，保证最终显示的是 V6 UI。
         */
        [
            80,
            240,
            650,
            1400
        ]
            .forEach(
                delay => {

                    setTimeout(
                        apply,
                        delay
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
