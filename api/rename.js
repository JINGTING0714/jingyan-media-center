const fs = require("fs");
const path = require("path");


const CONFIG_FILE =
    path.join(
        __dirname,
        "../config.json"
    );


const HAN_REGEX =
    /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;


const HAN_SEQUENCE_REGEX =
    /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/gu;


const JAPANESE_KANA_REGEX =
    /[\u3040-\u30FF\u31F0-\u31FF]/u;


const HANGUL_REGEX =
    /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u;


const HANGUL_SEQUENCE_REGEX =
    /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]+/gu;


let pinyinFunction =
    null;


let transliterateFunction =
    null;


let koreanRomanizeFunction =
    null;


let kuroshiroInstance =
    null;


let kuroshiroPromise =
    null;


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            CONFIG_FILE,
            "utf8"
        )
    );

}


function getDefaultExport(
    module
) {

    if (
        module &&
        module.default
    ) {

        return module.default;

    }


    return module;

}


async function getPinyin() {

    if (pinyinFunction) {

        return pinyinFunction;

    }


    const module =
        await import(
            "pinyin-pro"
        );


    if (
        typeof module.pinyin !==
        "function"
    ) {

        throw new Error(
            "pinyin-pro does not export pinyin()"
        );

    }


    pinyinFunction =
        module.pinyin;


    return pinyinFunction;

}


async function getGeneralTransliterator() {

    if (transliterateFunction) {

        return transliterateFunction;

    }


    const module =
        await import(
            "@sindresorhus/transliterate"
        );


    const transliterate =
        getDefaultExport(
            module
        );


    if (
        typeof transliterate !==
        "function"
    ) {

        throw new Error(
            "@sindresorhus/transliterate export invalid"
        );

    }


    transliterateFunction =
        transliterate;


    return transliterateFunction;

}


async function getKoreanRomanizer() {

    if (koreanRomanizeFunction) {

        return koreanRomanizeFunction;

    }


    const module =
        await import(
            "@romanize/korean"
        );


    if (
        typeof module.romanize !==
        "function"
    ) {

        throw new Error(
            "@romanize/korean does not export romanize()"
        );

    }


    koreanRomanizeFunction =
        module.romanize;


    return koreanRomanizeFunction;

}


async function getKuroshiro() {

    if (kuroshiroInstance) {

        return kuroshiroInstance;

    }


    if (kuroshiroPromise) {

        return kuroshiroPromise;

    }


    kuroshiroPromise =
        (
            async () => {

                const kuroshiroModule =
                    await import(
                        "kuroshiro"
                    );


                const analyzerModule =
                    await import(
                        "kuroshiro-analyzer-kuromoji"
                    );


                const Kuroshiro =
                    getDefaultExport(
                        kuroshiroModule
                    );


                const KuromojiAnalyzer =
                    getDefaultExport(
                        analyzerModule
                    );


                if (
                    typeof Kuroshiro !==
                    "function"
                ) {

                    throw new Error(
                        "kuroshiro export invalid"
                    );

                }


                if (
                    typeof KuromojiAnalyzer !==
                    "function"
                ) {

                    throw new Error(
                        "kuroshiro-analyzer-kuromoji export invalid"
                    );

                }


                const instance =
                    new Kuroshiro();


                await instance.init(
                    new KuromojiAnalyzer()
                );


                kuroshiroInstance =
                    instance;


                return instance;

            }
        )();


    try {

        return await kuroshiroPromise;

    } catch (error) {

        kuroshiroPromise =
            null;


        throw error;

    }

}


function parseLanguageHint(
    text
) {

    const match =
        String(
            text || ""
        ).match(
            /^\s*\[(zh|ja|ko)\]\s*/i
        );


    if (!match) {

        return {

            language:
                null,

            text:
                String(
                    text || ""
                )

        };

    }


    return {

        language:
            match[1]
                .toLowerCase(),

        text:
            String(
                text || ""
            ).slice(
                match[0].length
            )

    };

}


function stripExistingSequence(
    text
) {

    return String(
        text || ""
    ).replace(
        /^\s*\d{1,9}[-_\s]+/,
        ""
    );

}


function stripRepeatedExtension(
    filename
) {

    const raw =
        path.basename(
            String(
                filename || ""
            )
        );


    const extension =
        path.extname(
            raw
        ).toLowerCase();


    if (!extension) {

        return {

            basename:
                raw,

            extension:
                ""

        };

    }


    let basename =
        path.basename(
            raw,
            path.extname(
                raw
            )
        );


    while (
        basename
            .toLowerCase()
            .endsWith(
                extension
            )
    ) {

        basename =
            basename
                .slice(
                    0,
                    -extension.length
                )
                .replace(
                    /[._\-\s]+$/g,
                    ""
                );

    }


    return {

        basename,

        extension

    };

}


async function transliterateChinese(
    text
) {

    const pinyin =
        await getPinyin();


    const matches =
        Array.from(
            String(
                text
            ).matchAll(
                HAN_SEQUENCE_REGEX
            )
        );


    if (
        matches.length ===
        0
    ) {

        return text;

    }


    let output =
        "";


    let cursor =
        0;


    for (
        const match
        of matches
    ) {

        output +=
            text.slice(
                cursor,
                match.index
            );


        const converted =
            pinyin(
                match[0],
                {
                    toneType:
                        "none",

                    type:
                        "string",

                    separator:
                        " "
                }
            );


        output +=
            converted;


        cursor =
            match.index +
            match[0].length;

    }


    output +=
        text.slice(
            cursor
        );


    return output;

}


