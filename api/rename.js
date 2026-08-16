const fs = require("fs");
const path = require("path");


const PINYIN = {

"方":"fang",
"大":"da",
"同":"tong",

"周":"zhou",
"杰":"jie",
"伦":"lun",

"晴":"qing",
"天":"tian",

"你":"ni",
"好":"hao",

"的":"de",

"音":"yin",
"乐":"yue",

"新":"xin",
"歌":"ge"

};





function loadConfig(){

    return JSON.parse(

        fs.readFileSync(
            "config.json",
            "utf8"
        )

    );

}






function getExtension(filename){

    return path.extname(filename)
    .toLowerCase();

}






function removeExtension(filename){

    return path.basename(
        filename,
        path.extname(filename)
    );

}






function convertChinese(text){


    let result="";


    for(
        const char of text
    ){

        if(PINYIN[char]){

            result +=
            "-"
            +
            PINYIN[char];

        }else{

            result += char;

        }

    }


    return result;

}






function normalizeName(name){


    let result =
    convertChinese(name);



    result =
    result
    .toLowerCase();



    result =
    result
    .replace(
        /[^a-z0-9]+/g,
        "-"
    );



    result =
    result
    .replace(
        /^-+|-+$/g,
        ""
    );



    return result;

}







function getNextNumber(type){


    const config=
    loadConfig();


    const file =
    config.database[type];



    if(
        !fs.existsSync(file)
    ){

        return "001";

    }




    const list =
    JSON.parse(

        fs.readFileSync(
            file,
            "utf8"
        )

    );



    return String(
        list.length+1
    )
    .padStart(
        3,
        "0"
    );


}








function renameFile(filename){


    const ext =
    getExtension(filename);



    const name =
    removeExtension(filename);



    const clean =
    normalizeName(name);



    let prefix="001";



    if(
        ext===".mp3" ||
        ext===".wav" ||
        ext===".flac"
    ){

        prefix=
        getNextNumber("audio");

    }



    if(
        ext===".jpg" ||
        ext===".png" ||
        ext===".webp"
    ){

        prefix=
        getNextNumber("image");

    }



    if(
        ext===".mp4" ||
        ext===".webm"
    ){

        prefix=
        getNextNumber("video");

    }



    return (

        prefix
        +
        "-"
        +
        clean
        +
        ext

    );


}







module.exports={


    renameFile,


    normalizeName,


    convertChinese


};
