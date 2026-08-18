const {
  loadConfig,
  saveConfig,
  getStorageOwner
} = require("./repository");

const {
  getRepositoryIndex
} = require("./storage-registry");

const {
  createRepository,
  repositoryExists,
  getRepositoryInfo,
  getRepositorySizeMB,
  getFile,
  upsertTextFile
} = require("./github");


const MEDIA_TYPES = new Set([
  "image",
  "audio",
  "video"
]);


function normalizeType(value) {

  const type =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !MEDIA_TYPES.has(
      type
    )
  ) {

    throw new Error(
      "Usage: node api/storage-switch-test.js <image|audio|video>"
    );

  }


  return type;

}


function getState(
  status,
  fallback = "standby"
) {

  const value =
    String(
      status &&
      (
        status.state ||
        status.status
      ) ||
      fallback
    )
      .toLowerCase();


  return [
    "active",
    "standby",
    "sealed"
  ].includes(
    value
  )

    ? value

    : fallback;

}


function getRepositoryList(
  config,
  type
) {

  config.storage =
    config.storage ||
    {};


  config.storage.repositories =
    config.storage.repositories ||
    {};


  if (
    !Array.isArray(
      config.storage.repositories[type]
    )
  ) {

    config.storage.repositories[type] =
      [];

  }


  return config.storage.repositories[type];

}


function getNextIndex(
  list
) {

  const highest =
    list.reduce(

      (
        value,
        repository
      ) =>
        Math.max(

          value,

          getRepositoryIndex(
            repository
          )

        ),

      0

    );


  return Math.max(
    2,
    highest + 1
  );

}


function getBucketSize(
  config
) {

  return Math.max(

    100,

    Number(
      config.storage.bucketSize ||
      1000
    )

  );

}


function buildDescriptor(
  config,
  type,
  index,
  fullName,
  branch,
  options = {}
) {

  const settings =
    config.mediaTypes[type];


  return {

    id:
      `${type}-${String(index)
        .padStart(
          2,
          "0"
        )}`,

    type,

    repo:
      fullName,

    owner:
      String(
        fullName
      )
        .split("/")[0],

    branch:
      branch ||
      "main",

    folder:
      settings.folder,

    database:
      settings.database,

    status:
      settings.status,

    marker:
      settings.marker,

    sizeMB:
      Number(
        options.sizeMB ||
        0
      ),

    fileCount:
      0,

    firstMediaId:
      null,

    lastMediaId:
      null,

    state:
      "standby",

    layout:
      "bucket-v1",

    bucketSize:
      getBucketSize(
        config
      ),

    createdAt:
      options.createdAt ||
      null,

    sealedAt:
      null,

    updatedAt:
      options.updatedAt ||
      null,

    health:
      "healthy"

  };

}


async function readJson(
  repo,
  filePath,
  branch
) {

  const file =
    await getFile(
      repo,
      filePath,
      branch
    );


  if (
    !file ||
    !file.content
  ) {

    return null;

  }


  return JSON.parse(
    file.content
  );

}


function assertMarker(
  marker,
  descriptor,
  config
) {

  if (

    !marker ||

    marker.system !==
      config.system ||

    marker.type !==
      descriptor.type ||

    marker.repositoryId !==
      descriptor.id ||

    marker.repository !==
      descriptor.repo ||

    marker.owner !==
      descriptor.owner ||

    marker.layout !==
      "bucket-v1" ||

    Number(
      marker.bucketSize
    ) !==
      Number(
        descriptor.bucketSize
      )

  ) {

    throw new Error(
      `Standby marker mismatch: ${descriptor.repo}`
    );

  }

}


