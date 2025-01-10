// ==UserScript==
// @name        SuperPreloader-NG
// @namespace   Violentmonkey Scripts
// @include     http*
// @grant       none
// @version     1.0
// @run-at      document-start
// @author      -
// @description 5/29/2024, 1:52:32 AM
// ==/UserScript==

(function () {
  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchContent(page_link, pageElement, nextLink = null) {
    try {
      const response = await fetch(page_link);
      if (response.ok) {
        const htmlText = await response.text();
        console.log(`Fetched ${page_link}`);

        // Create a DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const content = doc.querySelector(pageElement);
        const next_page_link =
          nextLink === null ? null : doc.querySelector(nextLink);
        return [content, next_page_link];
      } else {
        console.error(
          `Error fetching content from ${page_link}. Status code: ${response.status}`
        );
      }
    } catch (error) {
      console.error(`Error fetching content from ${page_link}:`, error);
    }
  }

  function create_pagination(page_num, page_link) {
    const html = `
        <div class="sp-separator" id="sp-separator-${page_num}">
        <a class="sp-sp-nextlink" target="_blank" href="${page_link}" title="${page_link}">
          <b>Page <span style="color:#595959!important;">${page_num}</span></b>
          [ Actual elements/pages: <span style="color:#595959!important;">${page_num}</span> ]
        </a>
        </div>`;
    const template = document.createElement("template");
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
    const styleElement = doc.createElement("style");
    styleElement.type = "text/css";
    styleElement.appendChild(doc.createTextNode(customStyles));

    // Append the <style> element to the <head>
    doc.head.appendChild(styleElement);
  }

  async function fetch_all(nextLinks, pageElement) {
    await timeout(1000);
    const contentSelector = pageElement;
    const nextPages = [];
    document.querySelectorAll(nextLinks).forEach((link) => {
      const hrefValue = link.getAttribute("href");
      nextPages.push(hrefValue);
    });
    console.log(`Next pages: ${nextPages}`);
    const parsedDOMs = await Promise.all(
      nextPages.map(async (url) => {
        const [content, page_url] = await fetchContent(url, contentSelector);
        return content;
      })
    );

    const targetElement = document.querySelector(contentSelector);
    add_pagination_style(document);

    parsedDOMs.forEach((parsedDOM, idx) => {
      if (parsedDOM) {
        const pagination = create_pagination(idx + 1, nextPages[idx]);
        targetElement.appendChild(pagination);
        while (parsedDOM.firstChild) {
          targetElement.appendChild(parsedDOM.firstChild);
        }
      }
    });
  }

  class InfiniteScrollLoader {
    constructor(contentSelector, nextLinkSelector, paginationSelector) {
      this.contentSelector = contentSelector;
      this.nextLinkSelector = nextLinkSelector;
      this.paginationSelector = paginationSelector || nextLinkSelector;
      if (this.paginationSelector == this.nextLinkSelector) {
        add_pagination_style(document);
      }
      this.updateElement();
      this.observer = null;
      this.numPage = 1;

      this.nextPageLink = this.nextLinkElement.getAttribute("href");
      if (this.nextPageLink) {
        console.info(`Prefetch ${this.nextPageLink}`);
        this.request = fetch(this.nextPageLink).then((response) =>
          response.text()
        );
        this.initObserver();
      } else {
        console.log("Don't find next page link");
      }
    }

    updateElement() {
      this.contentElement = document.querySelector(this.contentSelector);
      this.nextLinkElement = document.querySelector(this.nextLinkSelector);
      this.paginationElement = document.querySelector(this.paginationSelector);
    }

    // Initialize the IntersectionObserver
    initObserver() {
      const options = {
        root: null, // Viewport
        rootMargin: "100px 0px",
        threshold: 1.0, // Trigger when the element is 100% visible
      };

      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        options
      );
      this.observer.observe(this.nextLinkElement);
    }

    // Intersection handler
    handleIntersection(entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadMoreContent();
        }
      });
    }

    // Fetch and append new content, and replace pagination element
    loadMoreContent() {
      this.request
        .then((html) => {
          try {
            window.history.pushState(null, '', this.nextPageLink);
          } catch (error) {
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          // Extract new content
          const newContent = doc.querySelector(this.contentSelector);
          if (newContent) {
            if (this.nextLinkSelector === this.paginationSelector) {
              const pagination = create_pagination(
                this.numPage,
                this.nextPageLink
              );
              this.contentElement.appendChild(pagination);
            }

            // Append each child of the new content to the current content element
            Array.from(newContent.children).forEach((child) => {
              this.contentElement.appendChild(child);
            });
          }

          // Extract and replace the pagination element
          const newNextLinkElement = doc.querySelector(this.nextLinkSelector);
          const newPaginationElement = doc.querySelector(
            this.paginationSelector
          );
          if (newNextLinkElement && newPaginationElement) {
            this.observer.unobserve(this.nextLinkElement);
            this.numPage += 1;

            if (this.nextLinkSelector != this.paginationSelector) {
              this.paginationElement.replaceWith(newPaginationElement);
            } else {
              this.nextLinkElement.setAttribute(
                "href",
                newNextLinkElement.getAttribute("href")
              );
            }
            this.updateElement();

            this.nextPageLink = this.nextLinkElement.getAttribute("href");
            if (this.nextPageLink) {
              console.info(`Prefetch ${this.nextPageLink}`);
              this.request = fetch(this.nextPageLink).then((response) =>
                response.text()
              );
              // Reobserve the new pagination element
              this.observer.observe(this.nextLinkElement);
            } else {
              console.log("Don't find next page link");
            }
          } else {
            // If no new pagination element is found, stop observing
            this.observer.unobserve(this.nextLinkElement);
            // this.paginationElement.style.display = 'none'; // Optionally hide the pagination element
          }
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
          this.observer.unobserve(this.nextLinkElement);
          return;
        });
    }
  }

  addEventListener("DOMContentLoaded", (event) => {
    console.log("DOM fully loaded and parsed, init pager");
    const database = [
      {
        name: "xiutaku",
        url: "^https?://(www\\.)?xiutaku\\.(com|[^/]*workers\\.dev)/\\d+(\\?page=\\d+)?$",
        nextLinks:
          "nav:first-of-type span:has(a.pagination-link.is-current) ~span a",
        pageElement: "div.article-fulltext",
      },
      {
        name: "xiutaku post list",
        url: "^https?://(www\\.)?xiutaku\\.(com|[^/]*workers\\.dev)/([^\\d].*)?$",
        nextLink: "a.pagination-next",
        pagination: "nav.pagination",
        pageElement: "div.blog ~.blog",
      },
      {
        name: "4khd",
        url: "^https?://(www\\.)?4khd\\.(com|[^/]*workers\\.dev)/.*\\.html\/?$",
        nextLinks: "li.current ~ li a",
        pageElement: "div.wp-block-post-content>p:has(>a)",
      },
      {
        name: "4khd post list",
        url: "^https?://(www\\.)?4khd\\.(com|[^/]*workers\\.dev)(/(pages|search|\\?query).*)?",
        nextLink: "span.current~a",
        pagination: "nav.wp-block-query-pagination",
        pageElement: "ul:has(li.wp-block-post)",
      },
      {
        name: "jpxgmn",
        url: "^https?://(www\\.)?jpxgmn\\.(com|[^/]*workers\\.dev)/[^/]*/[^/]*\\.html",
        nextLink: " div.content:nth-child(6)  a.current ~ a",
        pageElement: "div.content:has(p)",
      },
    ];

    let config = null;
    for (const this_config of database) {
      let match = false;
      if ("url" in this_config && this_config["url"].length >= 0) {
        const url_re = new RegExp(this_config["url"]);
        if (url_re.test(location.href)) {
          match = true;
        }
      } else if ("head" in this_config) {
        for (const key in this_config.head) {
          let selector = "";
          const value_re = new RegExp(this_config.head[key]);
          if (key === "title") {
            selector = "head title";
          } else if (key.startsWith("meta")) {
            const [_, name] = key.split(".", 2);
            selector = `head meta[name="${name}"]`;
          }
          const element = document.querySelector(selector);
          if (element) {
            if (key === "title" && value_re.test(element.innerHTML)) {
              match = true;
            } else if (key.startsWith("meta")) {
              const content = element.getAttribute("content");
              if (value_re.test(content)) {
                match = true;
              }
            }
          }
        }
      }
      if (match) {
        config = this_config;
        break;
      }
    }
    if (config) {
      if ("nextLinks" in config) {
        console.log("Autopager fetch-all mode");
        fetch_all(config.nextLinks, config.pageElement).then(() => {
          console.log("Autopager is done");
        });
      } else if ("nextLink" in config) {
        console.log("Autopager next-page mode");
        new InfiniteScrollLoader(
          config.pageElement, // Selector for the content container
          config.nextLink, // Selector for the pagination link within the pagination bar
          config.pagination // Pagination bar to replace
        );
      }
    } else {
      console.error("No rule is found");
    }
  });
})();
