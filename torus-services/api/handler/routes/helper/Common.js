var reqLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');

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

function doFilterRecursiveArr(recursiveArr, filterVal, filterKey, childArrKey, pLogInfo, callback) {
    try {
        var tempDTR = new reqLinq(recursiveArr)
            .Where(function (tmp) {
                return tmp[filterKey] == filterVal;
            })
            .ToArray();
        if (tempDTR.length > 0) {
            return callback(tempDTR[0]);
        } else {
            for (var dtr in recursiveArr) {
                var tmpdtr = recursiveArr[dtr]
                doFilterRecursiveArr(tmpdtr[childArrKey], filterVal, filterKey, childArrKey, pLogInfo, callback)
                if (tempDTR.length > 0) {
                    break;
                }
            }
        }
    } catch (error) {
        printError(error, 'ERR-FX-12218', pLogInfo);
        return callback(null);
    }
}

function printError(pError, pErrorCode, pLogInfo) {
    console.log(pError.stack);
    reqLogWriter.TraceError(pLogInfo, pError.stack, pErrorCode);
}

function printInfo(pInfo, pLogInfo) {
    console.log(pInfo);
    reqLogWriter.TraceInfo(pLogInfo, pInfo);
}

module.exports = {
    ArrKeyToUpperCase: arrKeyToUpperCase,
    PrintError: printError,
    PrintInfo: printInfo,
    DoFilterRecursiveArr: doFilterRecursiveArr
}