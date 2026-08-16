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






function ensureFile(file){


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


    ensureFile(file);



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


    ensureFile(file);



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



    return config.database[type];


}








function getNextID(type){


    const list=
    getMedia(type);



    return String(

        list.length + 1

    )
    .padStart(
        6,
        "0"
    );


}








function addRecord(

    type,

    item

){


    const file=
    getDatabase(type);



    const list=
    readDatabase(file);



    const record={


        id:

        `${type}-${getNextID(type)}`,



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

        file,

        list

    );



    return record;


}









function removeMedia(

    type,

    id

){


    const file=
    getDatabase(type);



    let list=
    readDatabase(file);



    list=
    list.filter(

        item=>

        item.id!==id

    );



    writeDatabase(

        file,

        list

    );



    return true;


}









function getMedia(type){


    const file=
    getDatabase(type);



    return readDatabase(file);


}







module.exports={


    addRecord,


    removeMedia,


    getMedia,


    getNextID,


    readDatabase,


    writeDatabase


};
