const fs = require("fs");
const path = require("path");

const {
    getFile,
    upsertTextFile
} = require("./github");


const CONFIG_FILE = "config.json";


function loadConfig() {

    return JSON.parse(
        fs.readFileSync(
            CONFIG_FILE,
            "utf8"
        )
    );

}


function getJobRepository() {

    const config =
        loadConfig();


    if (
        !config.jobs ||
        !config.jobs.repository
    ) {

        throw new Error(
            "Upload job repository is not configured"
        );

    }


    return config.jobs.repository;

}


async function readJobs() {

    const repository =
        getJobRepository();


    const result =
        await getFile(
            repository.repo,
            repository.database,
            repository.branch
        );


    if (!result) {

        return [];

    }


    const data =
        JSON.parse(
            result.content || "[]"
        );


    if (!Array.isArray(data)) {

        throw new Error(
            "Upload jobs database must be array"
        );

    }


    return data;

}



async function saveJobs(
    jobs,
    message
) {

    const repository =
        getJobRepository();


    await upsertTextFile(

        repository.repo,

        repository.database,

        JSON.stringify(
            jobs,
            null,
            2
        ) + "\n",

        repository.branch,

        message

    );


}



function createJobId() {

    return (

        "job-" +

        Date.now()

        + "-" +

        Math.random()
            .toString(36)
            .substring(2,8)

    );

}



async function createUploadJob(
    data = {}
) {


    const jobs =
        await readJobs();


    const job = {

        id:
            createJobId(),


        status:
            "queued",


        stage:
            "prepare",


        progress:
            0,


        total:
            Number(
                data.total || 0
            ),


        completed:
            0,


        failed:
            0,


        files:
            data.files || [],


        userId:
            data.userId || null,


        batchId:
            data.batchId || null,


        workflow:
            null,


        message:
            "Waiting",


        createdAt:
            new Date()
                .toISOString(),


        updatedAt:
            new Date()
                .toISOString(),


        finishedAt:
            null

    };


    jobs.push(
        job
    );


    await saveJobs(
        jobs,
        `Create upload job ${job.id}`
    );


    return job;

}



async function updateUploadJob(
    id,
    patch = {}
) {


    const jobs =
        await readJobs();


    const index =
        jobs.findIndex(
            item =>
                item.id === id
        );


    if (index === -1) {

        throw new Error(
            `Upload job not found: ${id}`
        );

    }


    jobs[index] = {

        ...jobs[index],

        ...patch,


        updatedAt:
            new Date()
                .toISOString()

    };


    await saveJobs(

        jobs,

        `Update upload job ${id}`

    );


    return jobs[index];

}



async function getUploadJob(
    id
) {

    const jobs =
        await readJobs();


    return (
        jobs.find(
            item =>
                item.id === id
        )
        || null
    );

}



async function listUploadJobs(
    userId = null
) {


    const jobs =
        await readJobs();


    if (!userId) {

        return jobs;

    }


    return jobs.filter(

        item =>

            item.userId === userId

    );

}



async function markUploadRunning(
    id,
    stage = "uploading"
) {


    return updateUploadJob(

        id,

        {

            status:
                "running",

            stage

        }

    );

}



async function markUploadCompleted(
    id
) {


    return updateUploadJob(

        id,

        {

            status:
                "completed",

            stage:
                "finished",

            progress:
                100,


            finishedAt:
                new Date()
                    .toISOString()

        }

    );

}



async function markUploadFailed(
    id,
    error
) {


    return updateUploadJob(

        id,

        {

            status:
                "failed",


            stage:
                "error",


            message:
                error || "Unknown error",


            finishedAt:
                new Date()
                    .toISOString()

        }

    );

}



module.exports = {


    createUploadJob,


    updateUploadJob,


    getUploadJob,


    listUploadJobs,


    markUploadRunning,


    markUploadCompleted,


    markUploadFailed


};
