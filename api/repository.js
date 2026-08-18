const fs = require("fs");

const {
  createRepository,
  repositoryExists,
  getRepositorySizeMB,
  getDirectorySizeMB,
  getFile,
  upsertTextFile,
  assertRepositoryOwner
} = require("./github");

const {
  loadRegistry,
  saveRegistry,
  getRepositoryIndex,
  summarizeRecords
} = require("./storage-registry");

const CONFIG_FILE = "config.json";
const MEDIA_TYPES = ["image", "audio", "video"];

function readConfigFile() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function getRepositoryOwner(repository) {
  return repository.owner || String(repository.repo || "").split("/")[0] || null;
}

function getControlOwner(config) {
  return config.github.controlOwner || config.github.owner;
}

function getStorageOwner(config) {
  return config.github.storageOwner || "jingyan-media-storage";
}

function getMediaSettings(config, type) {
  const settings = config.mediaTypes[type];

  if (!settings) {
    throw new Error(`Invalid media type: ${type}`);
  }

  return settings;
}

function createEmptyRepositoryGroups() {
  return {
    image: [],
    audio: [],
    video: []
  };
}

function hydrateConfigFromRegistry(config) {
  const registry = loadRegistry(config);

  if (!registry.repositories || registry.repositories.length === 0) {
    return config;
  }

  const groups = createEmptyRepositoryGroups();

  for (const repository of registry.repositories) {
    if (!repository || !MEDIA_TYPES.includes(repository.type)) {
      continue;
    }

    groups[repository.type].push({
      ...repository
    });
  }

  for (const type of MEDIA_TYPES) {
    groups[type].sort(
      (a, b) =>
        getRepositoryIndex(a) -
        getRepositoryIndex(b)
    );
  }

  config.storage = config.storage || {};
  config.storage.repositories = groups;

  return config;
}

function loadConfig() {
  return hydrateConfigFromRegistry(
    readConfigFile()
  );
}

function buildRegistryFromConfig(config) {
  const existing = loadRegistry(config);
  const repositories = [];

  for (const type of MEDIA_TYPES) {
    const list =
      config.storage &&
      config.storage.repositories &&
      Array.isArray(
        config.storage.repositories[type]
      )
        ? config.storage.repositories[type]
        : [];

    for (const repository of list) {
      repositories.push({
        ...repository,
        type,
        owner: getRepositoryOwner(repository)
      });
    }
  }

  return {
    ...existing,
    version: existing.version || 1,
    system: config.system,
    repositories
  };
}

function saveConfig(config) {
  saveRegistry(
    buildRegistryFromConfig(config),
    config
  );

  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(
      config,
      null,
      2
    ) + "\n"
  );
}

function getHighestRepositoryIndex(list) {
  return (
    Array.isArray(list)
      ? list
      : []
  ).reduce(
    (highest, repository) =>
      Math.max(
        highest,
        getRepositoryIndex(repository)
      ),
    0
  );
}

function getNewRepositoryLayout(config) {
  return (
    config.storage.newRepositoryLayout ||
    "bucket-v1"
  );
}

function getBucketSize(config) {
  return Math.max(
    100,
    Number(
      config.storage.bucketSize ||
      1000
    )
  );
}

function buildRepositoryDescriptor(
  config,
  type,
  index,
  fullName,
  branch = "main",
  options = {}
) {
  const settings =
    getMediaSettings(
      config,
      type
    );

  const owner =
    String(
      fullName ||
      ""
    ).split("/")[0];

  const isNewStorage =
    owner.toLowerCase() ===
    getStorageOwner(config)
      .toLowerCase();

  return {
    id:
      `${type}-${String(index)
        .padStart(2, "0")}`,

    type,

    repo:
      fullName,

    owner,

    branch,

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
      Number(
        options.fileCount ||
        0
      ),

    firstMediaId:
      options.firstMediaId ||
      null,

    lastMediaId:
      options.lastMediaId ||
      null,

    state:
      options.state ||
      "active",

    layout:
      options.layout ||
      (
        isNewStorage
          ? getNewRepositoryLayout(config)
          : "legacy-flat"
      ),

    bucketSize:
      options.bucketSize !== undefined
        ? options.bucketSize
        : (
          isNewStorage
            ? getBucketSize(config)
            : null
        ),

    createdAt:
      options.createdAt ||
      null,

    sealedAt:
      options.sealedAt ||
      null,

    updatedAt:
      options.updatedAt ||
      null,

    health:
      options.health ||
      "unknown"
  };
}

