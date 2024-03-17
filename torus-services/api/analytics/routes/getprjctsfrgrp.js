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
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper'); 
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/getprjctsfrgrp', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'getprojectsforgrp-Analytics';
        objLogInfo.ACTION = 'getprojectsforgrp';

        var strHeader = appReq.headers

        try {

            
            var query ="select p.ide_project_name,p.ide_project_type,pg.sequence_no,pg.program_id from programs p join program_group pg on p.ide_project_code = pg.program_id where pg.project_id="+appReq.body.PRJCT_ID+" and pg.group_name='"+appReq.body.GRP_NAME+"'"
            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                try {
                      reqAnalyticInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                        if (err) {
                            _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from program_group Table', err, null,objLogInfo);
                        }
                        else{
                            _SendResponse({res}, '', '', null, null);
                        }
                      })
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                }

            })
        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable Load', pError, null);
        }
        // To send the app response
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
