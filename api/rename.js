const fs = require("fs");
const path = require("path");


const CONFIG_FILE =
    path.join(

        __dirname,

        "../config.json"

    );


const BASIC_PINYIN = {

    "方": "fang",

    "大": "da",

    "同": "tong",

    "周": "zhou",

    "杰": "jie",

    "伦": "lun",

    "晴": "qing",

    "天": "tian",

    "圣": "sheng",

    "诞": "dan",

    "快": "kuai",

    "乐": "le",

    "夜": "ye",

    "曲": "qu",

    "你": "ni",

    "好": "hao",

    "音": "yin",

    "新": "xin",

    "歌": "ge"

};


function loadConfig() {

    return JSON.parse(

        fs.readFileSync(

            CONFIG_FILE,

            "utf8"

        )

    );

}


function unicodeFallback(
    char
) {

    return (

        "u" +

        char
            .codePointAt(0)
            .toString(16)

    );

}


function transliterateSafe(
    text
) {

    const pieces =
        [];


    for (
        const char
        of text
    ) {

        if (
            BASIC_PINYIN[char]
        ) {

            pieces.push(
                BASIC_PINYIN[char]
            );

            continue;

        }


        if (
            /[a-zA-Z0-9]/.test(
                char
            )
        ) {

            pieces.push(
                char
            );

            continue;

        }


        const decomposed =
            char
                .normalize(
                    "NFKD"
                )
                .replace(

                    /[\u0300-\u036f]/g,

                    ""

                );


        if (

            decomposed &&

            /^[a-zA-Z0-9]+$/.test(
                decomposed
            )

        ) {

            pieces.push(
                decomposed
            );

            continue;

        }


        if (

            /\s/.test(
                char
            ) ||

            /[-_.,;:!?()[\]{}'"`~@#$%^&*+=|\\/<>]/.test(
                char
            )

        ) {

            pieces.push(
                "-"
            );

            continue;

        }


        pieces.push(

            "-" +

            unicodeFallback(
                char
            ) +

            "-"

        );

    }


    return pieces.join(
        ""
    );

}


function normalizeName(
    text
) {

    let result =
        transliterateSafe(
            text
        );


    result =
        result

            .replace(
                /&/g,
                "-and-"
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


    return (
        result ||
        "file"
    );

}


function renameFile(

    filename,

    sequence

) {

    const config =
        loadConfig();


    const renameConfig =
        config.rename ||
        {};


    const extension =
        path.extname(
            filename
        )
        .toLowerCase();


    let basename =
        path.basename(

            filename,

            extension

        );


    basename =
        basename.replace(

            /^\d{1,9}[-_\s]+/,

            ""

        );


    const normalized =
        normalizeName(
            basename
        );


    const digits =
        Number(

            renameConfig.numberDigits ||
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

    normalizeName

};
