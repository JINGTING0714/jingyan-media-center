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

            "[]"

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








function addRecord(

    repository,

    item

){


    const database =
    repository.database;



    const list =
    readDatabase(database);




    const record={


        id:

        Date.now()
        .toString(),


        type:item.type,


        name:item.name,


        repository:
        repository.repo,


        path:
        item.path,


        cdn:
        item.cdn,


        sizeMB:
        item.sizeMB,


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






function getMedia(repository){


    return readDatabase(

        repository.database

    );


}






module.exports={


    addRecord,


    getMedia,


    readDatabase,


    writeDatabase


};
