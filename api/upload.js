const fs = require("fs");
const path = require("path");


const {
    renameFile
}=require("./rename");


const {
    selectRepository
}=require("./repository");


const {
    uploadFile
}=require("./github");


const {
    generateRepositoryCDN
}=require("./cdn");


const {
    addRecord
}=require("./database");




function loadConfig(){

    return JSON.parse(
        fs.readFileSync(
            "config.json",
            "utf8"
        )
    );

}




function detectType(file){


    const ext =
    path.extname(file)
    .replace(".","")
    .toLowerCase();



    const images=[
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif"
    ];


    const audio=[
        "mp3",
        "wav",
        "flac",
        "aac"
    ];


    const video=[
        "mp4",
        "webm"
    ];



    if(images.includes(ext))
        return "image";


    if(audio.includes(ext))
        return "audio";


    if(video.includes(ext))
        return "video";


    return null;

}





function checkSize(file,type){


    const config=loadConfig();


    const sizeMB =
    fs.statSync(file).size
    /
    1024
    /
    1024;



    const limit =
    config.limits[type]
    .maxSizeMB;



    if(sizeMB > limit){

        throw new Error(

            `${type} file too large ${sizeMB.toFixed(2)}MB`

        );

    }


}





async function processUpload(file){


    const config=
    loadConfig();



    const type=
    detectType(file);



    if(!type){

        console.log(
            "Unsupported:",
            file
        );

        return;

    }



    checkSize(
        file,
        type
    );



    const newName=
    renameFile(
        path.basename(file)
    );



    const repository=
    await selectRepository(
        type,
        config
    );



    const targetPath=
    `${repository.folder}/${newName}`;




    console.log(
        "Uploading:",
        targetPath
    );





    await uploadFile(

        repository.repo,

        file,

        targetPath

    );





    const cdn=
    generateRepositoryCDN(

        repository,

        newName

    );





    addRecord(

        type,

        {

            name:newName,

            repository:
            repository.repo,


            path:
            targetPath,


            cdn

        }

    );






    // 删除临时文件

    fs.unlinkSync(file);



    console.log(
        "Completed:",
        newName
    );


}





async function run(){



    console.log(
        "Jingyan Media Upload Start"
    );



    const uploadDir=
    "upload";



    if(!fs.existsSync(uploadDir)){


        console.log(
            "upload folder missing"
        );


        return;

    }





    const files=
    fs.readdirSync(uploadDir);




    for(const file of files){


        const fullPath=
        path.join(
            uploadDir,
            file
        );



        if(
            fs.statSync(fullPath)
            .isFile()
        ){


            await processUpload(
                fullPath
            );


        }


    }



    console.log(
        "All upload finished"
    );


}




if(require.main===module){


    run()
    .catch(err=>{

        console.error(err);

        process.exit(1);

    });


}



module.exports={

    detectType,

    processUpload,

    run

};
