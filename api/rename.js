const path = require("path");


// ===============================
// 清理特殊字符
// ===============================

function cleanText(text){


    return text

        // 去除扩展名
        .replace(/\.[^/.]+$/, "")

        // 删除特殊符号
        .replace(/[()[\]{}&@#!?,.'""]/g,"")

        // 空格转 -
        .replace(/\s+/g,"-")

        // 多个 - 合并
        .replace(/-+/g,"-")

        // 去除首尾 -
        .replace(/^-|-$/g,"");


}



// ===============================
// Unicode 拉丁化
// 处理欧洲语言
// ===============================

function normalizeLatin(text){


    return text

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g,"");


}



// ===============================
// 简易中文拼音转换
// ===============================

function chineseToPinyin(text){


    const map={

        "晴":"qing",

        "天":"tian",

        "圣":"sheng",

        "诞":"dan",

        "快":"kuai",

        "乐":"le"

    };


    let result="";


    for(
        let char of text
    ){


        if(map[char]){

            result += "-" + map[char];

        }

        else{

            result += char;

        }


    }


    return result;



}



// ===============================
// 日文/韩文基础处理
// 后续可接API增强
// ===============================

function otherLanguage(text){


    return text

        .replace(/[^\x00-\x7F]/g,"");



}



// ===============================
// 文件编号
// ===============================

function generateID(number){


    return String(number)

        .padStart(3,"0");


}



// ===============================
// 主函数
// ===============================


function renameFile(
    filename,
    id
){


    let name =
        path.basename(filename);



    let extension =
        path.extname(name)
        .toLowerCase();



    let base =
        cleanText(name);



    // 中文处理

    base =
        chineseToPinyin(base);



    // 去重音

    base =
        normalizeLatin(base);



    // 其他字符处理

    base =
        otherLanguage(base);



    // 小写

    base =
        base.toLowerCase();



    // 最终清理

    base =
        cleanText(base);



    const finalName =
        generateID(id)
        +
        "-"
        +
        base
        +
        extension;



    return finalName;


}



module.exports={

    renameFile

};
