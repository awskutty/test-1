/**
 * @Description     : Reusable common code
 * @Last_Error_Code : 
 */

// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');


//Common Result  Preparation
function prepareMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, InfoMessage) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject,
        'PROCESS_STATUS': ProcessStatus,
        'INFO_MESSAGE': InfoMessage
    }
    return obj
}


// To check if the input is string and parse it to json
function parseJSON(data) {
    if (typeof data === 'string' || data instanceof String) {
        return JSON.parse(data);
    } else {
        return data;
    }
}

// To check if the input is string and if not stringify it
function stringifyJSON(data) {
    if (typeof data === 'string' || data instanceof String) {
        return data;
    } else {
        return JSON.stringify(data);
    }
}

function formulateSeparator(separator, custom_separator) {
    switch (separator) {
        case 'VBCRLF':
            return '\r\n'
        case 'VBTAB':
            return '\t'
        case 'vbcrlf':
            return '\r\n'
        case 'vbtab':
            return '\t'
        case 'others':
            return custom_separator
        default:
            return separator
    }
}

function GetKeyColumn(pCasIns, pAppId, pDTCode, pDTTCode, pLogInfo, pCallback) {
    var objCallbak = {}
    try {
        const DTINFO = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? AND DT_CODE=? ;'
        reqFXDBInstance.GetTableFromFXDB(pCasIns, 'DT_INFO', ['RELATION_JSON'], {
            'APP_ID': pAppId,
            'DT_CODE': pDTCode
        }, pLogInfo, function callback(pError, pResult) {
            if (pError) {
                var objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-EXC-', 'Error on GetKeyColumn()', pError, null)
                return pCallback(objCallbak)
            } else {
                if (pResult.rows.length > 0) {
                    var strRelationJson = pResult.rows[0]['relation_json']
                    var tmpstr = GetTargetTableAndKeyColumn(JSON.parse(strRelationJson), pDTTCode, pLogInfo)
                    return pCallback(tmpstr)
                }
            }
        })
    } catch (error) {
        objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40162', 'Error on GetKeyColumn()', error, null)
        return pCallback(objCallbak)
    }
}

function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode, pLogInfo) {
    var tmpStr = ''
    for (var j = 0; j < pRelationJson.length; j++) {
        tmpStr = _GetHierarchyDTT(pRelationJson[j], pDTTCode, pLogInfo)
        if (tmpStr != undefined && tmpStr.Status == 'SUCCESS') {
            if (tmpStr.Data != undefined && tmpStr.Data != null && tmpStr.Data != '')
                break;
        }
        if (tmpStr != undefined && tmpStr.Status == 'FAILURE') // if error in _GetHierarchyDTT()
            break;

    }
    return tmpStr
}

function _GetHierarchyDTT(pRelationJson, pDTTCode, pLogInfo) {
    var obj = {}
    try {
        var objRelationJson = pRelationJson
        var strTargetTable = ''
        var strKeyColumn = ''
        var strDTTDescription = ''
        var strDTTCategory = ''
        // Find targettable and keycolumn for selected DTTCode
        if (objRelationJson.DTT_CODE == pDTTCode) {
            strTargetTable = objRelationJson['TARGET_TABLE']
            strKeyColumn = objRelationJson['PRIMARY_COLUMN']
            strDTTDescription = objRelationJson['DTT_DESCRIPTION']
            strDTTCategory = objRelationJson['CATEGORY']
            var strDTTInfo = strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
            //return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
            obj = _PrepareCallbackObject('SUCCESS', strDTTInfo, '', '', null, null)
            return obj
        }

        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            var rtn = _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo)
            if (rtn != null)
                return rtn
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40163', 'Error on _GetHierarchyDTT()', error, null)
        return obj
    }
}

// Prepare callback object
function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
    var objCallback = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    }
    return objCallback
}

function updateandGetCounter(pClient, pLogInfo, code, keycolumnid, callback) {

    if (keycolumnid == "" || keycolumnid == undefined || keycolumnid == null) {
        var QUERY_UPDATE_COUNTER = "UPDATE fx_total_items SET COUNTER_VALUE = COUNTER_VALUE + 1 WHERE CODE = '" + code + "'"
        var QUERY_SELECT_COUNTER = "select COUNTER_VALUE from fx_total_items where CODE = '" + code + "'"

        // Get cassandra instance

        reqFXDBInstance.ExecuteQuery(pClient, QUERY_UPDATE_COUNTER, pLogInfo, function (pErr, pRes) {
            if (!pErr) {
                reqFXDBInstance.ExecuteQuery(pClient, QUERY_SELECT_COUNTER, pLogInfo, function (pErr1, pResult1) {
                    if (!pErr1) {

                        if (!pResult1.rows.length) {
                            callback("SUCCESS", 1);
                        } else {
                            var counter_value = pResult1.rows[0]["counter_value"]["low"];

                            if (counter_value == undefined) {
                                counter_value = pResult1.rows[0]["counter_value"]
                            }
                            callback("SUCCESS", counter_value);
                        }
                    } else {
                        callback("FAILURE", pErr1);
                    }
                });
            } else {
                callback("FAILURE", pErr);
            }
        })
    } else {
        callback("SUCCESS", keycolumnid);
    }
}

function PrintInfo(pMessage) {
    var objLogInfo = {};
    reqInstanceHelper.PrintInfo('Exchange', pMessage, objLogInfo);
}

module.exports = {
    prepareMethodResponse: prepareMethodResponse,
    parseJSON: parseJSON,
    stringifyJSON: stringifyJSON,
    formulateSeparator: formulateSeparator,
    GetKeyColumn: GetKeyColumn,
    UpdateandGetCounter: updateandGetCounter,
    PrintInfo: PrintInfo
};