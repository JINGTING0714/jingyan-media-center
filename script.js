const uploadBox = document.querySelector(".upload-box");

const fileInput = document.createElement("input");

fileInput.type = "file";
fileInput.multiple = true;
fileInput.style.display = "none";

document.body.appendChild(fileInput);



let counters = {

    music: 1,
    image: 1,
    video: 1

};





uploadBox.onclick = ()=>{

    fileInput.click();

};





fileInput.onchange = e=>{

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



        if(type==="unknown"){

            alert(
            "不支持的文件类型: "
            +file.name
            );

            return;

        }



        if(!checkSize(file,type)){

            return;

        }



        const data=createMediaData(file,type);



        console.log(data);



        showResult(data);



    });


}







function getType(filename){


const ext =
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

return "music";





if(
[
"mp4",
"mov",
"avi",
"mkv",
"webm"
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







function checkSize(file,type){


const size=file.size;


let limit;



if(type==="image"){

    limit=15*1024*1024;

}



if(type==="music" || type==="video"){

    limit=30*1024*1024;

}




if(size>limit){


alert(
file.name+
"\n超过上传限制"
);


return false;


}



return true;


}









function createID(type){


let id=
String(counters[type])
.padStart(6,"0");



counters[type]++;



return type+"-"+id;


}









function createMediaData(file,type){



let ext =
file.name
.split(".")
.pop()
.toLowerCase();



return {


"id":
createID(type),



"title":
file.name
.replace(/\.[^/.]+$/,""),




"file":{


"name":
file.name,


"format":
ext,


"size":
formatSize(file.size)


},





"media":{


"type":
type==="music"
?
"audio"
:
type,


"category":
type,


"language":
""



},




"url":
"",



"repository":{


"name":
"pending",


"type":
type


},




"created":
new Date()
.toISOString()
.split("T")[0],




"source":
"upload"


};



}









function formatSize(bytes){



if(bytes<1024)

return bytes+" B";



if(bytes<1024*1024)

return(
bytes/1024
)
.toFixed(2)
+" KB";



return(
bytes/1024/1024
)
.toFixed(2)
+" MB";

}









function showResult(data){



const box=document.createElement("div");


box.className="file-result";



box.innerHTML=`

<h3>${data.title}</h3>

<p>
类型：
${data.media.category}
</p>


<p>
文件：
${data.file.name}
</p>


<p>
大小：
${data.file.size}
</p>


<p>
ID：
${data.id}
</p>


<p>
状态：
等待上传服务器
</p>

`;



document
.querySelector(".card")
.appendChild(box);



}
