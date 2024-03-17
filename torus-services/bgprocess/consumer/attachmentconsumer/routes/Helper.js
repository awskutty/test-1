/****
  @Description - Helper functions to find dtt relation json for all DTTs and maintain in hashtable
  @Last_Error_Code  : ERR-AUDITDATA-PRODUCER-2007
 ****/

// Require dependencies
var reqHashTable = require('jshashtable');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var serviceName = 'AuditDataProducer';

// Initialize global variables
var htDTTInfo = new reqHashTable();
var htTargetTblInfo = new reqHashTable();
var objLogInfo = '';

// Query the DT_INFO table
function GetDTInfo(pDepCasIns, pLogInfo, pHeader, pCallback) {
    try {
        _TraceInfo('Getting DT Info and assigning to hashtable');
        objLogInfo = pLogInfo
        reqFXDBInstance.GetTableFromFXDB(pDepCasIns, 'DT_INFO', [], {}, pLogInfo, function callback(pError, pResult) {
            if (pError) {
                _TraceError('Error in GetDTInfo - ' + pError);
            } else if (pResult) {
                if (pResult.rows.length > 0) {
                    var htTemp = new reqHashTable()
                    var htTempTarget = new reqHashTable()
                    for (var i = 0; i < pResult.rows.length; i++) {
                        _ParseDTTInfo(pResult.rows[i]['app_id'], pResult.rows[i]['relation_json'], htTemp, htTempTarget);
                    }
                    htDTTInfo.put(pHeader['routingkey'], htTemp);
                    htTargetTblInfo.put(pHeader['routingkey'], htTempTarget);
                }
            }
            _TraceInfo('DT Info process completed');
            pCallback();
        })
    } catch (ex) {
        _TraceError(ex, 'ERR-AUDITDATA-PRODUCER-2002', 'Catch Error in GetDTInfo()...');
        pCallback();
    }
}
// Query the DTT_INFO table
function GetDTTInfo(pDttInfoReqObj, pCallback) {
    try {
        /* pDttInfoReqObj sholud Contains
          - dep_cas_instance
          - objLogInfo
    */
        _TraceInfo('Getting DTT Info');
        var dep_cas_instance = pDttInfoReqObj.dep_cas_instance;
        var dttLogInfo = pDttInfoReqObj.objLogInfo;
        reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'DTT_INFO', ['DTT_DFD_JSON', 'DTT_CODE', 'NEED_AUDIT_LOG', 'NEED_SOLR_INDEX'], {
            /* APP_ID: strAppID,
            DTT_CODE: pDTTCode */
        }, dttLogInfo, function callbackAuditLog(pError, pResult) {
            if (pError) {
                _TraceError(pError, 'ERR-AUDITDATA-PRODUCER-2006', 'Error in GetDTTInfo()...');
                pCallback(pError, null);
            } else {
                pCallback(null, pResult);
            }
        });
    } catch (ex) {
        _TraceError(ex, 'ERR-AUDITDATA-PRODUCER-2007', 'Catch Error in GetDTTInfo()...');
        pCallback(ex, null);
    }
}

// Parse the dtt relation json for hierarchy level dtts
function _ParseDTTInfo(pAppID, pDTRelation, pHashTable, htTempTarget) {
    try {
        var objRelationJson = JSON.parse(pDTRelation)
        var tmpStr = ''
        for (var i = 0; i < objRelationJson.length; i++) {
            _GetHierarchyDTT(pAppID, objRelationJson[i], pHashTable, htTempTarget)
        }
    } catch (ex) {
        _TraceError(ex, 'ERR-AUDITDATA-PRODUCER-2003', 'Catch Error in _ParseDTTInfo()...');
    }
}

// Get the child DTTs
function _GetHierarchyDTT(pAppID, pRelationJson, pHashTable, htTempTarget) {
    try {
        var objRelationJson = pRelationJson
        var objDTT = {
            APP_ID: pAppID,
            RELATION: objRelationJson
        }
        pHashTable.put(objRelationJson.DTT_CODE, objDTT)
        htTempTarget.put(objRelationJson.TARGET_TABLE, objRelationJson.DTT_CODE)
        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            _GetHierarchyDTT(pAppID, objRelationJson.CHILD_DTT_RELEATIONS[i], pHashTable, htTempTarget)
        }
    } catch (ex) {
        _TraceError(ex, 'ERR-AUDITDATA-PRODUCER-2004', 'Catch Error in _GetHierarchyDTT()...');
    }
}

// Find the dtt info 
function FindDTTInfo(pDepCas, pLogInfo, pHeader, pDTTCode, pTableName, pCallback) {
    try {
        _TraceInfo('Processing FindDTTInfo');
        // If already exist the key of DTT_CODE
        var htTempDTT = htDTTInfo.get(pHeader['routingkey']);
        if (!pDTTCode || pDTTCode == '') {
            var htTempTarget = htTargetTblInfo.get(pHeader['routingkey']);
            pDTTCode = htTempTarget.get(pTableName.toUpperCase());
        }
        if (pDTTCode != null && pDTTCode != undefined) {
            var DTTInfo = htTempDTT.get(pDTTCode)
            if (DTTInfo != null && DTTInfo != undefined && DTTInfo != '')
                pCallback(DTTInfo);
            else { // if not exist the DTT_CODE
                _TraceInfo('DTT info not found for this key - ' + pHeader['routingkey']);
                htDTTInfo.remove(pHeader['routingkey']);
                GetDTInfo(pDepCas, pLogInfo, pHeader, function callbackGetDTInfo() {
                    var objDTTInfo = htTempDTT.get(pDTTCode);
                    pCallback(objDTTInfo);
                })
            }
        } else
            pCallback(null);
    } catch (ex) {
        _TraceError(ex, 'ERR-AUDITDATA-PRODUCER-2005', 'Catch Error in FindDTTInfo()...');
        pCallback(null);
    }
}

// To print error messages
function _TraceError(pErrorObj, pErrorCode, pErrInfoMesg) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
}

// To print log info messages
function _TraceInfo(pMsg) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, objLogInfo);
}

module.exports = {
    GetDTInfo: GetDTInfo,
    GetDTTInfo: GetDTTInfo,
    FindDTTInfo: FindDTTInfo
}
/******** End of File **********/