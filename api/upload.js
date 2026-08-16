const fs = require("fs");
const path = require("path");


const {
    verifyToken
}=require("./auth");


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
    addMedia,
    generateMediaData
}=require("./database");





function detectType(filename){


    const ext =

    path.extname(filename)
    .replace(".","")
    .toLowerCase();



    if(
        [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
        ]
        .includes(ext)
    ){

        return "image";

    }



    if(
        [
            "mp3",
            "wav",
            "flac",
            "aac"
        ]
        .includes(ext)
    ){

        return "audio";

    }



    if(
        [
            "mp4",
            "webm"
        ]
        .includes(ext)
    ){

        return "video";

    }



    throw new Error(
        "Unsupported file type"
    );


}







async function upload(

    file,

    token

){



    const user = verifyToken(token);



    if(!user){

        throw new Error(
            "Unauthorized"
        );

    }






    const type =

    detectType(
        file.name
    );






    const newName =

    renameFile(
        file.name
    );







    const repository =

    selectRepository(
        type
    );








    const githubPath =

    repository.folder

    +

    "/"

    +

    newName;









    await uploadFile(


        repository.repo,


        githubPath,


        file.buffer


    );









    const cdn =

    generateRepositoryCDN(

        repository,

        newName

    );









    const data =

    generateMediaData(

        type,

        newName,

        cdn

    );








    addMedia(

        type,

        data

    );







    return {


        success:true,


        type,


        filename:newName,


        repository:repository.repo,


        url:cdn,


        data


    };



}







module.exports={

    upload,

    detectType

};
