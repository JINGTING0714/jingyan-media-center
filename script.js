const uploadBox = document.querySelector(".upload-box");


const fileInput = document.createElement("input");

fileInput.type = "file";

fileInput.multiple = true;


fileInput.style.display="none";


document.body.appendChild(fileInput);



uploadBox.addEventListener(
"click",
()=>{

fileInput.click();

});




fileInput.addEventListener(
"change",
(e)=>{

handleFiles(e.target.files);

});




uploadBox.addEventListener(
"dragover",
(e)=>{

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
(e)=>{

e.preventDefault();

handleFiles(e.dataTransfer.files);

});






function handleFiles(files){


[...files].forEach(file=>{


const info={

name:file.name,

size:
formatSize(file.size),

type:
getType(file.name),

created:
new Date().toISOString()

};


console.log(info);


showResult(info);



});


}






function getType(filename){


const ext=
filename
.split(".")
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

return "audio";



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






function formatSize(bytes){


if(bytes<1024)

return bytes+" B";



if(bytes<1024*1024)

return
(bytes/1024)
.toFixed(2)
+" KB";



return
(bytes/1024/1024)
.toFixed(2)
+" MB";


}







function showResult(data){



const box=
document.createElement("div");


box.className="file-result";



box.innerHTML=`

<h3>${data.name}</h3>

<p>
类型：
${data.type}
</p>

<p>
大小：
${data.size}
</p>

<p>
时间：
${data.created}
</p>

`;



document
.querySelector(".card")
.appendChild(box);



}
