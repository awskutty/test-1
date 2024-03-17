/**
 * Api_Name         : /Getdttypes
 * Description      : To get the DTT detail which is Need_Audit_Log true
 * Last Error_Code  : ERR-AUT-15104
 **/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/'
var reqExpress = require(modPath + 'express');
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var async = require(modPath + 'async');
// Initialize Global variables
var router = reqExpress.Router();
// Host the login api
router.post('/Getdttypes', function(appRequest, appResponse) {
    var pHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLofInfoDetail(pLogInfo, pSessionInfo) {

        var arrResult = [];
        var DT_INFO = [];
        var DT_TYPE = [];
        var arrDTTInfo = [];
        var objLogInfo = ''
        var strAppId = pSessionInfo.APP_ID; // '1002'

        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'Getdttypes-Authentication'

        reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function callback(dbsession) {
            __PrepareDTTInfo(dbsession, strAppId, objLogInfo, function callbackPrepareDTTInfo(pStatusObject) {
                reqInstanceHelpr.SendResponse('Getdttypes', appResponse, DT_INFO, objLogInfo, pStatusObject.ErrorCode, pStatusObject.ErrorMsg, pStatusObject.Error)
            })
        })


        function __PrepareDTTInfo(pCasIns, pAppId, pLogInfo, pCallback) {
            const DTINFO = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? ;'
            reqFXDBInstance.GetTableFromFXDB(pCasIns, 'DTT_INFO', ['APP_ID', 'DTT_CODE', 'DTT_DESCRIPTION', 'NEED_AUDIT_LOG'], {}, pLogInfo, function callback(pErr, pRes) {
                if (pErr)
                    return _PrepareAndSendCallback('FAILURE', 'ERR-AUT-15101', 'Error on querying DTT_INFO table', pErr, null, pCallback)
                else {
                    arrDTTInfo = new reqLinq(pRes.rows)
                        .Where(function(u) {
                            return u['app_id'] == strAppId
                        }).ToArray();

                    reqFXDBInstance.GetTableFromFXDB(pCasIns, 'DT_INFO', ['DT_CODE', 'DT_DESCRIPTION', 'RELATION_JSON'], {
                        APP_ID: pAppId
                    }, pLogInfo, function callback(pError, pResult) {
                        if (pError)
                            return _PrepareAndSendCallback('FAILURE', 'ERR-AUT-15102', 'Error on querying DT_INFO table', pError, null, pCallback)
                        else if (pResult) {

                            // var objDTT = {
                            //     APP_ID: "",
                            //     DT_CODE: "",
                            //     DTT_CODE: "Select",
                            //     TARGET_TABLE: "",
                            //     DTT_DESC: "Select",
                            //     PRIMARY_COLUMN: ""
                            // }
                            // DT_INFO.push(objDTT);

                            for (var i = 0; i < pResult.rows.length; i++) {
                                var strRelationJson = pResult.rows[i]['relation_json']
                                GetTargetTableAndKeyColumn(JSON.parse(strRelationJson), pResult.rows[i]['dt_code'], pLogInfo)
                            }
                            return _PrepareAndSendCallback('SUCCESS', 'ERR-AUT-15103', '', null, null, pCallback)
                        }
                    })
                }
            })
        }

        function GetTargetTableAndKeyColumn(pRelationJson, pDTCode, pLogInfo) {

            for (var j = 0; j < pRelationJson.length; j++) {
                _GetHierarchyDTT(pRelationJson[j], pDTCode, pLogInfo)
            }

        }

        function _GetHierarchyDTT(pRelationJson, pDTCode, pLogInfo) {
            try {
                var objRelationJson = pRelationJson

                // Find targettable and keycolumn for selected DTTCode

                __PrepareDTTObject(strAppId, pDTCode, objRelationJson['DTT_CODE'], objRelationJson['DTT_DESCRIPTION'], objRelationJson['TARGET_TABLE'], objRelationJson['PRIMARY_COLUMN'])

                // find on child dtt relation
                for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
                    _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTCode, pLogInfo)
                }

            } catch (error) {
                _PrintError('ERR-AUT-15104', 'Error on _GetHierarchyDTT() - finding targettable and keycolumn ', error)
            }
        }

        function __PrepareDTTObject(pAppID, pDTCode, pDTTCode, pDTTDesc, pTargetTable, pKeyColumn) {

            var arrTmpDTTInfo = new reqLinq(arrDTTInfo)
                .Where(function(u) {
                    return u['dtt_code'] == pDTTCode && u['need_audit_log'] == 'Y'
                }).ToArray();

            if (arrTmpDTTInfo.length > 0) {
                var objDTT = {
                    APP_ID: pAppID,
                    DT_CODE: pDTCode,
                    DTT_CODE: pDTTCode,
                    TARGET_TABLE: pTargetTable,
                    DTT_DESC: pDTTDesc,
                    PRIMARY_COLUMN: pKeyColumn
                }
                DT_INFO.push(objDTT);
            }
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError('Getdttypes', pError, pErrCode, objLogInfo, pErrMessage)
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('Getdttypes', pMessage, objLogInfo)
        }

        // Prepare callback object
        function _PrepareAndSendCallback(pStatus, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
            var objCallback = {
                Status: pStatus,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            }
            return pCallback(objCallback)
        }
    });
});

module.exports = router;