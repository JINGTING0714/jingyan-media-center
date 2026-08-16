const fs=require("fs");




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

    branch,

    file

){


    const config=

    loadConfig();





    if(

        !config.cdn.enabled

    ){

        return null;

    }






    if(

        config.cdn.provider

        ===

        "jsdelivr"

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





    return null;



}






module.exports={


    generateCDN


};
