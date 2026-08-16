const fs=require("fs");
const path=require("path");




function loadConfig(){

    return JSON.parse(

        fs.readFileSync(
            "config.json",
            "utf8"
        )

    );

}





function ensureDatabase(file){


    const dir=
    path.dirname(file);



    if(!fs.existsSync(dir)){


        fs.mkdirSync(
            dir,
            {
                recursive:true
            }
        );


    }



    if(!fs.existsSync(file)){


        fs.writeFileSync(

            file,

            JSON.stringify(
                [],
                null,
                2
            )

        );


    }


}





function readDatabase(file){


    ensureDatabase(file);



    return JSON.parse(

        fs.readFileSync(
            file,
            "utf8"
        )

    );


}






function writeDatabase(

    file,

    data

){


    ensureDatabase(file);



    fs.writeFileSync(

        file,

        JSON.stringify(
            data,
            null,
            2
        )

    );


}







function getDatabase(type){


    const config=
    loadConfig();



    return config.sources[type].json;


}








function addRecord(

    type,

    item

){



    const database=
    getDatabase(type);



    const list=
    readDatabase(database);



    const record={


        id:
        Date.now()
        .toString(),


        type,


        name:
        item.name,


        repository:
        item.repository,


        path:
        item.path,


        cdn:
        item.cdn,


        createdAt:
        new Date()
        .toISOString()


    };




    list.push(record);



    writeDatabase(

        database,

        list

    );



    return record;


}







function removeMedia(

    type,

    id

){


    const database=
    getDatabase(type);



    let list=
    readDatabase(database);



    list=
    list.filter(

        item=>
        item.id!==id

    );



    writeDatabase(

        database,

        list

    );


    return true;


}








function getMedia(type){


    const database=
    getDatabase(type);



    return readDatabase(database);


}









module.exports={


    addRecord,


    removeMedia,


    getMedia,


    readDatabase,


    writeDatabase


};
