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



function saveConfig(data){


    fs.writeFileSync(

        "config.json",

        JSON.stringify(
            data,
            null,
            2
        )

    );


}





function getRepositories(

    type

){


    const config=
    loadConfig();


    return config.storage.repositories[type];


}








async function createNewRepository(

    type,

    config

){


    const list=
    config.storage.repositories[type];



    const index=
    list.length + 1;



    const template=
    config.repositoryTemplate[type];



    const name=

    template.prefix
    +
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

        config.sources[type].folder,



        database:

        config.database[type],



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
    getRepositories(type);




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

        "No available repository"

    );


}








function updateRepositorySize(

    type,

    repoId,

    size

){


    const config=
    loadConfig();



    const list=
    config.storage.repositories[type];



    const repo=

    list.find(

        r=>

        r.id===repoId

    );



    if(repo){


        repo.sizeMB += size;


    }



    saveConfig(config);


}








module.exports={


    selectRepository,


    updateRepositorySize,


    getRepositories


};
