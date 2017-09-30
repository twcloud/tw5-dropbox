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
        function twits() {
            var _this = this;
            this.apiKey = "gy3j4gsa191p31x"; //5zahnrxzw6wsy70
            this.token = {};
            this.client = new Dropbox({
                clientId: this.apiKey
            });
            // Authenticate against Dropbox
            this.setStatusMessage("Authenticating with Dropbox...");
            if (document.location.hash) {
                var data = document.location.hash.slice(1);
                data.split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); }).forEach(function (e) {
                    _this.token[e[0]] = e[1];
                });
                location.hash = "";
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
            this.clearStatusMessage();
            this.readFolder("", document.getElementById("twits-files"));
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
            // Loading message
            var loadingMessage = document.createTextNode("Loading...");
            var listParent = document.createElement("ol");
            listParent.appendChild(loadingMessage);
            parentNode.appendChild(listParent);
            this.streamFilesListFolder(path).subscribe(function (stats) {
                // Load entries
                for (var t = 0; t < stats.length; t++) {
                    var stat = stats[t];
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
            }, function (x) { return console.error(x); }, function () {
                loadingMessage.remove();
                //TODO: Insert sorting here
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
                    capabilities: ["save"]
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
    // Do our stuff when the page has loaded
    document.addEventListener("DOMContentLoaded", function (event) {
        new twits();
    }, false);
})(wrapper || (wrapper = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdjbG91ZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInR3Y2xvdWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLDJDQUEyQztBQUMzQyxzQ0FBc0M7QUFZdEMsSUFBVSxPQUFPLENBd1ZoQjtBQXhWRCxXQUFVLE9BQU87SUFDaEIscUVBQXFFO0lBQ3JFLGdEQUFnRDtJQUNoRCxJQUFNLEVBQUUsR0FBUyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQzNCLE9BQU8sTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUVqQixJQUFNLE9BQU8sR0FBZ0MsTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUM1RCxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFFdEIsSUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUN4QixPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDaEIsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBTXJCLHNCQUFzQjtJQUNkLElBQUEsMEJBQVUsRUFBRSxvQkFBTyxFQUFFLDBCQUFVLEVBQUUsOEJBQVksQ0FBUTtJQUc3RDtRQWVDO1lBQUEsaUJBdUJDO1lBL0JELFdBQU0sR0FBRyxpQkFBaUIsQ0FBQSxDQUFDLGlCQUFpQjtZQUM1QyxVQUFLLEdBS0QsRUFBUyxDQUFDO1lBR2IsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDekIsUUFBUSxFQUFFLElBQUksQ0FBQyxNQUFNO2FBQ3JCLENBQUMsQ0FBQztZQUVILCtCQUErQjtZQUMvQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztZQUV4RCxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLElBQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLEtBQUssQ0FB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