async function ensureMarker(
  descriptor,
  config,
  allowCreate
) {

  let marker =
    await readJson(

      descriptor.repo,

      descriptor.marker,

      descriptor.branch

    );


  if (marker) {

    assertMarker(
      marker,
      descriptor,
      config
    );


    descriptor.createdAt =
      marker.createdAt ||
      descriptor.createdAt;


    return marker;

  }


  if (!allowCreate) {

    throw new Error(
      `Standby marker missing: ${descriptor.repo}`
    );

  }


  const createdAt =
    new Date()
      .toISOString();


  marker = {

    system:
      config.system,

    type:
      descriptor.type,

    repositoryId:
      descriptor.id,

    repository:
      descriptor.repo,

    owner:
      descriptor.owner,

    layout:
      descriptor.layout,

    bucketSize:
      descriptor.bucketSize,

    createdAt

  };


  await upsertTextFile(

    descriptor.repo,

    descriptor.marker,

    JSON.stringify(
      marker,
      null,
      2
    ) + "\n",

    descriptor.branch,

    "Initialize standby repository marker"

  );


  descriptor.createdAt =
    createdAt;


  return marker;

}


async function ensureDatabase(
  descriptor
) {

  const existing =
    await getFile(

      descriptor.repo,

      descriptor.database,

      descriptor.branch

    );


  if (!existing) {

    await upsertTextFile(

      descriptor.repo,

      descriptor.database,

      "[]\n",

      descriptor.branch,

      "Initialize standby media database"

    );


    return;

  }


  const parsed =
    JSON.parse(
      existing.content ||
      "[]"
    );


  if (
    !Array.isArray(
      parsed
    )
  ) {

    throw new Error(
      `Standby database is not an array: ${descriptor.repo}/${descriptor.database}`
    );

  }


  if (
    parsed.length !==
    0
  ) {

    throw new Error(
      `Standby repository already contains media records: ${descriptor.repo}`
    );

  }

}


async function ensureBucket(
  descriptor
) {

  const keepPath =
    `${descriptor.folder}/0000/.gitkeep`;


  const existing =
    await getFile(

      descriptor.repo,

      keepPath,

      descriptor.branch

    );


  if (!existing) {

    await upsertTextFile(

      descriptor.repo,

      keepPath,

      "\n",

      descriptor.branch,

      "Initialize standby media bucket"

    );

  }


  return keepPath;

}


async function ensureStatus(
  descriptor,
  config
) {

  const existing =
    await readJson(

      descriptor.repo,

      descriptor.status,

      descriptor.branch

    );


  if (existing) {

    const state =
      getState(
        existing,
        "standby"
      );


    if (
      state !==
      "standby"
    ) {

      throw new Error(
        `Standby repository has unexpected state ${state}: ${descriptor.repo}`
      );

    }

  }


  const usedMB =
    await getRepositorySizeMB(
      descriptor.repo
    );


  const status = {

    system:
      config.system,

    repository:
      descriptor.repo,

    id:
      descriptor.id,

    type:
      descriptor.type,

    usedMB:
      Number(
        Number(
          usedMB ||
          0
        ).toFixed(
          3
        )
      ),

    targetMB:
      config.storage
        .targetRepositorySizeMB,

    overflowToleranceMB:
      config.storage
        .overflowToleranceMB,

    status:
      "standby",

    state:
      "standby",

    layout:
      descriptor.layout,

    bucketSize:
      descriptor.bucketSize,

    fileCount:
      0,

    firstMediaId:
      null,

    lastMediaId:
      null,

    preparedAt:
      existing &&
      existing.preparedAt

        ? existing.preparedAt

        : new Date()
          .toISOString(),

    updatedAt:
      new Date()
        .toISOString()

  };


  await upsertTextFile(

    descriptor.repo,

    descriptor.status,

    JSON.stringify(
      status,
      null,
      2
    ) + "\n",

    descriptor.branch,

    "Prepare standby repository"

  );


  descriptor.sizeMB =
    status.usedMB;


  descriptor.updatedAt =
    status.updatedAt;


  return status;

}


