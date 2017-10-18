/// <reference path="./dropbox.min.d.ts" />
/// <reference path="./Rx.min.d.ts" />

interface Window {
	saveChanges: Function;
	Dropbox: typeof Dropbox;
	jQuery: any;
	$: any;
	$tw: any;
	Rx: typeof Rx;
}
type rxjs = typeof Rx;
type Hashmap<T> = { [K: string]: T };
namespace wrapper {
	//PARANOIA: Delete the window property of these libraries to prevent 
	//Javascript in the page from messing with them.
	const Rx: rxjs = window.Rx;
	delete window.Rx;

	const Dropbox: typeof DropboxTypes.Dropbox = window.Dropbox;
	delete window.Dropbox;

	const $ = window.jQuery;
	delete window.$;
	delete window.jQuery;

	//declarations needed for the page
	declare const $tw: any, store: any, clearMessage: Function, displayMessage: Function;
	declare const story: any, main: Function, config: any;

	//load classes from Rx
	const { Observable, Subject, Subscriber, Subscription } = Rx;


	class twits {
		user: DropboxTypes.users.FullAccount;
		currentRev: string;
		originalText: string;
		originalPath: string;
		client: Dropbox;
		isProd: false
		apiKeyFull = "gy3j4gsa191p31x"
		apiKeyApps = "tu8jc7jsdeg55ta"
		token: {
			access_token: string,
			account_id: string,
			token_type: "bearer",
			uid: string
		} = {} as any;

		constructor(type: string, hash: string) {
			if (type !== "apps" && type !== "full") throw "type must be either apps or full"
			this.client = new Dropbox({
				clientId: (type === "full" ? this.apiKeyFull : (type === "apps" ? this.apiKeyApps : ""))
			});

			// Authenticate against Dropbox
			this.setStatusMessage("Authenticating with Dropbox...");

			if (hash) {
				const data = hash[0] === "#" ? hash.slice(1) : hash;
				data.split('&').map(e => e.split('=').map(f => decodeURIComponent(f))).forEach(e => {
					this.token[e[0]] = e[1];
				})
			}

			if (!this.token.access_token) {
				location.href = this.client.getAuthenticationUrl(location.href);
				return;
			} else {
				this.client.setAccessToken(this.token.access_token);
			}
			this.initApp();
		}

		// Main application
		initApp() {
			this.clearStatusMessage();
			this.client.usersGetCurrentAccount(undefined).then(res => {
				this.user = res;
				const profile = document.getElementById("twits-profile");
				const pic = document.createElement('img');
				pic.src = this.user.profile_photo_url;
				pic.classList.add("profile-pic");
				profile.appendChild(pic);
				const textdata = document.createElement('span');
				this.user.account_type
				textdata.innerText = this.user.name.display_name
					+ (this.user.team ? ("\n" + this.user.team.name) : "");
				textdata.classList.add(this.user.team ? "profile-name-team" : "profile-name");
				profile.appendChild(textdata);
				profile.classList.remove("startup");
				this.readFolder("", document.getElementById("twits-files"));
			})
		};
		isFileMetadata(a: any): a is DropboxTypes.files.FileMetadataReference {
			return a[".tag"] === "file";
		}
		isFolderMetadata(a: any): a is DropboxTypes.files.FolderMetadataReference {
			return a[".tag"] === "folder";
		}
		isHtmlFile(stat: DropboxTypes.files.FileMetadataReference) {
			return ['.htm', '.html'].indexOf(stat.name.slice(stat.name.lastIndexOf('.'))) > -1
		}
		getHumanSize(size: number) {
			const TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
			let power = 0;
			while (size >= 1024) {
				size /= 1024;
				power++;
			}
			return size.toFixed(1) + TAGS[power];
		}
		streamFilesListFolder(path) {
			const output = new Subject<DropboxTypes.files.ListFolderResult["entries"]>();

			function resHandler(res) {
				output.next(res.entries);
				if (res.has_more)
					return this.client.filesListFolderContinue({
						cursor: res.cursor
					}).then(resHandler)
				else
					output.complete();
			}

			this.client.filesListFolder({
				path: path
			}).then(resHandler);

			return output.asObservable();
		}
		readFolder(path, parentNode: Node) {

			const loadingMessage = document.createElement("li");
			loadingMessage.innerText = "Loading...";
			loadingMessage.classList.add("loading-message");

			var listParent = document.createElement("ol");
			listParent.appendChild(loadingMessage);

			parentNode.appendChild(listParent);

			const filelist: DropboxTypes.files.ListFolderResult["entries"] = [];
			this.streamFilesListFolder(path).subscribe((stats) => {
				filelist.push.apply(filelist, stats);
				loadingMessage.innerText = "Loading " + filelist.length + "...";
			}, x => console.error(x), () => {
				loadingMessage.remove();

				filelist.sort((a, b) => {
					//order by isFolder DESC, name ASC
					return (+this.isFolderMetadata(b) - +this.isFolderMetadata(a))
						|| a.name.localeCompare(b.name);
				})

				for (var t = 0; t < filelist.length; t++) {
					const stat = filelist[t];

					var listItem = document.createElement("li"),
						classes = [];
					if (this.isFolderMetadata(stat)) {
						classes.push("twits-folder");
					} else if (this.isFileMetadata(stat)) {
						classes.push("twits-file");
						if (this.isHtmlFile(stat)) {
							classes.push("twits-file-html");
						}
					}
					var link;
					classes.push("twits-file-entry");
					if (this.isFolderMetadata(stat) || (this.isFileMetadata(stat) && this.isHtmlFile(stat))) {
						link = document.createElement("a");
						link.href = "javascript:false;";
						link.setAttribute("data-twits-path", stat.path_lower);
						link.addEventListener("click", this.onClickFolderEntry(), false);
					} else {
						link = document.createElement("span");
					}
					link.className = classes.join(" ");
					var img = document.createElement("img");
					img.src = "dropbox-icons-broken.gif";
					img.style.width = "16px";
					img.style.height = "16px";
					link.appendChild(img);
					link.appendChild(document.createTextNode(stat.name));
					if (this.isFileMetadata(stat) && this.getHumanSize(stat.size)) {
						var size = document.createElement("span");
						size.appendChild(document.createTextNode(" (" + this.getHumanSize(stat.size) + ")"));
						link.appendChild(size);
					}
					listItem.appendChild(link);
					listParent.appendChild(listItem);
				}
			});
		};

