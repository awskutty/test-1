/*
    @Api_Name           : /CheckAtmtExistence,
    @Descriptions        : To Check the Attachment Exists in Tran db
    @Last Error Code    : 'ERR-RES-70209'
*/

// Require dependencies
var reqExpress = require('express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();

// Host api to server
router.post('/CheckAtmtExistence', function (appRequest, appResponse) {

    var objLogInfo;
    var serviceName="CheckAtmtExistence"
    var pfilename=appRequest.body.PARAMS.OG_FILE_NAME
    var pdt_code=appRequest.body.PARAMS.DT_CODE
    var pdtt_code=appRequest.body.PARAMS.DTT_CODE
    var pHeaders = appRequest.headers;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'ADD_CONTENT'; // correct it
                reqInsHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                            mTranDB = pSession;
                            var objCond ={}
                            objCond['DT_CODE'] = pdt_code;
                            objCond['DTT_CODE']=pdtt_code;
                            objCond['ORIGINAL_FILE_NAME']=pfilename
                            reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', objCond, objLogInfo, function (pResultFromDb) {
                                try {
                                    if(pResultFromDb.length>0){
                                        for (var i = 0; i < pResultFromDb.length; i++) {
                                        if(pResultFromDb[i].original_file_name==pfilename){
                                            reqInsHelper.SendResponse(serviceName, appResponse, "DUPLICATE_FILE", objLogInfo, null, null, null);
                                        }else{
                                            reqInsHelper.SendResponse(serviceName, appResponse, "NEW_FILE", objLogInfo, null, null, null);
                                        }
                                    }
                                    }else{
                                        reqInsHelper.SendResponse(serviceName, appResponse, "NEW_FILE", objLogInfo, null, null, null);
                                    }

                                } catch (error) {
                                    reqInsHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70204', 'Error in CheckAtmtExistence', error);
                                }
                            })
                        })

            } catch (error) {
                reqInsHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70204', 'Error in CheckAtmtExistence', error);
            }

        });

    } catch (error) {
        reqInsHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70204', 'Error in CheckAtmtExistence', error);
    }

})

module.exports = router;
/********* End of Service *********/