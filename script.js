const uploadBox = document.querySelector(".upload-box");

const fileInput = document.createElement("input");

fileInput.type="file";
fileInput.multiple=true;

fileInput.style.display="none";

document.body.appendChild(fileInput);



uploadBox.onclick=()=>{

fileInput.click();

};



fileInput.onchange=e=>{

handleFiles(e.target.files);

};



uploadBox.addEventListener(
"dragover",
e=>{

e.preventDefault();

uploadBox.style.borderColor="#8B5CF6";

});


uploadBox.addEventListener(
"dragleave",
()=>{

uploadBox.style.borderColor="#D8C7FF";

});



uploadBox.addEventListener(
"drop",
e=>{

e.preventDefault();

handleFiles(e.dataTransfer.files);

});





function handleFiles(files){


[...files].forEach(file=>{


const type=getType(file.name);



const limit=getLimit(type);



if(type==="unknown"){

alert(
file.name+" 不支持"
);

return;

}



if(file.size>limit){

alert(
file.name+" 超过限制"
);

return;

}




const data={


id:
createID(type),


title:
removeExt(file.name),


filename:
file.name,


type:type,


size:
formatSize(file.size),


created:
new Date()
.toISOString()



};



console.log(data);



showResult(data);



});


}






function getType(name){


let ext=
name.split(".")
.pop()
.toLowerCase();



if(
[
"mp3",
"wav",
"flac",
"aac",
"m4a"
]
.includes(ext)
)

return "music";



if(
[
"mp4",
"mov",
"avi",
"mkv"
]
.includes(ext)
)

return "video";



if(
[
"jpg",
"jpeg",
"png",
"webp",
"gif"
]
.includes(ext)
)

return "image";


return "unknown";


}





function getLimit(type){


if(type==="image")

return 15*1024*1024;


if(
type==="music"||
type==="video"
)

return 30*1024*1024;


return 0;


}







function createID(type){


let prefix={
music:"music",
video:"video",
image:"image"
}[type];



return prefix+
"-"+
Date.now();


}






function removeExt(name){

return name
.substring(
0,
name.lastIndexOf(".")
);

}






function formatSize(bytes){


if(bytes<1024)

return bytes+"B";


if(bytes<1024*1024)

return(
bytes/1024
).toFixed(2)+"KB";


return(
bytes/1024/1024
)
.toFixed(2)+"MB";


}







function showResult(data){


const box=document.createElement("div");

box.className="file-result";


box.innerHTML=`

<h3>${data.title}</h3>

<p>
类型：
${data.type}
</p>


<p>
文件：
${data.filename}
</p>


<p>
大小：
${data.size}
</p>


<p>
ID：
${data.id}
</p>

`;



document
.querySelector(".card")
.appendChild(box);


}
