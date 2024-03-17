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
router.post('/insertparamspg', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(appReq.body, appReq);
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'insertparamspg-Analytics';
        objLogInfo.ACTION = 'insertparamspg';
        var strHeader = {};
     
        try {
            var params = appReq.body;
            var Project_Info_JSON = params.EXEC_PARAMS.join(' ');
            var Project_Name = params.PROJ_NAME;
            var Project_Type = params.PROJ_TYPE;
            var Project_Code = params.PROJ_CODE;


            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {

                try {
                    reqAnalyticInstance.UpdateTranDBWithAudit(pSession, 'PROGRAMS', { PROJECT_INFO_JSON: Project_Info_JSON },
                        { IDE_PROJECT_NAME: Project_Name, IDE_PROJECT_TYPE: Project_Type, IDE_PROJECT_CODE: Project_Code },
                        objLogInfo,
                        function callbackUpdatePrograms(pResult, pError) {
                            try {
                                if (pError) {
                                    _SendResponse({}, 'Errcode', 'Unable To Update', pError, null);
                                }
                                else {
                                    _SendResponse('SUCCESS', '', '', null, null);
                                }
                            } catch (error) {
                                _SendResponse({}, 'Errcode', 'Unable To Insert', error, null);
                            }
                        })
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable To Insert', error, null);
                }


            })
            // var update_query = "update programs set project_info_json=? where ide_project_name=? AND ide_project_type=? AND ide_project_code=?"



        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable To Insert', pError, null);
        }
        // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
    })




    
   
});
module.exports = router;