/*
Parent: welcome-tiddly-saver
		Child: thankyou-tiddly-saver
		if (is TWC) Parent: original-html-tiddly-saver
    
Child: save-file-tiddly-saver
    Parent: file-saved-tiddly-saver
	
*/
(function () {


	var injectedSaveFile = function (path, content) {
		console.log('injectedSaveFile', path, )
		if(getLocalPath(location.href) !== path) return false;
		return saver(content, "save", function () {
			(displayMessage || alert)(config.messages.mainSaved || "File saved");
		});

	};
	var injectedLoadFile = function (path) {
		try {
			console.log('injectedLoadFile', path);
			if(getLocalPath(location.href) !== path) return false;
			return window.originalHTML;
		} catch (ex) {
			return false;
		}
	};
	var injectedConvertUriToUTF8 = function (path) {
		return path;
	}

	var injectedConvertUnicodeToFileFormat = function (s) {
		return s;
	}

	window.mozillaSaveFile = injectedSaveFile;
	window.mozillaLoadFile = injectedLoadFile;
	window.convertUriToUTF8 = injectedConvertUriToUTF8;
	window.convertUnicodeToFileFormat = injectedConvertUnicodeToFileFormat;
	window.getLocalPath = (url) => {
		return url;
	}

	//End TiddlyFox inject.js ========================================================


	var isTW5 = false;
	var isTWC = false;
	var thankyouSent = false;
	var pendingSaves = {};
	var messageId = 1;
	window.addEventListener('message', function (event) {
		console.log(event, this);
		if (event.data.message === "welcome-tiddly-saver") {
			window.postToParent = event.source.postMessage.bind(event.source);
			window.parentOrigin = event.origin;
			window.postToParent({ 
				message: 'thankyou-tiddly-saver', 
				isTWC: isTWC, 
				isTW5: isTW5 
			}, event.origin);
			thankyouSent = true;
		} else if (event.data.message === "file-saved-tiddly-saver") {
			pendingSaves[event.data.id](event.data.error);
			delete pendingSaves[event.data.id];
		} else if (event.data.message === "original-html-tiddly-saver") {
			window.originalHTML = event.data.originalText;
		}
	});

	console.log('inserting message box');
	var messageBox = document.getElementById("tiddlyfox-message-box");
	if (!messageBox) {
		messageBox = document.createElement("div");
		messageBox.id = "tiddlyfox-message-box";
		messageBox.style.display = "none";
		document.body.appendChild(messageBox);
	}
	// Attach the event handler to the message box
	messageBox.addEventListener("tiddlyfox-save-file", (ev) => {
		// Get the details from the message
		var messageElement = event.target,
			path = messageElement.getAttribute("data-tiddlyfox-path"),
			content = messageElement.getAttribute("data-tiddlyfox-content"),
			backupPath = messageElement.getAttribute("data-tiddlyfox-backup-path"),
			messageId = "tiddlywiki-save-file-response-" + this.idGenerator++;

		// Remove the message element from the message box
		messageElement.parentNode.removeChild(messageElement);
	}, false);


	var saver = function (text, method, callback, options) {

		if (window.postToParent) {
			window.postToParent({ message: 'save-file-tiddly-saver', data: text, id: messageId }, window.parentOrigin);
			pendingSaves[messageId] = callback;
			messageId++;
			return true;
		} else {
			return false;
		}

	};
	var saverObj = {
		info: {
			name: "tiddly-saver",
			priority: 5000,
			capabilities: ["save", "autosave"]
		},
		save: saver
	};
	function addSaver() {
		if ($tw.saverHandler && $tw.saverHandler.savers) {
			$tw.saverHandler.savers.push(saverObj);
			isTW5 = true;
			if (thankyouSent)
				window.postToParent({ message: 'update-tiddly-saver', TW5SaverAdded: true }, window.parentOrigin);
		} else {
			setTimeout(addSaver, 1000);
		}
	}
	if (typeof ($tw) !== "undefined" && $tw)
		addSaver();

	if(version.title === "TiddlyWiki" && version.major === 2){
		isTWC = true;
	}

	console.log("send-welcome-tiddly-chrome-file-saver");



})();
