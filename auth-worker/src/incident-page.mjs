function htmlResponse(
  html
) {

  return new Response(
    html,
    {
      status:
        200,

      headers: {

        "Content-Type":
          "text/html; charset=utf-8",

        "Cache-Control":
          "no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        "Referrer-Policy":
          "same-origin"

      }
    }
  );

}


export function renderIncidentInboxPage() {

  return htmlResponse(
`<!DOCTYPE html>

<html lang="zh-CN">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<meta
  name="color-scheme"
  content="light">

<title>
反馈收件箱 · Jingyan Media Center
</title>


<link
  rel="stylesheet"
  href="/app-shell.css?v=20260819-shell-v1">


<script
  src="/app-shell.js?v=20260819-shell-v1"
  defer>
</script>


<style>

:root {

  --purple:
    #7851ea;

  --purple-dark:
    #352357;

  --purple-soft:
    #f1ebff;

  --ink:
    #2e214d;

  --text:
    #6d6380;

  --muted:
    #988fa8;

  --border:
    rgba(72, 49, 108, .10);

  --green:
    #329a74;

  --green-soft:
    #eaf8f2;

  --blue:
    #4c8fcc;

  --blue-soft:
    #edf6ff;

  --red:
    #c95864;

  --red-soft:
    #fff0f2;

  --orange:
    #a87624;

  --orange-soft:
    #fff6df;

  --card:
    rgba(255, 255, 255, .93);

}


* {
  box-sizing:
    border-box;
}


html {
  background:
    #f8f7fc;
}


body {

  margin:
    0;

  color:
    var(--ink);

  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;

  background:

    radial-gradient(
      circle at 9% 3%,
      rgba(132, 86, 247, .13),
      transparent 29%
    ),

    radial-gradient(
      circle at 93% 15%,
      rgba(92, 173, 224, .10),
      transparent 26%
    ),

    #f8f7fc;

}


button,
input,
select,
textarea {
  font:
    inherit;
}


button {
  -webkit-tap-highlight-color:
    transparent;
}


.incident-page {

  width:
    min(
      1160px,
      calc(100% - 48px)
    );

  margin:
    0 auto;

  padding:

    60px

    0

    max(
      100px,
      calc(
        env(safe-area-inset-bottom)
        + 60px
      )
    );

}


.hero {

  display:
    grid;

  grid-template-columns:
    minmax(0,1fr)
    auto;

  gap:
    32px;

  align-items:
    end;

  margin-bottom:
    35px;

}


.eyebrow {

  margin-bottom:
    15px;

  color:
    var(--purple);

  font-size:
    13px;

  font-weight:
    850;

  letter-spacing:
    .16em;

}


h1 {

  margin:
    0;

  font-size:
    clamp(
      45px,
      6vw,
      72px
    );

  line-height:
    .98;

  letter-spacing:
    -.055em;

}


.hero p {

  max-width:
    720px;

  margin:
    22px 0 0;

  color:
    var(--text);

  font-size:
    16px;

  line-height:
    1.8;

}


.hero-action {

  min-height:
    48px;

  padding:
    0 20px;

  display:
    inline-flex;

  align-items:
    center;

  justify-content:
    center;

  border:
    1px solid var(--border);

  border-radius:
    16px;

  color:
    var(--ink);

  background:
    rgba(255,255,255,.8);

  text-decoration:
    none;

  font-size:
    14px;

  font-weight:
    760;

}


.summary-grid {

  display:
    grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0,1fr)
    );

  gap:
    13px;

  margin-bottom:
    22px;

}


.summary-card {

  padding:
    22px;

  border:
    1px solid rgba(255,255,255,.9);

  border-radius:
    22px;

  background:
    var(--card);

  box-shadow:
    0 16px 45px rgba(55, 36, 85, .06);

}


.summary-card span {

  display:
    block;

  color:
    var(--muted);

  font-size:
    13px;

}


.summary-card strong {

  display:
    block;

  margin-top:
    8px;

  font-size:
    31px;

  letter-spacing:
    -.04em;

}


.workspace {

  overflow:
    hidden;

  border:
    1px solid rgba(255,255,255,.9);

  border-radius:
    28px;

  background:
    var(--card);

  box-shadow:
    0 22px 70px rgba(58, 40, 88, .09);

}


.toolbar {

  display:
    flex;

  align-items:
    center;

  gap:
    11px;

  padding:
    20px;

  border-bottom:
    1px solid var(--border);

}


.search {

  flex:
    1 1 300px;

  min-width:
    0;

  height:
    48px;

  padding:
    0 17px;

  border:
    1px solid var(--border);

  border-radius:
    15px;

  outline:
    none;

  color:
    var(--ink);

  background:
    #faf9fd;

}


.search:focus {

  border-color:
    rgba(120,81,234,.35);

  box-shadow:
    0 0 0 4px rgba(120,81,234,.07);

}


.filter {

  height:
    48px;

  padding:
    0 40px 0 14px;

  border:
    1px solid var(--border);

  border-radius:
    15px;

  outline:
    none;

  color:
    var(--ink);

  background:
    #faf9fd;

}


.refresh {

  min-width:
    48px;

  height:
    48px;

  padding:
    0 15px;

  border:
    0;

  border-radius:
    15px;

  color:
    var(--purple);

  background:
    var(--purple-soft);

  cursor:
    pointer;

  font-weight:
    760;

}


.status-tabs {

  display:
    flex;

  gap:
    8px;

  overflow-x:
    auto;

  padding:
    15px 20px;

  border-bottom:
    1px solid var(--border);

  scrollbar-width:
    none;

}


.status-tabs::-webkit-scrollbar {
  display:
    none;
}


.tab {

  flex:
    0 0 auto;

  min-height:
    38px;

  padding:
    0 15px;

  border:
    0;

  border-radius:
    12px;

  color:
    var(--text);

  background:
    transparent;

  cursor:
    pointer;

  font-size:
    13px;

  font-weight:
    740;

}


.tab.active {

  color:
    var(--purple);

  background:
    var(--purple-soft);

}


.list {

  padding:
    0 20px 20px;

}


.incident {

  width:
    100%;

  display:
    grid;

  grid-template-columns:
    minmax(0,1fr)
    auto;

  gap:
    18px;

  align-items:
    center;

  padding:
    21px 4px;

  border:
    0;

  border-bottom:
    1px solid var(--border);

  color:
    inherit;

  text-align:
    left;

  background:
    transparent;

  cursor:
    pointer;

}


.incident:last-child {
  border-bottom:
    0;
}


.incident:hover {

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(120,81,234,.035),
      transparent
    );

}


.incident-main {
  min-width:
    0;
}


.incident-top {

  display:
    flex;

  align-items:
    center;

  gap:
    8px;

  margin-bottom:
    8px;

}


.category {

  color:
    var(--purple);

  font-size:
    11px;

  font-weight:
    850;

  letter-spacing:
    .08em;

}


.incident-title {

  overflow:
    hidden;

  font-size:
    16px;

  font-weight:
    790;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;

}


.incident-meta {

  display:
    flex;

  flex-wrap:
    wrap;

  gap:
    6px 14px;

  margin-top:
    7px;

  color:
    var(--muted);

  font-size:
    12px;

}


.incident-side {

  display:
    flex;

  align-items:
    center;

  gap:
    7px;

}


.badge {

  min-height:
    27px;

  padding:
    0 9px;

  display:
    inline-flex;

  align-items:
    center;

  border-radius:
    999px;

  font-size:
    11px;

  font-weight:
    800;

}


.status-open {

  color:
    var(--purple);

  background:
    var(--purple-soft);

}


.status-investigating {

  color:
    var(--blue);

  background:
    var(--blue-soft);

}


.status-resolved {

  color:
    var(--green);

  background:
    var(--green-soft);

}


.status-muted {

  color:
    #756e80;

  background:
    #f0eef3;

}


.severity-low {

  color:
    #6f7784;

  background:
    #f1f3f5;

}


.severity-normal {

  color:
    var(--green);

  background:
    var(--green-soft);

}


.severity-high {

  color:
    var(--orange);

  background:
    var(--orange-soft);

}


.severity-critical {

  color:
    var(--red);

  background:
    var(--red-soft);

}


.empty {

  padding:
    60px 20px;

  color:
    var(--muted);

  text-align:
    center;

  font-size:
    14px;

}


.drawer-backdrop {

  position:
    fixed;

  inset:
    0;

  z-index:
    1200;

  visibility:
    hidden;

  background:
    rgba(38, 29, 53, .26);

  opacity:
    0;

  backdrop-filter:
    blur(9px);

  transition:
    .22s ease;

}


.drawer-backdrop.open {

  visibility:
    visible;

  opacity:
    1;

}


.drawer {

  position:
    fixed;

  top:
    0;

  right:
    0;

  bottom:
    0;

  z-index:
    1210;

  width:
    min(
      560px,
      92vw
    );

  overflow-y:
    auto;

  padding:
    26px;

  background:
    #fff;

  box-shadow:
    -25px 0 80px rgba(37, 25, 59, .14);

  transform:
    translateX(103%);

  transition:
    transform .25s ease;

}


.drawer.open {
  transform:
    translateX(0);
}


.drawer-head {

  display:
    flex;

  align-items:
    flex-start;

  justify-content:
    space-between;

  gap:
    18px;

  margin-bottom:
    28px;

}


.drawer-title {

  margin:
    7px 0 0;

  font-size:
    27px;

  line-height:
    1.18;

  letter-spacing:
    -.035em;

}


.close {

  width:
    42px;

  height:
    42px;

  flex:
    0 0 auto;

  border:
    0;

  border-radius:
    13px;

  color:
    var(--text);

  background:
    #f5f3f8;

  cursor:
    pointer;

  font-size:
    22px;

}


.drawer-meta {

  display:
    flex;

  flex-wrap:
    wrap;

  gap:
    8px;

  margin-bottom:
    24px;

}


.editor-grid {

  display:
    grid;

  grid-template-columns:
    1fr
    1fr;

  gap:
    12px;

}


.field {

  display:
    block;

  margin-bottom:
    17px;

}


.field > span {

  display:
    block;

  margin-bottom:
    8px;

  color:
    var(--text);

  font-size:
    12px;

  font-weight:
    750;

}


.field select,
.field textarea {

  width:
    100%;

  border:
    1px solid var(--border);

  border-radius:
    15px;

  outline:
    none;

  color:
    var(--ink);

  background:
    #faf9fc;

}


.field select {

  height:
    46px;

  padding:
    0 13px;

}


.field textarea {

  min-height:
    108px;

  padding:
    14px;

  resize:
    vertical;

  line-height:
    1.6;

}


.save {

  width:
    100%;

  min-height:
    49px;

  border:
    0;

  border-radius:
    15px;

  color:
    #fff;

  background:
    linear-gradient(
      135deg,
      #8b63f3,
      #6741df
    );

  cursor:
    pointer;

  font-weight:
    800;

}


.save:disabled {
  opacity:
    .55;
}


.report-section {

  margin-top:
    31px;

  padding-top:
    25px;

  border-top:
    1px solid var(--border);

}


.report-section h3 {

  margin:
    0 0 15px;

  font-size:
    19px;

}


.report-card {

  margin-bottom:
    11px;

  padding:
    15px;

  border:
    1px solid var(--border);

  border-radius:
    16px;

  background:
    #faf9fc;

}


.report-message {

  color:
    var(--ink);

  font-size:
    14px;

  line-height:
    1.65;

}


.report-time {

  margin-top:
    9px;

  color:
    var(--muted);

  font-size:
    11px;

}


.context {

  margin-top:
    11px;

  color:
    var(--text);

  font-size:
    11px;

  line-height:
    1.55;

}


.drawer-notice {

  display:
    none;

  margin-top:
    12px;

  padding:
    12px;

  border-radius:
    13px;

  color:
    var(--green);

  background:
    var(--green-soft);

  font-size:
    13px;

}


.drawer-notice.show {
  display:
    block;
}


@media (
  max-width:
  900px
) {

  .incident-page {

    width:
      calc(100% - 28px);

    padding-top:
      38px;

  }


  .hero {

    grid-template-columns:
      1fr;

    margin-bottom:
      28px;

  }


  .hero-action {
    display:
      none;
  }


  .summary-grid {

    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      );

  }


  .summary-card {

    padding:
      18px;

  }


  .toolbar {

    display:
      grid;

    grid-template-columns:
      minmax(0,1fr)
      auto;

  }


  .search {

    grid-column:
      1 / -1;

  }


  .filter {
    width:
      100%;
  }


  .incident {

    grid-template-columns:
      1fr;

    gap:
      11px;

  }


  .incident-side {

    justify-content:
      flex-start;

  }


  .drawer-backdrop {
    z-index:
      3000;
  }


  .drawer {

    top:
      auto;

    left:
      0;

    right:
      0;

    bottom:
      0;

    z-index:
      3010;

    width:
      100%;

    max-height:
      88vh;

    padding:
      24px 20px
      max(
        28px,
        calc(
          env(safe-area-inset-bottom)
          + 20px
        )
      );

    border-radius:
      28px 28px 0 0;

    transform:
      translateY(103%);

  }


  .drawer.open {
    transform:
      translateY(0);
  }

}


@media (
  max-width:
  520px
) {

  h1 {
    font-size:
      47px;
  }


  .editor-grid {
    grid-template-columns:
      1fr;
  }


  .toolbar {
    padding:
      16px;
  }


  .status-tabs {
    padding:
      13px 16px;
  }


  .list {
    padding:
      0 16px 16px;
  }

}

</style>

</head>


<body>


<main class="incident-page">


<section class="hero">

  <div>

    <div class="eyebrow">
      INCIDENT CENTER
    </div>

    <h1>
      反馈收件箱。
    </h1>

    <p>
      相同问题会自动聚类。
      这里处理问题，不把重复报告堆成无限列表。
    </p>

  </div>


  <a
    class="hero-action"
    href="/admin/">
    返回管理后台
  </a>

</section>


<section class="summary-grid">

  <article class="summary-card">

    <span>
      待处理
    </span>

    <strong id="countOpen">
      —
    </strong>

  </article>


  <article class="summary-card">

    <span>
      处理中
    </span>

    <strong id="countInvestigating">
      —
    </strong>

  </article>


  <article class="summary-card">

    <span>
      已解决
    </span>

    <strong id="countResolved">
      —
    </strong>

  </article>


  <article class="summary-card">

    <span>
      全部问题
    </span>

    <strong id="countAll">
      —
    </strong>

  </article>

</section>


<section class="workspace">


<div class="toolbar">

  <input
    class="search"
    id="search"
    type="search"
    autocomplete="off"
    placeholder="搜索标题、错误或 Fingerprint…">


  <select
    class="filter"
    id="categoryFilter">

    <option value="">
      全部类型
    </option>

    <option value="upload">
      上传
    </option>

    <option value="playback">
      播放
    </option>

    <option value="media">
      媒体
    </option>

    <option value="collection">
      图库 / 歌单
    </option>

    <option value="account">
      账户
    </option>

    <option value="ui">
      界面
    </option>

    <option value="other">
      其他
    </option>

  </select>


  <button
    class="refresh"
    id="refresh"
    type="button">
    刷新
  </button>

</div>


<div
  class="status-tabs"
  id="statusTabs">

  <button
    class="tab active"
    type="button"
    data-status="open">
    待处理
  </button>

  <button
    class="tab"
    type="button"
    data-status="investigating">
    处理中
  </button>

  <button
    class="tab"
    type="button"
    data-status="resolved">
    已解决
  </button>

  <button
    class="tab"
    type="button"
    data-status="muted">
    已归档
  </button>

  <button
    class="tab"
    type="button"
    data-status="">
    全部
  </button>

</div>


<div
  class="list"
  id="incidentList">

  <div class="empty">
    正在读取反馈…
  </div>

</div>


</section>


</main>


<div
  class="drawer-backdrop"
  id="drawerBackdrop">
</div>


<aside
  class="drawer"
  id="drawer"
  aria-hidden="true">


<div class="drawer-head">

  <div>

    <div class="eyebrow">
      INCIDENT
    </div>

    <h2
      class="drawer-title"
      id="drawerTitle">
      —
    </h2>

  </div>


  <button
    class="close"
    id="drawerClose"
    type="button"
    aria-label="关闭">
    ×
  </button>

</div>


<div
  class="drawer-meta"
  id="drawerMeta">
</div>


<div class="editor-grid">

  <label class="field">

    <span>
      状态
    </span>

    <select id="incidentStatus">

      <option value="open">
        待处理
      </option>

      <option value="investigating">
        处理中
      </option>

      <option value="resolved">
        已解决
      </option>

      <option value="muted">
        已归档
      </option>

    </select>

  </label>


  <label class="field">

    <span>
      严重程度
    </span>

    <select id="incidentSeverity">

      <option value="low">
        低
      </option>

      <option value="normal">
        普通
      </option>

      <option value="high">
        高
      </option>

      <option value="critical">
        严重
      </option>

    </select>

  </label>

</div>


<label class="field">

  <span>
    Owner 备注
  </span>

  <textarea
    id="ownerNote"
    maxlength="3000"
    placeholder="处理结论、原因或后续计划…"></textarea>

</label>


<button
  class="save"
  id="saveIncident"
  type="button">
  保存处理状态
</button>


<div
  class="drawer-notice"
  id="drawerNotice">
  已保存。
</div>


<section class="report-section">

  <h3>
    用户报告
  </h3>

  <div id="reportList">
  </div>

</section>


</aside>


<script>

(() => {

  "use strict";


  const state = {

    incidents:
      [],

    status:
      "open",

    category:
      "",

    query:
      "",

    selectedId:
      null,

    detail:
      null

  };


  const incidentList =
    document.getElementById(
      "incidentList"
    );


  const search =
    document.getElementById(
      "search"
    );


  const categoryFilter =
    document.getElementById(
      "categoryFilter"
    );


  const refresh =
    document.getElementById(
      "refresh"
    );


  const statusTabs =
    document.getElementById(
      "statusTabs"
    );


  const drawer =
    document.getElementById(
      "drawer"
    );


  const drawerBackdrop =
    document.getElementById(
      "drawerBackdrop"
    );


  const drawerClose =
    document.getElementById(
      "drawerClose"
    );


  const drawerTitle =
    document.getElementById(
      "drawerTitle"
    );


  const drawerMeta =
    document.getElementById(
      "drawerMeta"
    );


  const incidentStatus =
    document.getElementById(
      "incidentStatus"
    );


  const incidentSeverity =
    document.getElementById(
      "incidentSeverity"
    );


  const ownerNote =
    document.getElementById(
      "ownerNote"
    );


  const saveIncident =
    document.getElementById(
      "saveIncident"
    );


  const drawerNotice =
    document.getElementById(
      "drawerNotice"
    );


  const reportList =
    document.getElementById(
      "reportList"
    );


  function escapeHtml(
    value
  ) {

    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  function formatTime(
    seconds
  ) {

    if (!seconds) {
      return "—";
    }


    return new Date(
      Number(
        seconds
      ) * 1000
    ).toLocaleString(
      "zh-CN",
      {
        hour12:
          false
      }
    );

  }


  function categoryText(
    value
  ) {

    return {

      upload:
        "上传",

      playback:
        "播放",

      media:
        "媒体",

      collection:
        "图库 / 歌单",

      account:
        "账户",

      ui:
        "界面",

      other:
        "其他"

    }[value] ||
    value ||
    "其他";

  }


  function statusText(
    value
  ) {

    return {

      open:
        "待处理",

      investigating:
        "处理中",

      resolved:
        "已解决",

      muted:
        "已归档"

    }[value] ||
    value;

  }


  function severityText(
    value
  ) {

    return {

      low:
        "低",

      normal:
        "普通",

      high:
        "高",

      critical:
        "严重"

    }[value] ||
    value;

  }


  async function api(
    url,
    options
  ) {

    const response =
      await fetch(
        url,
        Object.assign(
          {
            credentials:
              "same-origin",

            cache:
              "no-store",

            headers: {
              Accept:
                "application/json"
            }
          },
          options ||
          {}
        )
      );


    const data =
      await response
        .json()
        .catch(
          function () {
            return {};
          }
        );


    if (!response.ok) {

      throw new Error(
        data.error ||
        "request_failed"
      );

    }


    return data;

  }


  function updateSummary() {

    const all =
      state.incidents;


    document.getElementById(
      "countOpen"
    ).textContent =
      String(
        all.filter(
          function (item) {
            return item.status ===
              "open";
          }
        ).length
      );


    document.getElementById(
      "countInvestigating"
    ).textContent =
      String(
        all.filter(
          function (item) {
            return item.status ===
              "investigating";
          }
        ).length
      );


    document.getElementById(
      "countResolved"
    ).textContent =
      String(
        all.filter(
          function (item) {
            return item.status ===
              "resolved";
          }
        ).length
      );


    document.getElementById(
      "countAll"
    ).textContent =
      String(
        all.length
      );

  }


  function filteredIncidents() {

    const query =
      state.query
        .trim()
        .toLowerCase();


    return state.incidents.filter(
      function (
        item
      ) {

        if (
          state.status &&
          item.status !==
            state.status
        ) {

          return false;

        }


        if (
          state.category &&
          item.category !==
            state.category
        ) {

          return false;

        }


        if (!query) {

          return true;

        }


        const haystack = [

          item.title,

          item.fingerprint,

          item.category,

          item.ownerNote

        ]
          .join(
            " "
          )
          .toLowerCase();


        return haystack.includes(
          query
        );

      }
    );

  }


  function renderList() {

    const rows =
      filteredIncidents();


    if (!rows.length) {

      incidentList.innerHTML =
        '<div class="empty">这里暂时没有问题。</div>';

      return;

    }


    incidentList.innerHTML =
      rows
        .map(
          function (
            item
          ) {

            return (

              '<button class="incident" type="button" data-id="' +
              escapeHtml(
                item.id
              ) +
              '">' +

                '<div class="incident-main">' +

                  '<div class="incident-top">' +

                    '<span class="category">' +
                    escapeHtml(
                      categoryText(
                        item.category
                      )
                    ) +
                    '</span>' +

                  '</div>' +

                  '<div class="incident-title">' +
                  escapeHtml(
                    item.title
                  ) +
                  '</div>' +

                  '<div class="incident-meta">' +

                    '<span>同类报告 ' +
                    Number(
                      item.reportCount ||
                      0
                    ) +
                    ' 次</span>' +

                    '<span>最近 ' +
                    escapeHtml(
                      formatTime(
                        item.lastSeenAt
                      )
                    ) +
                    '</span>' +

                  '</div>' +

                '</div>' +

                '<div class="incident-side">' +

                  '<span class="badge severity-' +
                  escapeHtml(
                    item.severity
                  ) +
                  '">' +
                  escapeHtml(
                    severityText(
                      item.severity
                    )
                  ) +
                  '</span>' +

                  '<span class="badge status-' +
                  escapeHtml(
                    item.status
                  ) +
                  '">' +
                  escapeHtml(
                    statusText(
                      item.status
                    )
                  ) +
                  '</span>' +

                '</div>' +

              '</button>'

            );

          }
        )
        .join("");


    Array
      .from(
        incidentList.querySelectorAll(
          ".incident"
        )
      )
      .forEach(
        function (
          button
        ) {

          button.addEventListener(
            "click",
            function () {

              openIncident(
                button.dataset.id
              );

            }
          );

        }
      );

  }


  async function loadIncidents() {

    refresh.disabled =
      true;


    incidentList.innerHTML =
      '<div class="empty">正在读取反馈…</div>';


    try {

      const data =
        await api(
          "/api/admin/incidents?limit=100"
        );


      state.incidents =
        Array.isArray(
          data.incidents
        )
          ? data.incidents
          : [];


      updateSummary();

      renderList();

    } catch (
      error
    ) {

      console.error(
        error
      );


      incidentList.innerHTML =
        '<div class="empty">反馈收件箱读取失败。</div>';

    } finally {

      refresh.disabled =
        false;

    }

  }


  function closeDrawer() {

    drawer.classList.remove(
      "open"
    );


    drawerBackdrop.classList.remove(
      "open"
    );


    drawer.setAttribute(
      "aria-hidden",
      "true"
    );


    state.selectedId =
      null;

  }


  function renderReports(
    reports
  ) {

    if (
      !Array.isArray(
        reports
      ) ||
      !reports.length
    ) {

      reportList.innerHTML =
        '<div class="empty">暂无报告。</div>';

      return;

    }


    reportList.innerHTML =
      reports
        .map(
          function (
            report
          ) {

            const path =
              report.pagePath ||
              report.apiPath ||
              "未记录页面";


            const technical = [];

            if (report.httpStatus) {

              technical.push(
                "HTTP " +
                report.httpStatus
              );

            }


            if (report.errorCode) {

              technical.push(
                report.errorCode
              );

            }


            const contextText =
              report.context &&
              Object.keys(
                report.context
              ).length

                ? JSON.stringify(
                    report.context
                  )

                : "";


            return (

              '<article class="report-card">' +

                '<div class="report-message">' +
                escapeHtml(
                  report.message ||
                  "没有补充描述。"
                ) +
                '</div>' +

                '<div class="report-time">' +
                escapeHtml(
                  report.reporterName ||
                  "用户"
                ) +
                ' · ' +
                escapeHtml(
                  formatTime(
                    report.createdAt
                  )
                ) +
                '</div>' +

                '<div class="context">' +

                  escapeHtml(
                    path
                  ) +

                  (
                    technical.length
                      ? ' · ' +
                        escapeHtml(
                          technical.join(
                            " · "
                          )
                        )
                      : ""
                  ) +

                  (
                    contextText
                      ? '<br>' +
                        escapeHtml(
                          contextText
                        )
                      : ""
                  ) +

                '</div>' +

              '</article>'

            );

          }
        )
        .join("");

  }


  async function openIncident(
    id
  ) {

    state.selectedId =
      id;


    drawer.classList.add(
      "open"
    );


    drawerBackdrop.classList.add(
      "open"
    );


    drawer.setAttribute(
      "aria-hidden",
      "false"
    );


    drawerTitle.textContent =
      "正在读取…";


    drawerMeta.innerHTML =
      "";


    reportList.innerHTML =
      '<div class="empty">正在读取报告…</div>';


    drawerNotice.classList.remove(
      "show"
    );


    try {

      const data =
        await api(
          "/api/admin/incidents/" +
          encodeURIComponent(
            id
          )
        );


      state.detail =
        data;


      const incident =
        data.incident;


      drawerTitle.textContent =
        incident.title;


      incidentStatus.value =
        incident.status;


      incidentSeverity.value =
        incident.severity;


      ownerNote.value =
        incident.ownerNote ||
        "";


      drawerMeta.innerHTML =

        '<span class="badge status-' +
        escapeHtml(
          incident.status
        ) +
        '">' +
        escapeHtml(
          statusText(
            incident.status
          )
        ) +
        '</span>' +

        '<span class="badge severity-' +
        escapeHtml(
          incident.severity
        ) +
        '">' +
        escapeHtml(
          severityText(
            incident.severity
          )
        ) +
        '</span>' +

        '<span class="badge">' +
        Number(
          incident.reportCount ||
          0
        ) +
        ' 次报告</span>';


      renderReports(
        data.reports
      );

    } catch (
      error
    ) {

      console.error(
        error
      );


      drawerTitle.textContent =
        "无法读取问题";


      reportList.innerHTML =
        '<div class="empty">详情读取失败。</div>';

    }

  }


  async function saveCurrent() {

    if (!state.selectedId) {

      return;

    }


    saveIncident.disabled =
      true;


    drawerNotice.classList.remove(
      "show"
    );


    try {

      await api(
        "/api/admin/incidents/" +
        encodeURIComponent(
          state.selectedId
        ),
        {

          method:
            "PATCH",

          headers: {

            Accept:
              "application/json",

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              status:
                incidentStatus.value,

              severity:
                incidentSeverity.value,

              ownerNote:
                ownerNote.value

            })

        }
      );


      drawerNotice.classList.add(
        "show"
      );


      await loadIncidents();


      if (
        state.selectedId
      ) {

        await openIncident(
          state.selectedId
        );

      }

    } catch (
      error
    ) {

      console.error(
        error
      );


      drawerNotice.textContent =
        "保存失败。";


      drawerNotice.classList.add(
        "show"
      );

    } finally {

      saveIncident.disabled =
        false;

    }

  }


  search.addEventListener(
    "input",
    function () {

      state.query =
        search.value;

      renderList();

    }
  );


  categoryFilter.addEventListener(
    "change",
    function () {

      state.category =
        categoryFilter.value;

      renderList();

    }
  );


  statusTabs.addEventListener(
    "click",
    function (
      event
    ) {

      const button =
        event.target.closest(
          ".tab"
        );


      if (!button) {

        return;

      }


      state.status =
        button.dataset.status ||
        "";


      Array
        .from(
          statusTabs.querySelectorAll(
            ".tab"
          )
        )
        .forEach(
          function (
            item
          ) {

            item.classList.toggle(
              "active",
              item ===
                button
            );

          }
        );


      renderList();

    }
  );


  refresh.addEventListener(
    "click",
    loadIncidents
  );


  drawerClose.addEventListener(
    "click",
    closeDrawer
  );


  drawerBackdrop.addEventListener(
    "click",
    closeDrawer
  );


  saveIncident.addEventListener(
    "click",
    saveCurrent
  );


  document.addEventListener(
    "keydown",
    function (
      event
    ) {

      if (
        event.key ===
        "Escape"
      ) {

        closeDrawer();

      }

    }
  );


  loadIncidents();

})();

</script>


</body>

</html>`
  );

}
