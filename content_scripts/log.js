/**
 * JavaScript included with your extension, that you will inject into web pages.
 * @var {object} browser
 */
"use strict";

browser.runtime.onMessage.addListener(logs => {
  let log_types = ['log', 'warn', 'error', 'info'];
  
  logs.forEach(function (log) {
    if(log_types.indexOf(log.logType) !== -1) {
      console[log.logType]('%c' + log.logInfo, 'font-weight: bold;');
    } else {
      console[log.logType](log.logInfo);
    }
  });
  
  return Promise.resolve({response: "done"});
});