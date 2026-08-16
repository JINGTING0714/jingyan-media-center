const fs=require("fs");


const {

    createRepository

}=require("./github");






function loadConfig(){


    return JSON.parse(

        fs.readFileSync(

            "config.json",

            "utf8"

        )

    );


}







function saveConfig(config){


    fs.writeFileSync(

        "config.json",

        JSON.stringify(

            config,

            null,

            2

        )

    );


}









async function createNewRepository(

    type,

    config

){


    const list=

    config.storage.repositories[type];



    const index=

    list.length+1;



    const template=

    config.repositoryTemplate[type];




    const name=

    template.prefix+

    String(index)

    .padStart(

        2,

        "0"

    );





    const result=

    await createRepository({

        name

    });






    const repo={



        id:

        `${type}-${index}`,



        repo:

        result.repo,



        branch:

        "main",



        folder:

        config.storage.repositories[type][0].folder,



        database:

        config.storage.repositories[type][0].database,



        sizeMB:

        0


    };






    list.push(repo);



    saveConfig(config);



    return repo;



}









async function selectRepository(

    type

){


    const config=

    loadConfig();




    const list=

    config.storage.repositories[type];





    for(

        const repo of list

    ){



        if(

            repo.sizeMB

            <

            config.storage.maxRepositorySizeMB

        ){


            return repo;


        }


    }





    if(

        config.storage.autoSwitchRepository

    ){


        return await createNewRepository(

            type,

            config

        );


    }




    throw new Error(

        "Repository full"

    );



}








function updateRepositorySize(

    type,

    id,

    size

){


    const config=

    loadConfig();




    const repo=

    config.storage.repositories[type]

    .find(

        r=>

        r.id===id

    );




    if(repo){


        repo.sizeMB += size;


    }



    saveConfig(config);


}







module.exports={


    selectRepository,


    updateRepositorySize


};
