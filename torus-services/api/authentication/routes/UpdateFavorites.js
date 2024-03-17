
/*
@Api_Name           : SaveUserAccessLog,
@Description        : To save user fav screen
@Last_Error_code    : ERR-AUT-
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
router.post('/UpdateFavorites', function (appRequest, appResponse) {
    try {
        var header = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var insertReqArr = params.INSERT_ARR || [];
        var delReqArr = params.DELETE_ARR || [];
        var serviceName = 'UpdateFavorites';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqDBInstance.GetFXDBConnection(header, 'clt_cas', objLogInfo, function (pCltSessions) {

                    mainfunction();

                    async function mainfunction() {

                        if (insertReqArr.length) {
                            var insertarr = [];
                            for (var i = 0; i < insertReqArr.length; i++) {
                                var insertobj = {};
                                insertobj.U_ID = objLogInfo.USER_ID;
                                insertobj.TENANT_ID = objLogInfo.TENANT_ID;
                                insertobj.APP_ID = objLogInfo.APP_ID;
                                insertobj.CREATED_DATE = reqDateFormater.GetTenantCurrentDateTime(header, objLogInfo);
                                insertobj.MENU_INFO = JSON.stringify(insertReqArr[i]);
                                insertobj.REFERENCE_KEY = `${insertReqArr[i].module}>${insertReqArr[i].menuGroup}>${insertReqArr[i].menuItem}`;
                                insertobj.appur_id = objSessionInfo.APP_USER_ROLES;
                                insertarr.push(insertobj);
                            }
                            var insertcall = await Insertintofavscreen(insertarr);

                        }
                        if (delReqArr.length) {
                            for (var i = 0; i < delReqArr.length; i++) {
                                var pCond = {
                                    app_id: objLogInfo.APP_ID,
                                    TENANT_ID: objLogInfo.TENANT_ID,
                                    U_ID: objLogInfo.USER_ID,
                                    REFERENCE_KEY: `${delReqArr[i].module}>${delReqArr[i].menuGroup}>${delReqArr[i].menuItem}`
                                };

                                var delCal = await deletefromfavscreen(pCond);
                            }
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                        }
                    }

                    function Insertintofavscreen(pinsertArr) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqDBInstance.InsertFXDB(pCltSessions, 'USER_FAVORITE_MENU', pinsertArr, objLogInfo, function (pErr, pResult) {
                                    if (pErr) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17132', 'Error occured while insert access log', pErr);
                                    } else {
                                        // reqInstanceHelper.SendResponse("SUCCESS", appResponse, 'SUCCESS', objLogInfo, "", "", "", "SUCCESS");
                                        resolve("SUCCESS");
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17131', 'Exception occured while GetUserpreferedsettings', error);
                            }
                        });
                    }

                    function deletefromfavscreen(pCond) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqDBInstance.DeleteFXDB(pCltSessions, 'USER_FAVORITE_MENU', pCond, objLogInfo, function (pErr, pResult) {
                                    if (pErr) {
                                        reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Error occured while insert access log ", pErr);
                                    } else {
                                        // reqInstanceHelper.SendResponse("SUCCESS", appResponse, 'SUCCESS', objLogInfo, "", "", "", "SUCCESS");
                                        resolve("SUCCESS");
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17133', 'Exception occured while GetUserpreferedsettings', error);
                            }
                        });
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17134', 'Exception occured', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17135', 'Exception occured', error);
    }
});

module.exports = router;