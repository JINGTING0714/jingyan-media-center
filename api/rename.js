const fs=require("fs");



function loadConfig(){

    return JSON.parse(

        fs.readFileSync(

            "config.json",

            "utf8"

        )

    );

}






function normalizeName(name){


    return name

    .toLowerCase()

    .replace(

        /[^\w\s-]/g,

        ""

    )

    .replace(

        /\s+/g,

        "-"

    )

    .replace(

        /-+/g,

        "-"

    )

    .replace(

        /^-|-$/g,

        ""

    );


}








function renameFile(

    filename,

    index

){


    const config=

    loadConfig();



    if(

        !config.rename.enabled

    ){

        return filename;

    }





    const ext=

    filename

    .split(".")

    .pop()

    .toLowerCase();





    const original=

    filename

    .replace(

        /\.[^/.]+$/,

        ""

    );





    const name=

    normalizeName(

        original

    );





    const number=

    String(index)

    .padStart(

        3,

        "0"

    );





    return (

        number

        +

        "-"

        +

        name

        +

        "."

        +

        ext

    );



}








module.exports={


    renameFile,


    normalizeName


};
