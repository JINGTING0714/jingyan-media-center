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


export function renderFeedbackPage() {

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
反馈问题 · Jingyan Media Center
</title>

<style>

:root {

  --purple:
    #7550ea;

  --purple-2:
    #8d68f3;

  --purple-soft:
    #f2edff;

  --purple-soft-2:
    #faf8ff;

  --ink:
    #2d214e;

  --text:
    #655a7a;

  --muted:
    #958ba8;

  --border:
    rgba(79, 54, 123, .11);

  --green:
    #35a77c;

  --green-soft:
    #eaf8f2;

  --blue:
    #568fd4;

  --blue-soft:
    #edf6ff;

  --red:
    #d6606b;

  --red-soft:
    #fff0f2;

  --white:
    rgba(255, 255, 255, .94);

  --shadow:
    0 22px 70px rgba(65, 45, 101, .10);

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

  min-height:
    100vh;

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

  color:
    var(--ink);

  background:

    radial-gradient(
      circle at 7% 5%,
      rgba(142, 94, 255, .14),
      transparent 29%
    ),

    radial-gradient(
      circle at 92% 16%,
      rgba(101, 187, 232, .12),
      transparent 25%
    ),

    radial-gradient(
      circle at 77% 91%,
      rgba(103, 209, 166, .09),
      transparent 27%
    ),

    #f8f7fc;

}


button,
textarea,
input {

  font:
    inherit;

}


button {

  -webkit-tap-highlight-color:
    transparent;

}


.page {

  width:
    min(
      880px,
      calc(100% - 40px)
    );

  margin:
    0 auto;

  padding:

    max(
      24px,
      env(safe-area-inset-top)
    )

    0

    max(
      60px,
      calc(
        env(safe-area-inset-bottom)
        + 34px
      )
    );

}


.topbar {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    18px;

  margin-bottom:
    56px;

}


.brand {

  display:
    flex;

  align-items:
    center;

  gap:
    13px;

  min-width:
    0;

}


.logo {

  width:
    50px;

  height:
    50px;

  flex:
    0 0 auto;

  display:
    grid;

  place-items:
    center;

  border-radius:
    17px;

  color:
    white;

  font-size:
    20px;

  font-weight:
    800;

  background:
    linear-gradient(
      145deg,
      #9c70ff,
      #6339df
    );

  box-shadow:
    0 12px 28px rgba(108, 68, 222, .25);

}


.brand-name {

  font-size:
    18px;

  font-weight:
    780;

  letter-spacing:
    -.02em;

  white-space:
    nowrap;

}


.back {

  min-height:
    44px;

  padding:
    0 18px;

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
    rgba(255,255,255,.72);

  text-decoration:
    none;

  font-size:
    14px;

  font-weight:
    700;

}


.hero {

  margin-bottom:
    38px;

}


.eyebrow {

  margin-bottom:
    15px;

  color:
    var(--purple);

  font-size:
    13px;

  line-height:
    1;

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
      42px,
      8vw,
      70px
    );

  line-height:
    .98;

  letter-spacing:
    -.055em;

}


.hero p {

  max-width:
    650px;

  margin:
    23px 0 0;

  color:
    var(--text);

  font-size:
    17px;

  line-height:
    1.85;

}


.card {

  background:
    var(--white);

  border:
    1px solid rgba(255,255,255,.9);

  border-radius:
    30px;

  box-shadow:
    var(--shadow);

}


.form-card {

  padding:
    34px;

}


.section-label {

  margin-bottom:
    8px;

  color:
    var(--purple);

  font-size:
    12px;

  font-weight:
    850;

  letter-spacing:
    .15em;

}


.section-title {

  margin:
    0 0 25px;

  font-size:
    27px;

  letter-spacing:
    -.035em;

}


.categories {

  display:
    grid;

  grid-template-columns:
    repeat(
      4,
      1fr
    );

  gap:
    10px;

  margin-bottom:
    26px;

}


