/// <reference path="./dropbox.min.d.ts" />
var wrapper;
(function (wrapper) {
    var Dropbox = window.Dropbox;
    delete window.Dropbox;
    var $ = window.jQuery;
    delete window.$;
    delete window.jQuery;
    var dbx = new Dropbox({ accessToken: 'z98pMtdzbmkAAAAAAABhebCmMa8dvR2xPvM7xCw5XVRe8gzTgFcrznTblAHA-q1w' });
    // var twits = {
    // };
    var twits = /** @class */ (function () {
        function twits() {
            var _this = this;
            this.client = new Dropbox({
                clientId: this.apiKey
            });
            if (document.location.hash) {
                var data = document.location.hash.slice(1);
                console.log(data.split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); }));
            }
            debugger;
            //document.location.href = this.client.getAuthenticationUrl(document.location.href);
            //this.client.getAccessToken()
            this.client.authTokenRevoke(undefined).then(function (res) {
                return _this.client.filesListFolder({
                    path: ""
                });
            }).then(function (res) {
                debugger;
            });
            return;
            this.initApp();
        }
        // Main application
        twits.prototype.initApp = function () {
            // Initialise Dropbox for full access
            this.setStatusMessage("Initializing...");
            // var apiKey = this.isProd ? this.apiKeyProd : this.apiKeyDev;
            // this.client = new _dropbox.Client({
            // 	key: apiKey, sandbox: false
            // });
            // Apparently not needed any more (since Dropbox.js 10.x)
            // // Use the basic redirection authentication driver
            // this.client.authDriver(new Dropbox.Drivers.Redirect({useQuery: false}));
            // Authenticate against Dropbox
            this.setStatusMessage("Authenticating with Dropbox...");
            this.client.authenticate(function (error, client) {
                this.clearStatusMessage();
                if (error) {
                    return this.showError(error); // Something went wrong.
                }
                this.readFolder("/", document.getElementById("twits-files"));
            });
        };
        ;
        twits.prototype.readFolder = function (path, parentNode) {
            // Loading message
            var listParent = document.createElement("ol");
            listParent.appendChild(document.createTextNode("Loading..."));
            parentNode.appendChild(listParent);
            // Read the top level directory
            this.client.stat(path, { readDir: true }, function (error, stat, stats) {
                if (error) {
                    return this.showError(error); // Something went wrong.
                }
                // Remove loading message
                while (listParent.hasChildNodes()) {
                    listParent.removeChild(listParent.firstChild);
                }
                // Load entries
                for (var t = 0; t < stats.length; t++) {
                    stat = stats[t];
                    var listItem = document.createElement("li"), classes = [];
                    if (stat.isFolder) {
                        classes.push("twits-folder");
                    }
                    else {
                        classes.push("twits-file");
                        if (stat.mimeType === "text/html") {
                            classes.push("twits-file-html");
                        }
                    }
                    var link;
                    classes.push("twits-file-entry");
                    if (stat.isFolder || (stat.isFile && stat.mimeType === "text/html")) {
                        link = document.createElement("a");
                        link.href = "#";
                        link.setAttribute("data-twits-path", stat.path);
                        link.addEventListener("click", this.onClickFolderEntry, false);
                    }
                    else {
                        link = document.createElement("span");
                    }
                    link.className = classes.join(" ");
                    var img = document.createElement("img");
                    img.src = "dropbox-icons/16x16/" + stat.typeIcon + ".gif";
                    img.style.width = "16px";
                    img.style.height = "16px";
                    link.appendChild(img);
                    link.appendChild(document.createTextNode(stat.name));
                    if (stat.isFile && stat.humanSize) {
                        var size = document.createElement("span");
                        size.appendChild(document.createTextNode(" (" + stat.humanSize + ")"));
                        link.appendChild(size);
                    }
                    listItem.appendChild(link);
                    listParent.appendChild(listItem);
                }
            });
        };
        ;
        twits.prototype.onClickFolderEntry = function (event) {
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
            // Read the TiddlyWiki file
            // We can't trust Dropbox to have detected that the file is UTF8, so we load it in binary and manually decode it
            this.setStatusMessage("Reading HTML file...");
            this.trackProgress(this.client.readFile(path, { arrayBuffer: true }, function (error, data) {
                if (error) {
                    return this.showError(error); // Something went wrong.
                }
                // We have to manually decode the file as UTF8, annoyingly
                var byteData = new Uint8Array(data);
                data = this.manualConvertUTF8ToUnicode(byteData);
                this.clearStatusMessage();
                // Check it is a valid TiddlyWiki
                if (this.isTiddlyWiki(data)) {
                    // Save the text and path
                    this.originalPath = path;
                    this.originalText = data;
                    // Fillet the content out of the TiddlyWiki
                    //this.filletTiddlyWiki(data);
                    this.loadTW5(data);
                }
                else {
                    this.showError("Not a TiddlyWiki!");
                }
            }));
        };
        twits.prototype.getStatusPanel = function () {
            debugger;
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
        // Determine whether a string is a valid TiddlyWiki 2.x.x document
        twits.prototype.isTiddlyWiki = function (text) {
            return true; //text.indexOf(this.indexTWC) === 0 || text.indexOf(this.indexTW5) > -1;
        };
        ;
        twits.prototype.loadTW5 = function (data) {
            var rawIndex = data.indexOf('<' + '!--~~ Raw markup ~~--' + '>');
            //window.temp = data;
            var doc = document.createElement('html');
            doc.innerHTML = data;
            //this.test = doc;
            while (doc.children[0].childNodes.length > 0) {
                //console.log(doc.children[0].childNodes[0]); 
                try {
                    $(document.head).append(doc.children[0].childNodes[0]);
                }
                catch (e) {
                    console.log(e);
                }
            }
            document.body.className = doc.children[1].className;
            $(document.body).html(doc.children[1].innerHTML);
            //while( doc.children[1].childNodes.length > 0 ) {
            //console.log(doc.children[1].childNodes[0]); 
            //try{ 
            //	document.body.appendChild(doc.children[1].childNodes[0]);
            //} catch (e) {
            //	console.log(e); 
            //} 
            //}
            //var tags = document.getElementsByTagName('script');
            $tw.saverHandler.savers.push({
                info: {
                    name: "tw5-in-the-sky",
                    priority: 5000,
                    capabilities: ["save"]
                },
                save: function (text, method, callback, options) {
                    this.setStatusMessage("Saving changes...");
                    this.setProgress("");
                    this.trackProgress(this.client.writeFile(this.originalPath, text, function (error, stat) {
                        if (error) {
                            this.showError(error); // Something went wrong.
                            callback(error);
                            return;
                        }
                        else {
                            this.clearStatusMessage();
                            callback(null);
                        }
                    }), true);
                    return true;
                }
            });
        };
        ;
        // Extract the blocks of a TiddlyWiki 2.x.x document and add them to the current document
        twits.prototype.filletTiddlyWiki = function (text) {
            // Extract a block from a string given start and end markers
            var extractBlock = function (start, end) {
                var s = text.indexOf(start);
                if (s !== -1) {
                    var e = text.indexOf(end, s);
                    if (e !== -1) {
                        return text.substring(s + start.length, e);
                    }
                }
                return null;
            };
            // Collect up all the blocks in the document
            var output = { html: [], script: [], style: [] };
            for (var block = 0; block < this.blocks.length; block++) {
                var blockInfo = this.blocks[block], blockText = extractBlock(blockInfo.start, blockInfo.end);
                if (blockText) {
                    output[blockInfo.type].push(blockText);
                }
            }
            // Process the HTML blocks
            document.body.innerHTML = output.html.join("\n");
            // Process the style blocks
            var styleElement = document.createElement("style");
            styleElement.type = "text/css";
            styleElement.appendChild(document.createTextNode(output.style.join("\n")));
            document.getElementsByTagName("head")[0].appendChild(styleElement);
            // Compose the boot tail script
            var tail = "twits.patchTiddlyWiki();";
            // Process the script blocks
            var scr = document.createElement("script");
            scr.type = "text/javascript";
            scr.appendChild(document.createTextNode(output.script.join("\n") + "\n" + tail + "\n"));
            document.getElementsByTagName("head")[0].appendChild(scr);
        };
        ;
        //TWC
        twits.prototype.patchedSaveChanges = function (onlyIfDirty, tiddlers) {
            if (onlyIfDirty && !store.isDirty())
                return;
            clearMessage();
            this.setStatusMessage("Saving changes...");
            this.setProgress("");
            // Save the file to Dropbox
            this.trackProgress(this.client.writeFile(this.originalPath, revised, function (error, stat) {
                if (error) {
                    return this.showError(error); // Something went wrong.
                }
                this.clearStatusMessage();
                displayMessage(config.messages.mainSaved);
                store.setDirty(false);
            }), true);
        };
        ;
        twits.prototype.patchTiddlyWiki = function () {
            window.saveChanges = this.patchedSaveChanges;
            config.tasks.save.action = this.patchedSaveChanges;
            // Older TiddlyWikis use loadOptionsCookie()
            var overrideFn = window.loadOptions ? "loadOptions" : "loadOptionsCookie";
            var _old_ = window[overrideFn];
            window[overrideFn] = function () {
                _old_();
                config.options.chkHttpReadOnly = false;
            };
            main();
            window[overrideFn] = _old_;
            story.closeAllTiddlers();
            story.displayTiddlers(null, store.filterTiddlers(store.getTiddlerText("DefaultTiddlers")));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdjbG91ZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInR3Y2xvdWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMkNBQTJDO0FBUTNDLElBQVUsT0FBTyxDQTJZaEI7QUEzWUQsV0FBVSxPQUFPO0lBRWhCLElBQU0sT0FBTyxHQUFnQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQzVELE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUN0QixJQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3hCLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNoQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFJckIsSUFBTSxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxXQUFXLEVBQUUsa0VBQWtFLEVBQUUsQ0FBQyxDQUFDO0lBRTdHLGdCQUFnQjtJQUNoQixLQUFLO0lBRUw7UUFNQztZQUFBLGlCQW9CQztZQW5CQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksT0FBTyxDQUFDO2dCQUN6QixRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU07YUFDckIsQ0FBQyxDQUFBO1lBQ0YsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUM1QixJQUFNLElBQUksR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFyQixDQUFxQixDQUFDLEVBQTVDLENBQTRDLENBQUMsQ0FBQyxDQUFDO1lBQ3JGLENB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