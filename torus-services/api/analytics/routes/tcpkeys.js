/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/tcpkeys', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'tcpkeys-Analytics';
        objLogInfo.ACTION = 'tcpkeys';

        try {
            reqInstanceHelper.GetConfig('TCP_URL', function callbackGetKey(pConfig) {
                try {
                    return reqInstanceHelper.SendResponse('TcpKeys', appResp, JSON.parse(pConfig), objLogInfo, null, '', null, 'SUCCESS', '')
                } catch (error) {
                    return reqInstanceHelper.SendResponse('TcpKeys', appResp, {}, objLogInfo, null, '', error, 'FAILURE', '')
                }
            })


        } catch (error) {
            return reqInstanceHelper.SendResponse('TcpKeys', appResp, {}, objLogInfo, null, '', error, 'FAILURE', '')
        }
    })



    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;