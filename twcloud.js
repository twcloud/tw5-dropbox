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
            this.client = new Dropbox({
                clientId: "gy3j4gsa191p31x",
            });
            if (document.location.hash) {
                var data = document.location.hash.slice(1);
                console.log(data.split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); }));
            }
            debugger;
            document.location.href = this.client.getAuthenticationUrl(document.location.href);
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
        //new twits();
    }, false);
})(wrapper || (wrapper = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdjbG91ZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInR3Y2xvdWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMkNBQTJDO0FBUTNDLElBQVUsT0FBTyxDQXFZaEI7QUFyWUQsV0FBVSxPQUFPO0lBRWhCLElBQU0sT0FBTyxHQUFnQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQzVELE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUN0QixJQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3hCLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNoQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFJckIsSUFBTSxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxXQUFXLEVBQUUsa0VBQWtFLEVBQUUsQ0FBQyxDQUFDO0lBRTdHLGdCQUFnQjtJQUNoQixLQUFLO0lBRUw7UUFNQztZQUNDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxPQUFPLENBQUM7Z0JBQ3pCLFFBQVEsRUFBRSxpQkFBaUI7YUFFM0IsQ0FBQyxDQUFBO1lBQ0YsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUM1QixJQUFNLElBQUksR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFyQixDQUFxQixDQUFDLEVBQTVDLENBQTRDLENBQUMsQ0FBQyxDQUFDO1lBQ3JGLENBQUM7WUFDRCxRQUFRLENBQUM7WUFD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