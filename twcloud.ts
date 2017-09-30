/// <reference path="./dropbox.min.d.ts" />
interface Window {
	saveChanges: Function;
	Dropbox: typeof Dropbox;
	jQuery: any;
	$: any;
	$tw: any;
}
namespace wrapper {

	const Dropbox: typeof DropboxTypes.Dropbox = window.Dropbox;
	delete window.Dropbox;
	const $ = window.jQuery;
	delete window.$;
	delete window.jQuery;
	declare const $tw: any, store: any, clearMessage: Function, displayMessage: Function;
	declare const story: any, main: Function, config: any;

	const dbx = new Dropbox({ accessToken: 'z98pMtdzbmkAAAAAAABhebCmMa8dvR2xPvM7xCw5XVRe8gzTgFcrznTblAHA-q1w' });

	// var twits = {
	// };

	class twits {
		client: Dropbox;
		isProd: false                // (window.location.protocol + "//" + window.location.host + window.location.pathname) === "https://dl.dropboxusercontent.com/spa/4f6lw6nhu5zn5pr/TiddlyWiki/public/index.html",
		apiKeyProd: ""               //waukml5k6zt6vzr
		apiKey: "gy3j4gsa191p31x" //5zahnrxzw6wsy70

		constructor() {
			this.client = new Dropbox({
				clientId: "gy3j4gsa191p31x",
				//accessToken: 'z98pMtdzbmkAAAAAAABhebCmMa8dvR2xPvM7xCw5XVRe8gzTgFcrznTblAHA-q1w' 
			})
			if (document.location.hash) {
				const data = document.location.hash.slice(1);
				console.log(data.split('&').map(e => e.split('=').map(f => decodeURIComponent(f))));
			}
			debugger;
			document.location.href = this.client.getAuthenticationUrl(document.location.href);

			return;
			this.initApp();
		}

		// Main application
		initApp() {
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
					return this.showError(error);  // Something went wrong.
				}
				this.readFolder("/", document.getElementById("twits-files"));

			});
		};

		readFolder(path, parentNode) {
			// Loading message
			var listParent = document.createElement("ol");
			listParent.appendChild(document.createTextNode("Loading..."));
			parentNode.appendChild(listParent);
			// Read the top level directory
			this.client.stat(path, { readDir: true }, function (error, stat, stats) {
				if (error) {
					return this.showError(error);  // Something went wrong.
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
						link.addEventListener("click", this.onClickFolderEntry, false);
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

		onClickFolderEntry(event) {
			const self = this;
			return function (this: HTMLAnchorElement, event) {
				var path = this.getAttribute("data-twits-path"),
					classes = this.className.split(" ");
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
			}
		};

		openFile(path) {
			// Read the TiddlyWiki file
			// We can't trust Dropbox to have detected that the file is UTF8, so we load it in binary and manually decode it
			this.setStatusMessage("Reading HTML file...");
			this.trackProgress(this.client.readFile(path, { arrayBuffer: true }, function (error, data) {
				if (error) {
					return this.showError(error);  // Something went wrong.
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
				} else {
					this.showError("Not a TiddlyWiki!");
				}
			}));
		}



		getStatusPanel() {
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
			},
				status = getElement("twits-status", document.body),
				message = getElement("twits-message", status),
				progress = getElement("twits-progress", status);
			status.style.display = "block";
			return { status: status, message: message, progress: progress };
		};

		clearStatusMessage() {
			var status = this.getStatusPanel();
			status.status.style.display = "none";
		}

		setStatusMessage(text) {
			var status = this.getStatusPanel();
			while (status.message.hasChildNodes()) {
				status.message.removeChild(status.message.firstChild);
			}
			status.message.appendChild(document.createTextNode(text));
		};

		setProgress(text) {
			var status = this.getStatusPanel();
			while (status.progress.hasChildNodes()) {
				status.progress.removeChild(status.progress.firstChild);
			}
			status.progress.appendChild(document.createTextNode(text));
		};

		// Display an error
		showError(error) {
			this.setStatusMessage("Error: " + error);
			this.setProgress("");
		};

		trackProgress(xhr, isUpload?) {
			var onProgressHandler = function (event) {
				this.setProgress(Math.ceil(event.loaded / 1024) + "KB");
			},
				onLoadHandler = function () {
				},
				onErrorHandler = function () {
					this.setStatusMessage("XHR error");
				};
			var src = isUpload ? xhr.upload : xhr;
			src.addEventListener("progress", onProgressHandler, false);
			src.addEventListener("load", onLoadHandler, false);
			src.addEventListener("error", onErrorHandler, false);

		};

		// Determine whether a string is a valid TiddlyWiki 2.x.x document
		isTiddlyWiki(text) {
			return true; //text.indexOf(this.indexTWC) === 0 || text.indexOf(this.indexTW5) > -1;
		};

		loadTW5(data) {
			var rawIndex = data.indexOf('<' + '!--~~ Raw markup ~~--' + '>');

			//window.temp = data;

			var doc = document.createElement('html');
			doc.innerHTML = data;

			//this.test = doc;

			while (doc.children[0].childNodes.length > 0) {
				//console.log(doc.children[0].childNodes[0]); 
				try {
					$(document.head).append(doc.children[0].childNodes[0]);
				} catch (e) {
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
							this.showError(error);  // Something went wrong.
							callback(error);
							return;
						} else {
							this.clearStatusMessage();
							callback(null);
						}
					}), true);
					return true;
				}
			});

		};
		blocks: any[];
		// Extract the blocks of a TiddlyWiki 2.x.x document and add them to the current document
		filletTiddlyWiki(text) {
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
				var blockInfo = this.blocks[block],
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

		//TWC

		patchedSaveChanges(onlyIfDirty, tiddlers) {

			if (onlyIfDirty && !store.isDirty())
				return;
			clearMessage();
			this.setStatusMessage("Saving changes...");
			this.setProgress("");

			// Save the file to Dropbox
			this.trackProgress(this.client.writeFile(this.originalPath, revised, function (error, stat) {
				if (error) {
					return this.showError(error);  // Something went wrong.
				}
				this.clearStatusMessage();
				displayMessage(config.messages.mainSaved);
				store.setDirty(false);
			}), true);
		};

		patchTiddlyWiki() {
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

		manualConvertUTF8ToUnicode(utf) {
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
		}
	}
	// Do our stuff when the page has loaded
	document.addEventListener("DOMContentLoaded", function (event) {
		//new twits();
	}, false);

}