.category {

  min-height:
    54px;

  border:
    1px solid var(--border);

  border-radius:
    17px;

  color:
    var(--text);

  background:
    rgba(250,248,255,.8);

  cursor:
    pointer;

  font-weight:
    750;

  transition:
    .18s ease;

}


.category.active {

  color:
    var(--purple);

  border-color:
    rgba(117,80,234,.30);

  background:
    var(--purple-soft);

  box-shadow:
    inset 0 0 0 1px rgba(117,80,234,.05);

}


.field-label {

  display:
    block;

  margin:
    0 0 10px;

  color:
    var(--ink);

  font-size:
    14px;

  font-weight:
    780;

}


textarea {

  width:
    100%;

  min-height:
    148px;

  resize:
    vertical;

  padding:
    18px 19px;

  border:
    1px solid var(--border);

  border-radius:
    19px;

  outline:
    none;

  color:
    var(--ink);

  background:
    rgba(249,248,253,.88);

  font-size:
    16px;

  line-height:
    1.7;

  transition:
    .18s ease;

}


textarea:focus {

  border-color:
    rgba(117,80,234,.38);

  box-shadow:
    0 0 0 4px rgba(117,80,234,.07);

}


textarea::placeholder {
  color:
    #aaa1ba;
}


.field-meta {

  display:
    flex;

  justify-content:
    space-between;

  gap:
    12px;

  margin-top:
    8px;

  color:
    var(--muted);

  font-size:
    12px;

}


.context-box {

  margin-top:
    23px;

  border-top:
    1px solid var(--border);

  padding-top:
    18px;

}


details summary {

  min-height:
    44px;

  display:
    flex;

  align-items:
    center;

  cursor:
    pointer;

  list-style:
    none;

  color:
    var(--text);

  font-size:
    14px;

  font-weight:
    730;

}


details summary::-webkit-details-marker {
  display:
    none;
}


details summary::before {

  content:
    "›";

  margin-right:
    10px;

  color:
    var(--purple);

  font-size:
    21px;

  transition:
    transform .18s ease;

}


details[open] summary::before {

  transform:
    rotate(90deg);

}


.context-grid {

  display:
    grid;

  grid-template-columns:
    repeat(
      2,
      minmax(0,1fr)
    );

  gap:
    9px;

  padding:
    8px 0 4px;

}


.context-item {

  min-width:
    0;

  padding:
    13px 14px;

  border-radius:
    15px;

  background:
    #f8f7fb;

}


.context-key {

  margin-bottom:
    4px;

  color:
    var(--muted);

  font-size:
    11px;

}


.context-value {

  overflow:
    hidden;

  color:
    var(--text);

  font-size:
    12px;

  line-height:
    1.45;

  text-overflow:
    ellipsis;

  white-space:
    nowrap;

}


.submit {

  width:
    100%;

  min-height:
    58px;

  margin-top:
    24px;

  border:
    0;

  border-radius:
    18px;

  color:
    white;

  background:
    linear-gradient(
      135deg,
      var(--purple-2),
      #6940e2
    );

  cursor:
    pointer;

  font-size:
    16px;

  font-weight:
    820;

  box-shadow:
    0 15px 34px rgba(102, 62, 216, .23);

  transition:
    transform .18s ease,
    opacity .18s ease;

}


.submit:active {

  transform:
    scale(.99);

}


.submit:disabled {

  cursor:
    wait;

  opacity:
    .6;

}


.notice {

  display:
    none;

  margin-top:
    16px;

  padding:
    14px 16px;

  border-radius:
    16px;

  font-size:
    14px;

  line-height:
    1.6;

}


.notice.show {
  display:
    block;
}


.notice.success {

  color:
    #24775b;

  background:
    var(--green-soft);

}


.notice.error {

  color:
    #a4424c;

  background:
    var(--red-soft);

}


.history {

  margin-top:
    28px;

  padding:
    28px 30px;

}


.history-head {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    16px;

}


.history-title {

  margin:
    0;

  font-size:
    21px;

  letter-spacing:
    -.025em;

}


.history-toggle {

  border:
    0;

  color:
    var(--purple);

  background:
    none;

  cursor:
    pointer;

  font-weight:
    780;

}


