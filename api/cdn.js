const fs = require("fs");



function loadConfig(){

    return JSON.parse(

        fs.readFileSync(
            "config.json",
            "utf8"
        )

    );

}






function generateCDN(

    repo,

    filePath

){


    const config = loadConfig();



    if(

        !config.cdn ||

        !config.cdn.enabled

    ){

        return null;

    }





    const provider =

        config.cdn.provider;





    if(provider==="jsdelivr"){


        return (

            "https://cdn.jsdelivr.net/gh/"

            +

            repo

            +

            "/"

            +

            filePath

        );


    }





    return null;


}







function generateRepositoryCDN(

    repository,

    filename

){


    return generateCDN(

        repository.repo,

        repository.folder

        +

        "/"

        +

        filename

    );


}







function generateRawCDN(

    repo,

    branch,

    file

){


    return (

        "https://cdn.jsdelivr.net/gh/"

        +

        repo

        +

        "@"

        +

        branch

        +

        "/"

        +

        file

    );


}







module.exports={


    generateCDN,


    generateRepositoryCDN,


    generateRawCDN


};
