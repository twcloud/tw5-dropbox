
(function () {

	window.twits = {
		// Original text of the TiddlyWiki file
		originalText: null,
		// Dropbox keys
		isProd: (window.location.protocol + "//" + window.location.host + window.location.pathname) ===
		"https://dl.dropboxusercontent.com/spa/4f6lw6nhu5zn5pr/TiddlyWiki/public/index.html",
		apiKeyProd: "waukml5k6zt6vzr",
		apiKeyDev: "5zahnrxzw6wsy70",
		// The start of valid TiddlyWiki 2.x.x documents
		start: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n<head>\n<' + 'script id="versionArea" type="text/javascript">\n//<![CDATA[\nvar version = {title: "TiddlyWiki", major: ',
		// Definitions of the type, start and end of each block of a TiddlyWiki document
		blocks: [{
			type: 'html',
			start: '<' + '/noscript>',
			end: '<!--POST-STOREAREA-->'
		}, {
			type: 'script',
			start: '<' + 'script id="versionArea" type="text/javascript">\n//<![CDATA[',
			end: '//]]>\n</' + 'script>'
		}, {
			type: 'style', // Recent TiddlyWikis
			start: '<' + 'style id="styleArea" type="text/css">',
			end: '</' + 'style>'
		}, {
			type: 'style', // Older TiddlyWikis
			start: '<' + 'style type="text/css">',
			end: '</' + 'style>'
		}, {
			type: 'script',
			start: '<' + 'script id="jsArea" type="text/javascript">\n//<![CDATA[',
			end: '</' + 'script>'
		}, {
			type: 'script',
			start: '<' + 'script id="jsdeprecatedArea" type="text/javascript">',
			end: '</' + 'script>'
		}, {
			type: 'script',
			start: '<' + 'script id="jslibArea" type="text/javascript">',
			end: '</' + 'script>'
		}, {
			type: 'script',
			start: '<' + 'script id="jqueryArea" type="text/javascript">',
			end: '</' + 'script>'
		}]
	};

	// Main application
	twits.initApp = function () {
		// Indicate whether we're running in dev
		if (!twits.isProd) {
			var dev = document.getElementById("twits-dev");
			dev.appendChild(document.createTextNode("(dev)"));
		}
		// Initialise Dropbox for full access
		twits.setStatusMessage("Initializing...");
		var apiKey = twits.isProd ? twits.apiKeyProd : twits.apiKeyDev;
		twits.client = new Dropbox.Client({
			key: apiKey, sandbox: false
		});

		// Apparently not needed any more (since Dropbox.js 10.x)
		// // Use the basic redirection authentication driver
		// twits.client.authDriver(new Dropbox.Drivers.Redirect({useQuery: false}));

		// Authenticate against Dropbox
		twits.setStatusMessage("Authenticating with Dropbox...");
		twits.client.authenticate(function (error, client) {
			twits.clearStatusMessage();
			if (error) {
				return twits.showError(error);  // Something went wrong.
			}
			twits.readFolder("/", document.getElementById("twits-files"));

		});
	};

	twits.readFolder = function (path, parentNode) {
		// Loading message
		var listParent = document.createElement("ol");
		listParent.appendChild(document.createTextNode("Loading..."));
		parentNode.appendChild(listParent);
		// Read the top level directory
		twits.client.stat(path, { readDir: true }, function (error, stat, stats) {
			if (error) {
				return twits.showError(error);  // Something went wrong.
			}
			// Remove loading message
			while (listParent.hasChildNodes()) {
				listParent.removeChild(listParent.firstChild);
			}
			// Load entries
			for (var t = 0; t < stats.length; t++) {
				stat = stats[t];
				var listItem = document.createElement("li"),
					classes = [];
				if (stat.isFolder) {
					classes.push("twits-folder");
				} else {
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
					link.addEventListener("click", twits.onClickFolderEntry, false);
				} else {
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

	twits.onClickFolderEntry = function (event) {
		var path = this.getAttribute("data-twits-path"),
			classes = this.className.split(" ");
		if (classes.indexOf("twits-folder") !== -1 && classes.indexOf("twits-folder-open") === -1) {
			classes.push("twits-folder-open");
			twits.readFolder(path, this.parentNode);
		}
		if (classes.indexOf("twits-file-html") !== -1) {
			twits.openFile(path);
		}
		this.className = classes.join(" ");
		event.preventDefault();
		return false;
	};

	twits.openFile = function (path) {
		// Read the TiddlyWiki file
		// We can't trust Dropbox to have detected that the file is UTF8, so we load it in binary and manually decode it
		twits.setStatusMessage("Reading HTML file...");
		twits.trackProgress(twits.client.readFile(path, { arrayBuffer: true }, function (error, data) {
			if (error) {
				return twits.showError(error);  // Something went wrong.
			}
			// We have to manually decode the file as UTF8, annoyingly
			var byteData = new Uint8Array(data);
			data = twits.manualConvertUTF8ToUnicode(byteData);
			twits.clearStatusMessage();
			// Check it is a valid TiddlyWiki
			if (twits.isTiddlyWiki(data)) {
				// Save the text and path
				twits.originalPath = path;
				twits.originalText = data;
				// Fillet the content out of the TiddlyWiki
				twits.filletTiddlyWiki(data);
			} else {
				twits.showError("Not a TiddlyWiki!");
			}
		}));
	}

	twits.getStatusPanel = function () {
		var getElement = function (id, parentNode) {
			parentNode = parentNode || document;
			var el = document.getElementById(id);
			if (!el) {
				el = document.createElement("div");
				el.setAttribute("id", id);
				parentNode.appendChild(el);
			}
			return el;
		},
			status = getElement("twits-status", document.body),
			message = getElement("twits-message", status),
			progress = getElement("twits-progress", status);
		status.style.display = "block";
		return { status: status, message: message, progress: progress };
	};

	twits.clearStatusMessage = function () {
		var status = twits.getStatusPanel();
		status.status.style.display = "none";
	}

	twits.setStatusMessage = function (text) {
		var status = twits.getStatusPanel();
		while (status.message.hasChildNodes()) {
			status.message.removeChild(status.message.firstChild);
		}
		status.message.appendChild(document.createTextNode(text));
	};

	twits.setProgress = function (text) {
		var status = twits.getStatusPanel();
		while (status.progress.hasChildNodes()) {
			status.progress.removeChild(status.progress.firstChild);
		}
		status.progress.appendChild(document.createTextNode(text));
	};

	// Display an error
	twits.showError = function (error) {
		twits.setStatusMessage("Error: " + error);
		twits.setProgress("");
	};

	twits.trackProgress = function (xhr, isUpload) {
		var onProgressHandler = function (event) {
			twits.setProgress(Math.ceil(event.loaded / 1024) + "KB");
		},
			onLoadHandler = function () {
			},
			onErrorHandler = function () {
				twits.setStatusMessage("XHR error");
			};
		var src = isUpload ? xhr.upload : xhr;
		src.addEventListener("progress", onProgressHandler, false);
		src.addEventListener("load", onLoadHandler, false);
		src.addEventListener("error", onErrorHandler, false);
	};

	// Determine whether a string is a valid TiddlyWiki 2.x.x document
	twits.isTiddlyWiki = function (text) {
		return text.indexOf(twits.start) === 0;
	};

	// Extract the blocks of a TiddlyWiki 2.x.x document and add them to the current document
	twits.filletTiddlyWiki = function (text) {
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
		for (var block = 0; block < twits.blocks.length; block++) {
			var blockInfo = twits.blocks[block],
				blockText = extractBlock(blockInfo.start, blockInfo.end);
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

	twits.patchedSaveChanges = function (onlyIfDirty, tiddlers) {
		if (onlyIfDirty && !store.isDirty())
			return;
		clearMessage();
		twits.setStatusMessage("Saving changes...");
		twits.setProgress("");
		var posDiv = locateStoreArea(twits.originalText);
		if (!posDiv) {
			alert(config.messages.invalidFileError.format([localPath]));
			return;
		}
		var revised = twits.originalText;
		// Update the file
		revised = revised.substr(0, posDiv[0] + startSaveArea.length) + "\n" +
			store.allTiddlersAsHtml() + "\n" +
			revised.substr(posDiv[1]);
		var newSiteTitle = getPageTitle().htmlEncode();
		revised = revised.replaceChunk("<title" + ">", "</title" + ">", " " + newSiteTitle + " ");
		revised = updateLanguageAttribute(revised);
		revised = updateMarkupBlock(revised, "PRE-HEAD", "MarkupPreHead");
		revised = updateMarkupBlock(revised, "POST-HEAD", "MarkupPostHead");
		revised = updateMarkupBlock(revised, "PRE-BODY", "MarkupPreBody");
		revised = updateMarkupBlock(revised, "POST-SCRIPT", "MarkupPostBody");
		// Save the file to Dropbox
		twits.trackProgress(twits.client.writeFile(twits.originalPath, revised, function (error, stat) {
			if (error) {
				return twits.showError(error);  // Something went wrong.
			}
			twits.clearStatusMessage();
			displayMessage(config.messages.mainSaved);
			store.setDirty(false);
		}), true);
	};

	twits.patchTiddlyWiki = function () {
		window.saveChanges = twits.patchedSaveChanges;
		config.tasks.save.action = twits.patchedSaveChanges;
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

	twits.manualConvertUTF8ToUnicode = function (utf) {
		var uni = [],
			src = 0,
			b1, b2, b3,
			c;
		while (src < utf.length) {
			b1 = utf[src++];
			if (b1 < 0x80) {
				uni.push(String.fromCharCode(b1));
			} else if (b1 < 0xE0) {
				b2 = utf[src++];
				c = String.fromCharCode(((b1 & 0x1F) << 6) | (b2 & 0x3F));
				uni.push(c);
			} else {
				b2 = utf[src++];
				b3 = utf[src++];
				c = String.fromCharCode(((b1 & 0xF) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F));
				uni.push(c);
			}
		}
		return uni.join("");
	};

	// Do our stuff when the page has loaded
	document.addEventListener("DOMContentLoaded", function (event) {
		twits.initApp();
	}, false);

})();
