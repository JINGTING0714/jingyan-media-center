const path = require("path");


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


function convertBasicChinese(text) {

    let result = "";


    for (
        const char
        of text
    ) {

        if (
            BASIC_PINYIN[char]
        ) {

            result +=
                " " +
                BASIC_PINYIN[char] +
                " ";

        } else {

            result += char;

        }

    }


    return result;

}


function normalizeName(text) {

    let result =
        convertBasicChinese(
            text
        );


    result =
        result
            .normalize("NFKD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /&/g,
                " and "
            )
            .replace(
                /['’"`]/g,
                ""
            )
            .toLowerCase();


    result =
        result
            .replace(
                /[^a-z0-9]+/g,
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


    if (!result) {

        result = "file";

    }


    return result;

}


function renameFile(
    filename,
    sequence
) {

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
            /^\d{1,6}[-_\s]+/,
            ""
        );


    const normalized =
        normalizeName(
            basename
        );


    const number =
        String(sequence)
            .padStart(
                3,
                "0"
            );


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
