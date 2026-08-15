const fs = require("fs");
const path = require("path");


const config = require("../config.json");


function getRepository(type){

    if(type==="image"){
        return config.repositories.image;
    }


    if(type==="music" || type==="audio"){
        return config.repositories.music;
    }


    if(type==="video"){
        return config.repositories.video;
    }


    throw new Error("Unknown media type");

}



function createID(type){

    const time = Date.now();

    return type + "-" + time;

}



function createMediaData(file,type){


    const repo = getRepository(type);


    return {

        id:createID(type),

        name:file.name,

        type:type,

        size:file.size,


        repository:repo.current,


        data:repo.data,


        status:"waiting"


    };


}



module.exports={

    createMediaData

};
