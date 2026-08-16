const fs=require("fs");

const path=require("path");

const {
 createRepository,
 generateRepositoryName
}
=require("./github");





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








async function selectRepository(type){


 const config=
 loadConfig();



 const list=
 config.storage
 .repositories[type];



 if(!list){

  throw new Error(
   "Invalid media type"
  );

 }



 for(
  const repo of list
 ){

  if(
   repo.sizeMB <
   config.storage.maxRepositorySizeMB
  ){

    return repo;

  }

 }





 // 已满，自动创建


 const index=
 list.length+1;



 const name=
 generateRepositoryName(
 type,
 index
 );




 const auth=
 require("../auth.json");



 const result=
 await createRepository({

 username:
 auth.owner.username,


 token:
 auth.users[0].token,


 name

 });





 const newRepo={


 id:
 `${type}-${index}`,

 repo:
 result.repo,


 branch:
 "main",


 folder:
 type==="audio"
 ?
 "music"
 :
 type,


 database:
 `data/${type}.json`,


 sizeMB:0


 };





 list.push(
 newRepo
 );




 saveConfig(
 config
 );





 return newRepo;



}





module.exports={

 selectRepository

};
