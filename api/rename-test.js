const fs = require("fs");
const path = require("path");

const {
    renameFile
} = require("./rename");


const REPORT_FILE =
    "data/rename-test-report.json";


const TEST_CASES = [

    {
        id:
            "chinese",

        description:
            "Chinese + semantic words + duplicate extension",

        input:
            "方大同 - 测试 Live feat. 王力宏.jpg.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        exact:
            "999-fang-da-tong-ce-shi-live-feat-wang-li-hong.jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "japanese-explicit",

        description:
            "Japanese pure Kanji with explicit language hint",

        input:
            "[ja]宇多田光 - First Love.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        mustContain: [
            "first-love"
        ],

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "japanese-auto",

        description:
            "Japanese auto detection with Katakana",

        input:
            "宇多田ヒカル - First Love.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        mustContain: [
            "first-love"
        ],

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "korean",

        description:
            "Korean Revised Romanization",

        input:
            "[ko]방탄소년단 - Dynamite.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        mustContain: [
            "dynamite"
        ],

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "russian",

        description:
            "Cyrillic transliteration",

        input:
            "Моя песня.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "arabic",

        description:
            "Arabic transliteration",

        input:
            "أغنية جميلة.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "persian",

        description:
            "Persian transliteration",

        input:
            "آهنگ زیبا.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "greek",

        description:
            "Greek transliteration",

        input:
            "Αγάπη μου.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "vietnamese",

        description:
            "Vietnamese diacritics",

        input:
            "Tình yêu mùa hè.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "latin-diacritics",

        description:
            "Latin diacritics",

        input:
            "Beyoncé - Déjà Vu.jpg",

        sequence:
            999,

        expectedExtension:
            ".jpg",

        exact:
            "999-beyonce-deja-vu.jpg",

        forbidUnicodeFallback:
            true
    },

    {
        id:
            "existing-sequence",

        description:
            "Existing sequence must be stripped before new sequence",

        input:
            "003-Artist - Song Live Remix feat. Guest.mp3.mp3",

        sequence:
            999,

        expectedExtension:
            ".mp3",

        exact:
            "999-artist-song-live-remix-feat-guest.mp3",

        forbidUnicodeFallback:
            true
    }

];


function ensureReportDirectory() {

    fs.mkdirSync(

        path.dirname(
            REPORT_FILE
        ),

        {
            recursive:
                true
        }

    );

}


function writeReport(
    report
) {

    ensureReportDirectory();


    fs.writeFileSync(

        REPORT_FILE,

        JSON.stringify(
            report,
            null,
            2
        ) + "\n"

    );

}


function hasUnicode(
    text
) {

    return /[^\x00-\x7F]/.test(
        text
    );

}


function hasUnicodeFallback(
    text
) {

    return /(?:^|-)u[0-9a-f]{4,6}(?:-|\.|$)/i.test(
        text
    );

}


function isSafeFilename(
    filename
) {

    return /^[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/i.test(
        filename
    );

}


function hasRepeatedExtension(
    filename,
    extension
) {

    const lower =
        filename.toLowerCase();


    const ext =
        extension.toLowerCase();


    if (
        !lower.endsWith(
            ext
        )
    ) {

        return false;

    }


    const withoutFinalExtension =
        lower.slice(
            0,
            -ext.length
        );


    return withoutFinalExtension
        .endsWith(
            ext
        );

}


async function runCase(
    test
) {

    const result = {

        id:
            test.id,

        description:
            test.description,

        input:
            test.input,

        sequence:
            test.sequence,

        output:
            null,

        status:
            "running",

        checks:
            [],

        error:
            null

    };


    try {

        const output =
            await renameFile(

                test.input,

                test.sequence

            );


        result.output =
            output;


        function check(
            name,
            passed,
            details = null
        ) {

            result.checks.push({

                name,

                passed:
                    Boolean(
                        passed
                    ),

                details

            });

        }


        check(

            "ascii-only",

            !hasUnicode(
                output
            )

        );


        check(

            "safe-filename",

            isSafeFilename(
                output
            )

        );


        check(

            "correct-sequence",

            output.startsWith(
                String(
                    test.sequence
                ).padStart(
                    3,
                    "0"
                ) + "-"
            )

        );


        check(

            "correct-extension",

            output
                .toLowerCase()
                .endsWith(
                    test
                        .expectedExtension
                        .toLowerCase()
                )

        );


        check(

            "no-repeated-extension",

            !hasRepeatedExtension(

                output,

                test.expectedExtension

            )

        );


        check(

            "language-hint-removed",

            !output.includes(
                "["
            ) &&
            !output.includes(
                "]"
            )

        );


        if (
            test.forbidUnicodeFallback
        ) {

            check(

                "no-unicode-fallback",

                !hasUnicodeFallback(
                    output
                )

            );

        }


        if (
            test.exact
        ) {

            check(

                "exact-output",

                output ===
                    test.exact,

                {
                    expected:
                        test.exact,

                    actual:
                        output
                }

            );

        }


        for (
            const fragment
            of (
                test.mustContain ||
                []
            )
        ) {

            check(

                `contains:${fragment}`,

                output.includes(
                    fragment
                ),

                {
                    fragment
                }

            );

        }


        const failedChecks =
            result.checks
                .filter(
                    item =>
                        !item.passed
                );


        result.status =
            failedChecks.length ===
                0

                ? "pass"

                : "fail";


        return result;

    } catch (error) {

        result.status =
            "error";


        result.error =
            error &&
            error.stack

                ? error.stack

                : String(
                    error
                );


        return result;

    }

}


async function run() {

    const startedAt =
        new Date()
            .toISOString();


    const results =
        [];


    for (
        const test
        of TEST_CASES
    ) {

        console.log(
            `Testing: ${test.id}`
        );


        const result =
            await runCase(
                test
            );


        results.push(
            result
        );


        console.log(
            `${result.status.toUpperCase()}: ${result.input} -> ${
                result.output ||
                "NO OUTPUT"
            }`
        );

    }


    const passed =
        results.filter(
            item =>
                item.status ===
                "pass"
        ).length;


    const failed =
        results.length -
        passed;


    const report = {

        version:
            1,

        status:
            failed ===
                0

                ? "pass"

                : "fail",

        startedAt,

        completedAt:
            new Date()
                .toISOString(),

        environment: {

            node:
                process.version,

            platform:
                process.platform,

            architecture:
                process.arch

        },

        summary: {

            total:
                results.length,

            passed,

            failed

        },

        results

    };


    writeReport(
        report
    );


    console.log("");
    console.log(
        "Rename test summary:"
    );


    console.log(
        JSON.stringify(
            report.summary,
            null,
            2
        )
    );


    if (
        failed >
        0
    ) {

        throw new Error(
            `${failed} rename test case(s) failed`
        );

    }


    console.log(
        "All rename tests passed."
    );


    return report;

}


if (
    require.main ===
    module
) {

    run()
        .catch(
            error => {

                console.error(
                    "Rename test failed:"
                );


                console.error(
                    error
                );


                process.exit(1);

            }
        );

}


module.exports = {

    TEST_CASES,

    runCase,

    run

};
