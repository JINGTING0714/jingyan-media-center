const fs = require("fs");
const path = require("path");


// 读取权限配置
const authPath = path.join(
    __dirname,
    "../auth.template.json"
);


function loadAuth(){

    if(!fs.existsSync(authPath)){
        throw new Error(
            "auth.template.json not found"
        );
    }


    const data = fs.readFileSync(
        authPath,
        "utf-8"
    );


    return JSON.parse(data);

}



// 根据token查找用户

function verifyToken(token){


    const auth = loadAuth();


    if(!token){

        return {

            success:false,

            message:"Missing token"

        };

    }



    const user = auth.users.find(
        u => u.token === token
    );



    if(!user){

        return {

            success:false,

            message:"Invalid token"

        };

    }



    if(user.status !== "active"){


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



// 检查指定权限

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



// 获取用户列表（只有owner）

function getUsers(token){


    const result =
        verifyToken(token);



    if(
        !result.success ||
        result.user.role !== "owner"
    ){

        return {

            success:false,

            message:"Permission denied"

        };

    }



    const auth = loadAuth();


    return {


        success:true,


        users:auth.users


    };


}



module.exports={


    verifyToken,


    checkPermission,


    getUsers


};