		onClickFolderEntry() {
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
			this.client.filesDownload({
				path: path
			}).then(res => {
				//debugger;
				this.currentRev = res.rev;
				return new Promise<string>(resolve => {
					const data: Blob = res.fileBlob;
					console.log(data.type);
					var reader = new FileReader();
					reader.addEventListener("loadend", () => {
						// We have to manually decode the file as UTF8, annoyingly
						// [ I wonder if this is still necessary in v2 since it is a buffer -Arlen ]
						const byteData = new Uint8Array(reader.result);
						const unicode = this.manualConvertUTF8ToUnicode(byteData);
						this.originalPath = path;
						this.originalText = unicode;
						resolve(unicode);
					});
					reader.readAsArrayBuffer(data);
					//debugger;
				})
			}).then(data => {
				this.loadTW5(data);
			})

		}



		getStatusPanel() {
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
			},
				status = getElement("twits-status", document.body),
				message = getElement("twits-message", status),
				progress = getElement("twits-progress", status);
			status.style.display = "block";
			if (this.user) {
				const profile = document.createElement('img');
				profile.src = this.user.profile_photo_url;
				profile.classList.add("profile-pic");
				status.insertBefore(profile, message);
			}
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

		loadTW5(data) {
			location.hash = "";
			var rawIndex = data.indexOf('<' + '!--~~ Raw markup ~~--' + '>');

			var doc = document.createElement('html');
			doc.innerHTML = data;

			while (doc.children[0].childNodes.length > 0) {
				try {
					$(document.head).append(doc.children[0].childNodes[0]);
				} catch (e) {
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
				save: (text, method, callback, options) => {
					this.setStatusMessage("Saving changes...");
					this.client.filesUpload({
						path: this.originalPath,
						mode: {
							".tag": "update",
							"update": this.currentRev
						},
						contents: text
					}).then(res => {
						this.clearStatusMessage();
						this.currentRev = res.rev;
						callback(null);
					}).catch(err => {
						console.log(err);
						callback(err);
					})
					//TODO: add progress tracker
					return true;
				}
			});
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
	const locationHash = location.hash;
	location.hash = "";
	// Do our stuff when the page has loaded
	document.addEventListener("DOMContentLoaded", function (event) {
		const url = new URL(location.href);
		const accessType = url.searchParams.get('type');
		if (!accessType) return;
		$('#twits-selector').hide();
		new twits(accessType, locationHash);
	}, false);

}