async function transliterateJapanese(
    text
) {

    const kuroshiro =
        await getKuroshiro();


    return kuroshiro.convert(
        text,
        {
            to:
                "romaji",

            mode:
                "spaced",

            romajiSystem:
                "hepburn"
        }
    );

}


async function transliterateKorean(
    text
) {

    const romanize =
        await getKoreanRomanizer();


    const matches =
        Array.from(
            String(
                text
            ).matchAll(
                HANGUL_SEQUENCE_REGEX
            )
        );


    if (
        matches.length ===
        0
    ) {

        return text;

    }


    let output =
        "";


    let cursor =
        0;


    for (
        const match
        of matches
    ) {

        output +=
            text.slice(
                cursor,
                match.index
            );


        output +=
            romanize(
                match[0]
            );


        cursor =
            match.index +
            match[0].length;

    }


    output +=
        text.slice(
            cursor
        );


    return output;

}


function unicodeFallback(
    text
) {

    let output =
        "";


    for (
        const character
        of text
    ) {

        if (
            /[a-zA-Z0-9]/.test(
                character
            )
        ) {

            output +=
                character;


            continue;

        }


        if (
            /\s/.test(
                character
            )
        ) {

            output +=
                "-";


            continue;

        }


        if (
            /[-_.,;:!?()[\]{}'"`~@#$%^&*+=|\\/<>]/.test(
                character
            )
        ) {

            output +=
                "-";


            continue;

        }


        output +=
            `-u${character
                .codePointAt(0)
                .toString(16)}-`;

    }


    return output;

}


function finalizeSlug(
    text
) {

    const config =
        loadConfig();


    const maxLength =
        Number(
            (
                config.rename &&
                config.rename
                    .maxBaseLength
            ) ||
            120
        );


    let result =
        String(
            text || ""
        )
            .normalize(
                "NFKD"
            )

            .replace(
                /[\u0300-\u036f]/g,
                ""
            )

            .replace(
                /&/g,
                " and "
            )

            .toLowerCase()

            .replace(
                /[^a-z0-9-]+/g,
                "-"
            )

            .replace(
                /-+/g,
                "-"
            )

            .replace(
                /^-+|-+$/g,
                ""
            );


    if (
        result.length >
        maxLength
    ) {

        result =
            result
                .slice(
                    0,
                    maxLength
                )
                .replace(
                    /-+$/g,
                    ""
                );

    }


    return (
        result ||
        "file"
    );

}


async function normalizeName(
    originalText
) {

    const hint =
        parseLanguageHint(
            originalText
        );


    let text =
        hint.text
            .normalize(
                "NFKC"
            )
            .replace(
                /＆/g,
                "&"
            );


    text =
        stripExistingSequence(
            text
        );


    const hasKana =
        JAPANESE_KANA_REGEX.test(
            text
        );


    const hasHangul =
        HANGUL_REGEX.test(
            text
        );


    const hasHan =
        HAN_REGEX.test(
            text
        );


    if (
        hint.language ===
            "ja" ||
        (
            !hint.language &&
            hasKana
        )
    ) {

        try {

            text =
                await transliterateJapanese(
                    text
                );

        } catch (error) {

            console.warn(
                `Japanese transliteration fallback: ${error.message}`
            );


            if (hasHan) {

                text =
                    await transliterateChinese(
                        text
                    );

            }

        }

    } else {

        if (
            hint.language ===
                "zh" ||
            (
                !hint.language &&
                hasHan
            )
        ) {

            text =
                await transliterateChinese(
                    text
                );

        }

    }


    if (
        hint.language ===
            "ko" ||
        hasHangul
    ) {

        text =
            await transliterateKorean(
                text
            );

    }


    try {

        const transliterate =
            await getGeneralTransliterator();


        text =
            transliterate(
                text,
                {
                    customReplacements: [
                        [
                            "&",
                            " and "
                        ]
                    ]
                }
            );

    } catch (error) {

        console.warn(
            `General transliteration fallback: ${error.message}`
        );

    }


    text =
        unicodeFallback(
            text
        );


    return finalizeSlug(
        text
    );

}


async function renameFile(
    filename,
    sequence
) {

    const config =
        loadConfig();


    const renameConfig =
        config.rename ||
        {};


    const {
        basename,
        extension
    } =
        stripRepeatedExtension(
            filename
        );


    if (!extension) {

        throw new Error(
            `File extension missing: ${filename}`
        );

    }


    const normalized =
        await normalizeName(
            basename
        );


    const digits =
        Number(
            renameConfig
                .numberDigits ||
            3
        );


    const number =
        String(
            sequence
        ).padStart(
            digits,
            "0"
        );


    const format =
        renameConfig.format ||
        "number-name-extension";


    if (
        format !==
        "number-name-extension"
    ) {

        throw new Error(
            `Unsupported rename format: ${format}`
        );

    }


    return (
        number +
        "-" +
        normalized +
        extension
    );

}


module.exports = {

    renameFile,

    normalizeName,

    stripRepeatedExtension,

    parseLanguageHint

};
