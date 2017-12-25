/**
 * background-script.js
 * @var {object} browser
 */
(function () {
	
 let active = false;
 let inactiveSuffix = ' (inactive)';
 let tabsWithExtensionEnabled = [];
 let logTypes = [
   'log', 
   'warn', 
   'error', 
   'group', 
   'info', 
   'groupEnd', 
   'groupCollapsed', 
   'table'
 ];    
 let disabledUrls = [
   'about:debugging'
 ];

 /**
  * @param {object} tab
  * @return boolean
  */
 function tabIsBrowser (tab) {
   return disabledUrls.some(function (url) {
     return tab.url.indexOf(url) === 0;
   });
 }

 /**
  * @param {object} tab
  */
 function onClickOnExtensionIcon (tab) {
   if (tabIsBrowser(tab)) {
     return alert('You cannot use browser Logger on this page.');
   }
   toggleActivity(tab);
 }

 /**
  * @param {object} tab
  */
 function toggleActivity (tab) {
   let url = tab.url;
   let host = getHost(url);

   browser.storage.local.get().then((localStorage) => {
     if (localStorage[host] === true) {
       browser.storage.local.remove([host]);
       deactivate(tab.id);
     }
     else {
       browser.storage.local.set({[host]: true});
       activate(tab.id);
     }
   }).catch(() => {
     console.log('Error retrieving stored settings');
   });
 }

 /**
  * @param {string} url
  * @returns {string}
  */
 function getHost (url) {
   url = url.replace(/^(https?:\/\/)/, '', url);
   return url.split('/')[0];
 }

 /**
  * @param {int} tabId
  * @returns void
  */
 function activate (tabId) {
   active = true;

   if (tabsWithExtensionEnabled.indexOf(tabId) === -1) {
     tabsWithExtensionEnabled.push(tabId);
   }

   enableIcon();
   activateTitle(tabId);
 }

 /**
  * @param {int} tabId
  */
 function deactivate (tabId) {
   active = false;

   let index = tabsWithExtensionEnabled.indexOf(tabId);
   if (index !== -1) {
     tabsWithExtensionEnabled.splice(index, 1);
   }

   disableIcon();
   deactivateTitle(tabId);
 }

 /**
  * @param {int} tabId
  */
 function activateTitle (tabId) {
   browser.browserAction.getTitle({tabId: tabId}, function (title) {
     browser.browserAction.setTitle({
       title: title.replace(inactiveSuffix, ''),
       tabId: tabId,
     });
   });
 }

 /**
  * @param {int} tabId
  */
 function deactivateTitle (tabId) {
   browser.browserAction.getTitle({tabId: tabId}, function (title) {
     browser.browserAction.setTitle({
       title: title.indexOf(inactiveSuffix) === -1
         ? title + inactiveSuffix
         : title,
       tabId: tabId,
     });
   });
 }

 function enableIcon () {
   browser.browserAction.setIcon({
     path: 'icons/icon38.png',
   });
 }

 function disableIcon () {
   browser.browserAction.setIcon({
     path: 'icons/icon38_disabled.png',
   });
 }

 function onError (error) {
   console.error(`Error: ${error}`);
 }

 /**
  * @see https://developer.browser.com/extensions/tabs#event-onActivated
  * @param {[type]} activeInfo
  * @return  void
  */
 function onTabActivated (activeInfo) {
   if (typeof activeInfo.tabId != 'number') {
     return;
   }

   browser.tabs.get(activeInfo.tabId, onTabEvent);
 }

 /**
  * @see https://developer.browser.com/extensions/tabs#event-onUpdated
  * @param {int} tabId
  * @param {object} changeInfo
  * @param {object} tab
  * @return void
  */
 function onTabUpdated (tabId, changeInfo, tab) {
   onTabEvent(tab);
 }

 /**
  * @param {object} tab
  * @return void
  */
 function onTabEvent (tab) {
   let id = (typeof tab.id === 'number') ? tab.id : tab.sessionID;

   if (!tab.active) {
     return;
   }

   if (typeof id === 'undefined') {
     return;
   }

   if (tabIsBrowser(tab)) {
     deactivate(id);
     return;
   }

   browser.storage.local.get().then((localStorage) => {
     let host = getHost(tab.url);

     if (localStorage[host] === true) {
       activate(tab.id);
     }
     else {
       deactivate(tab.id);
     }
   }).catch(() => {
     console.log('Error retrieving stored settings');
   });
 }

 /**
  * @param {int} tabId
  * @param {array} logs
  * @returns {undefined}
  */
 function sendMessage(tabId, logs) {
   browser
     .tabs
     .sendMessage(tabId, logs)
     .then(response => {
      // console.log(response.response);
     })
     .catch(onError);
 }
 
 /**
  * @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs
  * @param {object} requestDetails
  */
 function logFromHeader (requestDetails) {
   let headersName = 'X-ChromeLogger-Data';
   let headersArr = requestDetails.responseHeaders;

   if (tabsWithExtensionEnabled.indexOf(requestDetails.tabId) === -1) {
     return;
   }

   try {
     headersArr.forEach(function (header) {
       if (header.name === headersName) {
         let decodedHeader = JSON.parse(window.atob(header.value));

         if (decodedHeader.hasOwnProperty('rows')) {
           let logs = [];
           
           decodedHeader.rows.forEach(function (row) {
             let logType = (logTypes.indexOf(row[2]) === -1) ? 'log' : row[2];
             row[0].forEach(function (logInfo) {
               if (logInfo == '') {
                 return;
               }

               logs.push({logType: logType, logInfo: logInfo});
             });
           });            
           
           if (logs.length > 0) {
             sendMessage(requestDetails.tabId, logs);
           }
         }
       }
     });
   }
   catch (e) {
     console.log(e);
   }
 }

 function init () {
   browser.browserAction.onClicked.addListener(onClickOnExtensionIcon);
   browser.tabs.onActivated.addListener(onTabActivated);
   browser.tabs.onCreated.addListener(onTabEvent);
   browser.tabs.onUpdated.addListener(onTabUpdated);
   browser.webRequest.onResponseStarted.addListener(
     logFromHeader,
     {urls: ['<all_urls>']},
     ['responseHeaders'],
   );
 }

 init();

})();
