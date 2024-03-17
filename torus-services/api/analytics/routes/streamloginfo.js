/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/streamloginfo', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'streamloginfo-Analytics';
        objLogInfo.ACTION = 'streamloginfo';
        var strHeader = {};

        try {
            var params = appReq.body;
            var prg_id = params.PROJECT_ID
            var prg_name = params.PROJNAME
            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                reqAnalyticInstance.GetTableFromTranDB(pSession, 'PROGRAM_GROUP_FLOW_LOG', {}, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                    try {
                        if (pError) {
                            _SendResponse({}, 'Errcode', 'Unable To Run', pError, null);
                        }
                        else {
                            var LOGINFO = pResult
                            if ((LOGINFO.length > 0)) {
                                var resultInfo = LOGINFO.filter((value) => {
                                    if (value.program_name == prg_name && value.project_id == prg_id) {
                                        return value;
                                    }
                                });
                                if (resultInfo.length == 0) {
                                    log()
                                }
                            }
                            else {
                                if (LOGINFO.length == 0) {
                                    log()
                                }
                            }
                            _SendResponse({SUCCESS:'SUCCESS'}, '', '','',null);     
                        }
                    } catch (error) {
                        _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                    }
    
                })
                function log() {
                    reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP_FLOW_LOG', [{
                        PROJECT_ID: prg_id,
                        PROgram_NAME: prg_name
    
    
                    }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                        try {
                            if (pError) {
                                _SendResponse({}, 'Errcode', 'Unable To insert into Table', pError, null);
                            }
                            else {
                                _SendResponse({ SUCCESS: 'Program Exection Started Successfully' }, '', '', '', null);
                            }
    
                        } catch (error) {
                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                        }
                    })
                }
            })
          

        } catch (error) {
            _SendResponse({}, 'Errcode', 'Error Unable To Load Group', error, null);
        }
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
        function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }

    })



});
module.exports = router;