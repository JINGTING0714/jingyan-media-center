const https = require("https");


function githubRequest(
  method,
  path,
  token,
  data = null
) {

  return new Promise((resolve, reject)=>{


    const options = {

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

            try{

              resolve(
                JSON.parse(body)
              );

            }catch(e){

              resolve(body);

            }

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





async function createRepository({

 username,

 token,

 name,

 description

}){


  const result =
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


  if(!result.full_name){

    throw new Error(
      "GitHub repository creation failed"
    );

  }


  return {


    success:true,

    repo:
    result.full_name,


    url:
    result.html_url


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


 generateRepositoryName


};
