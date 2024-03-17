/****
  @Descriptions - Common helper functions  
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../../torus-references/common/InstanceHelper');
var serviceName = 'Common';
var objLogInfo = null;

// To print error messages
function printError(error) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
}

// this will return object with keys in uppercase
function arrKeyToUpperCase(pArr, pLogInfo) {
    try {
        var arrForReturn = [];
        for (var i = 0; i < pArr.length; i++) {
            var obj = pArr[i];
            var objNew = new Object();
            for (var key in obj) {
                var strUpperCaseKey = key.toUpperCase();
                objNew[strUpperCaseKey] = obj[key];
            }
            arrForReturn.push(objNew);
        }
        return arrForReturn;
    } catch (error) {
        printError(error, 'ERR-FX-12217', pLogInfo);
        return null;
    }
}

module.exports = {
    PrintError: printError,
    ArrKeyToUpperCase: arrKeyToUpperCase
}
    /******** End of File **********/