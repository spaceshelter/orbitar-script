// ==UserScript==
// @name         Orbitar temporary tweaks
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  Slightly modify orbitar.space UI
// @author       pazoozoo42 & LazyKarlson
// @match        https://*.orbitar.space/*
// @match        http://*.orbitar.local/*
// @icon         https://orbitar.space/favicon.ico
// @grant        none
// ==/UserScript==
(function () {
  let currentLoggedUsername = null;
  let currentLoggedUserId = null;
  let htmlString = "";

  const parser = new DOMParser();

  const getCookie = function (name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(";").shift();
    }
  };

  fetch(
    document.location.protocol +
      "//api." +
      document.location.host +
      "/api/v1/status",
    {
      headers: {
        "content-type": "application/json",
        "x-session-id": getCookie("session"),
      },
      body: '{"site":"main"}',
      method: "POST",
      mode: "cors",
      credentials: "omit",
    },
  )
    .then(function (response) {
      return response.json();
    })
    .then(function (responseJson) {
      currentLoggedUsername = responseJson.payload.user.username;
      currentLoggedUserId = responseJson.payload.user.id;
    })
    .catch(function () {});

  const live = function (eventType, elementQuerySelector, cb) {
    document.addEventListener(eventType, function (event) {
      const qs = document.querySelectorAll(elementQuerySelector);
      if (qs) {
        let el = event.target,
          index = -1;
        while (el && (index = Array.prototype.indexOf.call(qs, el)) === -1) {
          el = el.parentElement;
        }
        if (index > -1) {
          cb.call(el, event);
        }
      }
    });
  };

  const getSettings = function () {
    let currentSettings = {};
    try {
      currentSettings = JSON.parse(localStorage.getItem("BO__SETTINGS"));
    } catch (e) {}
    if (currentSettings === null) {
      currentSettings = {};
    }
    return Object.assign(
      {},
      {
        changeLayout: false,
        hideCommentsRatings: false,
        addVocativeToComments: false,
        scrollToTop: false,
        newCommentsNav: false,
        userInfoPopUp: false,
        wideContent: false,
      },
      currentSettings,
    );
  };

  const getHidingUsernames = function () {
    let currentSettings = getSettings();
    if (!currentSettings.hide) {
      return [];
    }
    if (currentSettings.hide.length === 1 && currentSettings.hide[0] === "") {
      return [];
    }
    return currentSettings.hide;
  };

  const getHidingPosts = function () {
    let currentSettings = getSettings();
    if (!currentSettings.hidePosts) {
      return [];
    }
    if (
      currentSettings.hidePosts.length === 1 &&
      currentSettings.hidePosts[0] === ""
    ) {
      return [];
    }
    return currentSettings.hidePosts;
  };

  const doHidePost = function (el, author, site) {
    el.classList.add("BO__hidden_post");
    let currentSettings = getSettings();
    el.dataset.originalContent = el.innerHTML;
    htmlString =
      "<span>скрытый пост от " +
      author +
      (site ? " на " + site : "") +
      "</span>";
    if (currentSettings.hidePostsForGood) {
      el.innerHTML = "";
    } else {
      escapeHTML(el, htmlString);
    }
  };

  const escapeHTML = function (el, str) {
    let message = str;
    const parsed = parser.parseFromString(message, `text/html`);
    el.innerHTML = "";
    el.appendChild(parsed.body.firstChild);
  };

  let currentPostAuthor = null;
  const settings = getSettings();
  const hideUsernames = getHidingUsernames();
  const hidePosts = getHidingPosts();

  let vocativeOpeningTags = [];
  let vocativeClosingTags = [];
  if (settings.vocativeBold) {
    vocativeOpeningTags.push("<b>");
    vocativeClosingTags.push("</b>");
  }
  if (settings.vocativeItalic) {
    vocativeOpeningTags.push("<i>");
    vocativeClosingTags.push("</i>");
  }

  const doStuff = function () {
    document
      .querySelectorAll('[class*="PostComponent_post__"]')
      .forEach((el) => {
        if (el.dataset.boProcessed) {
          return;
        }
        const signature = el.querySelector(
          '[class*="SignatureComponent_signature__"]',
        );
        if (!signature) {
          return;
        }

        const signaturreLinks = signature.querySelectorAll('a[href*="/p"]');
        const signatureSiteLink = signature.querySelector('a[href*="/s/"]');
        const signatureAuthorLink = signature.querySelector('a[href*="/u/"]');
        let postSite = null;
        if (signatureSiteLink && signatureSiteLink.innerHTML) {
          postSite = signatureSiteLink.innerHTML;
        }

        let postId = null;
        signaturreLinks.forEach((link) => {
          if (link.href) {
            let result = link.href.match(/\/(p[0-9]+)/);
            if (result && result.length >= 2) {
              postId = result[1];
            }
          }
        });

        if (settings.changeLayout) {
          const controlsContainer = el.querySelector(
            "[class*=PostComponent_controls__]",
          );
          controlsContainer.insertAdjacentElement("afterbegin", signature);
        }

        const postAuthor = signature.querySelector("a.i-user").innerText;

        if (postId) {
          const hidePostEl = document.createElement("span");
          hidePostEl.className = "BO__hide-post";
          hidePostEl.innerHTML = "×";
          hidePostEl.title = "скрыть пост";
          hidePostEl.dataset.postId = postId;
          hidePostEl.dataset.postAuthor = postAuthor;
          signature.insertAdjacentElement("beforeend", hidePostEl);
        }

        if (window.location.href.indexOf("/s/") < 0) {
          if (postSite) {
            const hideSiteEl = document.createElement("span");
            hideSiteEl.className = "BO__hide-site";
            hideSiteEl.innerHTML = "×";
            hideSiteEl.title = "игнорировать " + postSite;
            hideSiteEl.dataset.postSite = postSite;
            signatureSiteLink.insertAdjacentElement("afterend", hideSiteEl);
          }
        }

        if (postAuthor) {
          const hideAuthorEl = document.createElement("span");
          hideAuthorEl.className = "BO__hide-username";
          hideAuthorEl.innerHTML = "×";
          hideAuthorEl.title = "игнорировать " + postAuthor;
          hideAuthorEl.dataset.postAuthor = postAuthor;
          signatureAuthorLink.insertAdjacentElement("afterend", hideAuthorEl);
        }

        if (
          hidePosts.includes(postId) ||
          hideUsernames.includes(postAuthor) ||
          (postSite && hidePosts.includes(postSite))
        ) {
          doHidePost(el, postAuthor, postSite);
        }
        el.dataset.boProcessed = "1";
      });

    document
      .querySelectorAll('[class*="CommentComponent_comment__"]')
      .forEach((el) => {
        if (el.dataset.boProcessed) {
          return;
        }
        const commentSignature = el.querySelector(
          '[class*="SignatureComponent_signature__"]',
        );
        if (!commentSignature) {
          return;
        }
        const signatureCAuthorLink = commentSignature.querySelector("a.i-user");
        const commentAuthor =
          commentSignature.querySelector("a.i-user").innerText;
        if (commentAuthor) {
          const hideCAuthorEl = document.createElement("span");
          hideCAuthorEl.className = "BO__hide-username";
          hideCAuthorEl.innerHTML = "×";
          hideCAuthorEl.title = "игнорировать " + commentAuthor;
          hideCAuthorEl.dataset.postAuthor = commentAuthor;
          signatureCAuthorLink.insertAdjacentElement("afterend", hideCAuthorEl);
        }
        el.dataset.boProcessed = "1";
      });

    if (document.location.href.match(/space\/(s\/[a-z0-9_-]+?\/)?p\d+/)) {
      if (!currentPostAuthor) {
        let currentPost = document.querySelector(
          '[class*=PostComponent_post__] [class*="SignatureComponent_signature__"] a',
        );
        if (currentPost) {
          let currentPostAuthor =
            currentPost.textContent || currentPost.innerText;

          if (settings.markPostAuthor) {
            markPostAuthor(currentPostAuthor);
          }
          document
            .querySelectorAll('[class*="CommentComponent_comment__"]')
            .forEach((el) => {
              let commentAuthorContainer = el.querySelector(
                "[class*=SignatureComponent_signature__] a",
              );
              let commentAuthor =
                commentAuthorContainer.textContent ||
                commentAuthorContainer.innerText;
              let commentBodyContainer = el.querySelector(
                '[class*="commentBody"]',
              );
              let editingThisComment = el.querySelector(
                '[class*="CreateCommentComponent_editor__"]',
              );
              let previewingEditedComment = el.querySelector(
                '[class*="CreateCommentComponent_preview__"]',
              );
              if (editingThisComment || previewingEditedComment) {
                commentBodyContainer.classList.add("BO_editing_comment");
              } else {
                commentBodyContainer.classList.remove("BO_editing_comment");
              }
              if (
                currentPostAuthor === commentAuthor &&
                !commentBodyContainer.className.includes("BO__CommentByAuthor")
              ) {
                commentBodyContainer.className =
                  commentBodyContainer.className + " BO__CommentByAuthor";
              }
              if (
                currentLoggedUsername &&
                commentAuthor === currentLoggedUsername &&
                !commentBodyContainer.className.includes(
                  "BO__CommentByLoggedUser",
                ) &&
                currentPostAuthor !== commentAuthor
              ) {
                commentBodyContainer.className =
                  commentBodyContainer.className + " BO__CommentByLoggedUser";
              }
              if (hideUsernames.includes(commentAuthor)) {
                commentBodyContainer.classList.add("BO__hidden_comment");
                commentBodyContainer.addEventListener("click", function () {
                  commentBodyContainer.classList.remove("BO__hidden_comment");
                });
              }
            });
        }
      }

      if (settings.addVocativeToComments) {
        document
          .querySelectorAll(
            "[class*=CommentComponent_answers__] > [class*=CommentComponent_comment__]",
          )
          .forEach(function (el) {
            let parentComment =
              el.parentNode.parentNode.querySelector(".commentBody");
            if (!parentComment) {
              return;
            }
            let parentCommentAuthorContainer = parentComment.querySelector(
              "[class*=SignatureComponent_signature__] a",
            );
            if (!parentCommentAuthorContainer) {
              return;
            }
            let parentCommentAuthor = parentCommentAuthorContainer.innerText;
            if (!parentCommentAuthor) {
              return;
            }
            let commentHtmlContainer = el.querySelector(
              ".commentBody [class*=CommentComponent_content__] [class*=ContentComponent_content__]",
            );
            if (
              !commentHtmlContainer ||
              commentHtmlContainer.dataset.vocativeProcessed
            ) {
              return;
            }
            if (
              commentHtmlContainer.innerHTML.match(
                new RegExp(`^${parentCommentAuthor}[,:]`),
              )
            ) {
              return;
            }
            const commentStartsWithMedia =
              commentHtmlContainer.innerHTML.match(/^\s*(<img|<iframe)/);
            if (settings.vocativeLowercase) {
              htmlString =
                "<span>" +
                commentHtmlContainer.innerHTML.charAt(0).toLowerCase() +
                commentHtmlContainer.innerHTML.slice(1) +
                "</span>";
              escapeHTML(commentHtmlContainer, htmlString);
            }
            htmlString =
              "<span>" +
              vocativeOpeningTags.join("") +
              parentCommentAuthor +
              vocativeClosingTags.join("") +
              ((settings.vocativeSymbol ? settings.vocativeSymbol : ",") +
                " ") +
              (commentStartsWithMedia ? "<br/>" : "") +
              commentHtmlContainer.innerHTML +
              "</span>";
            commentHtmlContainer.dataset.vocativeProcessed = "1";
            escapeHTML(commentHtmlContainer, htmlString);
          });
      }
    } else {
      currentPostAuthor = null;
    }

    if (
      document.location.href.match(/\/u\/[^\/]+\/comments/) ||
      document.location.href.match(/profile\/comments/)
    ) {
      if (settings.addVocativeToComments) {
        document
          .querySelectorAll(
            "[class*=UserPage_userinfo__] [class*=FeedPage_feed__] [class*=CommentComponent_comment__]",
          )
          .forEach(function (el) {
            let parentCommentAuthorNode = el.querySelector(
              "[class=commentBody] [class*=SignatureComponent_signature__]",
            );
            if (parentCommentAuthorNode) {
              const parentCommentAuthor =
                parentCommentAuthorNode.getElementsByClassName("arrow");
              if (parentCommentAuthor && parentCommentAuthor[0]) {
                const parentCommentAuthorUsername =
                  parentCommentAuthor[0].innerHTML;
                const commentHtmlContainer = el.querySelector(
                  ".commentBody [class*=CommentComponent_content__] [class*=ContentComponent_content__]",
                );
                if (
                  !commentHtmlContainer ||
                  commentHtmlContainer.dataset.vocativeProcessed
                ) {
                  return;
                }
                if (
                  commentHtmlContainer.innerHTML.match(
                    new RegExp(`^${parentCommentAuthor}[,:]`),
                  )
                ) {
                  return;
                }
                const commentStartsWithMedia =
                  commentHtmlContainer.innerHTML.match(/^\s*(<img|<iframe)/);
                if (settings.vocativeLowercase) {
                  htmlString =
                    "<span>" +
                    commentHtmlContainer.innerHTML.charAt(0).toLowerCase() +
                    commentHtmlContainer.innerHTML.slice(1) +
                    "</span>";
                  escapeHTML(commentHtmlContainer, htmlString);
                }
                htmlString =
                  "<span>" +
                  vocativeOpeningTags.join("") +
                  parentCommentAuthorUsername +
                  vocativeClosingTags.join("") +
                  ((settings.vocativeSymbol ? settings.vocativeSymbol : ",") +
                    " ") +
                  (commentStartsWithMedia ? "<br/>" : "") +
                  commentHtmlContainer.innerHTML +
                  "</span>";
                commentHtmlContainer.dataset.vocativeProcessed = "1";
                escapeHTML(commentHtmlContainer, htmlString);
              }
            }
          });
      }
    }
    /*if (
      document.location.href.match(/\/u\/[^\/]+/) &&
      !document.location.href.match(/\/u\/[^\/]+\//)
    ) {
      document
        .querySelectorAll("[class*=PostComponent_controls__]")
        .forEach(function (el) {
          let parentProfileNode = el.querySelector(
            "[class*=UserProfileName_profile_name__]",
          );
          if (
            !parentProfileNode ||
            parentProfileNode.dataset.userNoteProcessed
          ) {
            return;
          } else {
            var textarea = document.createElement("button");
            var para = document.createElement("div");
            para.appendChild(textarea);
            textarea.innerHTML = "Создать заметку";
            parentProfileNode.appendChild(para);
            parentProfileNode.dataset.userNoteProcessed = "1";
          }
        });
    }*/
    /*if (
      document.location.href.match(/\/u\/[^\/]+/) &&
      !document.location.href.match(/\/u\/[^\/]+\//)
    ) {
      document
        .querySelectorAll("[class*=PostComponent_controls__]")
        .forEach(function (el) {
          let parentProfileNode = el.querySelector(
            "[class*=UserProfileName_profile_name__]"
          );
          if (
            !parentProfileNode ||
            parentProfileNode.dataset.userNoteProcessed
          ) {
            return;
          } else {
            var button = document.createElement("button");
            button.innerHTML = "Создать заметку";
            button.className = "BO__create-note-button";
            button.onclick = function() {
              var textarea = document.createElement("textarea");
              textarea.className = "BO__user-note";
              textarea.placeholder = "Введите заметку о пользователе";
              this.parentNode.insertBefore(textarea, this.nextSibling);
              this.style.display = "none";
            };
            parentProfileNode.appendChild(button);
            parentProfileNode.dataset.userNoteProcessed = "1";
          }
        });
    }*/
    if (
      document.location.href.match(/\/u\/[^\/]+/) &&
      !document.location.href.match(/\/u\/[^\/]+\//)
    ) {
      document
        .querySelectorAll("[class*=UserPage_header__]")
        .forEach(function (el) {
          let parentProfileNode = el.querySelector(
            "[class*=UserPage_username__]"
          );
          if (
            !parentProfileNode ||
            parentProfileNode.dataset.userNoteProcessed
          ) {
            return;
          } else {
            var username = parentProfileNode.textContent.trim();
            //var existingNote = localStorage.getItem('BO__user_note_' + username);
            var userNotes = loadUserNotes();
            var existingNote = userNotes[username] || '';

            var noteContainer = document.createElement("div");
            noteContainer.className = "BO__note-container";

            if (existingNote) {
              // Display existing note
              var noteDiv = document.createElement("div");
              noteDiv.className = "BO__user-note-display";
              noteDiv.textContent = existingNote;
              noteContainer.appendChild(noteDiv);

              var editButton = document.createElement("button");
              editButton.innerHTML = "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18 2.9 17.35 2.9 16.96 3.29L15.12 5.12L18.87 8.87L20.71 7.04ZM3 17.25V21H6.75L17.81 9.93L14.06 6.18L3 17.25Z\"></path></svg>";
              editButton.className = "BO__edit-note-button";
              noteContainer.appendChild(editButton);

              editButton.onclick = function () {
                createEditableNote();
              };
            } else {
              // Create new note button
              var createButton = document.createElement("button");
              createButton.innerHTML = "Создать заметку";
              createButton.className = "BO__create-note-button";
              noteContainer.appendChild(createButton);

              createButton.onclick = function () {
                createEditableNote();
              };
            }

            //parentProfileNode.appendChild(noteContainer);
            parentProfileNode.insertAdjacentElement('afterend', noteContainer);
            parentProfileNode.dataset.userNoteProcessed = "1";
            function loadUserNotes() {
              const notes = localStorage.getItem('BO__user_notes');
              return notes ? JSON.parse(notes) : {};
            }

            // Function to save all user notes to localStorage
            function saveUserNotes(notes) {
              localStorage.setItem('BO__user_notes', JSON.stringify(notes));
            }
            function createEditableNote() {
              var userNotes = loadUserNotes();
              var existingNote = userNotes[username] || '';

              noteContainer.innerHTML = '';
              var textarea = document.createElement("textarea");
              textarea.className = "BO__user-note";
              textarea.placeholder = "Введите заметку о пользователе";
              textarea.value = existingNote;

              var saveButton = document.createElement("button");
              saveButton.innerHTML = "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2,21L23,12L2,3V10L17,12L2,14V21Z\"></path></svg>";
              saveButton.className = "BO__save-note-button";

              noteContainer.appendChild(textarea);
              noteContainer.appendChild(saveButton);

              saveButton.onclick = function () {
                var note = textarea.value.trim();
                var userNotes = loadUserNotes();

                if (note === '') {
                  // If note is empty, remove it from the notes object
                  delete userNotes[username];
                  noteContainer.innerHTML = ''; // Clear editable elements

                  // Add back the "Create note" button
                  var createButton = document.createElement("button");
                  createButton.innerHTML = "Создать заметку";
                  createButton.className = "BO__create-note-button";
                  noteContainer.appendChild(createButton);

                  createButton.onclick = function () {
                    createEditableNote();
                  };
                } else {
                  // Save the note for this username
                  userNotes[username] = note;
                  noteContainer.innerHTML = ''; // Clear editable elements

                  var noteDiv = document.createElement("div");
                  noteDiv.className = "BO__user-note-display";
                  noteDiv.textContent = note;
                  noteContainer.appendChild(noteDiv);

                  var editButton = document.createElement("button");
                  editButton.innerHTML = "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18 2.9 17.35 2.9 16.96 3.29L15.12 5.12L18.87 8.87L20.71 7.04ZM3 17.25V21H6.75L17.81 9.93L14.06 6.18L3 17.25Z\"></path></svg>";
                  editButton.className = "BO__edit-note-button";
                  noteContainer.appendChild(editButton);

                  editButton.onclick = function () {
                    createEditableNote();
                  };
                }

                // Save all notes back to localStorage
                saveUserNotes(userNotes);
              };
            }
          }
        });
    }
  };



  const targetNode = document.getElementsByTagName("html")[0];
  const config = { attributes: false, childList: true, subtree: true };
  let newComments = 0;
  let previousUrl = "";
  let lastUrl = "";
  let count = 0;
  const callback = function () {
    doStuff();
    if (location.href !== lastUrl) {
      count = 0;
      lastUrl = location.href;
    }
    newComments = document.getElementsByClassName("isNew");
    if (settings.newCommentsNav && newComments.length > 1) {
      doCommentNav();
    }
    if (settings.userInfoPopUp) {
      showUserInfoPopUp();
    }

    if (settings.newCommentsNav && newComments.length == 0) {
      document.querySelector(".prevC").style.display = "none";
      document.querySelector(".nextC").style.display = "none";
    }

    if (settings.redirectToAll) {
      const homeLogo = document.querySelector(
        '[class*="Topbar_left__"] a[href="/"]',
      );
      if (homeLogo) {
        homeLogo.setAttribute("href", "/all");
      }
      if (location.href !== previousUrl) {
        if (
          location.href ===
          document.location.protocol + "//" + document.location.host + "/"
        ) {
          document.location.href =
            document.location.protocol + "//" + document.location.host + "/all";
          return;
        }
        previousUrl = location.href;
      }
    }
  };
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);

  doStuff();

  let settingsShown = false;

  live("click", ".BO__settings button.remove-main", function (e) {
    const stateIndicator = document.getElementById("BO__main_change_state");
    stateIndicator.innerHTML = "";
    try {
      fetch(
        document.location.protocol +
          "//api." +
          document.location.host +
          "/api/v1/site/subscribe",
        {
          headers: {
            "content-type": "application/json",
            "x-session-id": getCookie("session"),
          },
          body: '{"site":"main", "main":' + !!e.target.dataset.value + "}",
          method: "POST",
          mode: "cors",
          credentials: "omit",
        },
      )
        .then(function (response) {
          return response.json();
        })
        .then(function (responseJson) {
          if (responseJson.result === "success") {
            stateIndicator.innerHTML = "готово";
          }
        })
        .catch(function () {});
    } catch (e) {}
  });

  live("click", ".BO__settings button.save", function (e) {
    let newSettings = {
      hide: document
        .querySelector(".BO__settings textarea.usernames")
        .value.split(/\s*,\s*/),
      hidePosts: document
        .querySelector(".BO__settings textarea.posts")
        .value.split(/\s*,\s*/),
      hidePostsForGood: document.querySelector(
        '[data-setting-name="hidePostsForGood"]',
      ).checked,
      changeLayout: document.querySelector('[data-setting-name="changeLayout"]')
        .checked,
      redirectToAll: document.querySelector(
        '[data-setting-name="redirectToAll"]',
      ).checked,
      fixImages: document.querySelector('[data-setting-name="fixImages"]')
        .checked,
      hideCommentsRatings: document.querySelector(
        '[data-setting-name="hideCommentsRatings"]',
      ).checked,
      scrollToTop: document.querySelector('[data-setting-name="scrollToTop"]')
        .checked,
      newCommentsNav: document.querySelector(
        '[data-setting-name="newCommentsNav"]',
      ).checked,
      newCommentsNavPosition: document.querySelector(
        '[data-setting-name="newCommentsNavPosition"]',
      ).value,
      newCommentsNavPositionSide: document.querySelector(
        '[data-setting-name="newCommentsNavPositionSide"]',
      ).value,
      userInfoPopUp: document.querySelector(
        '[data-setting-name="userInfoPopUp"]',
      ).checked,
      markPostAuthor: document.querySelector(
        '[data-setting-name="markPostAuthor"]',
      ).checked,
      addVocativeToComments: document.querySelector(
        '[data-setting-name="addVocativeToComments"]',
      ).checked,
      vocativeBold: document.querySelector('[data-setting-name="vocativeBold"]')
        .checked,
      vocativeItalic: document.querySelector(
        '[data-setting-name="vocativeItalic"]',
      ).checked,
      vocativeLowercase: document.querySelector(
        '[data-setting-name="vocativeLowercase"]',
      ).checked,
      vocativeSymbol: document
        .querySelector("input[name=vocativeSymbol]:checked")
        .getAttribute("data-setting-value"),
      useFont: document.querySelector("select[name=useFont]").value,
      wideContent: document.querySelector('[data-setting-name="wideContent"]')
        .checked,
    };
    localStorage.setItem("BO__SETTINGS", JSON.stringify(newSettings));
    document.querySelector(".BO__settings").remove();
    document.getElementById("root").classList.remove("BO__settings_shown");
    settingsShown = false;
    if (e.target.dataset.reload) {
      document.location.reload();
    }
  });

  live("click", "[class*=App_monster__]", function () {
    if (!settingsShown) {
      const settingsContainer = document.createElement("div");
      settingsContainer.className = "BO__settings";
      htmlString =
        `<span>
        <div style="overflow: auto; padding-bottom: 60px;">
        <div class="row">
        <div class="column">
         <hr/>
          <div>
              <h2>Прятать пользователей (юзернеймы через запятую):</h2>
              <textarea class="usernames">` +
        getHidingUsernames().join(", ") +
        `</textarea>
          </div>
          <hr/>
          <div>
              <h2>Прятать посты (id постов или названия сайтов через запятую):</h2>
              <textarea class="posts">` +
        getHidingPosts().join(", ") +
        `</textarea>
              <div style="margin-bottom: 10px;">
                  <label><input type="checkbox" data-setting-name="hidePostsForGood" ` +
        (settings.hidePostsForGood ? 'checked="1"' : "") +
        ` /> - прятать посты насовсем (если выключено, в ленте будут ссылки на скрытые посты)</label>
              </div>
          </div>
          </div>
          <div class="column">
          <hr/>
          <div class="BO_settings_checkboxes">
              <div>
                  <label><input type="checkbox" data-setting-name="redirectToAll" ` +
        (settings.redirectToAll ? 'checked="1"' : "") +
        ` /> - редиректить ленту на /all (все посты)</label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="changeLayout" ` +
        (settings.changeLayout ? 'checked="1"' : "") +
        ` /> - менять стили</label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" data-setting-name="fixImages" ` +
        (settings.fixImages ? 'checked="1"' : "") +
        ` /> - исправлять висячие картинки и видео</label>
              </div>
              <div>
                  <label><input type="checkbox"  data-setting-name="hideCommentsRatings" ` +
        (settings.hideCommentsRatings ? 'checked="1"' : "") +
        ` /> - прятать рейтинг комментов</label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="wideContent" ` +
        (settings.wideContent ? 'checked="1"' : "") +
        ` /> - сделать контент пошире</label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="addVocativeToComments" ` +
        (settings.addVocativeToComments ? 'checked="1"' : "") +
        ` /> - добавлять обращение в комменты</label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" data-setting-name="vocativeBold" ` +
        (settings.vocativeBold ? 'checked="1"' : "") +
        ` /> - выделять обращение <b>жирным</b></label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" data-setting-name="vocativeItalic" ` +
        (settings.vocativeItalic ? 'checked="1"' : "") +
        ` /> - выделять обращение <i>курсивом</i></label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" data-setting-name="vocativeLowercase" ` +
        (settings.vocativeLowercase ? 'checked="1"' : "") +
        ` /> - уменьшать первую букву после обращения</label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input name="vocativeSymbol" type="radio" data-setting-name="vocativeSymbol" data-setting-value="," ` +
        (settings.vocativeSymbol === "," || !settings.vocativeSymbol
          ? 'checked="1"'
          : "") +
        ` /> - отделять обращение запятой</label>
              </div>
              <div>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;<input name="vocativeSymbol" type="radio" data-setting-name="vocativeSymbol" data-setting-value=":" ` +
        (settings.vocativeSymbol === ":" ? 'checked="1"' : "") +
        ` /> - отделять обращение двоеточием</label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="scrollToTop" ` +
        (settings.scrollToTop ? 'checked="1"' : "") +
        ` /> - показывать кнопку "Наверх"</label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="newCommentsNav" ` +
        (settings.newCommentsNav ? 'checked="1"' : "") +
        ` /> - показывать кнопки навигации по новым комментам</label>
                  <label><input type="text" maxlength="4" size="4" data-setting-name="newCommentsNavPosition" value="` +
        (settings.newCommentsNavPosition
          ? settings.newCommentsNavPosition
          : 100) +
        `" />px - позиция кнопок навигации по новым комментам<br /></label>
<label>Кнопки навигации по новым комментам<select name="newCommentsNavPositionSide" data-setting-name="newCommentsNavPositionSide"><option value="right" ` +
        (settings.newCommentsNavPositionSide === "right" ? "selected" : "") +
        ` >справа</option><option value="left" ` +
        (settings.newCommentsNavPositionSide === "left" ? "selected" : "") +
        `>слева</option></select></label>
              </div>
              <div>
                  <label><input type="checkbox" data-setting-name="userInfoPopUp" ` +
        (settings.userInfoPopUp ? 'checked="1"' : "") +
        ` /> - показывать подсказку с информацией юзернейма</label>
              </div>
                <div>
                  <label><input type="checkbox" data-setting-name="markPostAuthor" ` +
        (settings.markPostAuthor ? 'checked="1"' : "") +
        ` /> - выделять юзернейм автора поста в комментах</label>
              </div>
          </div>
          </div>
          </div>
          <hr/>
          <div>
              <h2 style="display: inline-block;">Использовать шрифт:</h2>
              <select name="useFont" id="BO__settings_font" class="BO__settings__font">
                  <option value="">дефолтный</option>
                  <option value="Google Sans">Google Sans</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Roboto Slab">Roboto Slab</option>
                  <option value="Ubuntu">Ubuntu</option>
                  <option value="Rubik">Rubik</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Merriweather">Merriweather</option>
              </select>
          </div>
          <hr/>
          <div>
              <button class="remove-main" data-value="">убрать главную из подписок</button> или
              <button class="remove-main" data-value="1">вернуть её туда</button><b id="BO__main_change_state" class="BO__ok"></b><br/>
              <i>изменения вступят в силу после перезагрузки страницы</i>
          </div>
        </div>
          <div style="position: absolute; bottom: 10px;">
              <div>
                <button class="save" data-reload="1">сохранить и перезагрузить страницу</button>
                <button class="export">Экспорт настроек</button>
                <button onclick="document.getElementById('file-input').click();">Импорт настроек</button>
                <input class="import" id="file-input" type="file" name="name" style="display: none;" />
              </div>
              <div>
                   <i>для вступления в силу надо перезагрузить страницу после сохранения</i>
              </div>
          </div></span>
        `;
      escapeHTML(settingsContainer, htmlString);

      document.getElementsByTagName("body")[0].appendChild(settingsContainer);
      settingsShown = true;
      document.getElementById("BO__settings_font").value = settings.useFont;
      document.getElementById("root").classList.add("BO__settings_shown");
    } else {
      settingsShown = false;
      if (document.querySelector(".BO__settings")) {
        document.querySelector(".BO__settings").remove();
      }
      document.getElementById("root").classList.remove("BO__settings_shown");
    }
  });

  live("click", ".BO__hide-post", function (e) {
    const settings = getSettings();
    let hidePosts = settings.hidePosts;
    if (!hidePosts || (hidePosts.length === 1 && hidePosts[0] === "")) {
      hidePosts = [];
    }
    const postId = e.target.dataset.postId;
    if (postId && !hidePosts.includes(postId)) {
      hidePosts.push(postId);
      settings.hidePosts = hidePosts;
      localStorage.setItem("BO__SETTINGS", JSON.stringify(settings));
    }
    const post = e.target.parentNode.parentNode.parentNode;
    const user = e.target.dataset.postAuthor;
    if (post) {
      doHidePost(post, user);
    }
  });

  live("click", ".BO__hide-site", function (e) {
    const settings = getSettings();
    let hidePosts = settings.hidePosts;
    if (!hidePosts || (hidePosts.length === 1 && hidePosts[0] === "")) {
      hidePosts = [];
    }
    const siteId = e.target.dataset.postSite;
    if (siteId && !hidePosts.includes(siteId)) {
      hidePosts.push(siteId);
      settings.hidePosts = hidePosts;
      localStorage.setItem("BO__SETTINGS", JSON.stringify(settings));
    }
  });

  live("click", ".BO__hide-username", function (e) {
    const settings = getSettings();
    let hideUsernames = settings.hide;
    if (
      !hideUsernames ||
      (hideUsernames.length === 1 && hideUsernames[0] === "")
    ) {
      hideUsernames = [];
    }
    const username = e.target.dataset.postAuthor;
    if (username && !hidePosts.includes(username)) {
      hideUsernames.push(username);
      settings.hide = hideUsernames;
      localStorage.setItem("BO__SETTINGS", JSON.stringify(settings));
    }
  });

  live("click", ".BO__hidden_post span", function (e) {
    const post = e.target.parentNode;
    if (!post) {
      return;
    }
    post.classList.remove("BO__hidden_post");
    htmlString = "<span>" + post.dataset.originalContent + "</span>";
    escapeHTML(post, htmlString);
  });

  live("click", ".BO__settings button.export", function (e) {
    var boSettings = localStorage.getItem("BO__SETTINGS");

    if (boSettings) {
      var blob = new Blob([boSettings], { type: "text/csv" });

      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);

      a.download = "orbitar.csv";

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
    } else {
      console.error("No 'BO__SETTINGS' item found in local storage.");
    }
  });

  live("change", ".BO__settings input.import", function (e) {
    var reader = new FileReader();

    reader.onload = function (event) {
      var csvData = event.target.result;

      localStorage.setItem("BO__SETTINGS", csvData);

      console.log("Data imported from CSV to local storage successfully.");
    };

    reader.readAsText(e.target.files[0]);
  });

  const layoutChangeCss =
    (settings.useFont
      ? `
      * {
        font-family: "${settings.useFont}" !important;
      }
      `
      : ``) +
    `
      div[class*=Topbar_topbar__] {
          --background-color: var(--bg);
      }
      .i-user {
          font-weight: bold !important;
      }
      .i-user:before {
          content: '';
      }

      [class*="PostComponent_post__"] [class*="PostComponent_controls__"] {
          display: flex;
          flex-direction: row-reverse;
          flex-wrap: wrap-reverse;
      }
      [class*="PostComponent_optionsList__"] {
          left: 0;
          top: 26px;
      }
      [class*="PostComponent_post__"] [class*="PostComponent_controls__"] [class*="SignatureComponent_signature__"] {
          order: 1;
          margin-bottom: 0 !important;
          margin-left: 6px;
          flex-grow: 1;
      }
      [class*="CommentComponent_comment__"] .commentBody {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
      }
      [class*="CommentComponent_comment__"] [class^="CommentComponent_controls__"] {
          display: inline-flex;
          order: 3;
          flex-direction: row-reverse;
          font-size: 14px !important;
          margin-top: -4px;
          visibility: ` +
    (settings.hideCommentsRatings ? "hidden" : "") +
    `;
          margin-bottom: -10px;
      }
      [class*="CommentComponent_comment__"] [class*="CommentComponent_controls__"] [class*="CommentComponent_control__"] {
          margin-right: 0;
          margin-left: 10px;
      }
      [class*="CommentComponent_comment__"] [class*="CommentComponent_controls__"] [class*="CommentComponent_control__"] button,
      [class*="CommentComponent_comment__"] [class*="CommentComponent_controls__"] [class*="CommentComponent_control__"] div
      {
          font-size: 12px;
      }
      [class*="CommentComponent_comment__"] .commentBody:hover [class*="CommentComponent_controls__"] {
         visibility: visible;
      }
      [class*="CommentComponent_comment__"] .commentBody [class*="SignatureComponent_signature__"] {
          margin-top: 5px;
          order: 2;
          display: inline-flex;
      }
      [class*="CommentComponent_comment__"] .commentBody [class*="SignatureComponent_signature__"],
      [class*="CommentComponent_comment__"] .commentBody [class*="SignatureComponent_signature__"] [class*="SignatureComponent_toggleHistory__"]
      {
          font-size: 12px;
          margin-bottom: 0;
      }
      [class*="CommentComponent_comment__"] .commentBody [class*="CommentComponent_content__"] {
          order: 1;
          flex-basis: 100%;
      }
      [class*="CommentComponent_answers__"] {
          border-left: none;
      }
      [class*=".CommentComponent_answers__"] {
          margin-top: -4px;
      }
      .commentBody {
          padding-left: 4px;
      }
      .BO__CommentByAuthor {
          --background-color: var(--topbar-bg);
          border-left: 2px solid var(--positive) !important;
      }
      .BO__CommentByLoggedUser {
          border-left: 2px solid var(--danger) !important;
      }
      .isNew {
          border-left: 0;
      }
      .isNew .commentBody {
          border-left: 2px solid var(--primary);
      }
      [class*="SignatureComponent_signature__"] {
          margin-bottom: -4px;
      }
      ` +
    (settings.fixImages
      ? `
      [class*="ContentComponent_content__"] img,
      [class*="ContentComponent_content__"] iframe,
      [class*="ContentComponent_content__"] video
      {
          display: block;
          margin-top: 4px;
          margin-bottom: 4px;
      }
      .BO_editing_comment {
          flex-direction: column;
      }
      `
      : "");

  const settingsCss = `
      [class*=App_monster__] {
          cursor: pointer;
          z-index: 1000;
      }
      #root.BO__settings_shown {
          opacity: 0.1;
      }
      @keyframes slide  {
         from {
            bottom: -500px;
         }
         to {
            bottom: 24px;
         }
      }
      .row {
        display: flex;
      }

      .column {
        flex: 50%;
      }
      .BO__settings {
          width: 720px;
          height: auto;
          color: var(--fg);
          background-color: var(--bg);
          filter: invert(1);
          animation-duration: 0.3s;
          animation-name: slide;
          bottom: 24px;
          right: 14px;
          position: fixed;
          padding: 10px;
      }
      .BO__ok {
          color: green;
          filter: invert(1);
          font-size: x-small;
      }
      .BO__settings h2 {
          font-size: 14px;
          font-weight: bold;
      }
      .BO__settings textarea {
          width: calc(100% - 20px);
          height: calc(100% - 200px);
          margin-bottom: 10px;
      }
      .BO__settings label {
        font-size: 12px;
      }
      .BO__settings button {
          margin: 4px;
          margin-top: 10px;
      }
      .BO__settings i {
          font-size: 10px;
      }
      .BO__settings hr {
          border: 0;
          border-bottom: 1px dashed #ccc;
          background: #999;
          margin-bottom: 0;
          margin-top: 0;
      }
      .BO__settings .BO_settings_checkboxes {
          margin-top: 10px;
          margin-bottom: 10px;
      }
    `;

  const hiddenCss = `
      .BO__hidden_comment.commentBody {
          position: relative;
          outline: 1px solid var(--danger);
          border-radius: 5px;
          cursor: pointer;
          opacity: 0.2;
      }
      .BO__hidden_comment.commentBody:hover {
          opacity: 1;
      }
      .BO__hidden_comment.commentBody > div {
          opacity: 0;
      }
      .BO__hidden_comment:before {
          content: 'Спрятано. Нажмите, чтобы посмотреть, но там может быть хуй!';
          font-size: 10px;
          position: absolute;
          display: block;
          width: 100%;
          text-align: center;
          cursor: pointer;
          top: 50%;
          left: 0;
          right: 0;
          margin: auto;
          transform: translateY(-50%);
          opacity: 0.2;
      }
      .BO__hidden_comment:hover:before {
          opacity: 1;
      }
      .BO__hide-post {
        padding-left:3px;
          cursor: pointer;
      }
      .BO__hide-post:hover {
       color: red;
      }
      .BO__hide-site {
        padding-left:3px;
        cursor: pointer;
    }
    .BO__hide-site:hover {
        color: red;
       }
    .BO__hide-username {
        padding-left:3px;
        cursor: pointer;
    }
    .BO__hide-username:hover {
        color: red;
       }
      .BO__hidden_post {
          margin: 0 0 20px;
          font-size: 10px;
          opacity: 0.2;
          cursor: pointer;
      }
      .BO__hidden_post:hover {
           opacity: 1;
      }
    `;

  const wideContentCss = `
        @media (min-width: 800px) {
        div[class*=App_container__] {
            width: calc(100% - 20px);
        }
        div[class*=App_innerContainer__] {
            padding: 0 0 0 200px;
        }
        div[class*=FeedPage_feed__],
        div[class*=UserPage_container__],
        div[class*=PostPage_container__]
        {
            max-width: initial;
        }
        }
    `;

  const vocativesCss = `
       div.commentBody div[class*=SignatureComponent_signature__] a.arrow.i.i-arrow {
           visibility: hidden;
           width: 10px;
       }
       div.commentBody div[class*=SignatureComponent_signature__] a.arrow.i.i-arrow:before {
           visibility: visible;
       }
    `;

  const scrollToTopCss = `
        .scrollToTop {
        width: 40px;
        height: 40px;
        line-height: 40px;
        text-align: center;
        background: DarkGray;
        font-weight: bold;
        font-size: 25px;
        color: DimGray;
        text-decoration: none;
        position: fixed;
        bottom: 0;
        right: 0;
        display: block;
        border: 1px solid grey;
        border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
        box-shadow: 0 0 3px grey;
        transition: opacity 250ms ease-out;
        opacity: .5;
        z-index: 1000;
        cursor: pointer;
        }
        .scrollToTop:hover {
        	text-decoration: none;
        	opacity: 1;
        }
        `;

  const newCommentsNavCss =
    `
        .commentBody{
            padding: 7px;
            scroll-margin-top: 80px;
            border: 1px solid transparent;
        }

        .prevC {
        width: 40px;
        height: 40px;
        line-height: 40px;
        text-align: center;
        background: DarkGray;
        font-weight: bold;
        font-size: 25px;
        color: DimGray;
        text-decoration: none;
        position: fixed;
        bottom: ` +
    (parseInt(settings.newCommentsNavPosition) + 50) +
    `px;
        ` +
    (settings.newCommentsNavPositionSide === "right"
      ? "right: 0;"
      : "left: 0;") +
    `
        border-top-` +
    (settings.newCommentsNavPositionSide === "right" ? "left" : "right") +
    `-radius: 8px;
        display: none;
        border: 1px solid grey;
        box-shadow: 0 0 3px grey;
        transition: opacity 250ms ease-out;
        opacity: .5;
        z-index: 1000;
        cursor: pointer;
        }
        .prevC:hover {
        	text-decoration: none;
        	opacity: 1;
        }
      .BO__note-container button {
        background: none;
        margin: 0;
        padding: 0;
        border: none;
        display: flex;
        align-items: center;
        font-size: 13px;
        fill: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 0.4);
        text-decoration: none;
        font-weight: normal;
        &.active {
            color: #68B1C1;
            fill: #68B1C1;
            font-weight: normal;
        }
        &:hover {
            color: #68B1C1;
        }
    }
        .BO__user-note {
        background: none;
        margin:0;
        padding: 0;
        border: 1px solid;
        display: flex;
        align-items: center;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);
        text-decoration: none;
        width: 400px;
        height: 70px;
        font-weight: normal;
        }


        .nextC {
            width: 40px;
            height: 40px;
            line-height: 40px;
            text-align: center;
            background: DarkGray;
            font-weight: bold;
            font-size: 25px;
            color: DimGray;
            text-decoration: none;
            position: fixed;
            bottom: ` +
    settings.newCommentsNavPosition +
    `px;
            ` +
    (settings.newCommentsNavPositionSide === "right"
      ? "right: 0;"
      : "left: 0;") +
    `
            border-bottom-` +
    (settings.newCommentsNavPositionSide === "right" ? "left" : "right") +
    `-radius: 8px;
            display: none;
            border: 1px solid grey;
            box-shadow: 0 0 3px grey;
            transition: opacity 250ms ease-out;
            opacity: .5;
            z-index: 1000;
            cursor: pointer;
            }
            .nextC:hover {
                text-decoration: none;
                opacity: 1;
            }
        `;

  const postAuthorCss = `
        .author-comment {
        font-weight: bold !important;
        }
        `;

  const css =
    hiddenCss +
    "\n" +
    settingsCss +
    "\n" +
    (settings.changeLayout ? layoutChangeCss : "") +
    "\n" +
    (settings.wideContent ? wideContentCss : "") +
    "\n" +
    (settings.addVocativeToComments ? vocativesCss : "") +
    "\n" +
    (settings.scrollToTop ? scrollToTopCss : "") +
    "\n" +
    (settings.newCommentsNav ? newCommentsNavCss : "") +
    "\n" +
    (settings.markPostAuthor ? postAuthorCss : "") +
    "\n";

  const head = document.head || document.getElementsByTagName("head")[0];
  const style = document.createElement("style");
  head.appendChild(style);

  style.setAttribute("type", "text/css");
  style.appendChild(document.createTextNode(css));

  if (settings.useFont) {
    const link = document.createElement("link");
    link.setAttribute(
      "href",
      "https://fonts.googleapis.com/css?family=" + settings.useFont,
    );
    link.setAttribute("rel", "stylesheet");
    head.appendChild(link);
  }

  //Scrol to top functions
  var timeoutID;

  function scrollToTop() {
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var ch = document.documentElement.clientHeight;
    if (scrolled === 0) {
      clearTimeout(timeoutID);
      timeoutID = null;
      return;
    } else if (scrolled < ch) {
      window.scrollTo(0, parseInt(scrolled / 1.3));
    } else if (scrolled < ch * 3) {
      window.scrollTo(0, parseInt(scrolled / 1.5));
    } else {
      window.scrollTo(0, parseInt(scrolled / 2));
    }
    timeoutID = setTimeout(scrollToTop, 15);
  }

  function onClick(event) {
    if (typeof timeoutID == "number") return;
    scrollToTop();
  }

  function toggleScrollToTop() {
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var ch = document.documentElement.clientHeight;
    var elm = document.querySelector(".scrollToTop");
    if (scrolled > ch / 1.1) {
      elm.style.cssText = "display: block;";
    } else {
      elm.style.cssText = "display: none;";
    }
  }

  if (settings.scrollToTop) {
    window.onscroll = toggleScrollToTop;

    window.onwheel = function () {
      if (typeof timeoutID != "number") return;
      clearTimeout(timeoutID);
      timeoutID = null;
    };

    var div = document.createElement("div");
    div.className = "scrollToTop";
    div.textContent = "🔝";
    div.onclick = onClick;
    document.body.appendChild(div);
    toggleScrollToTop();
  }

  //New Comment navigation

  function onPrev(event) {
    if (count > 0) {
      count--;
      var element = newComments[count];
      if (count != newComments.length) {
        newComments[count + 1].childNodes[0].style.border = "none";
      }
      element.childNodes[0].style.border = "1px solid Gray";
      element.childNodes[0].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    if (count < newComments.length) {
      document.querySelector(".nextC").style.display = "block";
    }
    if (count == 0) {
      document.querySelector(".prevC").style.display = "none";
    }
  }

  function onNext(event) {
    if (count >= 0 && count < newComments.length - 1) {
      count++;
      var element = newComments[count];
      newComments[count - 1].childNodes[0].style.border = "none";
      element.childNodes[0].style.border = "1px solid Gray";
      element.childNodes[0].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    if (count > 0) {
      document.querySelector(".prevC").style.display = "block";
    }
    if (count == newComments.length - 1) {
      document.querySelector(".nextC").style.display = "none";
    }
  }

  function doCommentNav() {
    if (newComments.length > 0) {
      newComments[0].childNodes[0].style.border = "1px solid Gray";
    }
    if (newComments.length > 1 && settings.newCommentsNav) {
      document.querySelector(".nextC").style.display = "block";
    }
  }

  function doc_keyUp(e) {
    var activeElement = document.activeElement;
    if (activeElement.type != "textarea") {
      if (e.code === "KeyJ") {
        onNext();
      }

      if (e.code === "KeyK") {
        onPrev();
      }
    }
  }

  if (settings.newCommentsNav) {
    var prev = document.createElement("div");
    prev.className = "prevC";
    prev.textContent = "⬆️";
    prev.onclick = onPrev;
    document.body.appendChild(prev);

    var next = document.createElement("div");
    next.className = "nextC";
    next.textContent = "⬇️";
    next.onclick = onNext;
    document.body.appendChild(next);

    document.addEventListener("keyup", doc_keyUp, false);
  }

  async function getUserData(uprofile) {
    try {
      const url = "https://api.orbitar.space/api/v1/user/profile";
      const profile = new URL(uprofile);
      const data = JSON.stringify({
        username: decodeURI(profile.pathname.slice(3)),
      });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-type": "application/json; charset=utf-8",
          "x-session-id": getCookie("session"),
        },
        body: data,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonResponse = await response.json();
      return jsonResponse;
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }

  function detectColorTheme() {
    try {
      const parsedValue = JSON.parse(localStorage.getItem("theme"));
      return parsedValue.theme;
    } catch (e) {
      console.error("Error parsing JSON from local storage:", e);
    }
  }

  function createPopup(content) {
    const theme = detectColorTheme();
    const popup = document.createElement("div");

    popup.innerHTML =
      `<div>` +
      content.payload.profile.username +
      `</div>
            <div>Пол: ` +
      convertGender(content.payload.profile.gender) +
      `</div>
            <div>Имя: ` +
      content.payload.profile.name +
      `</div>
            <div>` +
      invitedBy(content.payload.profile.gender) +
      content.payload.invitedBy.username +
      `</div>
            <div>#` +
      content.payload.profile.id +
      `</div>
            <div>` +
      registered(content.payload.profile.gender) +
      formatIsoDateString(content.payload.profile.registered) +
      `</div>
            <div>Карма ` +
      formatWithSign(content.payload.profile.karma) +
      `</div>
            <div>От меня в карме ` +
      formatWithSign(content.payload.profile.vote) +
      `</div>`;

    popup.style.position = "absolute";
    popup.style.padding = "8px";
    popup.style.border = "1px solid";
    popup.style.borderRadius = "4px";
    popup.style.zIndex = "1000";
    popup.style.display = "none";

    if (theme === "dark") {
      popup.style.background = "#333";
      popup.style.color = "#fff";
      popup.style.border = "1px solid #555";
    } else {
      popup.style.background = "#fff";
      popup.style.color = "#000";
      popup.style.border = "1px solid #ddd";
    }

    document.body.appendChild(popup);

    return popup;
  }

  function formatIsoDateString(isoString) {
    const date = new Date(isoString);
    let day = date.getDate().toString().padStart(2, "0");
    let month = (date.getMonth() + 1).toString().padStart(2, "0");
    let year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatWithSign(number) {
    return number > 0 ? `+${number}` : number.toString();
  }

  function invitedBy(genderId) {
    return genderId == 2 ? `Приглашена ` : `Приглашён `;
  }

  function registered(genderId) {
    return genderId == 2 ? `Зарегистрирована ` : `Зарегистрирован `;
  }

  function convertGender(genderId) {
    const genderMap = {
      1: "мужчина",
      2: "женщина",
      0: "не указан",
    };

    return genderMap[genderId] || "не указан";
  }
  function showPopupOnHover(link, content) {
    const popup = createPopup(content);

    const rect = link.getBoundingClientRect();
    popup.style.display = "block";
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    link.addEventListener("mouseout", function () {
      popup.style.display = "none";
    });
    addEventListener("click", function () {
      popup.style.display = "none";
    });
  }

  function showUserInfoPopUp() {
    var list = document.getElementsByClassName("i-user");
    for (var i = 0; i < list.length; i++) {
      (function (item) {
        var hoverTimeout;
        item.onmouseover = function () {
          var link = this;
          clearTimeout(hoverTimeout);
          hoverTimeout = setTimeout(function () {
            getUserData(link.href).then(function (value) {
              showPopupOnHover(link, value);
            });
          }, 500);
        };

        item.onmouseout = function () {
          clearTimeout(hoverTimeout);
        };
      })(list.item(i));
    }
  }

  function markPostAuthor(postAuthorUsername) {
    var comments = document.getElementsByClassName("i-user");
    for (var i = 0; i < comments.length; i++) {
      var comment = comments[i];
      var commentAuthorUsername = comment.textContent.trim();
      if (commentAuthorUsername === postAuthorUsername) {
        comment.classList.add("author-comment");
      }
    }
  }

  function processUserNotes(profileDiv) {
    let hasBeenCalled = false;
    return function () {
      if (!hasBeenCalled) {
        const parentProfileNode = profileDiv.querySelector(
          "[class*=UserProfileName_profile_name__]",
        );
        var textarea = document.createElement("button");
        textarea.innerHTML = "скрыть комментарии";
        //parentProfileNode.appendChild(textarea);
        console.log("Function called!");
        hasBeenCalled = true;
      } else {
        console.log("Function can only be called once.");
      }
    };
  }
})();
