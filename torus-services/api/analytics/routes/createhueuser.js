/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/';
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/createhueuser', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'createhueuser-Analytics';
        objLogInfo.ACTION = 'createhueuser';
        var strHeader = {};


        var params = appReq.body.PARAMS;
        var email = params.EMAIL_ID;
        var first_name = params.FIRST_NAME;
        var last_name = params.LAST_NAME;
        var login_name = params.LOGIN_NAME;

        strHeader = { 'routingkey': 'hue' };

        var query = "select *from auth_user order by id ASC limit 1";
        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
            try {
                reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                    if (err) {
                        _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null, objLogInfo);
                    }
                    else {
                        console.log(JSON.stringify(res.rows));



                        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                            var dt = reqDateFormatter.GetCurrentDateInUTC(strHeader, objLogInfo);
                            reqTranDBInstance.InsertTranDBWithAudit(pSession, 'auth_user', [{
                                password: res.rows[0].password,
                                last_login: dt,
                                is_superuser: false,
                                username: login_name,
                                first_name: '',
                                last_name: '',
                                email: '',
                                is_staff: false,
                                is_active: true,
                                date_joined: dt
                            }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                if (pError) {
                                    console.log(pError);
                                    _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                                }

                                else {
                                    _SendResponse('SUCCESS', '', '', null, null);

                                }


                            });
                        });

                    }

                });
            }
            catch (error) {
                errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error);
            }


        });






    });
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning, pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
        return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
    }

    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});

module.exports = router;