.report-list {

  display:
    none;

  margin-top:
    20px;

}


.report-list.open {
  display:
    block;
}


.report {

  display:
    grid;

  grid-template-columns:
    1fr auto;

  gap:
    14px;

  padding:
    17px 0;

  border-top:
    1px solid var(--border);

}


.report:first-child {
  border-top:
    0;
}


.report-name {

  margin-bottom:
    5px;

  font-size:
    14px;

  font-weight:
    780;

}


.report-meta {

  color:
    var(--muted);

  font-size:
    12px;

  line-height:
    1.5;

}


.status {

  align-self:
    start;

  padding:
    6px 9px;

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
    #3477af;

  background:
    var(--blue-soft);

}


.status-resolved {

  color:
    #267a5d;

  background:
    var(--green-soft);

}


.status-muted {

  color:
    #776f84;

  background:
    #f1eff4;

}


.empty {

  padding:
    20px 0 4px;

  color:
    var(--muted);

  font-size:
    14px;

}


@media (
  max-width:
  720px
) {

  .page {

    width:
      calc(100% - 28px);

    padding-top:
      max(
        18px,
        env(safe-area-inset-top)
      );

  }


  .topbar {

    margin-bottom:
      48px;

  }


  .logo {

    width:
      46px;

    height:
      46px;

    border-radius:
      15px;

  }


  .brand-name {

    font-size:
      16px;

  }


  .back {

    min-height:
      42px;

    padding:
      0 15px;

    font-size:
      13px;

  }


  h1 {

    font-size:
      clamp(
        42px,
        14vw,
        62px
      );

  }


  .hero p {

    margin-top:
      19px;

    font-size:
      15px;

    line-height:
      1.75;

  }


  .form-card {

    padding:
      24px 20px;

    border-radius:
      25px;

  }


  .categories {

    grid-template-columns:
      repeat(
        2,
        1fr
      );

  }


  .category {

    min-height:
      51px;

  }


  .context-grid {

    grid-template-columns:
      1fr;

  }


  .history {

    padding:
      24px 20px;

    border-radius:
      25px;

  }


  .report {

    grid-template-columns:
      minmax(0,1fr)
      auto;

  }

}


@media (
  max-width:
  390px
) {

  .brand-name {
    display:
      none;
  }


  .categories {

    gap:
      8px;

  }

}

</style>

</head>


<body>


<div class="page">


<header class="topbar">

  <div class="brand">

    <div class="logo">
      J
    </div>

    <div class="brand-name">
      Jingyan
    </div>

  </div>


  <a
    class="back"
    href="/">
    返回
  </a>

</header>


<section class="hero">

  <div class="eyebrow">
    FEEDBACK
  </div>

  <h1>
    反馈问题。
  </h1>

  <p>
    简单描述发生了什么。
    页面与错误上下文会自动附带，不需要手动复制技术信息。
  </p>

</section>


<section class="card form-card">

  <div class="section-label">
    REPORT
  </div>

  <h2 class="section-title">
    发生了什么？
  </h2>


  <div
    class="categories"
    id="categories">

    <button
      class="category active"
      type="button"
      data-category="upload">
      上传
    </button>

    <button
      class="category"
      type="button"
      data-category="playback">
      播放
    </button>

    <button
      class="category"
      type="button"
      data-category="media">
      媒体
    </button>

    <button
      class="category"
      type="button"
      data-category="collection">
      图库 / 歌单
    </button>

    <button
      class="category"
      type="button"
      data-category="account">
      账户
    </button>

    <button
      class="category"
      type="button"
      data-category="ui">
      界面
    </button>

    <button
      class="category"
      type="button"
      data-category="other">
      其他
    </button>

  </div>


  <label
    class="field-label"
    for="message">
    补充描述
  </label>


  <textarea
    id="message"
    maxlength="1600"
    placeholder="例如：上传完成以后一直停在处理中……"></textarea>


  <div class="field-meta">

    <span>
      不需要填写技术参数
    </span>

    <span id="counter">
      0 / 1600
    </span>

  </div>


  <div class="context-box">

    <details>

      <summary>
        自动附带的信息
      </summary>

      <div
        class="context-grid"
        id="contextGrid">
      </div>

    </details>

  </div>


  <button
    class="submit"
    id="submit"
    type="button">
    提交给 Owner
  </button>


  <div
    class="notice"
    id="notice">
  </div>