async function readJsonFile(
  repo,
  filePath,
  branch = "main"
) {
  const result =
    await getFile(
      repo,
      filePath,
      branch
    );

  if (
    !result ||
    !result.content
  ) {
    return null;
  }

  try {
    return JSON.parse(
      result.content
    );
  } catch {
    return null;
  }
}

async function readRepositoryStatus(repository) {
  return readJsonFile(
    repository.repo,
    repository.status,
    repository.branch
  );
}

async function readRepositoryMarker(repository) {
  return readJsonFile(
    repository.repo,
    repository.marker,
    repository.branch
  );
}

async function readRepositoryDatabase(repository) {
  const result =
    await getFile(
      repository.repo,
      repository.database,
      repository.branch
    );

  if (
    !result ||
    !result.content
  ) {
    return [];
  }

  const parsed =
    JSON.parse(
      result.content
    );

  if (
    !Array.isArray(parsed)
  ) {
    throw new Error(
      `Database must be an array: ${repository.repo}/${repository.database}`
    );
  }

  return parsed;
}

function normalizeState(
  value,
  fallback = "active"
) {
  const state =
    String(
      value ||
      ""
    ).toLowerCase();

  return [
    "active",
    "standby",
    "sealed"
  ].includes(state)
    ? state
    : fallback;
}

function getStatusState(
  status,
  fallback = "active"
) {
  if (!status) {
    return fallback;
  }

  return normalizeState(
    status.state ||
    status.status,
    fallback
  );
}

function assertMarkerMatches(
  marker,
  repository,
  type,
  config
) {
  if (
    !marker ||
    marker.system !== config.system ||
    marker.type !== type ||
    marker.repositoryId !== repository.id ||
    marker.repository !== repository.repo
  ) {
    throw new Error(
      `Repository marker mismatch: ${repository.repo}`
    );
  }

  return true;
}

async function writeRepositoryStatus(
  repository,
  type,
  usedMB,
  config,
  state = "active",
  extra = {}
) {
  const normalizedState =
    normalizeState(
      state,
      "active"
    );

  const status = {
    system:
      config.system,

    repository:
      repository.repo,

    id:
      repository.id,

    type,

    usedMB:
      Number(
        Number(
          usedMB ||
          0
        ).toFixed(3)
      ),

    targetMB:
      config.storage
        .targetRepositorySizeMB,

    overflowToleranceMB:
      config.storage
        .overflowToleranceMB,

    status:
      normalizedState,

    state:
      normalizedState,

    layout:
      repository.layout ||
      "legacy-flat",

    bucketSize:
      repository.bucketSize ||
      null,

    updatedAt:
      new Date()
        .toISOString(),

    ...extra
  };

  await upsertTextFile(
    repository.repo,
    repository.status,
    JSON.stringify(
      status,
      null,
      2
    ) + "\n",
    repository.branch,
    "Update repository status"
  );

  return status;
}

