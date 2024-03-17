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
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/createsupersetuser', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'createsupersetuser-Analytics';
        objLogInfo.ACTION = 'createsupersetuser';
        var strHeader = appReq.headers;


        var params = appReq.body.PARAMS;
        var email = params.EMAIL_ID;
        var first_name = params.FIRST_NAME;
        var last_name = params.LAST_NAME;
        var login_name = params.LOGIN_NAME;

        strHeader = { 'routingkey': 'SUPERSET' };

        var query = "select *from ab_user order by id desc LIMIT 1;";
        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {

            reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                if (err) {
                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null, objLogInfo);
                }
                else {
                    console.log(JSON.stringify(res.rows));


                    reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {

                        try {

                            appResp.setHeader('Content-Type', 'application/json');
                            // Initialize local variables
                            // var params = appReq.body.PARAMS;
                            // var email = params.EMAIL_ID;
                            // var first_name = params.FIRST_NAME;
                            // var last_name = params.LAST_NAME;
                            // var password = res.rows[0].password;
                            // var password_salt = res.rows[0].password_salt;
                            // var date_joined = res.rows[0].date_joined;
                            // var last_login = res.rows[0].last_login;
                            // var is_superuser = false;



                            reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                                var dt = reqDateFormatter.GetCurrentDateInUTC(strHeader, objLogInfo);
                                reqTranDBInstance.InsertTranDBWithAudit(pSession, 'ab_user', [{
                                    id: res.rows[0].id + 1,
                                    first_name: first_name,
                                    last_name: last_name,
                                    username: login_name.toUpperCase(),
                                    password: res.rows[0].password,
                                    active: true,
                                    email: email,
                                    created_on: dt,
                                    changed_on: dt,
                                    created_by_fk: 1,
                                    changed_by_fk: 1
                                }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                    if (pError) {
                                        console.log(pError);
                                        _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                                    }

                                    else {

                                        console.log(JSON.stringify(pResult));
                                        console.log(JSON.stringify(pResult));
                                        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                                            var query1 = "select *from ab_user_role order by id desc LIMIT 1";
                                            reqTranDBInstance.ExecuteSQLQuery(pSession, query1, objLogInfo, function callback(res, err) {
                                                if (err) {
                                                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null, objLogInfo);
                                                }
                                                else {
                                                    console.log(JSON.stringify(res.rows));
                                                    reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                                                        var dt = reqDateFormatter.GetCurrentDateInUTC(strHeader, objLogInfo);
                                                        reqTranDBInstance.InsertTranDBWithAudit(pSession, 'ab_user_role', [{
                                                            id: res.rows[0].id + 1,
                                                            user_id: pResult[0].id,
                                                            role_id: 3
                                                        }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                                            if (pError) {
                                                                console.log(pError);
                                                                _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                                                            }

                                                            else {
                                                                _SendResponse(pResult, '', '', null, null);
                                                            }


                                                        });
                                                    });


                                                }
                                            });
                                        });




                                    }


                                });
                            });


                        } catch (error) {
                            errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error);
                        }

                    });




                }
            });



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