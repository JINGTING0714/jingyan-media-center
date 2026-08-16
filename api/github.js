const https = require("https");
const fs = require("fs");



function githubRequest(
  method,
  path,
  token,
  data=null
){

  return new Promise((resolve,reject)=>{


    const options={

      hostname:"api.github.com",

      path,

      method,


      headers:{


        "Authorization":
        `Bearer ${token}`,


        "User-Agent":
        "jingyan-media-center",


        "Accept":
        "application/vnd.github+json",


        "Content-Type":
        "application/json"


      }

    };



    const req=https.request(

      options,

      res=>{


        let body="";


        res.on(
          "data",
          chunk=>{
            body+=chunk;
          }
        );


        res.on(
          "end",
          ()=>{


            let result;


            try{

              result=
              JSON.parse(body);

            }catch{

              result=body;

            }



            if(
              res.statusCode>=400
            ){

              reject(
                new Error(
                  JSON.stringify(result)
                )
              );

              return;

            }



            resolve(result);


          }

        );


      }

    );



    req.on(
      "error",
      reject
    );



    if(data){

      req.write(
        JSON.stringify(data)
      );

    }


    req.end();


  });


}







function getToken(){


  const token=
  process.env.GH_TOKEN;



  if(!token){

    throw new Error(
      "GH_TOKEN missing"
    );

  }


  return token;


}








async function createRepository({

 username,

 token,

 name,

 description=""


}){


  const result=
  await githubRequest(

    "POST",

    "/user/repos",

    token,

    {


      name,


      description,


      private:false,


      auto_init:true


    }

  );



  return {


    success:true,


    repo:
    result.full_name,


    url:
    result.html_url


  };


}









async function uploadFile(

 repo,

 filePath,

 targetPath


){


  const token=
  getToken();



  const content=
  fs.readFileSync(
    filePath
  )
  .toString("base64");




  const result=
  await githubRequest(


    "PUT",


    `/repos/${repo}/contents/${targetPath}`,


    token,


    {


      message:
      `Upload ${targetPath}`,


      content


    }


  );



  return {


    success:true,


    sha:
    result.content.sha,


    path:
    targetPath


  };


}










function generateRepositoryName(

 type,

 index

){


  const map={


    image:
    "jingyan-image-",


    audio:
    "jingyan-media-",


    video:
    "jingyan-video-"


  };



  return (

    map[type]

    +

    String(index)
    .padStart(2,"0")

  );


}







module.exports={


 githubRequest,


 createRepository,


 uploadFile,


 generateRepositoryName


};
