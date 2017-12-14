/**
 * background-script.js
 * @var {object} browser
 */
(function () {
//  'use strict';



  class Logger {   
    
    constructor() {
      // init property
      this.active = false;
      this.inactiveSuffix = ' (inactive)';
      this.tabsWithExtensionEnabled = [];
      this.logTypes = [
        'log', 
        'warn', 
        'error', 
        'group', 
        'info', 
        'groupEnd', 
        'groupCollapsed', 
        'table'
      ];    
      this.disabledUrls = [
        'about:debugging'
      ];
  
      // events
      browser.browserAction.onClicked.addListener(this.onClickOnExtensionIcon);
//      browser.tabs.onActivated.addListener(this.onTabActivated);
//      browser.tabs.onCreated.addListener(this.onTabEvent);
//      browser.tabs.onUpdated.addListener(this.onTabUpdated);
//      browser.webRequest.onResponseStarted.addListener(
//        this.logFromHeader,
//        {urls: ['<all_urls>']},
//        ['responseHeaders'],
//      );
    }
    
    /**
     * @param {object} tab
     * @returns {unresolved}
     */
    tabIsBrowser (tab) {      
      return this.disabledUrls.some(function (url) {
        return tab.url.indexOf(url) === 0;
      });
    }

    /**
     * @param {object} tab
     */
    onClickOnExtensionIcon (tab) {
      
      if (this.tabIsBrowser(tab)) {
        return alert('You cannot use browser Logger on this page.');
      }
      this.toggleActivity(tab);
    }

    /**
     * @param {object} tab
     */
    toggleActivity (tab) {
      let url = tab.url;
      let host = this.getHost(url);

      browser.storage.local.get().then((localStorage) => {
        if (localStorage[host] === true) {
          browser.storage.local.remove([host]);
          this.deactivate(tab.id);
        }
        else {
          browser.storage.local.set({[host]: true});
          this.activate(tab.id);
        }
      }).catch(() => {
        console.log('Error retrieving stored settings');
      });
    }

    /**
     * @param {string} url
     * @returns {string}
     */
    getHost (url) {
      url = url.replace(/^(https?:\/\/)/, '', url);
      return url.split('/')[0];
    }

    /**
     * @param {int} tabId
     * @returns void
     */
    activate (tabId) {
      this.active = true;

      if (this.tabsWithExtensionEnabled.indexOf(tabId) === -1) {
        this.tabsWithExtensionEnabled.push(tabId);
      }

      this.enableIcon();
      this.activateTitle(tabId);
    }

    /**
     * @param {int} tabId
     */
    deactivate (tabId) {
      this.active = false;

      let index = this.tabsWithExtensionEnabled.indexOf(tabId);
      if (index !== -1) {
        this.tabsWithExtensionEnabled.splice(index, 1);
      }

      this.disableIcon();
      this.deactivateTitle(tabId);
    }

    /**
     * @param {int} tabId
     */
    activateTitle (tabId) {
      browser.browserAction.getTitle({tabId: tabId}, function (title) {
        browser.browserAction.setTitle({
          title: title.replace(this.inactiveSuffix, ''),
          tabId: tabId
        });
      });
    }

    /**
     * @param {int} tabId
     */
    deactivateTitle (tabId) {
      browser.browserAction.getTitle({tabId: tabId}, function (title) {
        browser.browserAction.setTitle({
          title: (title.indexOf(this.inactiveSuffix) === -1) ? (title + this.inactiveSuffix) : title,
          tabId: tabId
        });
      });
    }

    enableIcon () {
      browser.browserAction.setIcon({
        path: 'icons/icon38.png'
      });
    }

    disableIcon () {
      browser.browserAction.setIcon({
        path: 'icons/icon38_disabled.png'
      });
    }

    onError (error) {
      console.error(`Error: ${error}`);
    }

    /**
     * @see https://developer.browser.com/extensions/tabs#event-onActivated
     * @param {[type]} activeInfo
     * @return  void
     */
    onTabActivated (activeInfo) {
      if (typeof activeInfo.tabId != 'number') {
        return;
      }

      browser.tabs.get(activeInfo.tabId, this.onTabEvent);
    }

    /**
     * @see https://developer.browser.com/extensions/tabs#event-onUpdated
     * @param {int} tabId
     * @param {object} changeInfo
     * @param {object} tab
     * @return void
     */
    onTabUpdated (tabId, changeInfo, tab) {
      this.onTabEvent(tab);
    }

    /**
     * @param {object} tab
     * @return void
     */
    onTabEvent (tab) {
      let id = (typeof tab.id === 'number') ? tab.id : tab.sessionID;

      if (!tab.active) {
        return;
      }

      if (typeof id === 'undefined') {
        return;
      }

      if (this.tabIsBrowser(tab)) {
        this.deactivate(id);
        return;
      }

      browser.storage.local.get().then((localStorage) => {
        let host = this.getHost(tab.url);

        if (localStorage[host] === true) {
          this.activate(tab.id);
        }
        else {
          this.deactivate(tab.id);
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
    sendMessage(tabId, logs) {
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
    logFromHeader (requestDetails) {
      let headersName = 'X-ChromeLogger-Data';
      let headersArr = requestDetails.responseHeaders;

      if (this.tabsWithExtensionEnabled.indexOf(requestDetails.tabId) === -1) {
        return;
      }

      try {
        headersArr.forEach(function (header) {
          if (header.name === headersName) {
            let decodedHeader = JSON.parse(window.atob(header.value));

            if (decodedHeader.hasOwnProperty('rows')) {
              let logs = [];

              decodedHeader.rows.forEach(function (row) {
                let logType = (this.logTypes.indexOf(row[2]) === -1) ? 'log' : row[2];
                row[0].forEach(function (logInfo) {
                  if (logInfo == '') {
                    return;
                  }

                  logs.push({logType: logType, logInfo: logInfo});
                });
              });            

              if (logs.length > 0) {
                this.sendMessage(requestDetails.tabId, logs);
              }
            }
          }
        });
      }
      catch (e) {
        console.log(e);
      }
    }
  }
  
  const logger = new Logger();

//  let active = false;
//  let inactiveSuffix = ' (inactive)';
//  let tabsWithExtensionEnabled = [];
//  let logTypes = [
//    'log', 
//    'warn', 
//    'error', 
//    'group', 
//    'info', 
//    'groupEnd', 
//    'groupCollapsed', 
//    'table'
//  ];    
//  let disabledUrls = [
//    'about:debugging'
//  ];
//
//  /**
//   * @param {object} tab
//   * @return boolean
//   */
//  function tabIsBrowser (tab) {
//    return disabledUrls.some(function (url) {
//      return tab.url.indexOf(url) === 0;
//    });
//  }
//
//  /**
//   * @param {object} tab
//   */
//  function onClickOnExtensionIcon (tab) {
//    if (tabIsBrowser(tab)) {
//      return alert('You cannot use browser Logger on this page.');
//    }
//    toggleActivity(tab);
//  }
//
//  /**
//   * @param {object} tab
//   */
//  function toggleActivity (tab) {
//    let url = tab.url;
//    let host = getHost(url);
//
//    browser.storage.local.get().then((localStorage) => {
//      if (localStorage[host] === true) {
//        browser.storage.local.remove([host]);
//        deactivate(tab.id);
//      }
//      else {
//        browser.storage.local.set({[host]: true});
//        activate(tab.id);
//      }
//    }).catch(() => {
//      console.log('Error retrieving stored settings');
//    });
//  }
//
//  /**
//   * @param {string} url
//   * @returns {string}
//   */
//  function getHost (url) {
//    url = url.replace(/^(https?:\/\/)/, '', url);
//    return url.split('/')[0];
//  }
//
//  /**
//   * @param {int} tabId
//   * @returns void
//   */
//  function activate (tabId) {
//    active = true;
//
//    if (tabsWithExtensionEnabled.indexOf(tabId) === -1) {
//      tabsWithExtensionEnabled.push(tabId);
//    }
//
//    enableIcon();
//    activateTitle(tabId);
//  }
//
//  /**
//   * @param {int} tabId
//   */
//  function deactivate (tabId) {
//    active = false;
//
//    let index = tabsWithExtensionEnabled.indexOf(tabId);
//    if (index !== -1) {
//      tabsWithExtensionEnabled.splice(index, 1);
//    }
//
//    disableIcon();
//    deactivateTitle(tabId);
//  }
//
//  /**
//   * @param {int} tabId
//   */
//  function activateTitle (tabId) {
//    browser.browserAction.getTitle({tabId: tabId}, function (title) {
//      browser.browserAction.setTitle({
//        title: title.replace(inactiveSuffix, ''),
//        tabId: tabId,
//      });
//    });
//  }
//
//  /**
//   * @param {int} tabId
//   */
//  function deactivateTitle (tabId) {
//    browser.browserAction.getTitle({tabId: tabId}, function (title) {
//      browser.browserAction.setTitle({
//        title: title.indexOf(inactiveSuffix) === -1
//          ? title + inactiveSuffix
//          : title,
//        tabId: tabId,
//      });
//    });
//  }
//
//  function enableIcon () {
//    browser.browserAction.setIcon({
//      path: 'icons/icon38.png',
//    });
//  }
//
//  function disableIcon () {
//    browser.browserAction.setIcon({
//      path: 'icons/icon38_disabled.png',
//    });
//  }
//
//  function onError (error) {
//    console.error(`Error: ${error}`);
//  }
//
//  /**
//   * @see https://developer.browser.com/extensions/tabs#event-onActivated
//   * @param {[type]} activeInfo
//   * @return  void
//   */
//  function onTabActivated (activeInfo) {
//    if (typeof activeInfo.tabId != 'number') {
//      return;
//    }
//
//    browser.tabs.get(activeInfo.tabId, onTabEvent);
//  }
//
//  /**
//   * @see https://developer.browser.com/extensions/tabs#event-onUpdated
//   * @param {int} tabId
//   * @param {object} changeInfo
//   * @param {object} tab
//   * @return void
//   */
//  function onTabUpdated (tabId, changeInfo, tab) {
//    onTabEvent(tab);
//  }
//
//  /**
//   * @param {object} tab
//   * @return void
//   */
//  function onTabEvent (tab) {
//    let id = (typeof tab.id === 'number') ? tab.id : tab.sessionID;
//
//    if (!tab.active) {
//      return;
//    }
//
//    if (typeof id === 'undefined') {
//      return;
//    }
//
//    if (tabIsBrowser(tab)) {
//      deactivate(id);
//      return;
//    }
//
//    browser.storage.local.get().then((localStorage) => {
//      let host = getHost(tab.url);
//
//      if (localStorage[host] === true) {
//        activate(tab.id);
//      }
//      else {
//        deactivate(tab.id);
//      }
//    }).catch(() => {
//      console.log('Error retrieving stored settings');
//    });
//  }
//
//  /**
//   * @param {int} tabId
//   * @param {array} logs
//   * @returns {undefined}
//   */
//  function sendMessage(tabId, logs) {
//    browser
//      .tabs
//      .sendMessage(tabId, logs)
//      .then(response => {
//       // console.log(response.response);
//      })
//      .catch(onError);
//  }
//  
//  /**
//   * @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs
//   * @param {object} requestDetails
//   */
//  function logFromHeader (requestDetails) {
//    let headersName = 'X-ChromeLogger-Data';
//    let headersArr = requestDetails.responseHeaders;
//
//    if (tabsWithExtensionEnabled.indexOf(requestDetails.tabId) === -1) {
//      return;
//    }
//
//    try {
//      headersArr.forEach(function (header) {
//        if (header.name === headersName) {
//          let decodedHeader = JSON.parse(window.atob(header.value));
//
//          if (decodedHeader.hasOwnProperty('rows')) {
//            let logs = [];
//            
//            decodedHeader.rows.forEach(function (row) {
//              let logType = (logTypes.indexOf(row[2]) === -1) ? 'log' : row[2];
//              row[0].forEach(function (logInfo) {
//                if (logInfo == '') {
//                  return;
//                }
//
//                logs.push({logType: logType, logInfo: logInfo});
//              });
//            });            
//            
//            if (logs.length > 0) {
//              sendMessage(requestDetails.tabId, logs);
//            }
//          }
//        }
//      });
//    }
//    catch (e) {
//      console.log(e);
//    }
//  }
//
//  function init () {
//    browser.browserAction.onClicked.addListener(onClickOnExtensionIcon);
//    browser.tabs.onActivated.addListener(onTabActivated);
//    browser.tabs.onCreated.addListener(onTabEvent);
//    browser.tabs.onUpdated.addListener(onTabUpdated);
//    browser.webRequest.onResponseStarted.addListener(
//      logFromHeader,
//      {urls: ['<all_urls>']},
//      ['responseHeaders'],
//    );
//  }
//
//  init();

})();
