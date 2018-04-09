"use strict";
/// <reference path="./dropbox.min.d.ts" />
/// <reference path="./Rx.min.d.ts" />
var wrapper;
(function (wrapper) {
    //PARANOIA: Delete the window property of these libraries to prevent 
    //Javascript in the page from messing with them.
    var Rx = window.Rx;
    delete window.Rx;
    var Dropbox = window.Dropbox;
    delete window.Dropbox;
    var $ = window.jQuery;
    delete window.$;
    delete window.jQuery;
    //load classes from Rx
    var Observable = Rx.Observable, Subject = Rx.Subject, Subscriber = Rx.Subscriber, Subscription = Rx.Subscription;
    var twits = /** @class */ (function () {
        function twits(type, hash) {
            var _this = this;
            this.apiKeyFull = "gy3j4gsa191p31x";
            this.apiKeyApps = "tu8jc7jsdeg55ta";
            this.token = {};
            if (type !== "apps" && type !== "full")
                throw "type must be either apps or full";
            this.client = new Dropbox({
                clientId: (type === "full" ? this.apiKeyFull : (type === "apps" ? this.apiKeyApps : ""))
            });
            // Authenticate against Dropbox
            this.setStatusMessage("Authenticating with Dropbox...");
            if (hash) {
                var data = hash[0] === "#" ? hash.slice(1) : hash;
                data.split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); }).forEach(function (e) {
                    _this.token[e[0]] = e[1];
                });
            }
            if (!this.token.access_token) {
                location.href = this.client.getAuthenticationUrl(location.href);
                return;
            }
            else {
                this.client.setAccessToken(this.token.access_token);
            }
            this.initApp();
        }
        // Main application
        twits.prototype.initApp = function () {
            var _this = this;
            this.clearStatusMessage();
            this.client.usersGetCurrentAccount(undefined).then(function (res) {
                _this.user = res;
                var profile = document.getElementById("twits-profile");
                var pic = document.createElement('img');
                pic.src = _this.user.profile_photo_url;
                pic.classList.add("profile-pic");
                profile.appendChild(pic);
                var textdata = document.createElement('span');
                _this.user.account_type;
                textdata.innerText = _this.user.name.display_name
                    + (_this.user.team ? ("\n" + _this.user.team.name) : "");
                textdata.classList.add(_this.user.team ? "profile-name-team" : "profile-name");
                profile.appendChild(textdata);
                profile.classList.remove("startup");
                _this.readFolder("", document.getElementById("twits-files"));
            });
        };
        ;
        twits.prototype.isFileMetadata = function (a) {
            return a[".tag"] === "file";
        };
        twits.prototype.isFolderMetadata = function (a) {
            return a[".tag"] === "folder";
        };
        twits.prototype.isHtmlFile = function (stat) {
            return ['.htm', '.html'].indexOf(stat.name.slice(stat.name.lastIndexOf('.'))) > -1;
        };
        twits.prototype.getHumanSize = function (size) {
            var TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            var power = 0;
            while (size >= 1024) {
                size /= 1024;
                power++;
            }
            return size.toFixed(1) + TAGS[power];
        };
        twits.prototype.streamFilesListFolder = function (path) {
            var output = new Subject();
            function resHandler(res) {
                output.next(res.entries);
                if (res.has_more)
                    return this.client.filesListFolderContinue({
                        cursor: res.cursor
                    }).then(resHandler);
                else
                    output.complete();
            }
            this.client.filesListFolder({
                path: path
            }).then(resHandler);
            return output.asObservable();
        };
        twits.prototype.readFolder = function (path, parentNode) {
            var _this = this;
            var loadingMessage = document.createElement("li");
            loadingMessage.innerText = "Loading...";
            loadingMessage.classList.add("loading-message");
            var listParent = document.createElement("ol");
            listParent.appendChild(loadingMessage);
            parentNode.appendChild(listParent);
            var filelist = [];
            this.streamFilesListFolder(path).subscribe(function (stats) {
                filelist.push.apply(filelist, stats);
                loadingMessage.innerText = "Loading " + filelist.length + "...";
            }, function (x) { return console.error(x); }, function () {
                loadingMessage.remove();
                filelist.sort(function (a, b) {
                    //order by isFolder DESC, name ASC
                    return (+_this.isFolderMetadata(b) - +_this.isFolderMetadata(a))
                        || a.name.localeCompare(b.name);
                });
                for (var t = 0; t < filelist.length; t++) {
                    var stat = filelist[t];
                    var listItem = document.createElement("li"), classes = [];
                    if (_this.isFolderMetadata(stat)) {
                        classes.push("twits-folder");
                    }
                    else if (_this.isFileMetadata(stat)) {
                        classes.push("twits-file");
                        if (_this.isHtmlFile(stat)) {
                            classes.push("twits-file-html");
                        }
                    }
                    var link;
                    classes.push("twits-file-entry");
                    if (_this.isFolderMetadata(stat) || (_this.isFileMetadata(stat) && _this.isHtmlFile(stat))) {
                        link = document.createElement("a");
                        link.href = "javascript:false;";
                        link.setAttribute("data-twits-path", stat.path_lower);
                        link.addEventListener("click", _this.onClickFolderEntry(), false);
                    }
                    else {
                        link = document.createElement("span");
                    }
                    link.className = classes.join(" ");
                    var img = document.createElement("img");
                    img.src = "dropbox-icons-broken.gif";
                    img.style.width = "16px";
                    img.style.height = "16px";
                    link.appendChild(img);
                    link.appendChild(document.createTextNode(stat.name));
                    if (_this.isFileMetadata(stat) && _this.getHumanSize(stat.size)) {
                        var size = document.createElement("span");
                        size.appendChild(document.createTextNode(" (" + _this.getHumanSize(stat.size) + ")"));
                        link.appendChild(size);
                    }
                    listItem.appendChild(link);
                    listParent.appendChild(listItem);
                }
            });
        };
        ;
        twits.prototype.onClickFolderEntry = function () {
            var self = this;
            return function (event) {
                var path = this.getAttribute("data-twits-path"), classes = this.className.split(" ");
                if (classes.indexOf("twits-folder") !== -1 && classes.indexOf("twits-folder-open") === -1) {
                    classes.push("twits-folder-open");
                    self.readFolder(path, this.parentNode);
                }
                if (classes.indexOf("twits-file-html") !== -1) {
                    self.openFile(path);
                }
                this.className = classes.join(" ");
                event.preventDefault();
                return false;
            };
        };
        ;
        twits.prototype.openFile = function (path) {
            var _this = this;
            // Read the TiddlyWiki file
            // We can't trust Dropbox to have detected that the file is UTF8, so we load it in binary and manually decode it
            this.setStatusMessage("Reading HTML file...");
            this.client.filesDownload({
                path: path
            }).then(function (res) {
                //debugger;
                _this.currentRev = res.rev;
                return new Promise(function (resolve) {
                    var data = res.fileBlob;
                    console.log(data.type);
                    var reader = new FileReader();
                    reader.addEventListener("loadend", function () {
                        // We have to manually decode the file as UTF8, annoyingly
                        // [ I wonder if this is still necessary in v2 since it is a buffer -Arlen ]
                        var byteData = new Uint8Array(reader.result);
                        var unicode = _this.manualConvertUTF8ToUnicode(byteData);
                        _this.originalPath = path;
                        _this.originalText = unicode;
                        resolve(unicode);
                    });
                    reader.readAsArrayBuffer(data);
                    //debugger;
                });
            }).then(function (data) {
                _this.loadTW5(data);
            });
        };
        twits.prototype.getStatusPanel = function () {
            // debugger;
            var getElement = function (id, parentNode) {
                parentNode = parentNode || document;
                var el = document.getElementById(id);
                if (!el) {
                    el = document.createElement("div");
                    el.setAttribute("id", id);
                    parentNode.appendChild(el);
                }
                return el;
            }, status = getElement("twits-status", document.body), message = getElement("twits-message", status), progress = getElement("twits-progress", status);
            status.style.display = "block";
            if (this.user) {
                var profile = document.createElement('img');
                profile.src = this.user.profile_photo_url;
                profile.classList.add("profile-pic");
                status.insertBefore(profile, message);
            }
            return { status: status, message: message, progress: progress };
        };
        ;
        twits.prototype.clearStatusMessage = function () {
            var status = this.getStatusPanel();
            status.status.style.display = "none";
        };
        twits.prototype.setStatusMessage = function (text) {
            var status = this.getStatusPanel();
            while (status.message.hasChildNodes()) {
                status.message.removeChild(status.message.firstChild);
            }
            status.message.appendChild(document.createTextNode(text));
        };
        ;
        twits.prototype.setProgress = function (text) {
            var status = this.getStatusPanel();
            while (status.progress.hasChildNodes()) {
                status.progress.removeChild(status.progress.firstChild);
            }
            status.progress.appendChild(document.createTextNode(text));
        };
        ;
        // Display an error
        twits.prototype.showError = function (error) {
            this.setStatusMessage("Error: " + error);
            this.setProgress("");
        };
        ;
        twits.prototype.trackProgress = function (xhr, isUpload) {
            var onProgressHandler = function (event) {
                this.setProgress(Math.ceil(event.loaded / 1024) + "KB");
            }, onLoadHandler = function () {
            }, onErrorHandler = function () {
                this.setStatusMessage("XHR error");
            };
            var src = isUpload ? xhr.upload : xhr;
            src.addEventListener("progress", onProgressHandler, false);
            src.addEventListener("load", onLoadHandler, false);
            src.addEventListener("error", onErrorHandler, false);
        };
        ;
        twits.prototype.loadTW5 = function (data) {
            var _this = this;
            location.hash = "";
            var rawIndex = data.indexOf('<' + '!--~~ Raw markup ~~--' + '>');
            var doc = document.createElement('html');
            doc.innerHTML = data;
            while (doc.children[0].childNodes.length > 0) {
                try {
                    $(document.head).append(doc.children[0].childNodes[0]);
                }
                catch (e) {
                    console.log(e);
                }
            }
            document.body.className = doc.children[1].className;
            $(document.body).html(doc.children[1].innerHTML);
            $tw.saverHandler.savers.push({
                info: {
                    name: "tw5-in-the-sky",
                    priority: 5000,
                    capabilities: ["save", "autosave"]
                },
                save: function (text, method, callback, options) {
                    _this.setStatusMessage("Saving changes...");
                    _this.client.filesUpload({
                        path: _this.originalPath,
                        mode: {
                            ".tag": "update",
                            "update": _this.currentRev
                        },
                        contents: text
                    }).then(function (res) {
                        _this.clearStatusMessage();
                        _this.currentRev = res.rev;
                        callback(null);
                    }).catch(function (err) {
                        console.log(err);
                        callback(err);
                    });
                    //TODO: add progress tracker
                    return true;
                }
            });
        };
        ;
        twits.prototype.manualConvertUTF8ToUnicode = function (utf) {
            var uni = [], src = 0, b1, b2, b3, c;
            while (src < utf.length) {
                b1 = utf[src++];
                if (b1 < 0x80) {
                    uni.push(String.fromCharCode(b1));
                }
                else if (b1 < 0xE0) {
                    b2 = utf[src++];
                    c = String.fromCharCode(((b1 & 0x1F) << 6) | (b2 & 0x3F));
                    uni.push(c);
                }
                else {
                    b2 = utf[src++];
                    b3 = utf[src++];
                    c = String.fromCharCode(((b1 & 0xF) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F));
                    uni.push(c);
                }
            }
            return uni.join("");
        };
        return twits;
    }());
    var locationHash = location.hash;
    location.hash = "";
    // Do our stuff when the page has loaded
    document.addEventListener("DOMContentLoaded", function (event) {
        var url = new URL(location.href);
        var accessType = url.searchParams.get('type');
        if (!accessType)
            return;
        $('#twits-selector').hide();
        new twits(accessType, locationHash);
    }, false);
})(wrapper || (wrapper = {}));