async function ensureRepositoryInitialized(
  repository,
  type,
  config,
  options = {}
) {
  const settings =
    getMediaSettings(
      config,
      type
    );

  repository.type =
    type;

  repository.owner =
    getRepositoryOwner(repository);

  repository.folder =
    repository.folder ||
    settings.folder;

  repository.database =
    repository.database ||
    settings.database;

  repository.status =
    repository.status ||
    settings.status;

  repository.marker =
    repository.marker ||
    settings.marker;

  repository.branch =
    repository.branch ||
    "main";

  if (!repository.layout) {
    repository.layout =
      repository.owner.toLowerCase() ===
      getStorageOwner(config).toLowerCase()
        ? getNewRepositoryLayout(config)
        : "legacy-flat";
  }

  repository.bucketSize =
    repository.layout === "bucket-v1"
      ? Number(
        repository.bucketSize ||
        getBucketSize(config)
      )
      : null;

  const marker =
    await readRepositoryMarker(
      repository
    );

  if (marker) {
    assertMarkerMatches(
      marker,
      repository,
      type,
      config
    );

    repository.createdAt =
      repository.createdAt ||
      marker.createdAt ||
      null;

    repository.layout =
      marker.layout ||
      repository.layout;

    repository.bucketSize =
      marker.bucketSize ||
      repository.bucketSize;

  } else {
    const info =
      await assertRepositoryOwner(
        repository.repo,
        repository.owner
      );

    if (
      options.trustedRegistered !== true &&
      info.description !==
      `Jingyan automatic ${type} storage`
    ) {
      throw new Error(
        `Unregistered repository cannot be adopted: ${repository.repo}`
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    await upsertTextFile(
      repository.repo,
      repository.marker,
      JSON.stringify(
        {
          system:
            config.system,

          type,

          repositoryId:
            repository.id,

          repository:
            repository.repo,

          owner:
            repository.owner,

          layout:
            repository.layout,

          bucketSize:
            repository.bucketSize ||
            null,

          createdAt
        },
        null,
        2
      ) + "\n",
      repository.branch,
      "Initialize repository marker"
    );

    repository.createdAt =
      repository.createdAt ||
      createdAt;
  }

  const keepPath =
    repository.layout ===
    "bucket-v1"
      ? `${repository.folder}/0000/.gitkeep`
      : `${repository.folder}/.gitkeep`;

  if (
    !await getFile(
      repository.repo,
      keepPath,
      repository.branch
    )
  ) {
    await upsertTextFile(
      repository.repo,
      keepPath,
      "\n",
      repository.branch,
      "Initialize media folder"
    );
  }

  if (
    !await getFile(
      repository.repo,
      repository.database,
      repository.branch
    )
  ) {
    await upsertTextFile(
      repository.repo,
      repository.database,
      "[]\n",
      repository.branch,
      "Initialize media database"
    );
  }

  if (
    !await getFile(
      repository.repo,
      repository.status,
      repository.branch
    )
  ) {
    const defaultState =
      normalizeState(
        options.defaultState,
        "active"
      );

    const extra = {};

    if (
      defaultState ===
      "sealed"
    ) {
      extra.sealedAt =
        new Date()
          .toISOString();

      extra.reason =
        "recovered-from-registry";
    }

    await writeRepositoryStatus(
      repository,
      type,
      0,
      config,
      defaultState,
      extra
    );
  }

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

  return repository;
}

async function inspectAdoptableRepository(
  fullName,
  type,
  index,
  config
) {
  const owner =
    String(
      fullName
    ).split("/")[0];

  const info =
    await assertRepositoryOwner(
      fullName,
      owner
    );

  const repository =
    buildRepositoryDescriptor(
      config,
      type,
      index,
      fullName,
      info.default_branch ||
      "main"
    );

  const marker =
    await readRepositoryMarker(
      repository
    );

  if (marker) {
    assertMarkerMatches(
      marker,
      repository,
      type,
      config
    );

    repository.layout =
      marker.layout ||
      repository.layout;

    repository.bucketSize =
      marker.bucketSize ||
      repository.bucketSize;

    repository.createdAt =
      marker.createdAt ||
      repository.createdAt;

    return repository;
  }

  if (
    info.description !==
    `Jingyan automatic ${type} storage`
  ) {
    throw new Error(
      `Reserved repository name is occupied by a non-system repository: ${fullName}`
    );
  }

  return repository;
}

function ensureRepositoryList(
  config,
  type
) {
  config.storage =
    config.storage ||
    {};

  if (
    !config.storage.repositories
  ) {
    config.storage.repositories =
      createEmptyRepositoryGroups();
  }

  if (
    !Array.isArray(
      config.storage
        .repositories[type]
    )
  ) {
    config.storage
      .repositories[type] = [];
  }

  return config.storage
    .repositories[type];
}

function registerRepository(
  config,
  type,
  repository
) {
  const list =
    ensureRepositoryList(
      config,
      type
    );

  const existing =
    list.find(
      item =>
        item.repo ===
        repository.repo ||
        item.id ===
        repository.id
    );

  if (existing) {
    Object.assign(
      existing,
      repository
    );

    return existing;
  }

  list.push(
    repository
  );

  list.sort(
    (a, b) =>
      getRepositoryIndex(a) -
      getRepositoryIndex(b)
  );

  return repository;
}

async function refreshRepositorySize(repository) {
  let repositorySize =
    0;

  try {
    repositorySize =
      await getRepositorySizeMB(
        repository.repo
      );
  } catch (error) {
    console.warn(
      `Repository size API warning for ${repository.repo}: ${error.message}`
    );
  }

  const mediaFolderSize =
    await getDirectorySizeMB(
      repository.repo,
      repository.folder,
      repository.branch
    );

  return Math.max(
    Number(
      repositorySize ||
      0
    ),
    Number(
      mediaFolderSize ||
      0
    )
  );
}

async function refreshRepositoryMetadata(repository) {
  const usedMB =
    await refreshRepositorySize(
      repository
    );

  const records =
    await readRepositoryDatabase(
      repository
    );

  const summary =
    summarizeRecords(
      records
    );

  return {
    usedMB,
    ...summary
  };
}

async function sealRepository(
  repository,
  type,
  config,
  usedMB,
  reason = "capacity"
) {
  const currentStatus =
    await readRepositoryStatus(
      repository
    );

  const sealedAt =
    (
      currentStatus &&
      currentStatus.sealedAt
    ) ||
    repository.sealedAt ||
    new Date()
      .toISOString();

  await writeRepositoryStatus(
    repository,
    type,
    usedMB,
    config,
    "sealed",
    {
      sealedAt,

      reason:
        (
          currentStatus &&
          currentStatus.reason
        ) ||
        reason
    }
  );

  repository.state =
    "sealed";

  repository.sizeMB =
    Number(
      Number(
        usedMB
      ).toFixed(3)
    );

  repository.sealedAt =
    sealedAt;

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

  saveConfig(
    config
  );
}

async function promoteStandbyRepository(
  repository,
  type,
  config
) {
  const metadata =
    await refreshRepositoryMetadata(
      repository
    );

  await writeRepositoryStatus(
    repository,
    type,
    metadata.usedMB,
    config,
    "active",
    {
      activatedAt:
        new Date()
          .toISOString()
    }
  );

  repository.state =
    "active";

  repository.sizeMB =
    Number(
      metadata.usedMB
        .toFixed(3)
    );

  repository.fileCount =
    metadata.fileCount;

  repository.firstMediaId =
    metadata.firstMediaId;

  repository.lastMediaId =
    metadata.lastMediaId;

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

  config.storage
    .activeRepository[type] =
    repository.id;

  saveConfig(
    config
  );

  return repository;
}

async function reconcileRepositories(type) {
  const config =
    loadConfig();

  const list =
    ensureRepositoryList(
      config,
      type
    );

  list.sort(
    (a, b) =>
      getRepositoryIndex(a) -
      getRepositoryIndex(b)
  );

  let changed =
    false;

  const configuredActive =
    list.find(
      repository =>
        repository.id ===
        config.storage
          .activeRepository[type]
    );

  const configuredActiveIndex =
    configuredActive
      ? getRepositoryIndex(
        configuredActive
      )
      : 0;

  for (
    const repository
    of list
  ) {
    const index =
      getRepositoryIndex(
        repository
      );

    const defaultState =
      repository.state ===
      "sealed" ||
      (
        configuredActiveIndex >
        0 &&
        index <
        configuredActiveIndex
      )
        ? "sealed"
        : (
          repository.state ||
          "active"
        );

    await ensureRepositoryInitialized(
      repository,
      type,
      config,
      {
        trustedRegistered:
          true,

        defaultState
      }
    );

    const status =
      await readRepositoryStatus(
        repository
      );

    const remoteState =
      getStatusState(
        status,
        defaultState
      );

    if (
      repository.state !==
      remoteState
    ) {
      repository.state =
        remoteState;

      changed =
        true;
    }

    if (
      status &&
      status.sealedAt &&
      repository.sealedAt !==
      status.sealedAt
    ) {
      repository.sealedAt =
        status.sealedAt;

      changed =
        true;
    }
  }

  let nextIndex =
    getHighestRepositoryIndex(
      list
    ) + 1;

  const storageOwner =
    getStorageOwner(
      config
    );

  while (true) {
    const settings =
      getMediaSettings(
        config,
        type
      );

    const name =
      settings.repositoryPrefix +
      String(
        nextIndex
      ).padStart(
        2,
        "0"
      );

    const fullName =
      `${storageOwner}/${name}`;

    if (
      !await repositoryExists(
        fullName
      )
    ) {
      break;
    }

    const repository =
      await inspectAdoptableRepository(
        fullName,
        type,
        nextIndex,
        config
      );

    await ensureRepositoryInitialized(
      repository,
      type,
      config,
      {
        trustedRegistered:
          false,

        defaultState:
          "standby"
      }
    );

    const status =
      await readRepositoryStatus(
        repository
      );

    repository.state =
      getStatusState(
        status,
        "standby"
      );

    registerRepository(
      config,
      type,
      repository
    );

    changed =
      true;

    nextIndex++;
  }

  const currentList =
    ensureRepositoryList(
      config,
      type
    ).sort(
      (a, b) =>
        getRepositoryIndex(a) -
        getRepositoryIndex(b)
    );

  let active =
    currentList.find(
      repository =>
        repository.id ===
        config.storage
          .activeRepository[type] &&
        repository.state ===
        "active"
    );

  if (!active) {
    const activeCandidates =
      currentList.filter(
        repository =>
          repository.state ===
          "active"
      );

    active =
      activeCandidates[
        activeCandidates.length -
        1
      ] ||
      null;
  }

  if (!active) {
    const standby =
      currentList.find(
        repository =>
          repository.state ===
          "standby"
      );

    if (standby) {
      active =
        await promoteStandbyRepository(
          standby,
          type,
          config
        );

      changed =
        true;
    }
  }

  if (!active) {
    const nonSealed =
      currentList.filter(
        repository =>
          repository.state !==
          "sealed"
      );

    active =
      nonSealed[
        nonSealed.length -
        1
      ] ||
      null;

    if (active) {
      active.state =
        "active";

      config.storage
        .activeRepository[type] =
        active.id;

      changed =
        true;
    }
  }

  if (active) {
    config.storage
      .activeRepository[type] =
      active.id;

    const selectedIndex =
      getRepositoryIndex(
        active
      );

    for (
      const repository
      of currentList
    ) {
      const index =
        getRepositoryIndex(
          repository
        );

      if (
        index >=
        selectedIndex ||
        repository.state ===
        "sealed"
      ) {
        continue;
      }

      const metadata =
        await refreshRepositoryMetadata(
          repository
        );

      const status =
        await readRepositoryStatus(
          repository
        );

      const sealedAt =
        (
          status &&
          status.sealedAt
        ) ||
        repository.sealedAt ||
        new Date()
          .toISOString();

      await writeRepositoryStatus(
        repository,
        type,
        metadata.usedMB,
        config,
        "sealed",
        {
          sealedAt,

          reason:
            (
              status &&
              status.reason
            ) ||
            "superseded-by-newer-repository"
        }
      );

      repository.state =
        "sealed";

      repository.sizeMB =
        Number(
          metadata.usedMB
            .toFixed(3)
        );

      repository.fileCount =
        metadata.fileCount;

      repository.firstMediaId =
        metadata.firstMediaId;

      repository.lastMediaId =
        metadata.lastMediaId;

      repository.sealedAt =
        sealedAt;

      repository.health =
        "healthy";

      repository.updatedAt =
        new Date()
          .toISOString();

      changed =
        true;
    }
  }

  if (changed) {
    saveConfig(
      config
    );
  }

  return config;
}

async function findNextRepositorySlot(
  type,
  config
) {
  const list =
    ensureRepositoryList(
      config,
      type
    );

  const settings =
    getMediaSettings(
      config,
      type
    );

  const index =
    Math.max(
      2,
      getHighestRepositoryIndex(
        list
      ) + 1
    );

  const name =
    settings.repositoryPrefix +
    String(
      index
    ).padStart(
      2,
      "0"
    );

  const owner =
    getStorageOwner(
      config
    );

  const fullName =
    `${owner}/${name}`;

  if (
    !await repositoryExists(
      fullName
    )
  ) {
    return {
      index,
      name,
      owner,
      fullName,
      exists:
        false,

      repository:
        null
    };
  }

  const repository =
    await inspectAdoptableRepository(
      fullName,
      type,
      index,
      config
    );

  return {
    index,
    name,
    owner,
    fullName,
    exists:
      true,

    repository
  };
}

async function createNewRepository(
  type,
  providedConfig = null
) {
  const config =
    providedConfig ||
    await reconcileRepositories(
      type
    );

  const list =
    ensureRepositoryList(
      config,
      type
    );

  const standby =
    list
      .filter(
        repository =>
          repository.state ===
          "standby"
      )
      .sort(
        (a, b) =>
          getRepositoryIndex(a) -
          getRepositoryIndex(b)
      )[0];

  if (standby) {
    console.log(
      `Activating standby repository: ${standby.repo}`
    );

    return promoteStandbyRepository(
      standby,
      type,
      config
    );
  }

  const slot =
    await findNextRepositorySlot(
      type,
      config
    );

  let repository;

  if (slot.exists) {
    repository =
      slot.repository;

    console.log(
      `Recovering repository: ${slot.fullName}`
    );

  } else {
    if (
      !config.github
        .autoCreateRepository
    ) {
      throw new Error(
        `Automatic repository creation disabled for ${type}`
      );
    }

    const result =
      await createRepository({
        expectedOwner:
          slot.owner,

        name:
          slot.name,

        description:
          `Jingyan automatic ${type} storage`,

        privateRepo:
          Boolean(
            config.github.private
          )
      });

    repository =
      buildRepositoryDescriptor(
        config,
        type,
        slot.index,
        result.repo,
        result.defaultBranch,
        {
          state:
            "active",

          layout:
            getNewRepositoryLayout(
              config
            ),

          bucketSize:
            getBucketSize(
              config
            )
        }
      );
  }

  await ensureRepositoryInitialized(
    repository,
    type,
    config,
    {
      trustedRegistered:
        false,

      defaultState:
        "active"
    }
  );

  const metadata =
    await refreshRepositoryMetadata(
      repository
    );

  await writeRepositoryStatus(
    repository,
    type,
    metadata.usedMB,
    config,
    "active",
    {
      activatedAt:
        new Date()
          .toISOString()
    }
  );

  repository.state =
    "active";

  repository.sizeMB =
    Number(
      metadata.usedMB
        .toFixed(3)
    );

  repository.fileCount =
    metadata.fileCount;

  repository.firstMediaId =
    metadata.firstMediaId;

  repository.lastMediaId =
    metadata.lastMediaId;

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

  registerRepository(
    config,
    type,
    repository
  );

  config.storage
    .activeRepository[type] =
    repository.id;

  saveConfig(
    config
  );

  console.log(
    `Repository ready: ${repository.repo}`
  );

  return repository;
}

async function selectRepository(
  type,
  incomingSizeMB
) {
  let config =
    await reconcileRepositories(
      type
    );

  const list =
    ensureRepositoryList(
      config,
      type
    );

  if (
    list.length ===
    0
  ) {
    return createNewRepository(
      type,
      config
    );
  }

  let repository =
    list.find(
      item =>
        item.id ===
        config.storage
          .activeRepository[type]
    );

  if (!repository) {
    throw new Error(
      `Active repository missing for ${type}`
    );
  }

  const remoteStatus =
    await readRepositoryStatus(
      repository
    );

  const state =
    getStatusState(
      remoteStatus,
      repository.state ||
      "active"
    );

  if (
    state ===
    "sealed"
  ) {
    return createNewRepository(
      type,
      config
    );
  }

  if (
    state ===
    "standby"
  ) {
    repository =
      await promoteStandbyRepository(
        repository,
        type,
        config
      );

    config =
      loadConfig();
  }

  const metadata =
    await refreshRepositoryMetadata(
      repository
    );

  repository.sizeMB =
    Number(
      metadata.usedMB
        .toFixed(3)
    );

  repository.fileCount =
    metadata.fileCount;

  repository.firstMediaId =
    metadata.firstMediaId;

  repository.lastMediaId =
    metadata.lastMediaId;

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

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
    metadata.usedMB +
    Number(
      incomingSizeMB ||
      0
    );

  if (
    predictedMB <=
    hardLimitMB
  ) {
    repository.state =
      "active";

    saveConfig(
      config
    );

    return repository;
  }

  if (
    !config.storage
      .autoSwitchRepository
  ) {
    throw new Error(
      `Repository capacity reached for ${type}: ${repository.repo}`
    );
  }

  await sealRepository(
    repository,
    type,
    config,
    metadata.usedMB,
    "next-file-would-exceed-limit"
  );

  config =
    loadConfig();

  return createNewRepository(
    type,
    config
  );
}

async function syncRepositoryStatus(
  type,
  repositoryId
) {
  const config =
    loadConfig();

  const list =
    ensureRepositoryList(
      config,
      type
    );

  const repository =
    list.find(
      item =>
        item.id ===
        repositoryId
    );

  if (!repository) {
    throw new Error(
      `Repository not found: ${repositoryId}`
    );
  }

  const metadata =
    await refreshRepositoryMetadata(
      repository
    );

  const currentStatus =
    await readRepositoryStatus(
      repository
    );

  const state =
    getStatusState(
      currentStatus,
      repository.state ||
      "active"
    );

  const extra = {
    fileCount:
      metadata.fileCount,

    firstMediaId:
      metadata.firstMediaId,

    lastMediaId:
      metadata.lastMediaId
  };

  if (
    state ===
    "sealed"
  ) {
    extra.sealedAt =
      (
        currentStatus &&
        currentStatus.sealedAt
      ) ||
      repository.sealedAt ||
      new Date()
        .toISOString();

    extra.reason =
      (
        currentStatus &&
        currentStatus.reason
      ) ||
      "sealed";
  }

  await writeRepositoryStatus(
    repository,
    type,
    metadata.usedMB,
    config,
    state,
    extra
  );

  repository.sizeMB =
    Number(
      metadata.usedMB
        .toFixed(3)
    );

  repository.fileCount =
    metadata.fileCount;

  repository.firstMediaId =
    metadata.firstMediaId;

  repository.lastMediaId =
    metadata.lastMediaId;

  repository.state =
    state;

  repository.sealedAt =
    state ===
    "sealed"
      ? extra.sealedAt
      : null;

  repository.health =
    "healthy";

  repository.updatedAt =
    new Date()
      .toISOString();

  saveConfig(
    config
  );

  return repository;
}

async function updateRepositoryAfterUpload(
  type,
  repositoryId
) {
  return syncRepositoryStatus(
    type,
    repositoryId
  );
}

module.exports = {
  loadConfig,
  saveConfig,
  reconcileRepositories,
  selectRepository,
  createNewRepository,
  updateRepositoryAfterUpload,
  syncRepositoryStatus,
  readRepositoryStatus,
  getControlOwner,
  getStorageOwner
};
