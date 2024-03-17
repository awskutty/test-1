var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../common/InstanceHelper');
var serviceName = 'transaction/Common';

// this is Item obj
function item() {
    this.Key_Value = 0;
    this.TS = new Object();
    this.TempHT = new Object();
}

// this is ItemSet obj
function itemSet() {
    this.DT_Code = '';
    this.DTT_Code = '';
    this.Key_Column = '';
    this.TS_Id = 0;
    this.Status = '';
    this.ProcessStatus = '';
    this.Has_Status = '';
    this.Has_ProcessStatus = '';
    this.PWDCtrls = '';
    this.DecCtrls = '';
    this.Items = [];
}

// this is DttRelation obj
function dttRelation() {
    this.TARGET_TABLE = '';
    this.PRIMARY_COLUMN = '';
    this.CATEGORY = '';
    this.DTT_CODE = '';
    this.DTT_DESCRIPTION = '';
    this.FOREIGN_COLUMN = '';
    this.CHILD_DTT_RELEATIONS = [];
}

// Recursive function to get dtt_info from child dtt relations
function doFilterRecursiveArr(recursiveArr, filterVal, filterKey, childArrKey, pLogInfo, callback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Processing FilterRecursiveArray function', pLogInfo);
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
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-TRX-100045', 'Error in doFilterRecursiveArr function', error);
        return callback(null);
    }
}

// To convert byte to string if any image (blob) column exists
function byteValToString(pObj, pLogInfo, callback) {
    try {
        var resultKeys = Object.keys(pObj);
        for (var i = 0; i < resultKeys.length; i++) {
            var key = resultKeys[i];
            if (pObj[key]) {
                var regex1 = /data:image\//;
                var regex2 = /base64,/;
                var result1 = pObj[key].toString().match(regex1);
                var result2 = pObj[key].toString().match(regex2);
                if (result1 && result2) {
                    reqInstanceHelper.PrintInfo(serviceName, 'image column available. So replacing characters', pLogInfo);
                    pObj[key] = pObj[key].toString();
                }
            }
        }
        return callback(pObj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-TRX-100044', 'Error in byteValToString function', error);
        return callback(pObj);
    }
}

module.exports = {
    Item: item,
    ItemSet: itemSet,
    DttRelation: dttRelation,
    DoFilterRecursiveArr: doFilterRecursiveArr,
    ByteValToString: byteValToString
}