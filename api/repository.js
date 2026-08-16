const fs=require("fs");

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
 config.storage.repositories[type];




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







 const index=
 list.length+1;





 const name=
 generateRepositoryName(

 type,

 index

 );






 const token=
 process.env.GH_TOKEN;



 if(!token){

    throw new Error(
      "GH_TOKEN missing"
    );

 }




 const result=
 await createRepository({

    token,

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
