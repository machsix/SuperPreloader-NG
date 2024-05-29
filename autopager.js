// ==UserScript==
// @name        New script mach.workers.dev
// @namespace   Violentmonkey Scripts
// @match       https://xiutaku.mach.workers.dev/*
// @grant       none
// @version     1.0
// @run-at      document-start
// @author      -
// @description 5/29/2024, 1:52:32 AM
// ==/UserScript==

(function () {
  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchContent(url, contentSelector) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const htmlText = await response.text();
            console.log(`Fetched ${url}`)

            // Create a DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            return doc.querySelector(contentSelector);
        } else {
            console.error(`Error fetching content from ${url}. Status code: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error);
    }
  }

  function create_pagination(page_num, page_link) {
    const html=`
        <div class="sp-separator" id="sp-separator-${page_num}">
        <a class="sp-sp-nextlink" target="_blank" href="${page_link}" title="${page_link}">
          <b>Page <span style="color:#595959!important;">${page_num}</span></b>
          [ Actual elements/pages: <span style="color:#595959!important;">${page_num}</span> ]
        </a>
        </div>`;
    const template = document.createElement('template');
    template.innerHTML = html;
    const result = template.content.children;
    if (result.length === 1) return result[0];
    return result;
  }

  function add_pagination_style(doc) {
    const customStyles = `
      .sp-separator {
        line-height: 1.8 !important;
        opacity: 1 !important;
        position: relative !important;
        float: none !important;
        top: 0 !important;
        left: 0 !important;
        min-width: 366px;
        width: auto;
        text-align: center !important;
        font-size: 14px !important;
        display: block !important;
        padding: 3px 0 !important;
        margin: 5px 10px 8px;
        clear: both !important;
        border-style: solid !important;
        border-width: 2px !important;
        -moz-border-radius: 30px !important;
        border-radius: 30px !important;
        background-color: #ffffff !important;
      }
      .sp-separator a {
        margin: 0 20px 0 -6px !important;
        display: inline !important;
        text-shadow: #fff 0 1px 0 !important;
        background: none !important;
        color: #595959 !important;
      }`;
    const styleElement = doc.createElement('style');
    styleElement.type = 'text/css';
    styleElement.appendChild(doc.createTextNode(customStyles));

    // Append the <style> element to the <head>
    doc.head.appendChild(styleElement);

  }

  async function main(nextLink, pageElement) {
    await timeout(1000);
    const pageSelector = nextLink;
    const contentSelector = pageElement;
    const nextPages = [];
    document.querySelectorAll(pageSelector).forEach(link => {
        const hrefValue = link.getAttribute('href');
        nextPages.push(hrefValue);
    });
    console.log(`Next pages: ${nextPages}`)
    const parsedDOMs = await Promise.all(nextPages.map((url)=>fetchContent(url, contentSelector)));

    const targetElement = document.querySelector(contentSelector);
    add_pagination_style(document);

    parsedDOMs.forEach((parsedDOM, idx) => {
        if (parsedDOM) {
          while (parsedDOM.firstChild) {
              targetElement.appendChild(parsedDOM.firstChild);
          }
          const pagination = create_pagination(idx+1, nextPages[idx]);
          targetElement.appendChild(pagination);
        }
    });

  }

  addEventListener("DOMContentLoaded", (event) => {
    console.log("DOM fully loaded and parsed, init pager");
    const database = [
        {
            name: 'xiutaku',
            keyword: 'xiutaku',
            nextLink: 'nav:first-of-type span:has(a.pagination-link.is-current) ~span a',
            pageElement: 'div.article-fulltext',
        },
        {
            name: '4khd',
            keyword: '4khd',
            nextLink: 'li.current ~ li a',
            pageElement: 'div.wp-block-post-content > p',
        }
    ]

    let d = null;
    for (const i of database) {
        if (location.href.includes(i.keyword)) {
            d = i;
            break
        }
    }
    if (d) {
        main(d.nextLink, d.pageElement).then(()=>{console.log("Autopager is done")});
    } else {
        console.error('No rule is found');
    }
  });
})();