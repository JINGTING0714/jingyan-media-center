const fs = require("fs");
const path = require("path");


const configPath =
    path.join(
        __dirname,
        "../config.json"
    );


function loadConfig(){

    const data =
        fs.readFileSync(
            configPath,
            "utf-8"
        );

    return JSON.parse(data);

}



// 获取仓库列表

function getRepositories(type){


    const config =
        loadConfig();


    const list =
        config.storage.repositories[type];


    if(!list){

        throw new Error(
            "Unknown media type"
        );

    }


    return list;


}



// 模拟获取仓库大小
// 后续连接GitHub API

function getRepositorySize(repo){


    const statusPath =
        path.join(
            __dirname,
            "../storage-status.json"
        );


    if(
        fs.existsSync(statusPath)
    ){

        const status =
            JSON.parse(
                fs.readFileSync(
                    statusPath,
                    "utf-8"
                )
            );


        return status[repo] || 0;

    }


    return 0;


}




// 保存仓库状态

function saveRepositorySize(
    repo,
    size
){


    const statusPath =
        path.join(
            __dirname,
            "../storage-status.json"
        );


    let status={};



    if(
        fs.existsSync(statusPath)
    ){

        status =
            JSON.parse(
                fs.readFileSync(
                    statusPath,
                    "utf-8"
                )
            );

    }



    status[repo]=size;



    fs.writeFileSync(
        statusPath,
        JSON.stringify(
            status,
            null,
            2
        )
    );


}



// 选择仓库

function selectRepository(
    type,
    fileSizeMB
){


    const config =
        loadConfig();



    const max =
        config.storage
        .maxRepositorySizeMB;



    const repositories =
        getRepositories(type);



    for(
        let repo of repositories
    ){


        const used =
            getRepositorySize(
                repo
            );



        if(
            used + fileSizeMB
            <= max
        ){

            return {

                repo,

                used,

                remain:
                    max-used-fileSizeMB

            };

        }


    }



    // 如果全部满

    if(
        config.storage.autoSwitchRepository
    ){


        return {

            needCreate:true,


            message:
            "Create next repository"

        };


    }



    throw new Error(
        "No available repository"
    );

}




module.exports={


    getRepositories,


    selectRepository,


    saveRepositorySize


};
