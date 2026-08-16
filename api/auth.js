const fs = require("fs");
const path = require("path");


const authPath = path.join(
    __dirname,
    "../auth.template.json"
);



function loadAuth(){


    if(!fs.existsSync(authPath)){

        throw new Error(
            "auth.template.json missing"
        );

    }



    return JSON.parse(

        fs.readFileSync(

            authPath,

            "utf8"

        )

    );

}






function verifyToken(token){


    const auth =
    loadAuth();



    if(!token){


        return {

            success:false,

            message:"Token missing"

        };

    }




    const user =
    auth.users.find(

        u => u.token === token

    );





    if(!user){


        return {

            success:false,

            message:"Invalid token"

        };

    }





    if(
        user.status !== "active"
    ){


        return {

            success:false,

            message:"User disabled"

        };


    }






    return {


        success:true,


        user:{


            id:user.id,


            username:user.username,


            role:user.role


        },



        permissions:

        auth.roles[user.role]


    };


}







function checkPermission(

    token,

    permission

){


    const result =
    verifyToken(token);



    if(!result.success){

        return false;

    }




    return Boolean(

        result.permissions[permission]

    );


}







module.exports={


    verifyToken,


    checkPermission


};
