const fs=require("fs");
const path=require("path");


const {
    renameFile
}=require("./rename");


const {
    selectRepository,
    updateRepositorySize
}=require("./repository");


const {
    uploadFile
}=require("./github");


const {
    generateCDN
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


    const ext=

    path.extname(file)

    .replace(".","")

    .toLowerCase();



    const map={


        image:[

            "jpg",

            "jpeg",

            "png",

            "webp",

            "gif"

        ],



        audio:[

            "mp3",

            "wav",

            "flac",

            "aac"

        ],



        video:[

            "mp4",

            "webm"

        ]


    };




    for(

        const type in map

    ){


        if(

            map[type]

            .includes(ext)

        ){

            return type;

        }


    }




    return null;


}







function getSizeMB(file){


    const size=

    fs.statSync(file)

    .size;



    return size /

    1024 /

    1024;


}









async function processUpload(

    file,

    index

){


    const config=

    loadConfig();




    const type=

    detectType(file);



    if(!type){

        return;

    }





    const sizeMB=

    getSizeMB(file);




    if(

        sizeMB

        >

        config.limits[type].maxSizeMB

    ){

        throw new Error(

            "File too large"

        );

    }





    const repository=

    await selectRepository(

        type

    );





    const newName=

    renameFile(

        path.basename(file),

        index

    );





    const target=

    repository.folder

    +

    "/"

    +

    newName;







    await uploadFile(

        repository.repo,

        file,

        target

    );







    const cdn=

    generateCDN(

        repository.repo,

        repository.branch,

        target

    );








    addRecord(

        repository,

        {

            type,

            name:newName,

            path:target,

            cdn,

            sizeMB

        }

    );







    updateRepositorySize(

        type,

        repository.id,

        sizeMB

    );





    console.log(

        "Uploaded:",

        cdn

    );



}









async function run(){


    const dir="upload";



    if(

        !fs.existsSync(dir)

    ){

        return;

    }






    const files=

    fs.readdirSync(dir);




    let index=1;



    for(

        const file of files

    ){


        const full=

        path.join(

            dir,

            file

        );



        if(

            fs.statSync(full)

            .isFile()

        ){


            await processUpload(

                full,

                index

            );



            index++;


        }


    }



}






if(require.main===module){


    run()

    .catch(

        err=>{


            console.error(err);


            process.exit(1);


        }

    );


}



module.exports={


    run,


    processUpload,


    detectType


};