</section>


<section class="card history">

  <div class="history-head">

    <h2 class="history-title">
      我的反馈
    </h2>

    <button
      class="history-toggle"
      id="historyToggle"
      type="button">
      展开
    </button>

  </div>


  <div
    class="report-list"
    id="reportList">
  </div>

</section>


</div>


<script>

(() => {

  "use strict";


  const params =
    new URLSearchParams(
      location.search
    );


  const categoryButtons =
    Array.from(
      document.querySelectorAll(
        ".category"
      )
    );


  const message =
    document.getElementById(
      "message"
    );


  const counter =
    document.getElementById(
      "counter"
    );


  const submit =
    document.getElementById(
      "submit"
    );


  const notice =
    document.getElementById(
      "notice"
    );


  const contextGrid =
    document.getElementById(
      "contextGrid"
    );


  const historyToggle =
    document.getElementById(
      "historyToggle"
    );


  const reportList =
    document.getElementById(
      "reportList"
    );


  let category =
    params.get(
      "category"
    ) ||
    "upload";


  let historyLoaded =
    false;


  const allowedCategories =
    new Set([

      "upload",
      "media",
      "playback",
      "collection",
      "account",
      "ui",
      "other"

    ]);


  if (
    !allowedCategories.has(
      category
    )
  ) {

    category =
      "other";

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
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


  function setNotice(
    text,
    type
  ) {

    notice.textContent =
      text;

    notice.className =
      "notice show " +
      type;

  }


  function clearNotice() {

    notice.textContent =
      "";

    notice.className =
      "notice";

  }


  function updateCategoryUI() {

    for (
      const button
      of categoryButtons
    ) {

      button.classList.toggle(
        "active",
        button.dataset.category ===
          category
      );

    }

  }


  function context() {

    const source =
      params.get(
        "source"
      ) ||
      (
        document.referrer
          ? new URL(
              document.referrer
            ).pathname
          : "/feedback/"
      );


    return {

      pageUrl:
        params.get(
          "page"
        ) ||
        source,

      apiPath:
        params.get(
          "api"
        ) ||
        "",

      httpStatus:
        params.get(
          "status"
        ) ||
        "",

      errorCode:
        params.get(
          "code"
        ) ||
        "",

      context: {

        mediaId:
          params.get(
            "media"
          ) ||
          "",

        collectionId:
          params.get(
            "collection"
          ) ||
          "",

        uploadJobId:
          params.get(
            "job"
          ) ||
          "",

        uploadBatchId:
          params.get(
            "batch"
          ) ||
          "",

        action:
          params.get(
            "action"
          ) ||
          "",

        route:
          source,

        browser:
          navigator.userAgent.slice(
            0,
            260
          ),

        platform:
          navigator.platform ||
          "",

        viewport:
          window.innerWidth +
          "x" +
          window.innerHeight,

        network:
          navigator.connection
            ?.effectiveType ||
          "",

        source:
          "feedback_page"

      }

    };

  }


  function renderContext() {

    const data =
      context();


    const items = [

      [
        "页面",
        data.pageUrl ||
        "当前页面"
      ],

      [
        "API",
        data.apiPath ||
        "未记录"
      ],

      [
        "HTTP",
        data.httpStatus ||
        "未记录"
      ],

      [
        "错误码",
        data.errorCode ||
        "未记录"
      ],

      [
        "媒体",
        data.context.mediaId ||
        "—"
      ],

      [
        "分组",
        data.context.collectionId ||
        "—"
      ]

    ];


    contextGrid.innerHTML =
      items
        .map(
          ([key, value]) =>
            \`
            <div class="context-item">

              <div class="context-key">
                \${escapeHtml(key)}
              </div>

              <div class="context-value">
                \${escapeHtml(value)}
              </div>

            </div>
            \`
        )
        .join("");

  }


  function statusText(
    status
  ) {

    return {

      open:
        "已收到",

      investigating:
        "处理中",

      resolved:
        "已解决",

      muted:
        "已归档"

    }[status] ||
    status;

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


  async function loadHistory() {

    reportList.innerHTML =
      \`
      <div class="empty">
        正在加载…
      </div>
      \`;


    try {

      const response =
        await fetch(
          "/api/feedback/mine?limit=10",
          {
            credentials:
              "same-origin",

            cache:
              "no-store"
          }
        );


      if (!response.ok) {

        throw new Error(
          "history_failed"
        );

      }


      const data =
        await response.json();


      const reports =
        Array.isArray(
          data.reports
        )
          ? data.reports
          : [];


      if (!reports.length) {

        reportList.innerHTML =
          \`
          <div class="empty">
            还没有提交过反馈。
          </div>
          \`;

        return;

      }


      reportList.innerHTML =
        reports
          .map(
            item =>
              \`
              <div class="report">

                <div>

                  <div class="report-name">
                    \${escapeHtml(item.title)}
                  </div>

                  <div class="report-meta">
                    \${escapeHtml(formatTime(item.createdAt))}
                    ·
                    同类报告 \${Number(item.reportCount || 1)} 次
                  </div>

                </div>

                <span
                  class="status status-\${escapeHtml(item.status)}">
                  \${escapeHtml(statusText(item.status))}
                </span>

              </div>
              \`
          )
          .join("");

    } catch {

      reportList.innerHTML =
        \`
        <div class="empty">
          暂时无法读取反馈记录。
        </div>
        \`;

    }

  }


  async function submitFeedback() {

    clearNotice();


    const data =
      context();


    const text =
      message.value
        .trim();


    if (
      !text &&
      !data.apiPath &&
      !data.errorCode
    ) {

      setNotice(
        "简单写一句发生了什么就可以。",
        "error"
      );

      message.focus();

      return;

    }


    submit.disabled =
      true;

    submit.textContent =
      "正在提交…";


    try {

      const response =
        await fetch(
          "/api/feedback",
          {

            method:
              "POST",

            credentials:
              "same-origin",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                category,

                message:
                  text,

                ...data

              })

          }
        );


      const result =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          result.error ||
          "feedback_failed"
        );

      }


      message.value =
        "";

      counter.textContent =
        "0 / 1600";


      const count =
        Number(
          result?.report
            ?.reportCount ||
          1
        );


      setNotice(

        count > 1

          ? \`已提交。系统发现这是第 \${count} 次同类反馈，已经自动归并到同一个问题。\`

          : "已提交给 Owner。",

        "success"

      );


      historyLoaded =
        true;

      await loadHistory();


      reportList.classList.add(
        "open"
      );

      historyToggle.textContent =
        "收起";

    } catch (
      error
    ) {

      setNotice(
        "提交失败，请稍后再试。",
        "error"
      );

      console.error(
        error
      );

    } finally {

      submit.disabled =
        false;

      submit.textContent =
        "提交给 Owner";

    }

  }


  for (
    const button
    of categoryButtons
  ) {

    button.addEventListener(
      "click",
      () => {

        category =
          button.dataset.category;

        updateCategoryUI();

      }
    );

  }


  message.addEventListener(
    "input",
    () => {

      counter.textContent =
        message.value.length +
        " / 1600";

    }
  );


  submit.addEventListener(
    "click",
    submitFeedback
  );


  historyToggle.addEventListener(
    "click",
    async () => {

      const opening =
        !reportList.classList.contains(
          "open"
        );


      reportList.classList.toggle(
        "open",
        opening
      );


      historyToggle.textContent =
        opening
          ? "收起"
          : "展开";


      if (
        opening &&
        !historyLoaded
      ) {

        historyLoaded =
          true;

        await loadHistory();

      }

    }
  );


  updateCategoryUI();

  renderContext();

})();

</script>


</body>

</html>`
  );

}