function upsertMirror(
  config,
  type,
  descriptor
) {

  const list =
    getRepositoryList(
      config,
      type
    );


  const index =
    list.findIndex(

      repository =>
        repository.id ===
          descriptor.id ||

        repository.repo ===
          descriptor.repo

    );


  if (
    index >=
    0
  ) {

    list[index] = {
      ...list[index],
      ...descriptor
    };

  } else {

    list.push({
      ...descriptor
    });

  }


  list.sort(

    (
      a,
      b
    ) =>
      getRepositoryIndex(a) -
      getRepositoryIndex(b)

  );

}


function capacityDecision(
  config,
  usedMB,
  incomingSizeMB
) {

  const hardLimitMB =
    Number(
      config.storage
        .targetRepositorySizeMB
    ) +
    Number(
      config.storage
        .overflowToleranceMB
    );


  const predictedMB =
    Number(
      usedMB ||
      0
    ) +
    Number(
      incomingSizeMB ||
      0
    );


  return {

    hardLimitMB,

    predictedMB,

    shouldSwitch:
      predictedMB >
      hardLimitMB

  };

}


async function validatePreparedStandby(
  descriptor,
  config
) {

  const marker =
    await readJson(

      descriptor.repo,

      descriptor.marker,

      descriptor.branch

    );


  assertMarker(
    marker,
    descriptor,
    config
  );


  const status =
    await readJson(

      descriptor.repo,

      descriptor.status,

      descriptor.branch

    );


  if (
    getState(
      status,
      "invalid"
    ) !==
    "standby"
  ) {

    throw new Error(
      `Standby status validation failed: ${descriptor.repo}`
    );

  }


  const database =
    await readJson(

      descriptor.repo,

      descriptor.database,

      descriptor.branch

    );


  if (
    !Array.isArray(
      database
    ) ||
    database.length !==
    0
  ) {

    throw new Error(
      `Standby database validation failed: ${descriptor.repo}`
    );

  }


  const keepPath =
    `${descriptor.folder}/0000/.gitkeep`;


  const keep =
    await getFile(

      descriptor.repo,

      keepPath,

      descriptor.branch

    );


  if (!keep) {

    throw new Error(
      `Standby bucket validation failed: ${descriptor.repo}/${keepPath}`
    );

  }


  return {
    marker,
    status,
    keepPath
  };

}


