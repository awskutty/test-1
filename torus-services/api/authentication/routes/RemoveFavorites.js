
/*
@Api_Name           : SaveUserAccessLog,
@Description        : To RemoveFavorites screen 
@Last_Error_code    : ERR-AUT-
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
router.post('/RemoveFavorites', function (appRequest, appResponse) {
    try {
        var header = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var serviceName = 'RemoveFavorites';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqDBInstance.GetFXDBConnection(header, 'clt_cas', objLogInfo, function (pCltSessions) {

                    mainfunction();
                    _PrintInfo('mainfunction called');
                    async function mainfunction() {
                        var pCond = {
                            app_id: objLogInfo.APP_ID,
                            TENANT_ID: objLogInfo.TENANT_ID,
                            U_ID: objLogInfo.USER_ID,
                            REFERENCE_KEY: `${params.module}>${params.menuGroup}>${params.menuItem}`
                        };
                        DeletefromTable(pCond);
                    }

                    function DeletefromTable(pCond) {
                        try {
                            _PrintInfo('Goign to remove the favorite screen');
                            reqDBInstance.DeleteFXDB(pCltSessions, 'USER_FAVORITE_MENU', pCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Error occured while insert access log ", pErr);
                                } else {
                                    _PrintInfo('Fav screen removed successfully.');
                                    reqInstanceHelper.SendResponse("SUCCESS", appResponse, 'SUCCESS', objLogInfo, "", "", "", "SUCCESS");
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Exception occured while GetUserpreferedsettings ", error);
                        }
                    }

                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                    }

                });
            } catch (error) {
                reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Exception occured ", error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse("FAILURE", '', '', '', "ERR-AUT-14705", "Exception occured ", error);
    }
});

module.exports = router;