async function prepareStandby(
  type
) {

  const config =
    loadConfig();


  const storageOwner =
    getStorageOwner(
      config
    );


  const activeBefore =
    config.storage
      .activeRepository[type];


  const list =
    getRepositoryList(
      config,
      type
    );


  let descriptor =
    list

      .filter(
        repository =>
          repository.state ===
          "standby"
      )

      .sort(
        (
          a,
          b
        ) =>
          getRepositoryIndex(a) -
          getRepositoryIndex(b)
      )[0] ||

    null;


  let created =
    false;


  if (!descriptor) {

    const nextIndex =
      getNextIndex(
        list
      );


    const name =
      config.mediaTypes[type]
        .repositoryPrefix +

      String(
        nextIndex
      ).padStart(
        2,
        "0"
      );


    const fullName =
      `${storageOwner}/${name}`;


    if (
      await repositoryExists(
        fullName
      )
    ) {

      const info =
        await getRepositoryInfo(
          fullName
        );


      if (
        info.description !==
        `Jingyan automatic ${type} storage`
      ) {

        throw new Error(
          `Reserved repository name is occupied by a non-system repository: ${fullName}`
        );

      }


      descriptor =
        buildDescriptor(

          config,

          type,

          nextIndex,

          fullName,

          info.default_branch ||
          "main"

        );

    } else {

      const result =
        await createRepository({

          expectedOwner:
            storageOwner,

          name,

          description:
            `Jingyan automatic ${type} storage`,

          privateRepo:
            Boolean(
              config.github.private
            )

        });


      descriptor =
        buildDescriptor(

          config,

          type,

          nextIndex,

          result.repo,

          result.defaultBranch ||
          "main"

        );


      created =
        true;

    }

  }


  if (
    descriptor.owner
      .toLowerCase() !==
    storageOwner
      .toLowerCase()
  ) {

    throw new Error(
      `Standby repository owner mismatch: ${descriptor.repo}`
    );

  }


  const info =
    await getRepositoryInfo(
      descriptor.repo
    );


  if (
    info.owner.login
      .toLowerCase() !==
    storageOwner
      .toLowerCase()
  ) {

    throw new Error(
      `Standby repository owner mismatch: ${descriptor.repo}`
    );

  }


  await ensureMarker(
    descriptor,
    config,
    true
  );


  await ensureDatabase(
    descriptor
  );


  const keepPath =
    await ensureBucket(
      descriptor
    );


  const status =
    await ensureStatus(
      descriptor,
      config
    );


  descriptor.state =
    "standby";


  descriptor.health =
    "healthy";


  descriptor.fileCount =
    0;


  descriptor.firstMediaId =
    null;


  descriptor.lastMediaId =
    null;


  descriptor.sealedAt =
    null;


  upsertMirror(
    config,
    type,
    descriptor
  );


  if (
    config.storage
      .activeRepository[type] !==
    activeBefore
  ) {

    throw new Error(
      `Active repository changed during standby preparation: ${activeBefore} -> ${config.storage.activeRepository[type]}`
    );

  }


  saveConfig(
    config
  );


  const reloaded =
    loadConfig();


  if (
    reloaded.storage
      .activeRepository[type] !==
    activeBefore
  ) {

    throw new Error(
      `Active repository changed after save: ${activeBefore} -> ${reloaded.storage.activeRepository[type]}`
    );

  }


  const registered =
    getRepositoryList(
      reloaded,
      type
    )
      .find(
        repository =>
          repository.id ===
          descriptor.id
      );


  if (

    !registered ||

    registered.state !==
      "standby" ||

    registered.layout !==
      "bucket-v1"

  ) {

    throw new Error(
      `Standby registry validation failed: ${descriptor.id}`
    );

  }


  await validatePreparedStandby(
    registered,
    reloaded
  );


  const active =
    getRepositoryList(
      reloaded,
      type
    )
      .find(
        repository =>
          repository.id ===
          activeBefore
      );


  if (!active) {

    throw new Error(
      `Active repository missing after standby preparation: ${activeBefore}`
    );

  }


  const simulatedIncomingMB =
    Number(
      reloaded.storage
        .targetRepositorySizeMB
    ) +
    Number(
      reloaded.storage
        .overflowToleranceMB
    ) +
    1;


  const decision =
    capacityDecision(

      reloaded,

      Number(
        active.sizeMB ||
        0
      ),

      simulatedIncomingMB

    );


  if (
    !decision.shouldSwitch
  ) {

    throw new Error(
      "Capacity switch simulation did not request a repository switch"
    );

  }


  console.log(

    JSON.stringify(
      {
        ok:
          true,

        type,

        created,

        activeRepository:
          activeBefore,

        activeState:
          active.state,

        standbyRepository:
          registered.id,

        standbyFullName:
          registered.repo,

        standbyState:
          registered.state,

        layout:
          registered.layout,

        bucketSize:
          registered.bucketSize,

        initializedBucket:
          keepPath,

        simulatedCapacityDecision:
          decision
      },
      null,
      2
    )

  );


  return {
    descriptor:
      registered,

    status,

    decision
  };

}


async function main() {

  const type =
    normalizeType(
      process.argv[2]
    );


  await prepareStandby(
    type
  );

}


if (
  require.main ===
  module
) {

  main()
    .catch(
      error => {

        console.error(
          "Storage switch preflight failed:"
        );

        console.error(
          error
        );

        process.exit(
          1
        );

      }
    );

}


module.exports = {
  prepareStandby,
  capacityDecision
};
